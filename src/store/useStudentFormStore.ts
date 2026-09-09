import { create } from "zustand";
import { memberItemKey } from "@/store/dynamodb-keys";
import type { Member } from "@/store/member-item";

/**
 * DynamoDB Member item (registration write)
 *
 * PK: MEMBER#(student_id)
 * SK: MEMBER#(student_id)
 * full_name: string        // studentName
 * student_id: string       // studentNumber
 * course: string           // programYear
 * department: string
 * current_organization: string
 */
export interface StudentFormData {
  studentName: string;
  studentNumber: string;
  programYear: string;
  department: string;
  organizationIds: string[];
  noOrganizationSelected: boolean;
}

interface StudentFormState extends StudentFormData {
  submitting: boolean;
  setFormData: (data: Partial<StudentFormData>) => void;
  setSubmitting: (submitting: boolean) => void;
  clearFormData: () => void;
  buildMemberItem: () => Member;
}

const emptyFormData: StudentFormData = {
  studentName: "",
  studentNumber: "",
  programYear: "",
  department: "",
  organizationIds: [],
  noOrganizationSelected: false,
};

export const useStudentFormStore = create<StudentFormState>((set, get) => ({
  ...emptyFormData,
  submitting: false,

  setFormData: (data) => set((state) => ({ ...state, ...data })),
  setSubmitting: (submitting) => set({ submitting }),

  clearFormData: () => set({ ...emptyFormData, submitting: false }),

  buildMemberItem: () => {
    const state = get();
    const studentId = state.studentNumber.trim();
    const key = memberItemKey(studentId);
    return {
      PK: key,
      SK: key,
      full_name: state.studentName.trim(),
      student_id: studentId,
      course: state.programYear.trim(),
      department: state.department.trim(),
      current_organization: "",
    };
  },
}));
