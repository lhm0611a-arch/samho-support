import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type LanguageCode = 'ko' | 'vi' | 'ne' | 'uz' | 'th' | 'si' | 'id';

interface LanguageState {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: 'ko',
      setLanguage: (language) => set({ language }),
    }),
    {
      name: 'language-storage',
    }
  )
);
