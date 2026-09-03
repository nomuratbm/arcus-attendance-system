"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
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

const INSTRUCTIONS = [
  "Enter your details in the fields on this page.",
  "A QR code is generated from your student number. Keep it — each student number can only be registered once.",
  "Show this QR code at AWS SBG Arcus events to mark your attendance.",
  "If you lose the QR code, open Retrieve and enter your student number to generate it again. Registering twice with the same number will be rejected.",
] as const;

const instructionList = (
  <ol className="list-decimal space-y-3 ps-5 text-sm text-foreground">
    {INSTRUCTIONS.map((step) => (
      <li key={step}>{step}</li>
    ))}
  </ol>
);

export function InstructionsDialog() {
  const [open, setOpen] = useState(true);

  return (
    <Dialog
      disablePointerDismissal
      onOpenChange={(nextOpen, eventDetails) => {
        if (!nextOpen && eventDetails.reason !== "close-press") {
          return;
        }
        setOpen(nextOpen);
      }}
      open={open}
    >
      <DialogPopup showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Before you continue</DialogTitle>
          <DialogDescription>
            Please read these steps so you know how your attendance QR code
            works.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>{instructionList}</DialogPanel>
        <DialogFooter>
          <DialogClose
            render={<Button className="w-full sm:w-auto" type="button" />}
          >
            Agree and proceed
          </DialogClose>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
