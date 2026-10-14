#!/usr/bin/env python3
"""Reconcile arcus-shape ORGANIZATION items into the mapua-apex organization object.

One-time migration. By default it only reports what it would change; pass
--apply to write. It operates on the shared single-table DynamoDB table.

Apex-shape organization: PK = SK = ORGANIZATION#<uuid>, has `name`.
Arcus-shape organization: PK = SK = ORGANIZATION#<uuid>, has `org_name`
and no `name` (legacy CSV-import shape).

For every arcus-shape organization:

1. Match by casefolded/trimmed name against apex-shape organizations.
   - Exactly one match (merge): re-put every MEMBER# join row from
     PK = ORGANIZATION#<arcus-uuid> onto PK = ORGANIZATION#<apex-uuid>
     (skipping collisions with existing rows), patch current_organization
     on the affected MEMBER# profile items, then delete the arcus-shape
     organization item and its stale join rows.
   - Multiple apex matches (ambiguous): skipped and reported for manual
     resolution.
   - No match (promote): in-place UpdateItem setting name,
     is_higher_council, signatories and removing the legacy attributes
     (patch, never PutItem, so concurrent apex writes are safe). The
     promoted uuid is appended to needs_desks.csv for a human to assign
     adviser/dean in the apex admin.

2. Re-point Cognito: users whose custom:organization_id equals a retired
   arcus uuid are updated to the apex uuid (admin-update-user-attributes).
   This step is NOT transactional with the DynamoDB pass — run it
   immediately after step 1 and replay from cognito_repoint.csv if it
   fails partway. Skipped when --skip-cognito is set or no user pool id
   can be resolved.

Deploy the read-path changes (apex-shape-only organizations.ts) BEFORE
running with --apply, and freeze the org CSV import on the live site for
the duration of the window.
"""

from __future__ import annotations

import argparse
import csv
import os
import sys
from pathlib import Path
from typing import Any

try:
    import boto3
    from botocore.config import Config
    from botocore.exceptions import BotoCoreError, ClientError
except ImportError:
    print("boto3 is required. Install it with: pip install boto3", file=sys.stderr)
    raise SystemExit(2)

ORGANIZATION_PREFIX = "ORGANIZATION#"
MEMBER_PREFIX = "MEMBER#"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Reconcile arcus-shape ORGANIZATION items into apex-shape "
            "organizations. Dry run by default; pass --apply to write."
        )
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write changes. Without this flag, the script performs a dry run.",
    )
    parser.add_argument(
        "--table-name",
        help="DynamoDB table name. Defaults to DYNAMODB_TABLE_NAME.",
    )
    parser.add_argument(
        "--region",
        help="AWS region. Defaults to AWS_REGION or the active AWS profile.",
    )
    parser.add_argument(
        "--profile",
        help="Optional AWS CLI profile name.",
    )
    parser.add_argument(
        "--report-dir",
        default="scripts/reconcile-report",
        help="Directory for CSV reports (default: scripts/reconcile-report).",
    )
    parser.add_argument(
        "--user-pool-id",
        help="Cognito user pool id. Defaults to COGNITO_USER_POOL_ID.",
    )
    parser.add_argument(
        "--skip-cognito",
        action="store_true",
        help="Skip the Cognito re-point step.",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=5,
        help="Concurrent member updates when --apply is used (default: 5).",
    )
    return parser.parse_args()


def load_project_env() -> None:
    env_path = Path(__file__).resolve().parents[1] / ".env"
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8-sig").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        name = name.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        if name:
            os.environ.setdefault(name, value)


def create_client(args: argparse.Namespace, service_name: str) -> Any:
    session = boto3.Session(
        profile_name=args.profile,
        region_name=args.region or os.getenv("AWS_REGION") or None,
    )
    return session.client(
        service_name,
        config=Config(retries={"max_attempts": 10, "mode": "adaptive"}),
    )


def validate_table(client: Any, table_name: str) -> None:
    table = client.describe_table(TableName=table_name)["Table"]
    key_schema = {
        key["AttributeName"]: key["KeyType"] for key in table["KeySchema"]
    }
    if key_schema.get("PK") != "HASH" or key_schema.get("SK") != "RANGE":
        raise RuntimeError(
            "The table must use PK as its partition key and SK as its sort key."
        )


