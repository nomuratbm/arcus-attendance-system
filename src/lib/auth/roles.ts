/**
 * Pure, dependency-free role logic so it can be unit tested without the
 * server-only session module. A "scanner operator" is either an organization
 * account (its ID token carries a `custom:organization_id` claim) or a member
 * of one of the operator groups. Everyone else is a scanee — they register on
 * `/` and scan their own QR, and are never allowed onto `/scanner`.
 */

export type SessionClaims = {
  organizationId?: string | null;
  groups?: string[] | null;
};

/**
 * @param claims      Verified token claims for the current session.
 * @param adminGroups Group names that grant operator access even without an
 *                    organization claim (super-admin / org-submitter / admin).
 */
export function isScannerOperator(
  claims: SessionClaims,
  adminGroups: readonly string[],
): boolean {
  if (typeof claims.organizationId === "string" && claims.organizationId.trim()) {
    return true;
  }

  const groups = claims.groups ?? [];
  return adminGroups.some((group) => groups.includes(group));
}

/** An organization account is specifically the claim-bearing kind of operator. */
export function isOrganizationAccount(claims: SessionClaims): boolean {
  return typeof claims.organizationId === "string" &&
    claims.organizationId.trim().length > 0;
}

/** Where a signed-in user should land: operators scan, everyone else registers. */
export function landingPath(
  claims: SessionClaims,
  adminGroups: readonly string[],
): "/" | "/scanner" {
  return isScannerOperator(claims, adminGroups) ? "/scanner" : "/";
}
