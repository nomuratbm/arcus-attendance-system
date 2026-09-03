import { AppHeader, PageShell } from "@/components/AppHeader";
import { SignOutButton } from "@/components/SignOutButton";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ForbiddenPage() {
  return (
    <PageShell>
      <AppHeader subtitle="Access denied" />
      <main className="mx-auto w-full min-w-0 max-w-xl px-4 py-8 sm:px-6">
        <Card>
          <CardHeader>
            <CardTitle>Admin access required</CardTitle>
            <CardDescription>
              This account is signed in but is not in the required Cognito admin
              group.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <SignOutButton />
          </CardFooter>
        </Card>
      </main>
    </PageShell>
  );
}
