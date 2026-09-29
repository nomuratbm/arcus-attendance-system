"use client";

import Image from "next/image";
import { useEffect, useState, type Ref } from "react";
import { AsyncLoadingOverlay } from "@/components/AsyncLoadingOverlay";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectGroup,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  NO_ORGANIZATION_VALUE,
  noOrganizationOption,
} from "@/lib/organizations";
import {
  apiErrorMessage,
  readResponseJson,
  requestErrorMessage,
} from "@/lib/request-errors";
import { useOrganizationsStore } from "@/store/useOrganizationsStore";

type QrCodePreviewProps = {
  currentOrganization: string;
  dataUrl: string;
  ref?: Ref<HTMLDivElement>;
  studentId: string;
};

export function QrCodePreview({
  currentOrganization,
  dataUrl,
  ref,
  studentId,
}: QrCodePreviewProps) {
  const [selectedOrganization, setSelectedOrganization] = useState(
    currentOrganization.trim() || NO_ORGANIZATION_VALUE,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const registryOrganizations = useOrganizationsStore(
    (state) => state.organizations,
  );
  const organizationsError = useOrganizationsStore(
    (state) => state.organizationsError,
  );
  const organizationsLoaded = useOrganizationsStore(
    (state) => state.organizationsLoaded,
  );
  const organizationsLoading = useOrganizationsStore(
    (state) => state.organizationsLoading,
  );
  const loadOrganizations = useOrganizationsStore(
    (state) => state.loadOrganizations,
  );
  const availableOrganizations = [
    noOrganizationOption,
    ...registryOrganizations,
  ];
  const selectedItem =
    availableOrganizations.find(
      (organization) => organization.value === selectedOrganization,
    ) ?? null;

  useEffect(() => {
    void loadOrganizations();
  }, [loadOrganizations]);

  async function handleOrganizationChange(value: string | null) {
    if (!value || value === selectedOrganization) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/member", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: studentId,
          organization_id: value === NO_ORGANIZATION_VALUE ? null : value,
        }),
      });
      const data = await readResponseJson(response);

      if (!response.ok) {
        throw new Error(
          apiErrorMessage(
            data,
            "Could not update the represented organization.",
          ),
        );
      }

      setSelectedOrganization(value);
    } catch (updateError) {
      setError(
        requestErrorMessage(
          updateError,
          "Could not update the represented organization. Please try again.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="flex flex-col items-center justify-center gap-4 px-6 pb-6 pt-2"
      ref={ref}
    >
      <Field aria-busy={saving} className="relative w-full max-w-sm">
        {saving ? (
          <AsyncLoadingOverlay
            className="-inset-2"
            label="Updating organization..."
          />
        ) : null}
        <FieldLabel>Representing organization</FieldLabel>
        {organizationsLoading && !organizationsLoaded ? (
          <Skeleton
            aria-label="Loading organizations"
            className="h-9 w-full"
            role="status"
          />
        ) : (
          <Select
            disabled={saving || Boolean(organizationsError)}
            isItemEqualToValue={(item, value) => item.value === value?.value}
            items={availableOrganizations}
            onValueChange={(value) => {
              void handleOrganizationChange(value?.value ?? null);
            }}
            value={selectedItem}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select an organization" />
            </SelectTrigger>
            <SelectPopup alignItemWithTrigger={false}>
              <SelectGroup>
                <SelectItem value={noOrganizationOption}>
                  {noOrganizationOption.label}
                </SelectItem>
                {registryOrganizations.map((organization) => (
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
                disabled={organizationsLoading || saving}
                onClick={() => void loadOrganizations(true)}
                size="sm"
                type="button"
                variant="outline"
              >
                Retry
              </Button>
            </span>
          ) : error ? (
            error
          ) : saving ? (
            "Updating organization..."
          ) : selectedOrganization === NO_ORGANIZATION_VALUE ? (
            "Attendance will not represent an organization."
          ) : (
            "Attendance will be recorded under this organization."
          )}
        </FieldDescription>
      </Field>
      <Image
        alt="Student QR Code"
        className="h-64 w-64 rounded-md border object-contain shadow-sm"
        height={256}
        src={dataUrl}
        unoptimized
        width={256}
      />
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Right-click (or long press) and save this QR code image. You will need
        it to scan in at events.
      </p>
    </div>
  );
}
