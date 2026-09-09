"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
  ComboboxValue,
} from "@/components/ui/combobox";
import {
  NO_ORGANIZATION_VALUE,
  noOrganizationOption,
} from "@/lib/organizations";
import { useOrganizationsStore } from "@/store/useOrganizationsStore";
import { useStudentFormStore } from "@/store/useStudentFormStore";

export function OrganizationSelect() {
  const selectedIds = useStudentFormStore((state) => state.organizationIds);
  const noOrganizationSelected = useStudentFormStore(
    (state) => state.noOrganizationSelected,
  );
  const submitting = useStudentFormStore((state) => state.submitting);
  const setFormData = useStudentFormStore((state) => state.setFormData);
  const organizations = useOrganizationsStore((state) => state.organizations);
  const organizationsError = useOrganizationsStore(
    (state) => state.organizationsError,
  );
  const organizationsLoading = useOrganizationsStore(
    (state) => state.organizationsLoading,
  );
  const organizationsLoaded = useOrganizationsStore(
    (state) => state.organizationsLoaded,
  );
  const loadOrganizations = useOrganizationsStore(
    (state) => state.loadOrganizations,
  );
  const selectedOrganizations = organizations.filter((organization) =>
    selectedIds.includes(organization.value),
  );
  const availableOrganizations = [noOrganizationOption, ...organizations];
  const selectedOptions =
    selectedOrganizations.length > 0
      ? selectedOrganizations
      : noOrganizationSelected
        ? [noOrganizationOption]
        : [];

  useEffect(() => {
    void loadOrganizations();
  }, [loadOrganizations]);

  useEffect(() => {
    if (!organizationsLoaded) {
      return;
    }
    const validIds = selectedIds.filter((organizationId) =>
      organizations.some(
        (organization) => organization.value === organizationId,
      ),
    );
    if (validIds.length !== selectedIds.length) {
      setFormData({ organizationIds: validIds });
    }
  }, [organizations, organizationsLoaded, selectedIds, setFormData]);

  return (
    <Field className="w-full">
      <FieldLabel>Organizations</FieldLabel>
      {organizationsLoading ? (
        <Skeleton
          aria-label="Loading organizations"
          className="h-9 w-full"
          role="status"
        />
      ) : (
      <Combobox
        disabled={organizationsLoading || submitting}
        isItemEqualToValue={(item, value) => item.value === value.value}
        itemToStringValue={(organization) => organization.label}
        items={availableOrganizations}
        multiple
        onValueChange={(value) => {
          const values = value.map((organization) => organization.value);
          const selectedNoOrganization = values.includes(
            NO_ORGANIZATION_VALUE,
          );
          const organizationIds = values.filter(
            (organizationId) =>
              organizationId !== NO_ORGANIZATION_VALUE,
          );

          setFormData({
            organizationIds:
              selectedNoOrganization && selectedIds.length > 0
                ? []
                : organizationIds,
            noOrganizationSelected:
              selectedNoOrganization && selectedIds.length > 0
                ? true
                : organizationIds.length > 0
                  ? false
                  : selectedNoOrganization,
          });
        }}
        value={selectedOptions}
      >
        <ComboboxChips>
          <ComboboxValue>
            {selectedOptions.map((organization) => (
              <ComboboxChip key={organization.value}>
                {organization.label}
              </ComboboxChip>
            ))}
          </ComboboxValue>
          <ComboboxChipsInput
            placeholder={
              organizationsLoading
                ? "Loading organizations..."
                : "Add an organization"
            }
          />
        </ComboboxChips>
        <ComboboxPopup>
          <ComboboxEmpty>No organizations found.</ComboboxEmpty>
          <ComboboxList>
            {(organization) => (
              <ComboboxItem
                key={organization.value}
                value={organization}
              >
                {organization.label}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxPopup>
      </Combobox>
      )}
      <FieldDescription>
        {organizationsError ? (
          <span className="flex flex-wrap items-center gap-2" role="alert">
            <span>{organizationsError}</span>
            <Button
              disabled={organizationsLoading || submitting}
              onClick={() => void loadOrganizations(true)}
              size="sm"
              type="button"
              variant="outline"
            >
              Retry
            </Button>
          </span>
        ) : (
          "Select every organization you are a member of, or choose no organization."
        )}
      </FieldDescription>
    </Field>
  );
}
