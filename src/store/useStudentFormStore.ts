import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
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
 */
export interface StudentFormData {
  studentName: string;
  studentNumber: string;
  programYear: string;
  department: string;
}

interface StudentFormState extends StudentFormData {
  setFormData: (data: Partial<StudentFormData>) => void;
  clearFormData: () => void;
  buildMemberItem: () => Member;
}

const emptyFormData: StudentFormData = {
  studentName: "",
  studentNumber: "",
  programYear: "",
  department: "",
};

export const useStudentFormStore = create<StudentFormState>()(
  persist(
    (set, get) => ({
      ...emptyFormData,

      setFormData: (data) => set((state) => ({ ...state, ...data })),

      clearFormData: () => set(emptyFormData),

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
        };
      },
    }),
    {
      name: "arcus-student-form",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        studentName: state.studentName,
        studentNumber: state.studentNumber,
        programYear: state.programYear,
        department: state.department,
      }),
    },
  ),
);
