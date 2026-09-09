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
  "Choose one organization to represent, or select No organization.",
  "A QR code is generated from your student number.",
  "Show this QR code at organization/mapua-wide events to mark your attendance.",
  "If you lose the QR code or want to change your represented organization, register again. Your current profile will be replaced, but past attendance will remain.",
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
