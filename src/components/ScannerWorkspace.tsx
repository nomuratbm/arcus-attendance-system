"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { EventSelector } from "@/components/EventSelector";
import {
  parseAttendanceRecord,
  useAttendanceStore,
  type AttendanceRecord,
} from "@/store/useAttendanceStore";
import {
  parseAttendanceEvent,
  useEventsStore,
  type AttendanceEvent,
} from "@/store/useEventsStore";

const scannerPanelFallback = (
  <div aria-hidden className="min-h-[340px] rounded-2xl border bg-card" />
);

const QRScanner = dynamic(
  () => import("@/components/QRScanner").then((mod) => mod.QRScanner),
  { loading: () => scannerPanelFallback, ssr: false },
);

const AttendanceDashboard = dynamic(
  () =>
    import("@/components/AttendanceDashboard").then(
      (mod) => mod.AttendanceDashboard,
    ),
  { ssr: false },
);

function eventsFromResponse(value: unknown): AttendanceEvent[] | null {
  if (typeof value !== "object" || value === null || !("events" in value)) {
    return null;
  }

  const events = value.events;
  if (!Array.isArray(events)) {
    return null;
  }

  return events
    .map(parseAttendanceEvent)
    .filter((event): event is AttendanceEvent => event !== null);
}

function attendanceFromResponse(
  eventPK: string,
  value: unknown,
): AttendanceRecord[] | null {
  if (typeof value !== "object" || value === null || !("checkIns" in value)) {
    return null;
  }

  const checkIns = value.checkIns;
  if (!Array.isArray(checkIns)) {
    return null;
  }

  return checkIns
    .map((item) => parseAttendanceRecord(eventPK, item))
    .filter((record): record is AttendanceRecord => record !== null)
    .sort((left, right) => right.timestamp - left.timestamp);
}

function isAbortError(error: unknown, signal: AbortSignal): boolean {
  if (signal.aborted) {
    return true;
  }

  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

export function ScannerWorkspace() {
  const selectedEventPK = useEventsStore((state) => state.selectedEventPK);

  useEffect(() => {
    const { setEvents, setEventsError, setEventsLoading } =
      useEventsStore.getState();
    const controller = new AbortController();

    setEventsLoading(true);
    setEventsError(null);

    void fetch("/api/events", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const data: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          const error =
            typeof data === "object" &&
            data !== null &&
            "error" in data &&
            typeof data.error === "string"
              ? data.error
              : "Failed to load events.";
          throw new Error(error);
        }

        const events = eventsFromResponse(data);
        if (!events) {
          throw new Error("Failed to load events.");
        }

        setEvents(events);
      })
      .catch((error: unknown) => {
        if (isAbortError(error, controller.signal)) {
          return;
        }

        setEventsError(
          error instanceof Error ? error.message : "Failed to load events.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setEventsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const {
      clearHistory,
      replaceAttendanceForEvent,
      setAlert,
      setAttendanceHistory,
      setAttendanceLoading,
      setCurrentMember,
      setScanStatus,
    } = useAttendanceStore.getState();

    setCurrentMember(null);
    setScanStatus("idle");
    setAlert(null, null);

    if (!selectedEventPK) {
      clearHistory();
      return;
    }

    const controller = new AbortController();
    setAttendanceHistory([]);
    setAttendanceLoading(true);

    const eventId = selectedEventPK.replace(/^EVENT#/, "");

    void fetch(
      `/api/events/${encodeURIComponent(eventId)}/checkins?format=json`,
      { signal: controller.signal },
    )
      .then(async (response) => {
        const data: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error("Failed to load attendance.");
        }

        const records = attendanceFromResponse(selectedEventPK, data);
        if (!records) {
          throw new Error("Failed to load attendance.");
        }

        replaceAttendanceForEvent(selectedEventPK, records);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        console.error("Failed to load attendance:", error);
        setAttendanceLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [selectedEventPK]);

  return (
    <main className="mx-auto w-full max-w-5xl min-w-0 space-y-6 overflow-x-clip px-4 py-8 sm:px-6">
      <EventSelector />
      <QRScanner />
      <AttendanceDashboard />
    </main>
  );
}
