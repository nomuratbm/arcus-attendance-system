import { create } from "zustand";
import { studentItemKey } from "@/store/dynamodb-keys";
import type { Student } from "@/store/student-item";

/**
 * DynamoDB Student item (registration write)
 *
 * PK: STUDENT#(student_id)
 * SK: STUDENT#(student_id)
 * full_name: string        // studentName
 * student_id: string       // studentNumber
 * course: string           // programYear
 * department: string
 */
export interface StudentFormData {
  studentName: string;
  studentNumber: string;
  programYear: string;
  department: string;
}

interface StudentFormState extends StudentFormData {
  submitting: boolean;
  setFormData: (data: Partial<StudentFormData>) => void;
  setSubmitting: (submitting: boolean) => void;
  clearFormData: () => void;
  buildStudentItem: () => Student;
}

const emptyFormData: StudentFormData = {
  studentName: "",
  studentNumber: "",
  programYear: "",
  department: "",
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
    return {
      PK: key,
      SK: key,
      full_name: state.studentName.trim(),
      student_id: studentId,
      course: state.programYear.trim(),
      department: state.department.trim(),
    };
  },
}));
