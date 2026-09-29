import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function AdminOrganizationNotice() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization not assigned</CardTitle>
        <CardDescription>
          This admin account is not assigned to an organization. A super-admin
          needs to set the Cognito attribute custom:reporganization-uuid before
          events can be opened.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
