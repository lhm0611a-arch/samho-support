import { create } from 'zustand';
import { Counselor } from '../types';

export interface CounselorUser extends Counselor {
  country: string;
  password?: string;
  loginId?: string; // customized login ID, fallback to id
  isRetired?: boolean;
}

interface CounselorState {
  counselors: CounselorUser[];
  setCounselors: (counselors: CounselorUser[]) => void;
}

export const useCounselorStore = create<CounselorState>()(
  (set) => ({
    counselors: [],
    setCounselors: (counselors) => set({ counselors })
  })
);
