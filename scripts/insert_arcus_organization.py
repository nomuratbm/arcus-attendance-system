#!/usr/bin/env python3
"""Insert the canonical AWS Student Builder Group — Arcus organization."""

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


ORGANIZATION_ID = "d0f409ec-9be8-4387-b814-8a5eed2cac8a"
ORGANIZATION_NAME = "AWS Student Builder Group — Arcus"
NORMALIZED_ORGANIZATION_NAME = "aws student builder group — arcus"
ORGANIZATION_KEY = f"ORGANIZATION#{ORGANIZATION_ID}"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Insert the canonical Arcus organization into DynamoDB."
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


def create_client(args: argparse.Namespace) -> Any:
    session = boto3.Session(
        profile_name=args.profile,
        region_name=args.region or os.getenv("AWS_REGION") or None,
    )
    return session.client(
        "dynamodb",
        config=Config(retries={"max_attempts": 10, "mode": "adaptive"}),
    )


def organization_item() -> dict[str, dict[str, str]]:
    return {
        "PK": {"S": ORGANIZATION_KEY},
        "SK": {"S": ORGANIZATION_KEY},
        "GSI4PK": {"S": "ORGANIZATION"},
        "GSI4SK": {
            "S": f"{NORMALIZED_ORGANIZATION_NAME}#{ORGANIZATION_ID}"
        },
        "organization_id": {"S": ORGANIZATION_ID},
        "org_name": {"S": ORGANIZATION_NAME},
        "normalized_org_name": {"S": NORMALIZED_ORGANIZATION_NAME},
    }


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
        table = client.describe_table(TableName=table_name)["Table"]
        key_schema = {
            key["AttributeName"]: key["KeyType"] for key in table["KeySchema"]
        }
        if key_schema.get("PK") != "HASH" or key_schema.get("SK") != "RANGE":
            raise RuntimeError(
                "The table must use PK as its partition key and SK as its sort key."
            )

        expected_item = organization_item()
        client.put_item(
            TableName=table_name,
            Item=expected_item,
            ConditionExpression=(
                "attribute_not_exists(PK) OR organization_id = :organization_id"
            ),
            ExpressionAttributeValues={
                ":organization_id": {"S": ORGANIZATION_ID}
            },
        )

        result = client.get_item(
            TableName=table_name,
            Key={
                "PK": {"S": ORGANIZATION_KEY},
                "SK": {"S": ORGANIZATION_KEY},
            },
            ConsistentRead=True,
        )
        if result.get("Item") != expected_item:
            raise RuntimeError("The organization did not match after insertion.")
    except (BotoCoreError, ClientError, RuntimeError) as error:
        print(f"Could not insert the Arcus organization: {error}", file=sys.stderr)
        return 1

    print(f"Inserted Arcus organization into {table_name}.")
    print(f"Organization ID: {ORGANIZATION_ID}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
