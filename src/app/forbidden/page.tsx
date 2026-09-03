import { AppHeader } from "@/components/AppHeader";
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
    <div className="min-h-screen bg-background text-foreground transition-colors duration-150">
      <AppHeader subtitle="Access denied" />
      <main className="mx-auto max-w-xl px-6 py-8">
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
    </div>
  );
}
