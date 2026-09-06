import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  user: any | null;
  role: 'worker' | 'counselor' | 'admin' | 'sub-admin' | null;
  company_code: string | null;
  login: (user: any, role: 'worker' | 'counselor' | 'admin' | 'sub-admin', company_code?: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      role: null,
      company_code: null,
      login: (user, role, company_code) => set({ user, role, company_code: company_code || null }),
      logout: () => set({ user: null, role: null, company_code: null }),
    }),
    {
      name: 'auth-storage', // name of item in the storage (must be unique)
    }
  )
);
