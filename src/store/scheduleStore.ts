import { create } from 'zustand';

export interface ScheduleEvent {
  id: string;
  counselorId: string;
  title: string;
  start: string;
  end: string;
  type: string;
  allDay?: boolean;
  performanceDetail?: string;
}

interface ScheduleState {
  events: ScheduleEvent[];
  setEvents: (events: ScheduleEvent[]) => void;
  addEvent: (event: ScheduleEvent) => void;
  removeEvent: (id: string) => void;
}

export const useScheduleStore = create<ScheduleState>((set) => ({
  events: [],
  setEvents: (events) => set({ events }),
  addEvent: (event) => set((state) => ({ events: [...state.events, event] })),
  removeEvent: (id) => set((state) => ({ events: state.events.filter((e) => e.id !== id) })),
}));
