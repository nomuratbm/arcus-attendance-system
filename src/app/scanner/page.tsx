import { AppHeader, PageShell } from "@/components/AppHeader";
import { ScannerWorkspace } from "@/components/ScannerWorkspace";
import { getSessionIdentity, requireAdminPage } from "@/lib/auth/session";
import { getOrganization } from "@/lib/dynamodb/organizations";

export default async function ScannerPage() {
  await requireAdminPage("/scanner");
  const identity = await getSessionIdentity();
  let organizationName: string | null = null;
  let organizationError: string | null = null;

  if (identity?.organizationId) {
    try {
      const organization = await getOrganization(identity.organizationId);
      organizationName = organization?.label ?? null;
      if (!organizationName) {
        organizationError =
          "Your account's organization could not be found. Contact an administrator.";
      }
    } catch (error) {
      console.error("Failed to resolve the signed-in organization:", error);
      organizationError =
        "Your account's organization could not be loaded. Try again.";
    }
  }

  return (
    <PageShell>
      <AppHeader subtitle="Scanner View" />
      <ScannerWorkspace
        organizationError={organizationError}
        organizationName={organizationName}
      />
    </PageShell>
  );
}
