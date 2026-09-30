#!/usr/bin/env python3
"""Raise Amazon Cognito user pool API rate limits for this project.

The limits are account-wide in one Region, not per user pool. This project's
pool is in AWS_REGION (ap-southeast-1) and uses managed login.

Two different controls apply:

- UserAuthentication and UserFederation cannot be changed with
  UpdateProvisionedLimit while the pool uses managed login. The script submits
  a Service Quotas increase for those categories. That raises the account
  ceiling. AWS approves some requests automatically.
- Other adjustable categories use a provisioned rate. The script raises the
  Service Quotas ceiling when the requested rate is above it, then calls
  UpdateProvisionedLimit up to the current ceiling. Capacity above the free
  default is billed for the time it stays provisioned.

Hosted UI domain caps are not adjustable: 300 requests per second from one
IP, 300 per app client, and 500 for the domain.

By default the script only prints the current limits and the changes it would
make. Pass --apply to submit them.

Examples:
  python scripts/increase_cognito_rate_limits.py --rps 200
  python scripts/increase_cognito_rate_limits.py --rps 200 --apply
  python scripts/increase_cognito_rate_limits.py --rps 80 --category UserToken --apply
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


# Operations this app performs: hosted UI sign-in and token refresh, sign-up,
# and refresh-token revocation.
DEFAULT_CATEGORIES = ("UserAuthentication", "UserCreation", "UserToken")

# Managed login rejects UpdateProvisionedLimit for these categories.
SERVICE_QUOTA_ONLY = frozenset({"UserAuthentication", "UserFederation"})

SERVICE_CODE = "cognito-idp"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Increase Cognito API rate limits for this project's Region."
    )
    parser.add_argument(
        "--rps",
        type=int,
        required=True,
        help="Target requests per second for each selected category.",
    )
    parser.add_argument(
        "--category",
        action="append",
        dest="categories",
        help=(
            "API category to change. Repeat for more than one. "
            f"Defaults to {', '.join(DEFAULT_CATEGORIES)}."
        ),
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Submit the quota request and provision the rate. Without this flag, the script only prints the plan.",
    )
    parser.add_argument(
        "--region",
        help="AWS region. Defaults to AWS_REGION.",
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


def limit_definition(category: str) -> dict[str, Any]:
    return {
        "LimitClass": "API_CATEGORY",
        "Attributes": {"Category": category},
    }


def find_rate_quota(quotas: list[dict[str, Any]], category: str) -> dict[str, Any] | None:
    matches = [
        quota
        for quota in quotas
        if category.lower() in str(quota.get("QuotaName", "")).lower()
        and "rate" in str(quota.get("QuotaName", "")).lower()
    ]
    if len(matches) == 1:
        return matches[0]
    if len(matches) > 1:
        adjustable = [quota for quota in matches if quota.get("Adjustable")]
        return adjustable[0] if len(adjustable) == 1 else matches[0]
    return None


def list_rate_quotas(client: Any) -> list[dict[str, Any]]:
    quotas: list[dict[str, Any]] = []
    paginator = client.get_paginator("list_service_quotas")
    for page in paginator.paginate(ServiceCode=SERVICE_CODE):
        quotas.extend(page.get("Quotas", []))
    return quotas


def current_provisioned_limit(client: Any, category: str) -> dict[str, Any] | None:
    try:
        response = client.get_provisioned_limit(LimitDefinition=limit_definition(category))
    except ClientError as error:
        code = error.response.get("Error", {}).get("Code", "")
        if code in {"UnknownOperationException", "InvalidParameterException"}:
            return None
        raise
    limit = response.get("Limit", {})
    return limit if isinstance(limit, dict) else None


def request_account_ceiling(
    client: Any,
    quota: dict[str, Any],
    desired_rps: int,
    apply: bool,
) -> None:
    quota_code = str(quota.get("QuotaCode", ""))
    quota_name = str(quota.get("QuotaName", quota_code))
    current = float(quota.get("Value", 0))
    if not quota.get("Adjustable"):
        print(f"  {quota_name} is not adjustable. It stays at {current:g} RPS.")
        return
    if desired_rps <= current:
        print(f"  Account ceiling for {quota_name} is already {current:g} RPS.")
        return

    print(
        f"  Request Service Quotas increase for {quota_name} "
        f"({quota_code}): {current:g} -> {desired_rps} RPS."
    )
    if not apply:
        return

    response = client.request_service_quota_increase(
        ServiceCode=SERVICE_CODE,
        QuotaCode=quota_code,
        DesiredValue=float(desired_rps),
    )
    requested = response.get("RequestedQuota", {})
    print(
        "  Submitted. Status: "
        f"{requested.get('Status', 'UNKNOWN')} "
        f"(id {requested.get('Id', 'unknown')})."
    )


def provision_rate(
    client: Any,
    category: str,
    desired_rps: int,
    ceiling: float,
    apply: bool,
) -> None:
    if category in SERVICE_QUOTA_ONLY:
        print(
            f"  {category} uses managed login, so UpdateProvisionedLimit cannot "
            "change it. The Service Quotas request is the increase."
        )
        return
    if desired_rps > ceiling:
        print(
            f"  Cannot provision {category} at {desired_rps} RPS until the "
            f"account ceiling ({ceiling:g} RPS) is approved."
        )
        return

    print(f"  Set provisioned {category} rate to {desired_rps} RPS.")
    if not apply:
        return

    response = client.update_provisioned_limit(
        LimitDefinition=limit_definition(category),
        RequestedLimitValue=desired_rps,
    )
    limit = response.get("Limit", {})
    print(
        "  Provisioned now: "
        f"{limit.get('ProvisionedLimitValue', desired_rps)} RPS "
        f"(free default {limit.get('FreeLimitValue', 'unknown')} RPS)."
    )


def raise_category(
    idp: Any,
    quotas_client: Any,
    quotas: list[dict[str, Any]],
    category: str,
    desired_rps: int,
    apply: bool,
) -> None:
    print(f"\n{category}")
    provisioned = current_provisioned_limit(idp, category)
    if provisioned:
        print(
            "  Provisioned: "
            f"{provisioned.get('ProvisionedLimitValue', 'unknown')} RPS; "
            f"free default: {provisioned.get('FreeLimitValue', 'unknown')} RPS."
        )
    else:
        print("  Provisioned limit is not available for this category or CLI/SDK.")

    quota = find_rate_quota(quotas, category)
    if quota is None:
        print(f"  No Service Quotas rate entry matched {category}.")
        return

    ceiling = float(quota.get("Value", 0))
    print(
        f"  Account ceiling: {ceiling:g} RPS "
        f"({quota.get('QuotaName')} / {quota.get('QuotaCode')})."
    )
    request_account_ceiling(quotas_client, quota, desired_rps, apply)
    provision_rate(idp, category, desired_rps, ceiling, apply)


def main() -> int:
    args = parse_args()
    if args.rps < 1:
        print("--rps must be at least 1.", file=sys.stderr)
        return 2

    load_project_env()
    region = args.region or os.getenv("AWS_REGION")
    if not region:
        print("Set AWS_REGION or pass --region.", file=sys.stderr)
        return 2

    categories = tuple(args.categories or DEFAULT_CATEGORIES)
    session = boto3.Session(profile_name=args.profile, region_name=region)
    config = Config(retries={"max_attempts": 10, "mode": "adaptive"})
    idp = session.client("cognito-idp", config=config)
    quotas_client = session.client("service-quotas", config=config)

    print(f"Region: {region}")
    print(f"Target: {args.rps} RPS")
    print("Mode: " + ("apply" if args.apply else "dry run"))
    print(
        "Rates above the free default are billed while they stay provisioned. "
        "Managed-login sign-in (UserAuthentication) changes only after Service "
        "Quotas approves the account ceiling."
    )

    try:
        quotas = list_rate_quotas(quotas_client)
        for category in categories:
            raise_category(idp, quotas_client, quotas, category, args.rps, args.apply)
    except (ClientError, BotoCoreError) as error:
        print(f"AWS request failed: {error}", file=sys.stderr)
        return 1

    if not args.apply:
        print("\nDry run only. Re-run with --apply to submit these changes.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
