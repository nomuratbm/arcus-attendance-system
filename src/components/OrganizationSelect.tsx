"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectGroup,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { noOrganizationOption } from "@/lib/organizations";
import { useOrganizationsStore } from "@/store/useOrganizationsStore";
import { useStudentFormStore } from "@/store/useStudentFormStore";

export function OrganizationSelect() {
  const organizationSelection = useStudentFormStore(
    (state) => state.organizationSelection,
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
  const availableOrganizations = [noOrganizationOption, ...organizations];
  const selectedOrganization =
    availableOrganizations.find(
      (organization) => organization.value === organizationSelection,
    ) ?? null;

  useEffect(() => {
    void loadOrganizations();
  }, [loadOrganizations]);

  useEffect(() => {
    if (
      organizationsLoaded &&
      organizationSelection &&
      organizationSelection !== noOrganizationOption.value &&
      !organizations.some(
        (organization) => organization.value === organizationSelection,
      )
    ) {
      setFormData({ organizationSelection: "" });
    }
  }, [
    organizationSelection,
    organizations,
    organizationsLoaded,
    setFormData,
  ]);

  return (
    <Field className="w-full">
      <FieldLabel>Organization</FieldLabel>
      {organizationsLoading ? (
        <Skeleton
          aria-label="Loading organizations"
          className="h-9 w-full"
          role="status"
        />
      ) : (
        <Select
          disabled={submitting}
          isItemEqualToValue={(item, value) => item.value === value?.value}
          items={availableOrganizations}
          onValueChange={(value) => {
            setFormData({ organizationSelection: value?.value ?? "" });
          }}
          value={selectedOrganization}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select an organization" />
          </SelectTrigger>
          <SelectPopup alignItemWithTrigger={false}>
            <SelectGroup>
              {availableOrganizations.map((organization) => (
                <SelectItem key={organization.value} value={organization}>
                  {organization.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectPopup>
        </Select>
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
          "Choose the one organization you represent, or choose No organization."
        )}
      </FieldDescription>
    </Field>
  );
}
