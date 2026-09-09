"use client";

import Image from "next/image";
import { useEffect, useState, type Ref } from "react";
import { PlusIcon } from "lucide-react";
import { AsyncLoadingOverlay } from "@/components/AsyncLoadingOverlay";
import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Form } from "@/components/ui/form";
import {
  Select,
  SelectGroup,
  SelectItem,
  SelectPopup,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ADD_ORGANIZATIONS_VALUE,
  addOrganizationsOption,
  NO_ORGANIZATION_VALUE,
  noOrganizationOption,
  parseOrganizationOptions,
  type OrganizationOption,
} from "@/lib/organizations";
import {
  apiErrorMessage,
  readResponseJson,
  requestErrorMessage,
} from "@/lib/request-errors";
import { useOrganizationsStore } from "@/store/useOrganizationsStore";

type QrCodePreviewProps = {
  dataUrl: string;
  studentId: string;
  organizations: OrganizationOption[];
  allowAddOrganizations?: boolean;
  ref?: Ref<HTMLDivElement>;
};

export function QrCodePreview({
  dataUrl,
  studentId,
  organizations,
  allowAddOrganizations = false,
  ref,
}: QrCodePreviewProps) {
  const [memberOrganizations, setMemberOrganizations] = useState(organizations);
  const [selectedOrganization, setSelectedOrganization] = useState<
    string | null
  >(null);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [organizationsToAdd, setOrganizationsToAdd] = useState<
    OrganizationOption[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const registryOrganizations = useOrganizationsStore(
    (state) => state.organizations,
  );
  const organizationsError = useOrganizationsStore(
    (state) => state.organizationsError,
  );
  const organizationsLoading = useOrganizationsStore(
    (state) => state.organizationsLoading,
  );
  const loadOrganizations = useOrganizationsStore(
    (state) => state.loadOrganizations,
  );
  const memberOrganizationIds = new Set(
    memberOrganizations.map((organization) => organization.value),
  );
  const addableOrganizations = registryOrganizations.filter(
    (organization) => !memberOrganizationIds.has(organization.value),
  );
  const availableOrganizations = [
    noOrganizationOption,
    ...memberOrganizations,
    ...(allowAddOrganizations ? [addOrganizationsOption] : []),
  ];
  const selectedItem =
    availableOrganizations.find(
      (organization) => organization.value === selectedOrganization,
    ) ?? null;

  useEffect(() => {
    if (addOpen) {
      void loadOrganizations();
    }
  }, [addOpen, loadOrganizations]);

  async function handleOrganizationChange(value: string | null) {
    if (!value || value === selectedOrganization) {
      return;
    }

    if (value === ADD_ORGANIZATIONS_VALUE) {
      setOrganizationsToAdd([]);
      setAddOpen(true);
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
          organization_id:
            value === NO_ORGANIZATION_VALUE ? null : value,
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

  async function handleAddOrganizations() {
    if (organizationsToAdd.length === 0) {
      setError("Select at least one organization to add.");
      return;
    }

    setAdding(true);
    setError(null);

    try {
      const response = await fetch("/api/member", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: studentId,
          add_organization_ids: organizationsToAdd.map(
            (organization) => organization.value,
          ),
        }),
      });
      const data = await readResponseJson(response);

      if (!response.ok) {
        throw new Error(
          apiErrorMessage(data, "Could not add the selected organizations."),
        );
      }

      setMemberOrganizations(parseOrganizationOptions(data));
      setOrganizationsToAdd([]);
      setAddOpen(false);
    } catch (addError) {
      setError(
        requestErrorMessage(
          addError,
          "Could not add the selected organizations. Please try again.",
        ),
      );
    } finally {
      setAdding(false);
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
        <Select
          disabled={saving}
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
              {memberOrganizations.map((organization) => (
                <SelectItem key={organization.value} value={organization}>
                  {organization.label}
                </SelectItem>
              ))}
            </SelectGroup>
            {allowAddOrganizations ? (
              <>
                <SelectSeparator />
                <SelectGroup>
                  <SelectItem value={addOrganizationsOption}>
                    <span className="flex items-center gap-2">
                      <PlusIcon />
                      Add organizations
                    </span>
                  </SelectItem>
                </SelectGroup>
              </>
            ) : null}
          </SelectPopup>
        </Select>
        <FieldDescription>
          {error && !addOpen
            ? error
            : saving
              ? "Updating organization..."
              : selectedOrganization === null
                ? allowAddOrganizations
                  ? "Select the organization represented for attendance, or add more organizations."
                  : "Select the organization represented for attendance."
                : selectedOrganization === NO_ORGANIZATION_VALUE
                ? "Attendance will not represent an organization."
                : "Attendance will be recorded under this organization."}
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

      {allowAddOrganizations ? (
        <Dialog
          onOpenChange={(open) => {
            if (adding) {
              return;
            }
            setAddOpen(open);
            if (!open) {
              setOrganizationsToAdd([]);
            }
          }}
          open={addOpen}
        >
          <DialogPopup showCloseButton={!adding}>
            <DialogHeader>
              <DialogTitle>Add organizations</DialogTitle>
              <DialogDescription>
                Choose organizations to add to this student number. They will
                appear in the representing organization list.
              </DialogDescription>
            </DialogHeader>
            <Form
              className="contents"
              onFormSubmit={() => {
                void handleAddOrganizations();
              }}
            >
              <DialogPanel className="relative">
                {adding ? (
                  <AsyncLoadingOverlay label="Adding organizations..." />
                ) : null}
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
                      disabled={adding || Boolean(organizationsError)}
                      isItemEqualToValue={(item, value) =>
                        item.value === value.value
                      }
                      itemToStringValue={(organization) => organization.label}
                      items={addableOrganizations}
                      multiple
                      onValueChange={setOrganizationsToAdd}
                      value={organizationsToAdd}
                    >
                      <ComboboxChips>
                        <ComboboxValue>
                          {organizationsToAdd.map((organization) => (
                            <ComboboxChip key={organization.value}>
                              {organization.label}
                            </ComboboxChip>
                          ))}
                        </ComboboxValue>
                        <ComboboxChipsInput placeholder="Add an organization" />
                      </ComboboxChips>
                      <ComboboxPopup>
                        <ComboboxEmpty>
                          {addableOrganizations.length === 0
                            ? "Every organization is already on this list."
                            : "No organizations found."}
                        </ComboboxEmpty>
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
                      <span
                        className="flex flex-wrap items-center gap-2"
                        role="alert"
                      >
                        <span>{organizationsError}</span>
                        <Button
                          disabled={organizationsLoading || adding}
                          onClick={() => void loadOrganizations(true)}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          Retry
                        </Button>
                      </span>
                    ) : error && addOpen ? (
                      error
                    ) : (
                      "Only organizations that are not already listed can be added."
                    )}
                  </FieldDescription>
                </Field>
              </DialogPanel>
              <DialogFooter>
                <DialogClose
                  render={
                    <Button disabled={adding} type="button" variant="outline" />
                  }
                >
                  Cancel
                </DialogClose>
                <Button
                  disabled={
                    adding ||
                    organizationsLoading ||
                    organizationsToAdd.length === 0
                  }
                  loading={adding}
                  type="submit"
                >
                  Add organizations
                </Button>
              </DialogFooter>
            </Form>
          </DialogPopup>
        </Dialog>
      ) : null}
    </div>
  );
}
