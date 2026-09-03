import { create } from "zustand";
import { memberItemKey, studentIdFromMemberKey } from "@/store/dynamodb-keys";
import { type Member } from "@/store/member-item";
import { useEventsStore } from "@/store/useEventsStore";

/**
 * DynamoDB Member item
 *
 * PK: MEMBER#(student_id)
 * SK: MEMBER#(student_id)
 * full_name: string
 * student_id: string
 * course: string
 * department: string
 *
 * DynamoDB Attendance item (intended write from scan history)
 *
 * PK: EVENT#(uuid)
 * SK: MEMBER#(student_id)
 * scannedAt: string
 * timestamp: number
 */

export type { Member } from "@/store/member-item";

export interface AttendanceRecord {
  id: string;
  PK: string;
  SK: string;
  member: Member;
  scannedAt: string;
  timestamp: number;
}

interface AttendanceState {
  currentMember: Member | null;
  attendanceHistory: AttendanceRecord[];
  attendanceLoading: boolean;
  scanStatus: "idle" | "loading" | "success" | "error";
  alertMessage: { type: "success" | "error" | "info"; message: string } | null;

  setCurrentMember: (member: Member | null) => void;
  addAttendanceRecord: (member: Member) => AttendanceRecord | null;
  removeAttendanceRecord: (id: string) => void;
  setAttendanceHistory: (records: AttendanceRecord[]) => void;
  replaceAttendanceForEvent: (eventPK: string, records: AttendanceRecord[]) => void;
  setAttendanceLoading: (loading: boolean) => void;
  setScanStatus: (status: "idle" | "loading" | "success" | "error") => void;
  setAlert: (type: "success" | "error" | "info" | null, message?: string | null) => void;
  clearHistory: () => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function memberFromDynamoItem(
  item: Record<string, unknown>,
  scannedStudentId: string,
): Member {
  const key =
    (typeof item.PK === "string" && item.PK) ||
    (typeof item.SK === "string" && item.SK) ||
    memberItemKey(scannedStudentId);

  return {
    PK: key,
    SK: typeof item.SK === "string" && item.SK ? item.SK : key,
    full_name: typeof item.full_name === "string" ? item.full_name : "",
    student_id:
      typeof item.student_id === "string" && item.student_id
        ? item.student_id
        : studentIdFromMemberKey(key),
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

  return {
    id: `${pk}#${sk}`,
    PK: pk,
    SK: sk,
    member: {
      PK: sk,
      SK: sk,
      full_name: typeof raw.full_name === "string" ? raw.full_name : "",
      student_id:
        typeof raw.student_id === "string" && raw.student_id
          ? raw.student_id
          : studentIdFromMemberKey(sk),
      course: typeof raw.course === "string" ? raw.course : "",
      department: typeof raw.department === "string" ? raw.department : "",
    },
    scannedAt: typeof raw.scannedAt === "string" ? raw.scannedAt : "",
    timestamp: Number.isFinite(timestamp) ? timestamp : 0,
  };
}

export const useAttendanceStore = create<AttendanceState>((set, get) => ({
  currentMember: null,
  attendanceHistory: [],
  attendanceLoading: false,
  scanStatus: "idle",
  alertMessage: null,

  setCurrentMember: (member) => set({ currentMember: member }),

  addAttendanceRecord: (member) => {
    const eventPK = useEventsStore.getState().selectedEventPK;
    if (!eventPK) {
      return null;
    }

    const memberSK = member.SK || member.PK;
    const existing = get().attendanceHistory.find(
      (record) => record.PK === eventPK && record.SK === memberSK,
    );
    if (existing) {
      return existing;
    }

    const now = new Date();
    const record: AttendanceRecord = {
      id: `${eventPK}#${memberSK}`,
      PK: eventPK,
      SK: memberSK,
      member,
      scannedAt: now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
      timestamp: now.getTime(),
    };

    set({
      attendanceHistory: [record, ...get().attendanceHistory],
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

  setScanStatus: (status) => set({ scanStatus: status }),

  setAlert: (type, message) =>
    set({
      alertMessage: type && message ? { type, message } : null,
    }),

  clearHistory: () =>
    set({
      attendanceHistory: [],
      attendanceLoading: false,
      currentMember: null,
      alertMessage: null,
    }),
}));
