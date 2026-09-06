import { create } from 'zustand';
import { CounselingTicket } from '../types';

interface TicketState {
  tickets: CounselingTicket[];
  setTickets: (tickets: CounselingTicket[]) => void;
  updateTicketStatus: (id: string, status: CounselingTicket['status']) => void;
}

export const useTicketStore = create<TicketState>((set) => ({
  tickets: [],
  setTickets: (tickets) => set({ tickets }),
  updateTicketStatus: (id, status) => set((state) => ({
    tickets: state.tickets.map(t => t.id === id ? { ...t, status } : t)
  })),
}));
