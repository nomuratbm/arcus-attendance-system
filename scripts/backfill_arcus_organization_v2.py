#!/usr/bin/env python3
"""Backfill every Member into the AWS SBG Arcus organization.

The script is idempotent. By default it only reports what it would change.
Pass --apply to write:

The Arcus Organization master item must already exist. The script writes:

1. current_organization on every Member master item.
2. One Organization Member relationship for every Member.

AWS credentials, region, and DYNAMODB_TABLE_NAME are read from the process
environment or the project .env file. They can also be supplied with flags.
"""

from __future__ import annotations

import argparse
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

try:
    import boto3
    from botocore.config import Config
    from botocore.exceptions import BotoCoreError, ClientError
except ImportError:
    print("boto3 is required. Install it with: pip install boto3", file=sys.stderr)
    raise SystemExit(2)


DEFAULT_ORGANIZATION_ID = "d0f409ec-9be8-4387-b814-8a5eed2cac8a"
MEMBER_PREFIX = "MEMBER#"
ORGANIZATION_PREFIX = "ORGANIZATION#"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Backfill all DynamoDB members into AWS SBG Arcus."
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
        "--organization-id",
        default=DEFAULT_ORGANIZATION_ID,
        help=f"Arcus organization UUID (default: {DEFAULT_ORGANIZATION_ID}).",
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


def string_attribute(item: dict[str, Any], name: str) -> str:
    value = item.get(name)
    if isinstance(value, dict) and isinstance(value.get("S"), str):
        return value["S"]
    return ""