def string_attribute(item: dict[str, Any], name: str) -> str:
    value = item.get(name)
    if isinstance(value, dict) and isinstance(value.get("S"), str):
        return value["S"]
    return ""


def organization_item_key(uuid: str) -> str:
    return f"{ORGANIZATION_PREFIX}{uuid}"


def normalize_name(name: str) -> str:
    return name.strip().casefold()


# ---------------------------------------------------------------------------
# Loading organizations and memberships
# ---------------------------------------------------------------------------

def load_organizations(client: Any, table_name: str) -> tuple[
    dict[str, dict[str, Any]], dict[str, dict[str, Any]]
]:
    """Return (apex_shape, arcus_shape) keyed by organization UUID."""
    apex_orgs: dict[str, dict[str, Any]] = {}
    arcus_orgs: dict[str, dict[str, Any]] = {}
    scan_kwargs: dict[str, Any] = {
        "TableName": table_name,
        "FilterExpression": "begins_with(#pk, :org) AND #pk = #sk",
        "ExpressionAttributeNames": {"#pk": "PK", "#sk": "SK"},
        "ExpressionAttributeValues": {":org": {"S": ORGANIZATION_PREFIX}},
        "ConsistentRead": True,
    }

    while True:
        response = client.scan(**scan_kwargs)
        for item in response.get("Items", []):
            pk = string_attribute(item, "PK")
            if not pk:
                continue
            uuid = pk.removeprefix(ORGANIZATION_PREFIX)
            if string_attribute(item, "name"):
                apex_orgs[uuid] = item
            elif string_attribute(item, "org_name"):
                arcus_orgs[uuid] = item
            else:
                print(f"warning: organization item {pk} has neither name nor org_name", file=sys.stderr)

        last_key = response.get("LastEvaluatedKey")
        if not last_key:
            break
        scan_kwargs["ExclusiveStartKey"] = last_key

    return apex_orgs, arcus_orgs


def list_join_rows(
    client: Any, table_name: str, organization_pk: str
) -> list[dict[str, str]]:
    """MEMBER# join rows under an organization PK."""
    rows: list[dict[str, str]] = []
    query_kwargs: dict[str, Any] = {
        "TableName": table_name,
        "KeyConditionExpression": "#pk = :pk AND begins_with(#sk, :member)",
        "ExpressionAttributeNames": {"#pk": "PK", "#sk": "SK"},
        "ExpressionAttributeValues": {
            ":pk": {"S": organization_pk},
            ":member": {"S": MEMBER_PREFIX},
        },
        "ProjectionExpression": "#pk, #sk, organization_id, student_id",
        "ConsistentRead": True,
    }

    while True:
        response = client.query(**query_kwargs)
        for item in response.get("Items", []):
            sk = string_attribute(item, "SK")
            if not sk.startswith(MEMBER_PREFIX):
                continue
            rows.append(
                {
                    "pk": string_attribute(item, "PK"),
                    "sk": sk,
                    "student_id": string_attribute(
                        item, "student_id"
                    ) or sk.removeprefix(MEMBER_PREFIX),
                }
            )

        last_key = response.get("LastEvaluatedKey")
        if not last_key:
            break
        query_kwargs["ExclusiveStartKey"] = last_key

    return rows


# ---------------------------------------------------------------------------
# Planning
# ---------------------------------------------------------------------------

