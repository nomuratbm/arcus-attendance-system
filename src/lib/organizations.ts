export type OrganizationOption = {
  label: string;
  value: string;
};

export const NO_ORGANIZATION_VALUE = "__none__";
export const noOrganizationOption: OrganizationOption = {
  label: "No organization",
  value: NO_ORGANIZATION_VALUE,
};

export const ADD_ORGANIZATIONS_VALUE = "__add__";
export const addOrganizationsOption: OrganizationOption = {
  label: "Add organizations",
  value: ADD_ORGANIZATIONS_VALUE,
};

export function isOrganizationOption(
  value: unknown,
): value is OrganizationOption {
  return (
    typeof value === "object" &&
    value !== null &&
    "label" in value &&
    typeof value.label === "string" &&
    Boolean(value.label.trim()) &&
    "value" in value &&
    typeof value.value === "string" &&
    Boolean(value.value.trim())
  );
}

export function parseOrganizationOptions(value: unknown): OrganizationOption[] {
  if (
    typeof value !== "object" ||
    value === null ||
    !("organizations" in value) ||
    !Array.isArray(value.organizations)
  ) {
    throw new Error("The server returned invalid organization data.");
  }

  if (!value.organizations.every(isOrganizationOption)) {
    throw new Error("The server returned invalid organization data.");
  }

  return value.organizations.map(({ label, value: organizationId }) => ({
      label,
      value: organizationId,
    }));
}
