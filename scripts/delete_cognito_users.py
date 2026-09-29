#!/usr/bin/env python3
"""Delete every user in this project's Cognito user pool.

By default the script only lists the users it would delete, including admin
and super-admin accounts. Pass --apply to delete them.

AWS credentials, region, and COGNITO_USER_POOL_ID are read from the process
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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Delete every user in the project Cognito user pool."
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Delete users. Without this flag, the script performs a dry run.",
    )
    parser.add_argument(
        "--user-pool-id",
        help="Cognito user pool ID. Defaults to COGNITO_USER_POOL_ID.",
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


def attribute_value(user: dict[str, Any], name: str) -> str:
    for attribute in user.get("Attributes", []):
        if attribute.get("Name") == name and isinstance(attribute.get("Value"), str):
            return attribute["Value"]
    return ""


def create_client(args: argparse.Namespace) -> Any:
    session = boto3.Session(
        profile_name=args.profile,
        region_name=args.region or os.getenv("AWS_REGION") or None,
    )
    return session.client(
        "cognito-idp",
        config=Config(retries={"max_attempts": 10, "mode": "adaptive"}),
    )


def list_users(client: Any, user_pool_id: str) -> list[dict[str, str]]:
    users: list[dict[str, str]] = []
    pagination_token: str | None = None

    while True:
        request: dict[str, Any] = {"UserPoolId": user_pool_id, "Limit": 60}
        if pagination_token:
            request["PaginationToken"] = pagination_token
        response = client.list_users(**request)
        for user in response.get("Users", []):
            username = user.get("Username")
            if not isinstance(username, str) or not username:
                continue
            users.append(
                {
                    "username": username,
                    "email": attribute_value(user, "email"),
                    "sub": attribute_value(user, "sub"),
                    "status": str(user.get("UserStatus", "")),
                }
            )
        pagination_token = response.get("PaginationToken")
        if not pagination_token:
            break

    return users


def delete_users(
    client: Any,
    user_pool_id: str,
    users: list[dict[str, str]],
) -> list[tuple[str, str]]:
    failures: list[tuple[str, str]] = []
    for index, user in enumerate(users, start=1):
        username = user["username"]
        try:
            client.admin_delete_user(UserPoolId=user_pool_id, Username=username)
        except ClientError as error:
            code = error.response.get("Error", {}).get("Code", "")
            if code != "UserNotFoundException":
                failures.append((username, str(error)))
        if index % 25 == 0 or index == len(users):
            print(f"Deleted {index - len(failures)}/{len(users)} users")
    return failures


def main() -> int:
    load_project_env()
    args = parse_args()
    user_pool_id = (
        args.user_pool_id or os.getenv("COGNITO_USER_POOL_ID", "")
    ).strip()
    if not user_pool_id:
        print(
            "COGNITO_USER_POOL_ID is required in .env, the environment, "
            "or --user-pool-id.",
            file=sys.stderr,
        )
        return 2

    try:
        client = create_client(args)
        client.describe_user_pool(UserPoolId=user_pool_id)
        users = list_users(client, user_pool_id)
    except (BotoCoreError, ClientError) as error:
        print(f"Could not list Cognito users: {error}", file=sys.stderr)
        return 1

    print(f"User pool: {user_pool_id}")
    print(f"Users found: {len(users)}")
    for user in users:
        email = f" <{user['email']}>" if user["email"] else ""
        status = f" [{user['status']}]" if user["status"] else ""
        print(f"- {user['username']}{email}{status}")

    if not users:
        print("No Cognito users to delete.")
        return 0
    if not args.apply:
        print("Dry run only. Re-run with --apply to delete every listed user.")
        return 0

    try:
        failures = delete_users(client, user_pool_id, users)
    except (BotoCoreError, ClientError) as error:
        print(f"Could not delete Cognito users: {error}", file=sys.stderr)
        return 1

    if failures:
        print(f"Deletion completed with {len(failures)} failure(s):", file=sys.stderr)
        for username, message in failures:
            print(f"- {username}: {message}", file=sys.stderr)
        return 1

    print("Deleted every Cognito user in the pool.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
