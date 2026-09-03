import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { memberItemKey } from "@/store/dynamodb-keys";
import type { Member } from "@/store/member-item";

/**
 * DynamoDB Member item (registration write)
 *
 * PK: MEMBER#(uuid)
 * SK: MEMBER#(uuid)
 * full_name: string        // studentName
 * student_id: string       // studentNumber
 * course: string           // programYear
 * department: string
 */
export interface StudentFormData {
  uuid: string;
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
  uuid: "",
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
        const uuid = state.uuid || crypto.randomUUID();
        if (!state.uuid) {
          set({ uuid });
        }

        const key = memberItemKey(uuid);
        return {
          PK: key,
          SK: key,
          full_name: state.studentName.trim(),
          student_id: state.studentNumber.trim(),
          course: state.programYear.trim(),
          department: state.department.trim(),
        };
      },
    }),
    {
      name: "arcus-student-form",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        uuid: state.uuid,
        studentName: state.studentName,
        studentNumber: state.studentNumber,
        programYear: state.programYear,
        department: state.department,
      }),
    },
  ),
);
