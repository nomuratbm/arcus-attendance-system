import { create } from "zustand";
import { memberItemKey } from "@/store/dynamodb-keys";
import { type Member } from "@/store/member-item";
import { useEventsStore } from "@/store/useEventsStore";

/**
 * DynamoDB Member item
 *
 * PK: MEMBER#(uuid)
 * SK: MEMBER#(uuid)
 * full_name: string
 * student_id: string
 * course: string
 * department: string
 *
 * DynamoDB Attendance item (intended write from scan history)
 *
 * PK: EVENT#(uuid)
 * SK: MEMBER#(uuid)
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
  scanStatus: "idle" | "loading" | "success" | "error";
  alertMessage: { type: "success" | "error" | "info"; message: string } | null;

  setCurrentMember: (member: Member | null) => void;
  addAttendanceRecord: (member: Member) => AttendanceRecord | null;
  removeAttendanceRecord: (id: string) => void;
  setScanStatus: (status: "idle" | "loading" | "success" | "error") => void;
  setAlert: (type: "success" | "error" | "info" | null, message?: string | null) => void;
  clearHistory: () => void;
}

export function memberFromDynamoItem(
  item: Record<string, unknown>,
  scannedUuid: string,
): Member {
  const key =
    (typeof item.PK === "string" && item.PK) ||
    (typeof item.SK === "string" && item.SK) ||
    memberItemKey(scannedUuid);

  return {
    PK: key,
    SK: typeof item.SK === "string" && item.SK ? item.SK : key,
    full_name: typeof item.full_name === "string" ? item.full_name : "",
    student_id: typeof item.student_id === "string" ? item.student_id : "",
    course: typeof item.course === "string" ? item.course : "",
    department: typeof item.department === "string" ? item.department : "",
  };
}

export const useAttendanceStore = create<AttendanceState>((set, get) => ({
  currentMember: null,
  attendanceHistory: [],
  scanStatus: "idle",
  alertMessage: null,

  setCurrentMember: (member) => set({ currentMember: member }),

  addAttendanceRecord: (member) => {
    const eventPK = useEventsStore.getState().selectedEventPK;
    if (!eventPK) {
      return null;
    }

    const now = new Date();
    const record: AttendanceRecord = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      PK: eventPK,
      SK: member.SK || member.PK,
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

  setScanStatus: (status) => set({ scanStatus: status }),

  setAlert: (type, message) =>
    set({
      alertMessage: type && message ? { type, message } : null,
    }),

  clearHistory: () =>
    set({ attendanceHistory: [], currentMember: null, alertMessage: null }),
}));
