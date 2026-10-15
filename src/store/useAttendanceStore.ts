import { create } from "zustand";
import { formatAttendanceClockTime } from "@/lib/scan-time";
import {
  memberItemKey,
  organizationIdFromKey,
  studentIdFromKey,
  studentItemKey,
} from "@/store/dynamodb-keys";
import { type Student } from "@/store/student-item";
import { useEventsStore } from "@/store/useEventsStore";

/**
 * DynamoDB Student profile item (arcus-owned identity record)
 *
 * PK: STUDENT#(student_id)
 * SK: STUDENT#(student_id)
 * full_name: string
 * student_id: string
 * course: string
 * department: string
 *
 * DynamoDB Attendance item (check-in child of an EVENT partition)
 *
 * PK: EVENT#(uuid)
 * SK: MEMBER#(student_id)   // kept as MEMBER# for apex's AggregateEventParticipants
 * member_organization: uuid
 * scannedAt: timestamp
 * leftAt: timestamp
 * timestamp: number
 */

export type { Student } from "@/store/student-item";

export type ScanTimestampMode = "enteredAt" | "leftAt";

export interface AttendanceRecord {
  id: string;
  PK: string;
  SK: string;
  student: Student;
  member_organization: string;
  scannedAt: string;
  leftAt: string;
  timestamp: number;
}

interface AttendanceState {
  currentStudent: Student | null;
  attendanceHistory: AttendanceRecord[];
  attendanceLoading: boolean;
  scanTimestampMode: ScanTimestampMode;
  membersOnlyMode: boolean;
  scanStatus: "idle" | "loading" | "success" | "error";
  alertMessage: { type: "success" | "error" | "info"; message: string } | null;

