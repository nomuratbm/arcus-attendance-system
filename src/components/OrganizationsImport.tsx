"use client";

import { useEffect, useState } from "react";
import { CircleAlertIcon, CircleCheckIcon } from "lucide-react";
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
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
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
      <Card>
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
                {organizationsLoading ? (
                  <TableRow>
                    <TableCell
                      className="py-8 text-center text-muted-foreground"
                      colSpan={2}
                    >
                      Loading organizations...
                    </TableCell>
                  </TableRow>
                ) : null}
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
