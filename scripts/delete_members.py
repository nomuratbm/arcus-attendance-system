#!/usr/bin/env python3
"""Delete member records while preserving attendance.

By default the script only reports what it would delete. Pass --apply to
delete:

1. Member profiles, where PK and SK are both MEMBER#(student_id).
2. Cognito login links, where PK and SK are both USER#(cognito_sub).
3. Organization memberships, where PK is ORGANIZATION#(uuid) and SK is
   MEMBER#(student_id).

Attendance rows stay in place. Those have PK EVENT#(uuid) and SK
MEMBER#(student_id). Events and organization master records are also kept.

AWS credentials, region, and DYNAMODB_TABLE_NAME are read from the process
environment or the project .env file. They can also be supplied with flags.
"""

from __future__ import annotations

import argparse
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


MEMBER_PREFIX = "MEMBER#"
USER_PREFIX = "USER#"
ORGANIZATION_PREFIX = "ORGANIZATION#"
EVENT_PREFIX = "EVENT#"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Delete DynamoDB members without deleting attendance."
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Delete member records. Without this flag, the script performs a dry run.",
    )
    parser.add_argument(
        "--table-name",
        help="DynamoDB table name. Defaults to DYNAMODB_TABLE_NAME.",
    )
    parser.add_argument(
        "--region",
        help="AWS region. Defaults to AWS_REGION or the active AWS profile.",
    )
    parser.add_argument("--profile", help="Optional AWS CLI profile name.")
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


def deletion_kind(pk: str, sk: str) -> str | None:
    if pk.startswith(EVENT_PREFIX):
        return None
    if pk.startswith(MEMBER_PREFIX) and sk == pk:
        return "member profile"
    if pk.startswith(USER_PREFIX) and sk == pk:
        return "user link"
    if pk.startswith(ORGANIZATION_PREFIX) and sk.startswith(MEMBER_PREFIX):
        return "organization membership"
    return None


def scan_targets(
    client: Any,
    table_name: str,
) -> tuple[list[tuple[str, str, str]], int]:
    targets: list[tuple[str, str, str]] = []
    attendance_count = 0
    scan_kwargs: dict[str, Any] = {
        "TableName": table_name,
        "ProjectionExpression": "#pk, #sk",
        "ExpressionAttributeNames": {"#pk": "PK", "#sk": "SK"},
    }

    while True:
        response = client.scan(**scan_kwargs)
        for item in response.get("Items", []):
            pk = string_attribute(item, "PK")
            sk = string_attribute(item, "SK")
            if pk.startswith(EVENT_PREFIX) and sk.startswith(MEMBER_PREFIX):
                attendance_count += 1
                continue
            kind = deletion_kind(pk, sk)
            if kind:
                targets.append((kind, pk, sk))

        last_key = response.get("LastEvaluatedKey")
        if not last_key:
            break
        scan_kwargs["ExclusiveStartKey"] = last_key

    return targets, attendance_count


def delete_targets(
    client: Any,
    table_name: str,
    targets: list[tuple[str, str, str]],
) -> None:
    pending = [
        {
            "DeleteRequest": {
                "Key": {"PK": {"S": pk}, "SK": {"S": sk}},
            }
        }
        for _kind, pk, sk in targets
        if not pk.startswith(EVENT_PREFIX)
    ]
    total = len(pending)
    deleted = 0
    retries = 0

    while pending:
        chunk = pending[:25]
        response = client.batch_write_item(
            RequestItems={table_name: chunk}
        )
        unprocessed = response.get("UnprocessedItems", {}).get(table_name, [])
        deleted += len(chunk) - len(unprocessed)
        pending = unprocessed + pending[25:]
        if unprocessed:
            retries += 1
            if retries > 20:
                raise RuntimeError(
                    f"DynamoDB left {len(pending)} delete request(s) unprocessed."
                )
        else:
            retries = 0
        print(f"Deleted {deleted}/{total} member records")


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

    try:
        client = create_client(args)
        validate_table(client, table_name)
        targets, attendance_count = scan_targets(client, table_name)
    except (BotoCoreError, ClientError, RuntimeError) as error:
        print(f"Could not inspect the table: {error}", file=sys.stderr)
        return 1

    counts = {
        "member profile": 0,
        "user link": 0,
        "organization membership": 0,
    }
    for kind, _pk, _sk in targets:
        counts[kind] += 1

    print(f"Table: {table_name}")
    print(f"Member profiles to delete: {counts['member profile']}")
    print(f"User links to delete: {counts['user link']}")
    print(f"Organization memberships to delete: {counts['organization membership']}")
    print(f"Attendance records preserved: {attendance_count}")
    for kind, pk, sk in targets:
        print(f"- {kind}: PK={pk} SK={sk}")

    if not targets:
        print("No member records to delete.")
        return 0
    if not args.apply:
        print("Dry run only. Re-run with --apply to delete the listed records.")
        return 0

    try:
        delete_targets(client, table_name, targets)
    except (BotoCoreError, ClientError, RuntimeError) as error:
        print(f"Could not delete member records: {error}", file=sys.stderr)
        return 1

    print("Member deletion completed. Attendance records were not deleted.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