  setCurrentStudent: (student: Student | null) => void;
  addAttendanceRecord: (student: Student) => AttendanceRecord | null;
  updateLeftAt: (student: Student) => AttendanceRecord | null;
  removeAttendanceRecord: (id: string) => void;
  setAttendanceHistory: (records: AttendanceRecord[]) => void;
  replaceAttendanceForEvent: (eventPK: string, records: AttendanceRecord[]) => void;
  setAttendanceLoading: (loading: boolean) => void;
  setScanTimestampMode: (mode: ScanTimestampMode) => void;
  setMembersOnlyMode: (mode: boolean) => void;
  setScanStatus: (status: "idle" | "loading" | "success" | "error") => void;
  setAlert: (type: "success" | "error" | "info" | null, message?: string | null) => void;
  clearHistory: () => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function selectedEventOrganizationId(eventPK: string): string {
  const event = useEventsStore
    .getState()
    .events.find((item) => item.PK === eventPK);
  return event?.GSI3SK ? organizationIdFromKey(event.GSI3SK) : "";
}

export function studentFromDynamoItem(
  item: Record<string, unknown>,
  scannedStudentId: string,
): Student {
  const key =
    (typeof item.PK === "string" && item.PK) ||
    (typeof item.SK === "string" && item.SK) ||
    studentItemKey(scannedStudentId);

  return {
    PK: key,
    SK: typeof item.SK === "string" && item.SK ? item.SK : key,
    full_name: typeof item.full_name === "string" ? item.full_name : "",
    student_id:
      typeof item.student_id === "string" && item.student_id
        ? item.student_id
        : studentIdFromKey(key),
    course: typeof item.course === "string" ? item.course : "",
    department: typeof item.department === "string" ? item.department : "",
  };
}

export function parseAttendanceRecord(
  eventPK: string,
  raw: unknown,
): AttendanceRecord | null {
  if (!isRecord(raw)) {
    return null;
  }

  const sk = typeof raw.SK === "string" ? raw.SK : "";
  if (!sk.startsWith("MEMBER#")) {
    return null;
  }

  const pk = typeof raw.PK === "string" && raw.PK ? raw.PK : eventPK;
  const timestamp =
    typeof raw.timestamp === "number"
      ? raw.timestamp
      : typeof raw.timestamp === "string"
        ? Number(raw.timestamp)
        : 0;
  const studentId =
    typeof raw.student_id === "string" && raw.student_id
      ? raw.student_id
      : studentIdFromKey(sk);
  const profileKey = studentItemKey(studentId);

  return {
    id: `${pk}#${sk}`,
    PK: pk,
    SK: sk,
    student: {
      PK: profileKey,
      SK: profileKey,
      full_name: typeof raw.full_name === "string" ? raw.full_name : "",
      student_id: studentId,
      course: typeof raw.course === "string" ? raw.course : "",
      department: typeof raw.department === "string" ? raw.department : "",
    },
    member_organization:
      typeof raw.member_organization === "string"
        ? raw.member_organization
        : "",
    scannedAt: typeof raw.scannedAt === "string" ? raw.scannedAt : "",
    leftAt: typeof raw.leftAt === "string" ? raw.leftAt : "",
    timestamp: Number.isFinite(timestamp) ? timestamp : 0,
  };
}

export const useAttendanceStore = create<AttendanceState>((set, get) => ({
  currentStudent: null,
  attendanceHistory: [],
  attendanceLoading: false,
  scanTimestampMode: "enteredAt",
  membersOnlyMode: false,
  scanStatus: "idle",
  alertMessage: null,

  setCurrentStudent: (student) => set({ currentStudent: student }),

  addAttendanceRecord: (student) => {
    const { selectedEventPK } = useEventsStore.getState();
    if (!selectedEventPK) {
      return null;
    }

    const checkInSK = memberItemKey(student.student_id);
    const existing = get().attendanceHistory.find(
      (record) => record.PK === selectedEventPK && record.SK === checkInSK,
    );
    if (existing) {
      return existing;
    }

    const now = new Date();
    const record: AttendanceRecord = {
      id: `${selectedEventPK}#${checkInSK}`,
      PK: selectedEventPK,
      SK: checkInSK,
      student,
      member_organization: selectedEventOrganizationId(selectedEventPK),
      scannedAt: formatAttendanceClockTime(now),
      leftAt: "",
      timestamp: now.getTime(),
    };

    set({
      attendanceHistory: [record, ...get().attendanceHistory],
    });

    return record;
  },

  updateLeftAt: (student) => {
    const eventPK = useEventsStore.getState().selectedEventPK;
    if (!eventPK) {
      return null;
    }

    const checkInSK = memberItemKey(student.student_id);
    const existing = get().attendanceHistory.find(
      (record) => record.PK === eventPK && record.SK === checkInSK,
    );
    if (!existing) {
      return null;
    }

    const record: AttendanceRecord = {
      ...existing,
      student: student.full_name ? student : existing.student,
      leftAt: formatAttendanceClockTime(),
    };

    set({
      attendanceHistory: get().attendanceHistory.map((item) =>
        item.id === record.id ? record : item,
      ),
    });

    return record;
  },

  removeAttendanceRecord: (id) =>
    set((state) => ({
      attendanceHistory: state.attendanceHistory.filter((rec) => rec.id !== id),
    })),

  setAttendanceHistory: (attendanceHistory) => set({ attendanceHistory }),

  replaceAttendanceForEvent: (eventPK, records) =>
    set((state) => {
      if (useEventsStore.getState().selectedEventPK !== eventPK) {
        return state;
      }

      const fetchedSKs = new Set(records.map((record) => record.SK));
      const pendingLocal = state.attendanceHistory.filter(
        (record) => record.PK === eventPK && !fetchedSKs.has(record.SK),
      );

      return {
        attendanceHistory: [...pendingLocal, ...records].sort(
          (left, right) => right.timestamp - left.timestamp,
        ),
        attendanceLoading: false,
      };
    }),

  setAttendanceLoading: (attendanceLoading) => set({ attendanceLoading }),

  setScanTimestampMode: (scanTimestampMode) => set({ scanTimestampMode }),

  setMembersOnlyMode: (membersOnlyMode) => set({ membersOnlyMode }),

  setScanStatus: (status) => set({ scanStatus: status }),

  setAlert: (type, message) =>
    set({
      alertMessage: type && message ? { type, message } : null,
    }),

  clearHistory: () =>
    set({
      attendanceHistory: [],
      attendanceLoading: false,
      currentStudent: null,
      alertMessage: null,
    }),
}));