def create_client(args: argparse.Namespace) -> Any:
    session = boto3.Session(
        profile_name=args.profile,
        region_name=args.region or os.getenv("AWS_REGION") or None,
    )
    return session.client(
        "dynamodb",
        config=Config(
            retries={"max_attempts": 10, "mode": "adaptive"},
        ),
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


def scan_members(client: Any, table_name: str) -> list[dict[str, str]]:
    members: list[dict[str, str]] = []
    scan_kwargs: dict[str, Any] = {
        "TableName": table_name,
        "FilterExpression": "begins_with(#pk, :member) AND #pk = #sk",
        "ExpressionAttributeNames": {"#pk": "PK", "#sk": "SK"},
        "ExpressionAttributeValues": {":member": {"S": MEMBER_PREFIX}},
        "ProjectionExpression": "#pk, #sk, student_id, current_organization",
    }

    while True:
        response = client.scan(**scan_kwargs)
        for item in response.get("Items", []):
            member_key = string_attribute(item, "PK")
            if not member_key:
                continue
            student_id = string_attribute(item, "student_id")
            if not student_id:
                student_id = member_key.removeprefix(MEMBER_PREFIX)
            members.append(
                {
                    "member_key": member_key,
                    "student_id": student_id,
                    "current_organization": string_attribute(
                        item, "current_organization"
                    ),
                }
            )

        last_key = response.get("LastEvaluatedKey")
        if not last_key:
            break
        scan_kwargs["ExclusiveStartKey"] = last_key

    return members


def validate_organization(
    client: Any,
    table_name: str,
    organization_id: str,
) -> str:
    organization_key = f"{ORGANIZATION_PREFIX}{organization_id}"
    result = client.get_item(
        TableName=table_name,
        Key={
            "PK": {"S": organization_key},
            "SK": {"S": organization_key},
        },
        ConsistentRead=True,
        ProjectionExpression="PK, SK, organization_id, org_name",
    )
    item = result.get("Item")
    if not isinstance(item, dict):
        raise RuntimeError(
            f"Organization {organization_id} does not exist. Create it before running the backfill."
        )
    stored_id = string_attribute(item, "organization_id")
    if stored_id != organization_id:
        raise RuntimeError(
            f"Organization item has organization_id {stored_id!r}; expected {organization_id!r}."
        )
    return string_attribute(item, "org_name") or organization_id


def backfill_member(
    client: Any,
    table_name: str,
    member: dict[str, str],
    organization_id: str,
) -> None:
    member_key = member["member_key"]
    student_id = member["student_id"]
    organization_key = f"{ORGANIZATION_PREFIX}{organization_id}"
    client.transact_write_items(
        TransactItems=[
            {
                "ConditionCheck": {
                    "TableName": table_name,
                    "Key": {
                        "PK": {"S": organization_key},
                        "SK": {"S": organization_key},
                    },
                    "ConditionExpression": (
                        "attribute_exists(PK) AND attribute_exists(SK)"
                    ),
                }
            },
            {
                "Update": {
                    "TableName": table_name,
                    "Key": {
                        "PK": {"S": member_key},
                        "SK": {"S": member_key},
                    },
                    "UpdateExpression": "SET current_organization = :organization",
                    "ConditionExpression": (
                        "attribute_exists(PK) AND attribute_exists(SK)"
                    ),
                    "ExpressionAttributeValues": {
                        ":organization": {"S": organization_id}
                    },
                }
            },
            {
                "Update": {
                    "TableName": table_name,
                    "Key": {
                        "PK": {"S": organization_key},
                        "SK": {"S": member_key},
                    },
                    "UpdateExpression": (
                        "SET organization_id = :organization, "
                        "student_id = :student_id"
                    ),
                    "ExpressionAttributeValues": {
                        ":organization": {"S": organization_id},
                        ":student_id": {"S": student_id},
                    },
                }
            },
        ]
    )


def apply_backfill(
    client: Any,
    table_name: str,
    members: list[dict[str, str]],
    organization_id: str,
    workers: int,
) -> list[tuple[str, str]]:
    failures: list[tuple[str, str]] = []
    with ThreadPoolExecutor(max_workers=workers) as executor:
        future_to_member = {
            executor.submit(
                backfill_member,
                client,
                table_name,
                member,
                organization_id,
            ): member
            for member in members
        }
        completed = 0
        for future in as_completed(future_to_member):
            member = future_to_member[future]
            completed += 1
            try:
                future.result()
            except (BotoCoreError, ClientError, RuntimeError) as error:
                failures.append((member["student_id"], str(error)))
            if completed % 100 == 0 or completed == len(members):
                print(f"Updated {completed}/{len(members)} members")
    return failures


def main() -> int:
    load_project_env()
    args = parse_args()
    table_name = args.table_name or os.getenv("DYNAMODB_TABLE_NAME", "").strip()
    organization_id = args.organization_id.strip()

    if not table_name:
        print(
            "DYNAMODB_TABLE_NAME is required in .env, the environment, "
            "or --table-name.",
            file=sys.stderr,
        )
        return 2
    if not organization_id:
        print("Organization ID cannot be empty.", file=sys.stderr)
        return 2
    if args.workers < 1 or args.workers > 25:
        print("--workers must be between 1 and 25.", file=sys.stderr)
        return 2

    try:
        client = create_client(args)
        validate_table(client, table_name)
        organization_name = validate_organization(
            client, table_name, organization_id
        )
        members = scan_members(client, table_name)
    except (BotoCoreError, ClientError, RuntimeError) as error:
        print(f"Could not inspect the table: {error}", file=sys.stderr)
        return 1

    already_arcus = sum(
        member["current_organization"] == organization_id for member in members
    )
    print(f"Table: {table_name}")
    print(f"Organization: {organization_name} ({organization_id})")
    print(f"Member records found: {len(members)}")
    print(f"Members already using Arcus: {already_arcus}")
    print(f"Members to set or reaffirm: {len(members)}")

    if not args.apply:
        print("Dry run only. Re-run with --apply to write the backfill.")
        return 0

    failures = apply_backfill(
        client,
        table_name,
        members,
        organization_id,
        args.workers,
    )

    if failures:
        print(f"Backfill completed with {len(failures)} failure(s):", file=sys.stderr)
        for student_id, message in failures:
            print(f"- {student_id}: {message}", file=sys.stderr)
        return 1

    print("Backfill completed successfully.")
    print(
        "Ensure GSI4 exists with GSI4PK/GSI4SK and an ALL projection "
        "(or INCLUDE org_name and normalized_org_name)."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
