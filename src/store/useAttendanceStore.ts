import { create } from "zustand";

/**
 * DynamoDB Member item (read on QR scan)
 *
 * PK: MEMBER#(uuid)
 * SK: MEMBER#(uuid)
 * uuid: string
 * student_id: string
 * full_name: string
 * student_email?: string
 * role?: string
 * course?: string
 * year?: string | number
 *
 * DynamoDB Attendance item (intended write from scan history)
 *
 * PK: EVENT#(timestamp)
 * SK: MEMBER#(uuid)
 * scannedAt: string
 * timestamp: number
 */

export interface Member {
  PK?: string;
  uuid?: string;
  student_id?: string;
  studentId?: string;
  full_name?: string;
  fullName?: string;
  student_email?: string;
  email?: string;
  role?: string;
  course?: string;
  year?: string | number;
  [key: string]: unknown;
}

export interface AttendanceRecord {
  id: string;
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
  addAttendanceRecord: (member: Member) => void;
  removeAttendanceRecord: (id: string) => void;
  setScanStatus: (status: "idle" | "loading" | "success" | "error") => void;
  setAlert: (type: "success" | "error" | "info" | null, message?: string | null) => void;
  clearHistory: () => void;
}

export const useAttendanceStore = create<AttendanceState>((set) => ({
  currentMember: null,
  attendanceHistory: [],
  scanStatus: "idle",
  alertMessage: null,

  setCurrentMember: (member) => set({ currentMember: member }),

  addAttendanceRecord: (member) =>
    set((state) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date();
      const record: AttendanceRecord = {
        id,
        member,
        scannedAt: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        timestamp: now.getTime(),
      };
      return {
        attendanceHistory: [record, ...state.attendanceHistory],
      };
    }),

  removeAttendanceRecord: (id) =>
    set((state) => ({
      attendanceHistory: state.attendanceHistory.filter((rec) => rec.id !== id),
    })),

  setScanStatus: (status) => set({ scanStatus: status }),

  setAlert: (type, message) =>
    set({
      alertMessage: type && message ? { type, message } : null,
    }),

  clearHistory: () => set({ attendanceHistory: [], currentMember: null, alertMessage: null }),
}));
