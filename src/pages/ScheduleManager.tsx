import { safeFormat } from '../utils/safeDate';
import { safeDate } from '../utils/safeDate';
import React, { useState, useEffect, useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useAuthStore } from '../store/authStore';
import { Calendar as CalendarIcon, AlertTriangle, User, X } from 'lucide-react';
import { DUMMY_COMPANIES, CATEGORIES, COUNTRY_COLORS } from '../constants';
import { useScheduleStore } from '../store/scheduleStore';
import { useTicketStore } from '../store/ticketStore';
import { useCounselorStore } from '../store/counselorStore';
import { searchCompanies, debounce } from '../lib/hangulSearch';
import { Search } from 'lucide-react';

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

import { useFirestore } from '../hooks/useFirestore';
import { format, addMinutes } from 'date-fns';
import { TicketDetailModal } from '../components/TicketDetailModal';
import { CounselingTicket } from '../types';

const TIME_OPTIONS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00"
];

export const ScheduleManager = () => {
  const { role, user } = useAuthStore();
  const counselors = useCounselorStore(state => state.counselors);
  const { addTicket, deleteTicket, addEventToDB, removeEventFromDB, updateEventInDB } = useFirestore();
  const [selectedCounselorId, setSelectedCounselorId] = useState<string>(role === 'counselor' && user?.uid ? user.uid : 'all');
  const { events } = useScheduleStore();
  const { tickets } = useTicketStore();

  const [selectedTicket, setSelectedTicket] = useState<CounselingTicket | null>(null);

  // Event creation modal state
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [pendingEventRange, setPendingEventRange] = useState<any>(null);
  const [eventType, setEventType] = useState('연차');
  const [eventTitle, setEventTitle] = useState('');
  const [eventStartTime, setEventStartTime] = useState('09:00');
  const [eventEndTime, setEventEndTime] = useState('17:00');
  const [isAllDay, setIsAllDay] = useState(false);

  const durationHours = useMemo(() => {
    if (isAllDay) return 0;
    const [sH, sM] = eventStartTime.split(':').map(Number);
    const [eH, eM] = eventEndTime.split(':').map(Number);
    return (eH - sH) + (eM - sM) / 60;
  }, [isAllDay, eventStartTime, eventEndTime]);

  const isHalfDay = durationHours === 4;

  useEffect(() => {
    if (!isHalfDay && eventType === '반차') {
      setEventType('연차');
    }
  }, [isHalfDay, eventType]);

  // View/Delete Event modal state
  const [isViewEventModalOpen, setIsViewEventModalOpen] = useState(false);
  const [selectedEventDetails, setSelectedEventDetails] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [performanceText, setPerformanceText] = useState('');

  // Emergency walk-in modal state
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
  const [emWorkerName, setEmWorkerName] = useState('');
  const [emOrgType, setEmOrgType] = useState<'subcontractor' | 'direct'>('subcontractor');
  const [subcontractorsList, setSubcontractorsList] = useState<string[]>([]);
  const [directOrgsList, setDirectOrgsList] = useState<string[]>([]);
  const [emCompany, setEmCompany] = useState('');
  const [emCompanyResults, setEmCompanyResults] = useState<any[]>([]);

  const handleEmCompanySearch = debounce((val: string, orgType: 'subcontractor' | 'direct') => {
    const sourceList = orgType === 'subcontractor' ? subcontractorsList : directOrgsList;
    if (sourceList && sourceList.length > 0) {
      const dummyList = sourceList.map((s, idx) => ({ id: `org_${idx}`, name: s, company_code: s } as any));
      setEmCompanyResults(searchCompanies(dummyList, val));
    } else {
      setEmCompanyResults(searchCompanies(DUMMY_COMPANIES, val));
    }
  }, 300);


  const onEmCompanyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmCompany(e.target.value);
    handleEmCompanySearch(e.target.value, emOrgType);
  };
  
  useEffect(() => {
    if (emCompany) {
      handleEmCompanySearch(emCompany, emOrgType);
    } else {
      setEmCompanyResults([]);
    }
  }, [emOrgType]);





  useEffect(() => {
    const fetchOrgs = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'settings', 'organizations'));

        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.subcontractors) setSubcontractorsList(data.subcontractors);
          if (data.direct) setDirectOrgsList(data.direct);
        }

      } catch(err) {
        console.error(err);
      }
    };
    fetchOrgs();
  }, []);

  const [emCategory, setEmCategory] = useState(CATEGORIES[0]);
  const [emCounselor, setEmCounselor] = useState('');
  const [emReservationTime, setEmReservationTime] = useState('');
  const [emReservationEndTime, setEmReservationEndTime] = useState('');

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    if (counselors.length > 0 && !emCounselor) {
      const activeCounselor = counselors.find(c => !c.isRetired && c.country !== '한국' && !c.id.toLowerCase().startsWith('admin'));
      if (activeCounselor) {
        setEmCounselor(activeCounselor.id);
      }
    }
  }, [counselors, emCounselor]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleEventClick = (clickInfo: any) => {
    if (clickInfo.event.extendedProps.type === '상담') {
      const ticket = tickets.find(t => t.id === clickInfo.event.id);
      if (ticket) {
        setSelectedTicket(ticket);
        return;
      }
    }

    setSelectedEventDetails({
      id: clickInfo.event.id,
      title: clickInfo.event.title,
      startStr: clickInfo.event.startStr,
      endStr: clickInfo.event.endStr,
      extendedProps: clickInfo.event.extendedProps
    });
    setPerformanceText(clickInfo.event.extendedProps.performanceDetail || '');
    setIsViewEventModalOpen(true);
  };

  const handleDeleteEvent = () => {
    setShowDeleteConfirm(true);
  };

  const executeDelete = async () => {
    if (selectedEventDetails) {
      const isTicket = tickets.some(t => t.id === selectedEventDetails.id);
      try {
        if (isTicket) {
          await deleteTicket(selectedEventDetails.id);
        }
        // Also call removeEvent just in case it's in the local store
        removeEventFromDB(selectedEventDetails.id);
        
        setIsViewEventModalOpen(false);
        setSelectedEventDetails(null);
        setShowDeleteConfirm(false);
      } catch (error) {
        console.error("Error deleting event:", error);
        alert("삭제 중 오류가 발생했습니다.");
      }
    }
  };

  const checkOverlap = (cId: string, start: Date, end: Date, excludeId?: string) => {
    // 1. Check local events
    const overlapEvent = events.some(e => {
      if (e.counselorId !== cId) return false;
      if (excludeId && e.id === excludeId) return false;
      
      const eStart = safeDate(e.start);
      // If event has no end, assume 1 hour duration or all day based on format, simple fallback
      const eEnd = e.end ? safeDate(e.end) : addMinutes(eStart, 60);
      
      // All day check is complex, simple bounds check
      return start < eEnd && end > eStart;
    });

    // 2. Check tickets assigned to this counselor
    const overlapTicket = tickets.some(t => {
      if ((t.counselor_id || (t as any).assigned_counselor_id) !== cId) return false;
      if ((t.status as string) === '취소' || t.status === '처리완료') return false;
      if (excludeId && t.id === excludeId) return false;
      
      if (!t.reservation_time) return false;
      const tStart = safeDate(t.reservation_time);
      const tEnd = addMinutes(tStart, 30);
      
      return start < tEnd && end > tStart;
    });
    
    return overlapEvent || overlapTicket;
  };

  const handleDateSelect = (selectInfo: any) => {
    if ((role === 'admin' || role === 'sub-admin') && selectedCounselorId === 'all') {
      alert('일정을 등록할 개별 통역사를 먼저 선택해주세요.');
      selectInfo.view.calendar.unselect();
      return;
    }
    
    const startDt = selectInfo.startStr;
    const endDt = selectInfo.endStr;
    const isAllDaySelection = selectInfo.allDay;
    
    setIsAllDay(isAllDaySelection);

    if (!isAllDaySelection) {
      const timePart = startDt.split('T')[1];
      if (timePart) {
        setEventStartTime(timePart.substring(0, 5));
        setEventEndTime(endDt ? endDt.split('T')[1].substring(0, 5) : timePart.substring(0, 5));
      }
    } else {
      setEventStartTime('09:00');
      setEventEndTime('17:00');
    }

    setPendingEventRange({
      startStr: startDt.split('T')[0], // just the date part
      rawStart: startDt,
      rawEnd: endDt,
      calendarApi: selectInfo.view.calendar
    });
    setEventType('연차');
    setEventTitle('');
    setIsEventModalOpen(true);
  };

  const submitEvent = () => {
    let finalTitle = eventTitle.trim();
    if (eventType === '연차' || eventType === '반차') {
      finalTitle = eventType;
    } else if (!finalTitle) {
      alert("세부 업무 내용을 입력해주세요.");
      return;
    }
    
    if (!pendingEventRange) return;
    
    const cId = selectedCounselorId === 'all' 
      ? (role === 'counselor' && user?.uid ? user.uid : counselors.find(c => c.country !== '한국' && !c.id.toLowerCase().startsWith('admin'))?.id)
      : selectedCounselorId;
    
    let finalStartStr, finalEndStr;
    let checkStart, checkEnd;

    const baseDate = pendingEventRange.startStr;

    if (isAllDay) {
      finalStartStr = baseDate;
      finalEndStr = format(addMinutes(new Date(baseDate + 'T00:00:00'), 24 * 60), 'yyyy-MM-dd');
      checkStart = new Date(baseDate + 'T00:00:00');
      checkEnd = new Date(baseDate + 'T23:59:59'); 
    } else {
      finalStartStr = baseDate + 'T' + eventStartTime;
      finalEndStr = baseDate + 'T' + eventEndTime;
      checkStart = new Date(finalStartStr);
      checkEnd = new Date(finalEndStr);
    }

    if (checkStart >= checkEnd) {
      alert("종료 시간이 시작 시간보다 빠를 수 없습니다.");
      return;
    }

    if (checkOverlap(cId, checkStart, checkEnd)) {
      alert("선택하신 시간에 이미 등록된 일정이 있습니다.");
      return;
    }

    addEventToDB({
      id: Date.now().toString(),
      counselorId: cId,
      title: finalTitle,
      start: finalStartStr,
      end: finalEndStr,
      type: eventType
    });
    
    pendingEventRange.calendarApi.unselect();
    setIsEventModalOpen(false);
    setPendingEventRange(null);
  };

  const cancelEvent = () => {
    if (pendingEventRange) {
      pendingEventRange.calendarApi.unselect();
    }
    setIsEventModalOpen(false);
    setPendingEventRange(null);
  };

  const handleEmergencySubmit = async () => {
    if (!emWorkerName.trim()) {
      alert('근로자 이름을 입력해주세요.');
      return;
    }
    
    const selectedC = counselors.find(c => c.id === emCounselor);
    
    const ticketId = 'walk-in-' + Date.now();
    const now = emReservationTime ? safeDate(emReservationTime) : new Date();
    const endNow = emReservationEndTime ? safeDate(emReservationEndTime) : addMinutes(now, 60);
    
    const CRITICAL_KEYWORDS = ['임금체불', '폭언', '폭행', '범죄', '퇴사', '산재', '치료', '사망', '사고', '우울', '정서/심리'];
    const isRedFlag = CRITICAL_KEYWORDS.some(k => emCategory.includes(k));
    
    const newTicket = {
      worker_id: ticketId,
      worker_name: emWorkerName,
      company_code: emCompany,
      category: emCategory,
      country: selectedC?.country || '',
      status: '배정완료' as any,
      summary: '긴급 현장 접수',
      urgency: 'high' as any,
      required_action: '즉시 상담 필요',
      red_flag: isRedFlag,
      reservation_time: now.toISOString(),
      reservation_end_time: endNow.toISOString(),
      counselor_id: emCounselor
    };

    await addTicket(newTicket);
    
    try {
      await fetch('/api/notify-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ticket: newTicket, 
          telegram_chat_id: selectedC?.telegram_chat_id,
          counselor_name: selectedC?.name,
          type: 'ASSIGNED'
        })
      });
    } catch (err) {
      console.error('Failed to send emergency assignment notification:', err);
    }
    
    alert('긴급 상담이 접수/배정 되었습니다.');
    setIsEmergencyModalOpen(false);
    setEmWorkerName('');
    setEmReservationTime('');
    setEmReservationEndTime('');
  };

  const filteredEvents = React.useMemo(() => {
    // Standard events (vacations, ad-hoc, etc)
    const baseEvents = selectedCounselorId === 'all' 
      ? events 
      : events.filter(e => e.counselorId === selectedCounselorId);
      
    // Ticket reservations
    const ticketEvents = tickets
      .filter(t => t.reservation_time && (selectedCounselorId === 'all' || (t.counselor_id || (t as any).assigned_counselor_id) === selectedCounselorId))
      .map(t => {
        const cId = t.counselor_id || (t as any).assigned_counselor_id;
        return {
          id: t.id,
          counselorId: cId,
          title: `[예약] ${t.worker_name} (${t.category})`,
          start: t.reservation_time,
          end: t.reservation_end_time ? t.reservation_end_time : addMinutes(safeDate(t.reservation_time!), 60).toISOString(),
          type: '상담',
          status: t.status
        };
      });

    const allEventsMap = new Map();
    [...baseEvents, ...ticketEvents].forEach(e => allEventsMap.set(e.id, e));
    const allEvents = Array.from(allEventsMap.values());

    const mappedEvents = allEvents.map(e => {
      const cInfo = counselors.find(c => c.id === e.counselorId);
      let bgColor = 'rgba(255, 255, 255, 0.1)';
      let borderColor = 'rgba(255, 255, 255, 0.3)';

      if (cInfo && cInfo.country === '네팔') { bgColor = 'rgba(239, 68, 68, 0.2)'; borderColor = 'rgba(239, 68, 68, 1)'; }
      else if (cInfo && cInfo.country === '베트남') { bgColor = 'rgba(234, 179, 8, 0.2)'; borderColor = 'rgba(234, 179, 8, 1)'; }
      else if (cInfo && cInfo.country === '태국') { bgColor = 'rgba(59, 130, 246, 0.2)'; borderColor = 'rgba(59, 130, 246, 1)'; }
      else if (cInfo && cInfo.country === '우즈베키스탄') { bgColor = 'rgba(34, 197, 94, 0.2)'; borderColor = 'rgba(34, 197, 94, 1)'; }
      else if (cInfo && cInfo.country === '인도네시아') { bgColor = 'rgba(168, 85, 247, 0.2)'; borderColor = 'rgba(168, 85, 247, 1)'; }
      else if (cInfo && cInfo.country === '스리랑카') { bgColor = 'rgba(249, 115, 22, 0.2)'; borderColor = 'rgba(249, 115, 22, 1)'; }

      return {
        id: e.id,
        title: `[${e.type || '기타'}] ${cInfo?.name || '통역사'}`,
        start: e.start,
        end: e.end,
        backgroundColor: bgColor,
        borderColor: borderColor,
        textColor: '#fff',
        classNames: ['border-l-4', 'font-medium', 'shadow-sm'],
        extendedProps: {
          detailTitle: e.title,
          counselorName: cInfo?.name || '통역사',
          type: e.type || '기타',
          counselorId: cInfo?.id,
          performanceDetail: e.performanceDetail || '',
          isCompleted: e.type === '상담' ? e.status === '처리완료' : (!['연차', '반차'].includes(e.type) ? !!e.performanceDetail : false)
        }
      };
    });

    return [
      ...mappedEvents,
      {
        id: 'lunch-time',
        groupId: 'lunch-time',
        title: '점심시간',
        startTime: '12:00:00',
        endTime: '13:00:00',
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        display: 'background',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        classNames: ['lunch-time-bg']
      }
    ];
  }, [events, tickets, selectedCounselorId]);

  return (
    <div className={`glass-panel p-4 md:p-8 animate-fade-in-up flex flex-col relative w-full ${isMobile ? 'h-auto' : 'h-full min-h-0 overflow-hidden'}`}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 md:mb-8 gap-4 shrink-0">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-4">
            <h2 className="text-xl md:text-3xl font-bold text-center text-gradient tracking-tight flex items-center gap-2 md:gap-3">
              <CalendarIcon className="w-6 h-6 md:w-8 md:h-8 text-white/80" /> 
              <span className="hidden md:inline">통역사 일정 관리</span>
              <span className="md:hidden text-center">통역사<br/>일정 관리</span>
            </h2>
            <div className="flex items-center gap-2 bg-apple-gray/50 border border-apple-border rounded-md px-2 md:px-4 py-0">
              <User className="w-3 h-3 md:w-4 md:h-4 text-gray-400" />
              <select
                value={selectedCounselorId}
                onChange={(e) => setSelectedCounselorId(e.target.value)}
               
                className="bg-transparent text-sm md:text-base text-white focus:outline-none appearance-none text-center"
              >
                <option value="all" className="bg-apple-dark">모든 통역사</option>
                {role === 'counselor' ? (
                  <option value={user?.uid} className="bg-apple-dark">내 일정</option>
                ) : (
                  counselors.filter(c => c.country !== '한국' && !c.id.toLowerCase().startsWith('admin')).map(c => (
                    <option key={c.id} value={c.id} className="bg-apple-dark">
                      {c.country} - {c.name} {c.isRetired ? '(퇴사)' : ''}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-1 md:mt-2">
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-500/80 border border-red-500"></div><span className="text-[11px] text-gray-400">네팔</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80 border border-yellow-500"></div><span className="text-[11px] text-gray-400">베트남</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-blue-500/80 border border-blue-500"></div><span className="text-[11px] text-gray-400">태국</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-green-500/80 border border-green-500"></div><span className="text-[11px] text-gray-400"><span className="hidden md:inline">우즈베키스탄</span><span className="md:hidden">우즈벡</span></span></div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-purple-500/80 border border-purple-500"></div><span className="text-[11px] text-gray-400"><span className="hidden md:inline">인도네시아</span><span className="md:hidden">인니</span></span></div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-orange-500/80 border border-orange-500"></div><span className="text-[11px] text-gray-400">스리랑카</span></div>
          </div>
        </div>
        
        
      </div>
      
      <div className={`bg-apple-gray/20 rounded-[24px] border border-apple-border p-2 md:p-4 backdrop-blur-xl apple-calendar flex flex-col ${isMobile ? 'h-auto flex-none' : 'flex-1 min-h-0 overflow-hidden'}`}>
        <div className={`relative w-full ${isMobile ? 'h-auto' : 'flex-1 min-h-0 h-full'}`}>
          <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={isMobile ? "timeGridDay" : "timeGridWeek"}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: isMobile ? 'timeGridDay,timeGridWeek' : 'timeGridDay,timeGridWeek,dayGridMonth'
          }}
          views={{
            timeGridWeek: {
              titleFormat: isMobile ? { month: 'short', day: 'numeric' } : { year: 'numeric', month: 'short', day: 'numeric' },
              dayHeaderFormat: isMobile ? { day: 'numeric' } : { weekday: 'short', month: 'numeric', day: 'numeric', omitCommas: true }
            },
            timeGridDay: {
              titleFormat: isMobile ? { month: 'short', day: 'numeric' } : { year: 'numeric', month: 'short', day: 'numeric' },
              dayHeaderFormat: isMobile ? { day: 'numeric' } : { weekday: 'long', month: 'numeric', day: 'numeric', omitCommas: true }
            }
          }}
          editable={true}
          selectable={true}
          unselectAuto={false}
          selectMirror={true}
          dayMaxEvents={4}
          moreLinkClick="timeGridDay"
          allDaySlot={false}
          slotDuration="00:30:00"
          slotMinTime="08:00:00"
          slotMaxTime="18:00:00"
          selectLongPressDelay={100}
          eventLongPressDelay={100}
          height={isMobile ? "auto" : "100%"}
          expandRows={true}
          slotLabelFormat={{
            hour: 'numeric',
            minute: '2-digit',
            hour12: false
          }}
          eventTimeFormat={{
            hour: 'numeric',
            minute: '2-digit',
            hour12: false
          }}
          eventContent={(arg) => {
            const isCompleted = arg.event.extendedProps.isCompleted;
            return (
              <div className="flex flex-col h-full w-full overflow-hidden leading-tight p-0.5">
                <div className="flex items-center gap-1 shrink-0">
                  <div className="text-[10px] font-semibold opacity-90">{arg.timeText}</div>
                  {isCompleted && (
                    <span className="text-[9px] px-1 rounded-sm bg-blue-500 text-white font-medium">
                      실적등록 완료
                    </span>
                  )}
                </div>
                <div className="text-xs truncate font-medium mt-0.5">{arg.event.title}</div>
              </div>
            );
          }}
          selectAllow={(selectInfo) => {
            const start = selectInfo.start.getHours() + selectInfo.start.getMinutes() / 60;
            const end = selectInfo.end.getHours() + selectInfo.end.getMinutes() / 60;
            if (start < 13 && end > 12) {
              return false;
            }
            return true;
          }}
          events={filteredEvents}
          select={handleDateSelect}
          eventClick={handleEventClick}
        />
        </div>
      </div>

      {/* View Event Modal */}
      {isViewEventModalOpen && selectedEventDetails && (
        <div className="fixed top-0 left-0 w-full h-[100dvh] bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-apple-gray/90 border border-apple-border rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in-up">
            <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center">
              <h3 className="font-semibold text-white">일정 상세</h3>
              <button onClick={() => setIsViewEventModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-xs text-gray-400 mb-1">일정 구분</label>
                <div className="text-white text-lg font-medium">[{selectedEventDetails.extendedProps?.type || '일정'}] {selectedEventDetails.extendedProps?.counselorName}</div>
              </div>
              <div className="mb-4">
                <label className="block text-xs text-gray-400 mb-1">상세 내용</label>
                <div className="text-white text-base">{selectedEventDetails.extendedProps?.detailTitle || selectedEventDetails.title}</div>
              </div>
              <div className="mb-6">
                <label className="block text-xs text-gray-400 mb-1">시간</label>
                <div className="text-white text-sm">
                  {safeFormat(selectedEventDetails.startStr, 'yyyy.MM.dd HH:mm')} - {safeFormat(selectedEventDetails.endStr || selectedEventDetails.startStr, 'HH:mm')}
                </div>
              </div>

              {!['연차', '반차', '상담'].includes(selectedEventDetails.extendedProps?.type) && (
                <div className="mb-6">
                  <label className="block text-xs text-gray-400 mb-2">세부 업무 실적</label>
                  {(role === 'admin' || role === 'sub-admin' || user?.uid === selectedEventDetails.extendedProps?.counselorId) ? (
                    <textarea
                      value={performanceText}
                      onChange={(e) => setPerformanceText(e.target.value)}
                      className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors text-sm min-h-[100px] resize-y"
                      placeholder="수행한 업무 실적을 상세히 기록해주세요. (예: 안전보건부 안전교안 100페이지 번역 완료)"
                    />
                  ) : (
                    <div className="text-white text-sm whitespace-pre-wrap bg-black/20 p-4 rounded-xl border border-white/5 min-h-[100px]">
                      {performanceText || '등록된 업무 실적이 없습니다.'}
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                {(role === 'admin' || role === 'sub-admin' || user?.uid === selectedEventDetails.extendedProps?.counselorId) && (
                  <button
                    onClick={handleDeleteEvent}
                    className="px-4 py-2 rounded-xl text-red-400 hover:bg-red-500/20 font-medium transition-colors"
                  >
                    삭제
                  </button>
                )}
                {(role === 'admin' || role === 'sub-admin' || user?.uid === selectedEventDetails.extendedProps?.counselorId) && !['연차', '반차', '상담'].includes(selectedEventDetails.extendedProps?.type) && (
                  <button
                    onClick={async () => {
                      if (selectedEventDetails) {
                        try {
                          await updateEventInDB(selectedEventDetails.id, { performanceDetail: performanceText });
                          setIsViewEventModalOpen(false);
                          alert("업무 실적이 등록되었습니다.");
                        } catch (e) {
                          alert("저장 중 오류가 발생했습니다.");
                        }
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 font-medium transition-colors"
                  >
                    저장
                  </button>
                )}
                <button
                  onClick={() => setIsViewEventModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/10 text-white hover:bg-white/20 font-medium transition-colors"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Event Modal */}
      {isEventModalOpen && (
        <div className="fixed top-0 left-0 w-full h-[100dvh] bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-apple-gray/90 border border-apple-border rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in-up">
            <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center">
              <h3 className="font-semibold text-white">업무 일정 등록</h3>
              <button onClick={cancelEvent} className="text-gray-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              {['admin', 'sub-admin', 'counselor'].includes(role || '') && (
                <button
                  onClick={() => {
                    const dt = pendingEventRange?.rawStart ? safeFormat(pendingEventRange.rawStart, "yyyy-MM-dd'T'HH:mm") : '';
                    const dtEnd = pendingEventRange?.rawEnd ? safeFormat(pendingEventRange.rawEnd, "yyyy-MM-dd'T'HH:mm") : '';
                    setEmReservationTime(dt);
                    setEmReservationEndTime(dtEnd);
                    setIsEventModalOpen(false);
                    setIsEmergencyModalOpen(true);
                    if (pendingEventRange) {
                      pendingEventRange.calendarApi.unselect();
                      setPendingEventRange(null);
                    }
                  }}
                  className="w-full mb-6 px-4 py-3 bg-red-500/20 text-red-400 font-medium rounded-xl hover:bg-red-500/30 border border-red-500/50 transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                >
                  <AlertTriangle className="w-5 h-5" /> 긴급 상담 생성
                </button>
              )}
              
              <label className="block text-sm text-gray-400 mb-2">업무 유형</label>
              <select 
                value={eventType}
                onChange={e => setEventType(e.target.value)}
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none mb-4"
              >
                <option value="연차" className="bg-apple-dark">연차</option>
                {isHalfDay && <option value="반차" className="bg-apple-dark">반차</option>}
                <option value="교육통역" className="bg-apple-dark">교육통역</option>
                <option value="번역업무" className="bg-apple-dark">번역업무</option>
                <option value="현장지원" className="bg-apple-dark">현장지원</option>
                <option value="외근" className="bg-apple-dark">외근</option>
                <option value="기타" className="bg-apple-dark">기타 (직접 입력)</option>
              </select>
              
              {eventType !== '연차' && eventType !== '반차' && (
                <div className="mb-4">
                  <label className="block text-sm text-gray-400 mb-2">세부 업무 내용</label>
                  <input 
                    type="text" 
                    value={eventTitle}
                    onChange={e => setEventTitle(e.target.value)}
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                    placeholder="세부 업무 내용을 입력하세요 (예: 기술교육원 통역)"
                    autoFocus
                  />
                </div>
              )}
              
              <div className="mb-4">
                <label className="flex items-center gap-2 text-sm text-white mb-2 cursor-pointer">
                  <input type="checkbox" checked={isAllDay} onChange={e => setIsAllDay(e.target.checked)} className="rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500" />
                  하루 종일
                </label>
                {!isAllDay && (
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">시작 시간</label>
                      <select 
                        value={eventStartTime}
                        onChange={e => setEventStartTime(e.target.value)}
                        className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors appearance-none"
                      >
                        {TIME_OPTIONS.map(t => <option key={t} value={t} className="bg-apple-dark">{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">종료 시간</label>
                      <select 
                        value={eventEndTime}
                        onChange={e => setEventEndTime(e.target.value)}
                        className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors appearance-none"
                      >
                        {TIME_OPTIONS.map(t => <option key={t} value={t} className="bg-apple-dark">{t}</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex gap-3">
                <button onClick={cancelEvent} className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-colors font-medium">취소</button>
                <button onClick={submitEvent} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors font-medium shadow-[0_0_15px_rgba(37,99,235,0.4)]">등록</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Emergency Modal */}
      {isEmergencyModalOpen && (
        <div className="fixed top-0 left-0 w-full h-[100dvh] bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-apple-gray/90 border border-apple-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
            <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center">
              <h3 className="font-semibold text-white flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-red-400"/> 긴급 상담 생성</h3>
              <button onClick={() => setIsEmergencyModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">근로자 이름</label>
                <input 
                  type="text" 
                  value={emWorkerName}
                  onChange={e => setEmWorkerName(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-red-500 transition-colors"
                  placeholder="근로자 이름 입력"
                />
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm text-gray-400">소속 업체/부서</label>
                  <div className="flex bg-black/40 rounded-lg p-0.5">
                    <button
                      type="button"
                      onClick={() => { setEmOrgType('subcontractor'); setEmCompany(''); setEmCompanyResults([]); }}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                        emOrgType === 'subcontractor' ? 'bg-blue-500 text-white' : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      협력사
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEmOrgType('direct'); setEmCompany(''); setEmCompanyResults([]); }}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                        emOrgType === 'direct' ? 'bg-blue-500 text-white' : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      직영
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <Search className="absolute left-4 top-3 h-5 w-5 text-gray-500" />
                  <input
                    type="text"
                    value={emCompany}
                    onChange={onEmCompanyChange}
                    className="w-full pl-12 pr-4 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white focus:outline-none focus:border-red-500 transition-colors"
                    placeholder={emOrgType === 'subcontractor' ? '협력사명 또는 초성 입력(ㄱㄴㄷ)' : '직영 부서명 또는 초성 입력(ㄱㄴㄷ)'}
                  />
                </div>
                {emCompanyResults.length > 0 && emCompany && (
                  <div className="absolute z-10 w-full mt-1 bg-gray-900 border border-white/10 rounded-xl shadow-2xl max-h-48 overflow-y-auto">
                    {emCompanyResults.map(c => (
                      <button
                        key={c.company_code}
                        onClick={() => {
                          setEmCompany(c.name);
                          setEmCompanyResults([]);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-white/10 text-sm text-gray-300 border-b border-white/10 last:border-0 transition-colors"
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>


              <div>
                <label className="block text-sm text-gray-400 mb-1">상담 유형</label>
                <select 
                  value={emCategory}
                  onChange={e => setEmCategory(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-red-500 transition-colors appearance-none"
                >
                  {CATEGORIES.map(c => <option key={c} value={c} className="bg-apple-dark">{c}</option>)}
                </select>
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">상담 예약 시간</label>
                <input 
                  type="datetime-local" 
                  value={emReservationTime}
                  onChange={e => setEmReservationTime(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-red-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">배정할 통역사</label>
                <select 
                  value={emCounselor}
                  onChange={e => setEmCounselor(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-red-500 transition-colors appearance-none"
                >
                  {counselors.filter(c => !c.isRetired && c.country !== '한국' && !c.id.toLowerCase().startsWith('admin')).map(c => <option key={c.id} value={c.id} className="bg-apple-dark">{c.country} - {c.name}</option>)}
                </select>
              </div>

              <div className="mt-6 flex gap-3 pt-4 border-t border-white/10">
                <button onClick={() => setIsEmergencyModalOpen(false)} className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-colors font-medium">취소</button>
                <button onClick={handleEmergencySubmit} className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors font-medium shadow-[0_0_15px_rgba(220,38,38,0.4)]">긴급 접수</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed top-0 left-0 w-full h-[100dvh] bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="glass-panel w-full max-w-sm p-6 flex flex-col items-center text-center animate-fade-in-up border border-red-500/30">
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">일정 삭제</h3>
            <p className="text-sm text-gray-400 mb-6">
              정말로 이 일정을 삭제하시겠습니까?<br/>삭제된 데이터는 복구할 수 없습니다.
            </p>
            <div className="flex gap-3 w-full">
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-white text-sm font-medium transition-colors"
              >
                취소
              </button>
              <button 
                onClick={executeDelete}
                className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 rounded-xl text-white text-sm font-medium transition-colors shadow-[0_0_15px_rgba(239,68,68,0.3)]"
              >
                삭제하기
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
        />
      )}
    </div>
  );
};

