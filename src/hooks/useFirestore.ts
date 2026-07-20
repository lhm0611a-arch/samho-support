import { useEffect } from 'react';
import { collection, onSnapshot, query, addDoc, updateDoc, doc, getDocs, where, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useTicketStore } from '../store/ticketStore';
import { useCounselorStore, CounselorUser } from '../store/counselorStore';
import { CounselingTicket, Reservation } from '../types';
import { useAuthStore } from '../store/authStore';
import { useScheduleStore } from '../store/scheduleStore';
import { DUMMY_COUNSELORS } from '../constants';

export const useFirestore = () => {
  const setTickets = useTicketStore((state) => state.setTickets);
  const setCounselors = useCounselorStore((state) => state.setCounselors);
  const { role, company_code, user } = useAuthStore();

  useEffect(() => {
    // Sync Counselors
    const cQuery = query(collection(db, 'counselors'));
    const unsubCounselors = onSnapshot(cQuery, async (snapshot) => {
      if (snapshot.empty) {
        // Seed counselors if empty
        const promises = DUMMY_COUNSELORS.map(c => 
          setDoc(doc(db, 'counselors', c.id), {
            ...c,
            password: '1234'
          })
        );
        await Promise.all(promises);
      } else {
        const cList: CounselorUser[] = [];
        snapshot.forEach((doc) => {
          cList.push({ id: doc.id, ...doc.data() } as CounselorUser);
        });
        setCounselors(cList);
      }
    });

    if (!user) {
      return () => {
        unsubCounselors();
      };
    }

    // Sync Events
    const eventsQuery = query(collection(db, 'events'));
    const unsubEvents = onSnapshot(eventsQuery, (snapshot) => {
      const eventsList: any[] = [];
      snapshot.forEach((doc) => {
        eventsList.push({ id: doc.id, ...doc.data() });
      });
      useScheduleStore.getState().setEvents(eventsList);
    });

    let q = query(collection(db, 'counseling_tickets'));
    
    const unsubTickets = onSnapshot(q, (snapshot) => {
      const tickets: CounselingTicket[] = [];
      snapshot.forEach((doc) => {
        tickets.push({ id: doc.id, ...doc.data() } as CounselingTicket);
      });
      // Filter locally
      const filteredTickets = tickets.filter(t => {
        if (role === 'admin') return true;
        if (role === 'sub-admin') return t.company_code === company_code && t.category !== '정서/심리';
        if (role === 'worker') return true;
        if (role === 'counselor') return true;
        return false;
      });
      setTickets(filteredTickets);
    });

    return () => {
      unsubCounselors();
      unsubTickets();
      unsubEvents();
    };
  }, [setTickets, setCounselors, role, company_code, user]);

  const addTicket = async (ticket: Omit<CounselingTicket, 'id'>) => {
    await addDoc(collection(db, 'counseling_tickets'), {
      ...ticket,
      created_at: Date.now()
    });
  };

  const updateTicketStatus = async (id: string, status: CounselingTicket['status']) => {
    await updateDoc(doc(db, 'counseling_tickets', id), { status });
  };

  const updateTicket = async (id: string, updates: Partial<CounselingTicket>) => {
    await updateDoc(doc(db, 'counseling_tickets', id), updates);
  };

  const checkNoShowPenalty = async (workerId: string) => {
    const q = query(collection(db, 'reservations'), where('worker_id', '==', workerId), where('status', '==', 'no-show'));
    const snapshot = await getDocs(q);
    return snapshot.size >= 3;
  };

  const deleteTicket = async (id: string) => {
    await deleteDoc(doc(db, 'counseling_tickets', id));
  };

  const addEventToDB = async (event: any) => {
    // If event has no id, generate one (though fullcalendar or UI might provide it)
    const docRef = event.id ? doc(db, 'events', event.id) : doc(collection(db, 'events'));
    await setDoc(docRef, { ...event, id: docRef.id });
  };

  const removeEventFromDB = async (id: string) => {
    await deleteDoc(doc(db, 'events', id));
  };

  const updateEventInDB = async (id: string, updates: any) => {
    await updateDoc(doc(db, 'events', id), updates);
  };

  const updateCounselorPassword = async (id: string, newPassword: string) => {
    await setDoc(doc(db, 'counselors', id), { password: newPassword }, { merge: true });
  };

  const addCounselorToDB = async (counselor: any) => {
    await setDoc(doc(db, 'counselors', counselor.id), counselor);
  };

  const updateCounselorInDB = async (id: string, updates: any) => {
    await updateDoc(doc(db, 'counselors', id), updates);
  };

  const removeCounselorFromDB = async (id: string) => {
    await updateDoc(doc(db, 'counselors', id), { isRetired: true });
  };

  const reinstateCounselorInDB = async (id: string) => {
    await updateDoc(doc(db, 'counselors', id), { isRetired: false });
  };

  const permanentlyDeleteCounselorFromDB = async (id: string) => {
    await deleteDoc(doc(db, 'counselors', id));
  };

  return { 
    addTicket, 
    updateTicketStatus, 
    updateTicket, 
    checkNoShowPenalty, 
    deleteTicket, 
    addEventToDB, 
    removeEventFromDB, 
    updateEventInDB,
    updateCounselorPassword, 
    addCounselorToDB, 
    updateCounselorInDB, 
    removeCounselorFromDB,
    reinstateCounselorInDB,
    permanentlyDeleteCounselorFromDB
  };
};
