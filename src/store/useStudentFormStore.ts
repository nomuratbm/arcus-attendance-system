import { create } from "zustand";
import {
  formatProgramAndYear,
  getDepartmentItem,
} from "@/lib/academic-options";
import { formatStudentName } from "@/lib/student-validation";
import { studentItemKey } from "@/store/dynamodb-keys";
import type { Student } from "@/store/student-item";

/**
 * DynamoDB Student item (registration write)
 *
 * PK: STUDENT#(student_id)
 * SK: STUDENT#(student_id)
 * full_name: string        // first name and last name, joined
 * student_id: string       // studentNumber
 * course: string           // "PROGRAM - Year Level", same shape as a SAAF proponent
 * department: string       // department code while editing; the saved item uses the school name
 */
export interface StudentFormData {
  firstName: string;
  lastName: string;
  studentNumber: string;
  department: string;
  program: string;
  yearLevel: string;
}

interface StudentFormState extends StudentFormData {
  submitting: boolean;
  setFormData: (data: Partial<StudentFormData>) => void;
  setSubmitting: (submitting: boolean) => void;
  clearFormData: () => void;
  buildStudentItem: () => Student;
}

const emptyFormData: StudentFormData = {
  firstName: "",
  lastName: "",
  studentNumber: "",
  department: "",
  program: "",
  yearLevel: "",
};

export const useStudentFormStore = create<StudentFormState>((set, get) => ({
  ...emptyFormData,
  submitting: false,

  setFormData: (data) => set((state) => ({ ...state, ...data })),
  setSubmitting: (submitting) => set({ submitting }),

  clearFormData: () => set({ ...emptyFormData, submitting: false }),

  buildStudentItem: () => {
    const state = get();
    const studentId = state.studentNumber.trim();
    const key = studentItemKey(studentId);
    const department = getDepartmentItem(state.department);
    return {
      PK: key,
      SK: key,
      full_name: formatStudentName(state.firstName, state.lastName),
      student_id: studentId,
      course: formatProgramAndYear(state.program, state.yearLevel),
      department: department?.name ?? state.department.trim(),
    };
  },
}));
