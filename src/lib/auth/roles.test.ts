import assert from "node:assert/strict";
import test from "node:test";
import {
  isOrganizationAccount,
  isScannerOperator,
  landingPath,
} from "./roles.ts";

const ADMIN_GROUPS = ["admin", "org_submitter"];

test("an organization-claim account is a scanner operator", () => {
  const claims = { organizationId: "d0f409ec-9be8-4387-b814-8a5eed2cac8a", groups: [] };
  assert.equal(isScannerOperator(claims, ADMIN_GROUPS), true);
  assert.equal(isOrganizationAccount(claims), true);
  assert.equal(landingPath(claims, ADMIN_GROUPS), "/scanner");
});

test("an admin-group member without a claim still operates the scanner", () => {
  const claims = { organizationId: null, groups: ["org_submitter"] };
  assert.equal(isScannerOperator(claims, ADMIN_GROUPS), true);
  assert.equal(isOrganizationAccount(claims), false);
  assert.equal(landingPath(claims, ADMIN_GROUPS), "/scanner");
});

test("a claim-less, group-less user is a scanee who lands on the form", () => {
  const claims = { organizationId: null, groups: [] };
  assert.equal(isScannerOperator(claims, ADMIN_GROUPS), false);
  assert.equal(isOrganizationAccount(claims), false);
  assert.equal(landingPath(claims, ADMIN_GROUPS), "/");
});

test("a blank organization id does not count as a claim", () => {
  const claims = { organizationId: "   ", groups: [] };
  assert.equal(isScannerOperator(claims, ADMIN_GROUPS), false);
  assert.equal(isOrganizationAccount(claims), false);
});

test("missing groups and organization fields are tolerated", () => {
  assert.equal(isScannerOperator({}, ADMIN_GROUPS), false);
  assert.equal(landingPath({}, ADMIN_GROUPS), "/");
});
