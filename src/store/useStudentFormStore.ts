import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

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
  studentName: string;
  studentNumber: string;
  programYear: string;
  department: string;
}

interface StudentFormState extends StudentFormData {
  setFormData: (data: Partial<StudentFormData>) => void;
  clearFormData: () => void;
}

const emptyFormData: StudentFormData = {
  studentName: "",
  studentNumber: "",
  programYear: "",
  department: "",
};

export const useStudentFormStore = create<StudentFormState>()(
  persist(
    (set) => ({
      ...emptyFormData,

      setFormData: (data) => set((state) => ({ ...state, ...data })),

      clearFormData: () => set(emptyFormData),
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
