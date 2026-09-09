"use client";

import { useEffect, useState } from "react";
import { CircleAlertIcon, CircleCheckIcon } from "lucide-react";
import { AsyncLoadingOverlay } from "@/components/AsyncLoadingOverlay";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Fieldset } from "@/components/ui/fieldset";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  apiErrorMessage,
  readResponseJson,
  requestErrorMessage,
} from "@/lib/request-errors";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useOrganizationsStore } from "@/store/useOrganizationsStore";

type ImportResult = {
  name: string;
  status: "created" | "updated";
};

type ImportSummary = {
  created: number;
  updated: number;
  total: number;
  results: ImportResult[];
};

export function OrganizationsImport() {
  const [addFormKey, setAddFormKey] = useState(0);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addResult, setAddResult] = useState<ImportResult | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const organizations = useOrganizationsStore((state) => state.organizations);
  const organizationsError = useOrganizationsStore(
    (state) => state.organizationsError,
  );
  const organizationsLoading = useOrganizationsStore(
    (state) => state.organizationsLoading,
  );
  const loadOrganizations = useOrganizationsStore(
    (state) => state.loadOrganizations,
  );

  useEffect(() => {
    void loadOrganizations();
  }, [loadOrganizations]);

  async function handleAdd(formValues: Record<string, unknown>) {
    const name = String(formValues.name ?? "").trim();
    const organizationId = String(
      formValues.organization_id ?? "",
    ).trim();

    if (!name) {
      setAddError("Enter an organization name.");
      return;
    }

    setAdding(true);
    setAddError(null);
    setAddResult(null);

    try {
      const formData = new FormData();
      formData.set("name", name);
      formData.set("organization_id", organizationId);
      const response = await fetch("/api/organizations", {
        method: "POST",
        body: formData,
      });
      const data = await readResponseJson(response);

      if (!response.ok) {
        throw new Error(
          apiErrorMessage(data, "Could not add the organization."),
        );
      }

      const parsedSummary = parseImportSummary(data);
      const result = parsedSummary?.results[0];
      if (!parsedSummary || parsedSummary.total !== 1 || !result) {
        throw new Error("The server returned an invalid organization result.");
      }

      setAddResult(result);
      setAddFormKey((current) => current + 1);
      await loadOrganizations(true);
    } catch (error) {
      setAddError(
        requestErrorMessage(
          error,
          "Could not add the organization. Please try again.",
        ),
      );
    } finally {
      setAdding(false);
    }
  }

  async function handleImport() {
    if (!file) {
      setImportError("Choose a CSV file before importing.");
      return;
    }

    setImporting(true);
    setImportError(null);
    setSummary(null);

    try {
      const formData = new FormData();
      formData.set("file", file);
      const response = await fetch("/api/organizations", {
        method: "POST",
        body: formData,
      });
      const data = await readResponseJson(response);

      if (!response.ok) {
        throw new Error(
          apiErrorMessage(data, "Could not import organizations."),
        );
      }

      const parsedSummary = parseImportSummary(data);
      if (!parsedSummary) {
        throw new Error("The server returned an invalid import summary.");
      }

      setSummary(parsedSummary);
      setFile(null);
      setFormKey((current) => current + 1);
      await loadOrganizations(true);
    } catch (error) {
      setImportError(
        requestErrorMessage(
          error,
          "Could not import organizations. Please try again.",
        ),
      );
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card aria-busy={adding} className="relative">
        {adding ? <AsyncLoadingOverlay label="Adding organization..." /> : null}
        <CardHeader>
          <CardTitle>Add organization</CardTitle>
          <CardDescription>
            Add one organization directly. Leave the UUID empty to generate
            one automatically.
          </CardDescription>
        </CardHeader>
        <Form
          className="contents"
          key={addFormKey}
          onFormSubmit={handleAdd}
        >
          <Fieldset className="contents" disabled={adding}>
          <CardPanel className="flex flex-col gap-4">
            <Field className="w-full" name="name">
              <FieldLabel>Organization name</FieldLabel>
              <Input
                autoComplete="organization"
                maxLength={200}
                name="name"
                placeholder="Example: AWS Student Builder Group — Arcus"
                required
                type="text"
              />
              <FieldError>Please enter an organization name.</FieldError>
            </Field>
            <Field className="w-full" name="organization_id">
              <FieldLabel>Organization UUID (optional)</FieldLabel>
              <Input
                autoComplete="off"
                maxLength={36}
                name="organization_id"
                placeholder="Generated automatically when empty"
                type="text"
              />
              <FieldDescription>
                Existing organizations reject a different supplied UUID.
              </FieldDescription>
            </Field>
          </CardPanel>
          <CardFooter className="justify-end">
            <Button disabled={adding} loading={adding} type="submit">
              Add organization
            </Button>
          </CardFooter>
          </Fieldset>
        </Form>
      </Card>

      {addError ? (
        <Alert variant="error">
          <CircleAlertIcon />
          <AlertTitle>Could not add organization</AlertTitle>
          <AlertDescription>{addError}</AlertDescription>
        </Alert>
      ) : null}

      {addResult ? (
        <Alert variant="success">
          <CircleCheckIcon />
          <AlertTitle>
            Organization {addResult.status === "created" ? "added" : "updated"}
          </AlertTitle>
          <AlertDescription>{addResult.name}</AlertDescription>
        </Alert>
      ) : null}

      <Card aria-busy={importing} className="relative">
        {importing ? (
          <AsyncLoadingOverlay label="Importing organizations..." />
        ) : null}
        <CardHeader>
          <CardTitle>Import organizations</CardTitle>
          <CardDescription>
            Upload a CSV whose first column is the organization name and whose
            optional second column is its UUID.
          </CardDescription>
        </CardHeader>
        <Form
          className="contents"
          key={formKey}
          onFormSubmit={handleImport}
        >
          <Fieldset className="contents" disabled={importing}>
          <CardPanel>
            <Field className="w-full" name="file">
              <FieldLabel>Organization CSV</FieldLabel>
              <Input
                accept=".csv,text/csv,application/vnd.ms-excel"
                name="file"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setImportError(null);
                }}
                required
                type="file"
              />
              <FieldDescription>
                Headers are optional. A UUID is generated when the second
                column is empty. Existing organizations keep their UUID and
                reject a different supplied UUID.
              </FieldDescription>
              <FieldError>Please choose a CSV file.</FieldError>
            </Field>
          </CardPanel>
          <CardFooter className="justify-end">
            <Button disabled={!file || importing} loading={importing} type="submit">
              Import organizations
            </Button>
          </CardFooter>
          </Fieldset>
        </Form>
      </Card>

      {importError ? (
        <Alert variant="error">
          <CircleAlertIcon />
          <AlertTitle>Import failed</AlertTitle>
          <AlertDescription>{importError}</AlertDescription>
        </Alert>
      ) : null}

      {summary ? (
        <Alert variant="success">
          <CircleCheckIcon />
          <AlertTitle>Import complete</AlertTitle>
          <AlertDescription>
            {summary.created} created, {summary.updated} updated, {summary.total}{" "}
            total.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Organization registry</CardTitle>
          <CardDescription>
            Public organization names currently available to registration and
            event tools.
          </CardDescription>
        </CardHeader>
        <CardPanel>
          {organizationsError ? (
            <Alert variant="error">
              <CircleAlertIcon />
              <AlertTitle>Could not load organizations</AlertTitle>
              <AlertDescription className="flex flex-wrap items-center gap-2">
                <span>{organizationsError}</span>
                <Button
                  disabled={organizationsLoading}
                  onClick={() => void loadOrganizations(true)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organizations.map((organization) => (
                  <TableRow key={organization.value}>
                    <TableCell className="font-medium">
                      {organization.label}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="success">Available</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {!organizationsLoading && organizations.length === 0 ? (
                  <TableRow>
                    <TableCell
                      className="py-8 text-center text-muted-foreground"
                      colSpan={2}
                    >
                      No organizations found.
                    </TableCell>
                  </TableRow>
                ) : null}
                {organizationsLoading
                  ? [0, 1, 2].map((row) => (
                      <TableRow key={row}>
                        <TableCell>
                          <Skeleton className="h-4 w-2/3" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="ml-auto h-5 w-20" />
                        </TableCell>
                      </TableRow>
                    ))
                  : null}
              </TableBody>
            </Table>
          )}
        </CardPanel>
      </Card>

      {summary && summary.results.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Last import</CardTitle>
            <CardDescription>
              Results from the most recent CSV upload.
            </CardDescription>
          </CardHeader>
          <CardPanel>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.results.map((result) => (
                  <TableRow key={result.name}>
                    <TableCell>{result.name}</TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={
                          result.status === "created" ? "success" : "info"
                        }
                      >
                        {result.status === "created" ? "Created" : "Updated"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardPanel>
        </Card>
      ) : null}
    </div>
  );
}

function parseImportSummary(value: unknown): ImportSummary | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record.created !== "number" ||
    typeof record.updated !== "number" ||
    typeof record.total !== "number" ||
    !Array.isArray(record.results)
  ) {
    return null;
  }

  const results = record.results.filter(
    (result): result is ImportResult =>
      typeof result === "object" &&
      result !== null &&
      "name" in result &&
      typeof result.name === "string" &&
      "status" in result &&
      (result.status === "created" || result.status === "updated"),
  );

  if (results.length !== record.results.length) {
    return null;
  }

  return {
    created: record.created,
    updated: record.updated,
    total: record.total,
    results,
  };
}
