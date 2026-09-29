"use client";

import { useEffect, useState } from "react";
import { InstructionsDialog } from "@/components/InstructionsDialog";
import { QrCodePreview } from "@/components/QrCodePreview";
import {
  StudentDetailsForm,
  type RegisteredStudent,
} from "@/components/StudentDetailsForm";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ToastProvider } from "@/components/ui/toast";
import { useQrCode } from "@/hooks/use-qr-code";

export type StudentProfile = RegisteredStudent;

export function StudentPortal({ profile }: { profile: StudentProfile | null }) {
  const [registered, setRegistered] = useState(profile);

  return (
    <ToastProvider position="bottom-right">
      {!registered ? (
        <>
          <InstructionsDialog />
          <StudentDetailsForm onRegistered={setRegistered} />
        </>
      ) : (
        <RegisteredQr profile={registered} />
      )}
    </ToastProvider>
  );
}

function RegisteredQr({ profile }: { profile: StudentProfile }) {
  const { dataUrl, error, generate, generating } = useQrCode();

  useEffect(() => {
    void generate(profile.studentId);
  }, [generate, profile.studentId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{profile.fullName}</CardTitle>
        <CardDescription>
          {profile.studentId} · {profile.course} · {profile.department}
        </CardDescription>
      </CardHeader>
      {generating && !dataUrl ? (
        <CardPanel className="flex justify-center">
          <Skeleton aria-label="Generating QR code" className="h-64 w-64" />
        </CardPanel>
      ) : null}
      {error ? (
        <CardPanel className="flex flex-col items-center gap-3">
          <p className="text-sm text-destructive-foreground" role="alert">
            {error}
          </p>
          <Button onClick={() => void generate(profile.studentId)} type="button">
            Retry
          </Button>
        </CardPanel>
      ) : null}
      {dataUrl ? (
        <QrCodePreview
          currentOrganization={profile.currentOrganization}
          dataUrl={dataUrl}
          studentId={profile.studentId}
        />
      ) : null}
    </Card>
  );
}