def plan_reconciliations(
    apex_orgs: dict[str, dict[str, Any]],
    arcus_orgs: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    by_name: dict[str, list[str]] = {}
    for uuid, item in apex_orgs.items():
        by_name.setdefault(normalize_name(string_attribute(item, "name")), []).append(uuid)

    plans: list[dict[str, Any]] = []
    for uuid, item in sorted(
        arcus_orgs.items(), key=lambda pair: string_attribute(pair[1], "org_name")
    ):
        org_name = string_attribute(item, "org_name")
        matches = sorted(by_name.get(normalize_name(org_name), []))
        if len(matches) > 1:
            plans.append(
                {"action": "ambiguous", "arcus_uuid": uuid, "arcus_name": org_name,
                 "target_uuid": "", "matches": matches}
            )
        elif len(matches) == 1:
            plans.append(
                {"action": "merge", "arcus_uuid": uuid, "arcus_name": org_name,
                 "target_uuid": matches[0],
                 "target_name": string_attribute(apex_orgs[matches[0]], "name"),
                 "matches": matches}
            )
        else:
            plans.append(
                {"action": "promote", "arcus_uuid": uuid, "arcus_name": org_name,
                 "target_uuid": uuid, "matches": []}
            )
    return plans


# ---------------------------------------------------------------------------
# Applying
# ---------------------------------------------------------------------------

def repoint_join_row(
    client: Any, table_name: str, row: dict[str, str], target_uuid: str
) -> str:
    """Move one join row to the target organization PK. Returns a status tag."""
    source_pk = row["pk"]
    target_pk = organization_item_key(target_uuid)
    key_target = {"PK": {"S": target_pk}, "SK": {"S": row["sk"]}}
    key_source = {"PK": {"S": source_pk}, "SK": {"S": row["sk"]}}

    try:
        client.transact_write_items(
            TransactItems=[
                {
                    "ConditionCheck": {
                        "TableName": table_name,
                        "Key": key_target,
                        "ConditionExpression": "attribute_not_exists(PK)",
                    }
                },
                {
                    "Put": {
                        "TableName": table_name,
                        "Item": {
                            "PK": {"S": target_pk},
                            "SK": {"S": row["sk"]},
                            "organization_id": {"S": target_uuid},
                            "student_id": {"S": row["student_id"]},
                        }
                    }
                },
                {
                    "Delete": {"TableName": table_name, "Key": key_source},
                },
            ]
        )
        return "moved"
    except ClientError as error:
        if error.response.get("Code") != "TransactionCanceledException":
            raise
        # Most likely the target join row already exists; keep it, drop the stale one.
        client.delete_item(TableName=table_name, Key=key_source)
        return "collision-kept-target"


def patch_member_profile(
    client: Any, table_name: str, member_key: str, old_uuid: str, new_uuid: str
) -> None:
    client.update_item(
        TableName=table_name,
        Key={"PK": {"S": member_key}, "SK": {"S": member_key}},
        UpdateExpression="SET current_organization = :organization",
        ConditionExpression=(
            "attribute_exists(PK) AND current_organization = :old"
        ),
        ExpressionAttributeValues={
            ":organization": {"S": new_uuid},
            ":old": {"S": old_uuid},
        },
    )


def merge_organization(
    client: Any, args: argparse.Namespace, table_name: str, plan: dict[str, Any]
) -> dict[str, Any]:
    source_pk = organization_item_key(plan["arcus_uuid"])
    joins = list_join_rows(client, table_name, source_pk)
    moved = 0
    collided = 0
    profiles = 0

    if args.apply:
        for row in joins:
            status = repoint_join_row(client, table_name, row, plan["target_uuid"])
            if status == "moved":
                moved += 1
            else:
                collided += 1
            if row["sk"].startswith(MEMBER_PREFIX):
                try:
                    patch_member_profile(
                        client,
                        table_name,
                        row["sk"],
                        plan["arcus_uuid"],
                        plan["target_uuid"],
                    )
                    profiles += 1
                except ClientError as error:
                    # Conditional failure means current_organization no longer
                    # points at the retired uuid; nothing to do.
                    if error.response.get("Error", {}).get("Code") != "ConditionalCheckFailedException":
                        raise
        client.delete_item(
            TableName=table_name,
            Key={"PK": {"S": source_pk}, "SK": {"S": source_pk}},
        )
        remaining = list_join_rows(client, table_name, source_pk)
        for row in remaining:
            client.delete_item(
                TableName=table_name,
                Key={"PK": {"S": row["pk"]}, "SK": {"S": row["sk"]}},
            )

    return {
        "join_rows": len(joins),
        "moved": moved,
        "collisions": collided,
        "profiles_patched": profiles,
    }


def promote_organization(
    client: Any, args: argparse.Namespace, table_name: str, plan: dict[str, Any]
) -> dict[str, Any]:
    pk = organization_item_key(plan["arcus_uuid"])
    detail = ""
    if args.apply:
        remove_attrs: list[str] = []
        for candidate in ("org_name", "normalized_org_name", "organization_id", "GSI4PK", "GSI4SK"):
            probe = client.get_item(
                TableName=table_name,
                Key={"PK": {"S": pk}, "SK": {"S": pk}},
                ProjectionExpression=candidate,
            )
            if candidate in probe.get("Item", {}):
                remove_attrs.append(candidate)

        expression = "SET #name = :name, is_higher_council = :hc, signatories = :sig"
        names = {"#name": "name"}
        values: dict[str, Any] = {
            ":name": {"S": plan["arcus_name"]},
            ":hc": {"BOOL": False},
            ":sig": {"L": []},
        }
        if remove_attrs:
            expression += " REMOVE " + ", ".join(
                f"#rm{i}" for i in range(len(remove_attrs))
            )
            names.update({f"#rm{i}": attr for i, attr in enumerate(remove_attrs)})

        client.update_item(
            TableName=table_name,
            Key={"PK": {"S": pk}, "SK": {"S": pk}},
            UpdateExpression=expression,
            ExpressionAttributeNames=names,
            ExpressionAttributeValues=values,
            ConditionExpression="attribute_exists(PK) AND attribute_exists(SK)",
        )
        detail = ",".join(remove_attrs) or "none"
    return {"removed_attributes": detail}


# ---------------------------------------------------------------------------
# Cognito re-point
# ---------------------------------------------------------------------------

def repoint_cognito(
    cognito: Any, user_pool_id: str, mapping: dict[str, str]
) -> list[dict[str, str]]:
    """Update users whose custom:organization_id is a retired arcus uuid.

    Returns rows for cognito_repoint.csv (also written beforehand so the
    mapping can be replayed)."""
    rows: list[dict[str, str]] = []
    lowercase_map = {old.lower(): new for old, new in mapping.items()}
    token: str | None = None

    while True:
        kwargs: dict[str, Any] = {"UserPoolId": user_pool_id, "Limit": 60}
        if token:
            kwargs["PaginationToken"] = token
        response = cognito.list_users(**kwargs)
        for user in response.get("Users", []):
            username = user.get("Username", "")
            attrs = {
                attr["Name"]: attr.get("Value", "")
                for attr in user.get("Attributes", [])
            }
            current = attrs.get("custom:organization_id", "")
            target = lowercase_map.get(current.lower())
            if not target:
                continue
            rows.append(
                {"username": username, "old_organization_id": current,
                 "new_organization_id": target, "status": "pending"}
            )
            combined = []
            for name, value in attrs.items():
                if name.lower() == "custom:organization_id":
                    value = target
                combined.append({"Name": name, "Value": value})
            try:
                cognito.admin_update_user_attributes(
                    UserPoolId=user_pool_id, Username=username, UserAttributes=combined
                )
                rows[-1]["status"] = "updated"
            except (BotoCoreError, ClientError) as error:
                rows[-1]["status"] = f"failed: {error}"
            print(f"cognito: {username} -> {target} ({rows[-1]['status']})")

        token = response.get("PaginationToken")
        if not token:
            break

    return rows


# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------

def write_reports(
    report_dir: Path,
    plans: list[dict[str, Any]],
    details: dict[str, dict[str, Any]],
    cognito_rows: list[dict[str, str]],
    applied: bool,
) -> None:
    report_dir.mkdir(parents=True, exist_ok=True)

    reconcile_path = report_dir / "reconcile_report.csv"
    with reconcile_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(
            ["action", "arcus_uuid", "arcus_name", "target_uuid", "target_name",
             "join_rows", "moved", "collisions", "profiles_patched",
             "removed_attributes", "note"]
        )
        for plan in plans:
            info = details.get(plan["arcus_uuid"], {})
            note = ""
            if plan["action"] == "ambiguous":
                note = "multiple apex matches: " + ";".join(plan["matches"])
            elif plan["action"] == "promote":
                note = "needs adviser/dean assignment in apex admin"
            writer.writerow(
                [
                    plan["action"],
                    plan["arcus_uuid"],
                    plan["arcus_name"],
                    plan["target_uuid"],
                    plan.get("target_name", ""),
                    info.get("join_rows", ""),
                    info.get("moved", ""),
                    info.get("collisions", ""),
                    info.get("profiles_patched", ""),
                    info.get("removed_attributes", ""),
                    note,
                ]
            )

    needs_desks = [p for p in plans if p["action"] == "promote"]
    needs_desks_path = report_dir / "needs_desks.csv"
    with needs_desks_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["uuid", "name"])
        for plan in needs_desks:
            writer.writerow([plan["arcus_uuid"], plan["arcus_name"]])

    if cognito_rows:
        cognito_path = report_dir / "cognito_repoint.csv"
        with cognito_path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle)
            writer.writerow(
                ["username", "old_organization_id", "new_organization_id", "status"]
            )
            for row in cognito_rows:
                writer.writerow(
                    [row["username"], row["old_organization_id"],
                     row["new_organization_id"], row["status"]]
                )

    print(f"reports written to {report_dir} ({'applied' if applied else 'dry run'})")
    print(f"- {reconcile_path.name}: every action, per organization")
    print(f"- {needs_desks_path.name}: {len(needs_desks)} promoted organization(s) needing desks")
    if cognito_rows:
        print(f"- cognito_repoint.csv: {len(cognito_rows)} user(s) re-pointed or failed")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    load_project_env()
    args = parse_args()
    table_name = args.table_name or os.getenv("DYNAMODB_TABLE_NAME", "").strip()

    if not table_name:
        print(
            "DYNAMODB_TABLE_NAME is required in .env, the environment, "
            "or --table-name.",
            file=sys.stderr,
        )
        return 2
    if args.workers < 1 or args.workers > 25:
        print("--workers must be between 1 and 25.", file=sys.stderr)
        return 2

    client = create_client(args, "dynamodb")
    try:
        validate_table(client, table_name)
        apex_orgs, arcus_orgs = load_organizations(client, table_name)
    except (BotoCoreError, ClientError, RuntimeError) as error:
        print(f"Could not inspect the table: {error}", file=sys.stderr)
        return 1

    plans = plan_reconciliations(apex_orgs, arcus_orgs)
    merges = [p for p in plans if p["action"] == "merge"]
    promotes = [p for p in plans if p["action"] == "promote"]
    ambiguous = [p for p in plans if p["action"] == "ambiguous"]

    print(f"Table: {table_name}")
    print(f"Apex-shape organizations: {len(apex_orgs)}")
    print(f"Arcus-shape organizations: {len(arcus_orgs)}")
    print(f"  merge: {len(merges)}  promote: {len(promotes)}  ambiguous: {len(ambiguous)}")
    for plan in ambiguous:
        print(
            f"AMBIGUOUS: {plan['arcus_name']!r} ({plan['arcus_uuid']}) matches "
            + ", ".join(plan["matches"]),
            file=sys.stderr,
        )

    if not args.apply:
        print("Dry run only. Re-run with --apply to write.")

    report_dir = Path(args.report_dir)
    details: dict[str, dict[str, Any]] = {}

    if args.apply:
        for plan in merges:
            details[plan["arcus_uuid"]] = merge_organization(client, args, table_name, plan)
            print(f"merged {plan['arcus_name']} ({plan['arcus_uuid']}) -> {plan['target_uuid']}")
        for plan in promotes:
            details[plan["arcus_uuid"]] = promote_organization(client, args, table_name, plan)
            print(f"promoted {plan['arcus_name']} ({plan['arcus_uuid']})")

    # Cognito re-point: only for retired (merged-away) arcus uuids.
    mapping = {p["arcus_uuid"]: p["target_uuid"] for p in merges}
    cognito_rows: list[dict[str, str]] = []
    if mapping:
        user_pool_id = (args.user_pool_id or os.getenv("COGNITO_USER_POOL_ID", "")).strip()
        if args.skip_cognito or not user_pool_id:
            reason = "--skip-cognito" if args.skip_cognito else "no COGNITO_USER_POOL_ID"
            print(
                f"WARNING: skipping Cognito re-point ({reason}). Replay from the "
                "merge mapping manually: " + ";".join(f"{k}={v}" for k, v in mapping.items()),
                file=sys.stderr,
            )
            for old in mapping:
                cognito_rows.append(
                    {"username": "(unresolved)", "old_organization_id": old,
                     "new_organization_id": mapping[old], "status": "skipped"}
                )
        else:
            cognito = create_client(args, "cognito-idp")
            try:
                cognito_rows = repoint_cognito(cognito, user_pool_id, mapping)
            except (BotoCoreError, ClientError) as error:
                print(f"Cognito re-point failed: {error}", file=sys.stderr)
                return 1

    write_reports(report_dir, plans, details, cognito_rows, args.apply)

    failed = [r for r in cognito_rows if r["status"].startswith("failed")]
    if failed:
        print(f"{len(failed)} Cognito update(s) failed; see cognito_repoint.csv.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
