import { AppHeader, PageShell } from "@/components/AppHeader";
import { StudentPortal } from "@/components/StudentPortal";
import { requireUserPage } from "@/lib/auth/session";
import { getMemberForUser } from "@/lib/dynamodb/members";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireUserPage("/");
  const member = await getMemberForUser(user.sub);

  return (
    <PageShell>
      <AppHeader subtitle={member ? "Your QR code" : "Student registration"} />
      <main className="mx-auto flex w-full min-w-0 max-w-xl flex-col gap-4 px-4 py-8 sm:px-6">
        <StudentPortal
          profile={
            member
              ? {
                  course: member.course,
                  currentOrganization: member.current_organization,
                  department: member.department,
                  fullName: member.full_name,
                  studentId: member.student_id,
                }
              : null
          }
        />
      </main>
    </PageShell>
  );
}
