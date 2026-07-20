import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, Search, ChevronRight, Check, List, Plus, AlertTriangle, X } from 'lucide-react';
import { useFirestore } from '../hooks/useFirestore';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

import { useAuthStore } from '../store/authStore';
import { Company, Counselor } from '../types';
import { searchCompanies, debounce } from '../lib/hangulSearch';
import { DUMMY_COMPANIES, CATEGORIES, COUNTRIES } from '../constants';
import { useCounselorStore } from '../store/counselorStore';
import { useScheduleStore } from '../store/scheduleStore';
import { useTicketStore } from '../store/ticketStore';
import { format } from 'date-fns';
import { safeFormat, safeDate } from '../utils/safeDate';
import { useLanguageStore } from '../store/languageStore';
import { useTranslation } from '../utils/translations';

export const MobileBooking = () => {
  const language = useLanguageStore(state => state.language);
  const t = useTranslation(language);
  const { addTicket, checkNoShowPenalty, deleteTicket, updateTicket } = useFirestore();
  const { user } = useAuthStore();
  const { events: scheduleEvents, removeEvent } = useScheduleStore();
  const { tickets } = useTicketStore();
  
  const [shownNotifications, setShownNotifications] = useState<Set<string>>(new Set());

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'granted') {
      tickets.forEach(async (t) => {
        if (t.emp_id === user?.uid) {
          if (t.reception_notified && !shownNotifications.has(`reception_${t.id}`)) {
            new Notification('상담 접수 완료', {
              body: `${t.worker_name}님의 상담 접수가 완료되었습니다.`,
            });
            setShownNotifications(prev => new Set(prev).add(`reception_${t.id}`));
          }
          if (t.status === '배정완료' && !t.assignment_notified && !shownNotifications.has(`assignment_${t.id}`)) {
            new Notification('상담 배정 완료', {
              body: `${t.worker_name}님의 상담이 배정되었습니다.`,
            });
            setShownNotifications(prev => new Set(prev).add(`assignment_${t.id}`));
            if (t.id) await updateTicket(t.id, { assignment_notified: true });
          }
        }
      });
    }
  }, [tickets, user?.uid, updateTicket, shownNotifications]);
  
  const [activeTab, setActiveTab] = useState<'book' | 'history'>('book');
  const [step, setStep] = useState(1);
  const [showNotice, setShowNotice] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [deletingTicketId, setDeletingTicketId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState(user?.name || '');
  const [empId, setEmpId] = useState(user?.uid || '');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [workerPassword, setWorkerPassword] = useState(user?.password || '');
  const dateInputRef = useRef<HTMLInputElement>(null);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/[^0-9]/g, '');
    if (val.length > 8) val = val.substring(0, 8);
    
    let formatted = val;
    if (val.length >= 5) {
      formatted = `${val.substring(0, 4)}-${val.substring(4, 6)}`;
    }
    if (val.length >= 7) {
      formatted = `${val.substring(0, 4)}-${val.substring(4, 6)}-${val.substring(6, 8)}`;
    }
    setBirthDate(formatted);
  };

  const [selectedCountry, setSelectedCountry] = useState('');
  const [visaType, setVisaType] = useState('');
    const [query, setQuery] = useState('');
  const [orgType, setOrgType] = useState<'subcontractor' | 'direct'>('subcontractor');
  const [subcontractorsList, setSubcontractorsList] = useState<string[]>([]);
  const [directOrgsList, setDirectOrgsList] = useState<string[]>([]);
  
  useEffect(() => {
        const fetchOrgs = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'settings', 'organizations'));

        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.subcontractors) setSubcontractorsList(data.subcontractors);
          if (data.direct) setDirectOrgsList(data.direct);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchOrgs();
  }, []);

  const [companyResults, setCompanyResults] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [category, setCategory] = useState('');
  const [selectedCounselor, setSelectedCounselor] = useState<Counselor | null>(null);
  
  // Dummy Schedule
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');

  // Mock holidays for Korea (2026)
  const isHoliday = (date: Date) => {
    const dStr = date.toISOString().split('T')[0];
    const holidays = ['2026-01-01', '2026-03-01', '2026-05-05', '2026-06-06', '2026-08-15', '2026-09-23', '2026-09-24', '2026-09-25', '2026-10-03', '2026-10-09', '2026-12-25'];
    return holidays.includes(dStr);
  };

  const getValidDays = (count: number) => {
    const days = [];
    let current = new Date();
    while (days.length < count) {
      const isWeekend = current.getDay() === 0 || current.getDay() === 6;
      if (!isWeekend && !isHoliday(current)) {
        days.push(new Date(current));
      }
      current.setDate(current.getDate() + 1);
    }
    return days;
  };

  const validDays = getValidDays(5);

    const handleCompanySearch = debounce((val: string) => {
    const sourceList = orgType === 'subcontractor' ? subcontractorsList : directOrgsList;
    if (sourceList && sourceList.length > 0) {
      const dummyList = sourceList.map((s, idx) => ({ id: `org_${idx}`, name: s, company_code: s } as any));
      setCompanyResults(searchCompanies(dummyList, val));
    } else {
      setCompanyResults(searchCompanies(DUMMY_COMPANIES, val));
    }
  }, 300);



  const onQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setSelectedCompany(null);
    handleCompanySearch(e.target.value);
  };

  const handleNext = async () => {
    if (step === 1) {
      if (!name) return alert('이름을 입력하세요.');
      if (!empId) return alert('사번을 입력하세요.');
      if (!phoneNumber) return alert('핸드폰번호를 입력하세요.');
      if (!birthDate) return alert('생년월일을 선택하세요.');
      if (!query.trim()) return alert('소속 업체를 입력하세요.');
      if (!selectedCountry) return alert('국가를 선택하세요.');
      if (!visaType) return alert('비자 종류를 선택하거나 입력하세요.');
      if (!workerPassword || workerPassword.length !== 4) return alert('예약 확인용 비밀번호 숫자 4자리를 입력하세요.');
      
      try {
        const uidToCheck = user?.uid || empId;
        if (uidToCheck) {
          const isPenalized = await checkNoShowPenalty(uidToCheck);
          if (isPenalized) {
            alert("노쇼 3회 누적으로 예약이 제한되었습니다. 센터로 직접 방문해 주세요.");
            return;
          }
        }
      } catch (err) {
        console.error("Penalty check error:", err);
      }
      setStep(2);
    } else if (step === 2) {
      if (!category) return alert(t('my_bookings.counseling') ? t('my_bookings.counseling') + ' 유형을 선택하세요.' : '상담 유형을 선택하세요.');
      if (!selectedCounselor) return alert(t('my_bookings.counseling') ? t('my_bookings.counseling') + '사를 선택하세요.' : '상담사를 선택하세요.');
      setStep(3);
    } else if (step === 3) {
      if (!selectedDate || !selectedTime) return alert('예약 시간을 선택하세요.');
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    setIsProcessing(true);
    setToastMessage('예약을 접수하고 있습니다...');

    let finalSummary = `${selectedDate} ${selectedTime} 예약건`;
    let finalKeywords = [category];
    let finalUrgency: 'low'|'medium'|'high' = 'medium';
    const CRITICAL_KEYWORDS = ['임금체불', '폭언', '폭행', '범죄', '퇴사', '산재', '치료', '사망', '사고', '우울', '정서/심리'];
    let finalRedFlag = CRITICAL_KEYWORDS.some(k => category.includes(k));

    let finalRequiredAction = '';

    try {
      const ticketData = {
        worker_id: user.uid,
        worker_name: name,
        emp_id: empId,
        phone_number: phoneNumber,
        birth_date: birthDate,
        country: selectedCountry,
        visa_type: visaType,
        company_code: query.trim(),
        counselor_id: selectedCounselor!.id,
        category: category,
        status: '접수대기' as const,
        summary: finalSummary,
        urgency: finalUrgency,
        red_flag: finalRedFlag,
        required_action: finalRequiredAction,
        ...(selectedDate && selectedTime ? { reservation_time: `${selectedDate}T${selectedTime}:00` } : {}),
        worker_password: workerPassword
      };

      await addTicket(ticketData);

      // Send Telegram notification
      try {
        await fetch('/api/notify-telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            ticket: ticketData, 
            telegram_chat_id: selectedCounselor?.telegram_chat_id 
          })
        });
      } catch (err) {
        console.error('Telegram Notification error:', err);
      }

      setToastMessage('예약이 성공적으로 완료되었습니다.');
      setActiveTab('history');
      
      // Reset form states
      setStep(1);
      setSelectedCompany(null);
      setQuery('');
      setVisaType('');
      setCategory('');
      setSelectedCounselor(null);
      setSelectedDate('');
      setSelectedTime('');
    } catch (error) {
      console.error(error);
      setToastMessage('예약 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsProcessing(false);
      setTimeout(() => setToastMessage(''), 3000);
    }
  };

  const myTickets = tickets.filter(t => t.emp_id === empId || t.worker_id === empId).sort((a, b) => (b.created_at || 0) - (a.created_at || 0));

  return (
    <div className="max-w-2xl mx-auto min-h-full flex flex-col pb-8 relative">
      {showNotice && step === 1 && activeTab === 'book' && (
        <div className="fixed top-0 left-0 w-full h-[100dvh] z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#1A1A1A] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl relative">
            <button 
              onClick={() => setShowNotice(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 mb-4 text-amber-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-medium">Notice</h3>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed mb-6">
              {t('notice.popup')}
            </p>
            <button 
              onClick={() => setShowNotice(false)}
              className="w-full py-3 bg-white text-black font-medium rounded-xl hover:bg-gray-200 transition-colors"
            >
              확인 (OK)
            </button>
          </div>
        </div>
      )}

      
      {/* Tabs */}
      <div className="flex gap-2 mb-6 px-4 pt-4">
        <button
          onClick={() => setActiveTab('book')}
          className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'book'
              ? 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.2)]'
              : 'bg-white/10 text-gray-400 hover:bg-white/20'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" /> 예약하기
          </div>
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'history'
              ? 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.2)]'
              : 'bg-white/10 text-gray-400 hover:bg-white/20'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <List className="w-4 h-4" /> 내 예약 목록
          </div>
        </button>
      </div>

      {activeTab === 'history' && (
        <div className="px-4 space-y-4 animate-fade-in-up pb-8">
          {myTickets.length === 0 ? (
            <div className="text-center py-16 text-gray-400 bg-white/5 rounded-2xl border border-white/10 border-dashed">
              <List className="w-10 h-10 mx-auto text-gray-500 mb-3 opacity-50" />
              <p className="text-sm">{t('my_bookings.empty')}</p>
              <button 
                onClick={() => setActiveTab('book')}
                className="mt-4 px-4 py-2 bg-white/10 rounded-lg text-sm font-medium hover:bg-white/20 transition-colors text-white"
              >
                {t('nav.new_booking')}
              </button>
            </div>
          ) : (
            myTickets.map(ticket => (
              <div key={ticket.id} className="glass-panel p-5 rounded-2xl border border-white/10 relative overflow-hidden group">
                {ticket.red_flag && <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />}
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-white text-lg flex items-center gap-2">
                      {ticket.category} {t('my_bookings.counseling') || '상담'}
                      {ticket.urgency === 'high' && <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded text-[10px] font-bold uppercase">Urgent</span>}
                    </h3>
                    <p className="text-xs text-gray-400 mt-1">{ticket.country} · {ticket.company_code} {ticket.visa_type ? `· ${ticket.visa_type}` : ''}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                    ticket.status === '접수대기' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30 shadow-[0_0_10px_rgba(168,85,247,0.2)]' :
                    ticket.status === '배정완료' || ticket.status === '상담중' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.2)]' :
                    'bg-green-500/20 text-green-300 border-green-500/30 shadow-[0_0_10px_rgba(34,197,94,0.2)]'
                  }`}>
                    {ticket.status === '접수대기' ? t('status.waiting') : (ticket.status === '배정완료' || ticket.status === '상담중') ? t('status.in_progress') : t('status.completed')}
                  </span>
                </div>
                
                <div className="bg-black/20 rounded-xl p-3 mb-4 border border-white/5">
                  <div className="flex items-center gap-3 text-sm text-gray-300 mb-2">
                    <span className="w-12 text-gray-500 text-xs">{t('my_bookings.counseling_date')}</span>
                    <span className="font-medium text-blue-200">
                      {ticket.reservation_time ? safeFormat(ticket.reservation_time, 'yyyy년 MM월 dd일 HH:mm') : t('my_bookings.unassigned') || '미지정'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-300">
                    <span className="w-12 text-gray-500 text-xs">{t('my_bookings.counselor')}</span>
                    <span>
                      {ticket.counselor_id ? useCounselorStore.getState().counselors.find(c => c.id === ticket.counselor_id)?.name || '담당자' : <span className="text-gray-500">{t('my_bookings.waiting')}</span>}
                    </span>
                  </div>
                </div>
                
                {ticket.status === '처리완료' && ticket.action_result && (
                  <div className="mt-2 p-3 bg-white/5 rounded-xl border border-white/10 text-sm text-gray-300">
                    <span className="font-semibold flex items-center gap-1.5 mb-1 text-green-400 text-xs"><Check className="w-3.5 h-3.5" /> {t('my_bookings.result')}</span>
                    <p className="leading-relaxed">{ticket.action_result}</p>
                  </div>
                )}
                
                <div className="mt-4 flex justify-between items-center">
                  <span className="text-[10px] text-gray-500">{t('my_bookings.ticket_num')}: {ticket.id?.substring(0, 8)}</span>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      setDeletingTicketId(ticket.id!);
                    }}
                    className="px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg text-xs font-medium transition-colors z-10 relative"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingTicketId && (
        <div className="fixed top-0 left-0 w-full h-[100dvh] bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="glass-panel w-full max-w-sm p-6 flex flex-col items-center text-center animate-fade-in-up border border-red-500/30">
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">{t('my_bookings.cancel_confirm_title')}</h3>
            <p className="text-sm text-gray-400 mb-6">
              정말로 이 예약을 삭제하시겠습니까?<br/>삭제된 데이터는 복구할 수 없습니다.
            </p>
            <div className="flex gap-3 w-full">
              <button 
                onClick={() => setDeletingTicketId(null)}
                className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-white text-sm font-medium transition-colors"
              >
                취소
              </button>
              <button 
                onClick={async () => {
                  if (deletingTicketId) {
                    try {
                      await deleteTicket(deletingTicketId);
                      removeEvent(deletingTicketId);
                      setToastMessage('삭제되었습니다.');
                    } catch(err) {
                      console.error(err);
                      setToastMessage('삭제에 실패했습니다.');
                    }
                  }
                  setDeletingTicketId(null);
                  setTimeout(() => setToastMessage(''), 3000);
                }}
                className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 rounded-xl text-white text-sm font-medium transition-colors shadow-[0_0_15px_rgba(239,68,68,0.3)]"
              >
                삭제하기
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'book' && (
        <>
          {/* Progress */}

      {step < 4 && (
        <div className="flex gap-3 mb-10 mt-4 px-2">
          {[1, 2, 3].map(s => (
            <div key={s} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${step >= s ? 'bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]' : 'bg-white/10'}`} />
          ))}
        </div>
      )}

      {/* Step 1: Profile */}
      {step === 1 && (
        <div className="glass-panel p-5 md:p-6 w-full animate-fade-in-up">
          <h2 className="text-xl md:text-2xl font-light text-gradient mb-5 tracking-tight">{t('step1.title')}</h2>
          
          <div className="space-y-4 md:space-y-5">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{t('step1.name')}</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-4 py-3 bg-apple-gray/50 border border-apple-border rounded-xl focus:ring-2 focus:ring-white/20 outline-none text-white transition-all glass-panel-hover"
                placeholder="본인 이름을 입력하세요"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{t('step1.emp_id_readonly')}</label>
              <input
                type="text"
                value={empId}
                disabled
                className="w-full px-4 py-3 bg-apple-gray/20 border border-apple-border rounded-xl text-gray-400 outline-none cursor-not-allowed"
                placeholder="사번"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{t('step1.password')}</label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={workerPassword}
                onChange={e => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  setWorkerPassword(val);
                }}
                className="w-full px-4 py-3 bg-apple-gray/50 border border-apple-border rounded-xl focus:ring-2 focus:ring-white/20 outline-none text-white transition-all glass-panel-hover"
                placeholder="숫자 4자리를 입력하세요"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                ※ 개인정보 보호 및 예약 보안을 위해 사용되며, 설정하신 비밀번호는 본인의 예약 내역을 조회할 때 사용됩니다.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{t('step1.phone')}</label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={e => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  let res = val;
                  if (val.length > 3 && val.length <= 7) {
                    res = `${val.slice(0, 3)}-${val.slice(3)}`;
                  } else if (val.length > 7 && val.length < 11) {
                    res = `${val.slice(0, 3)}-${val.slice(3, 6)}-${val.slice(6)}`;
                  } else if (val.length >= 11) {
                    res = `${val.slice(0, 3)}-${val.slice(3, 7)}-${val.slice(7, 11)}`;
                  }
                  setPhoneNumber(res);
                }}
                className="w-full px-4 py-3 bg-apple-gray/50 border border-apple-border rounded-xl focus:ring-2 focus:ring-white/20 outline-none text-white transition-all glass-panel-hover"
                placeholder="핸드폰번호를 입력하세요"
              />
            </div>

            <div className="relative">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{t('step1.birth')}</label>
              <input
                type="text"
                inputMode="numeric"
                value={birthDate}
                onChange={handleDateChange}
                onClick={() => { try { dateInputRef.current?.showPicker(); } catch(err) {} }}
                className="w-full px-4 py-3 bg-apple-gray/50 border border-apple-border rounded-xl focus:ring-2 focus:ring-white/20 outline-none text-white transition-all glass-panel-hover"
                placeholder="YYYY-MM-DD (직접 입력 또는 터치)"
              />
              <input
                type="date"
                ref={dateInputRef}
                value={birthDate.length === 10 ? birthDate : '1990-01-01'}
                onChange={(e) => setBirthDate(e.target.value)}
                className="absolute bottom-0 left-0 w-full h-0 opacity-0 pointer-events-none"
                tabIndex={-1}
              />
            </div>

            <div className="relative">
                            <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('step1.company')}</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setOrgType('subcontractor'); setQuery(''); setCompanyResults([]); }} className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${orgType === 'subcontractor' ? 'bg-blue-500 text-white' : 'bg-white/10 text-gray-400 hover:text-white'}`}>협력사</button>
                  <button type="button" onClick={() => { setOrgType('direct'); setQuery(''); setCompanyResults([]); }} className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${orgType === 'direct' ? 'bg-blue-500 text-white' : 'bg-white/10 text-gray-400 hover:text-white'}`}>직영</button>
                </div>
              </div>

              <div className="relative">
                <Search className="absolute left-4 top-3.5 h-5 w-5 text-gray-500" />
                <input
                  type="text"
                  value={query}
                  onChange={onQueryChange}
                  className="w-full pl-12 pr-4 py-3 bg-apple-gray/50 border border-apple-border rounded-xl focus:ring-2 focus:ring-white/20 outline-none text-white transition-all glass-panel-hover"
                                                      placeholder={orgType === 'subcontractor' ? '협력사명 또는 초성 입력(ㄱㄴㄷ)' : '직영 부서명 또는 초성 입력(ㄱㄴㄷ)'}


                />
              </div>
              {companyResults.length > 0 && query && (
                <div className="absolute z-10 w-full mt-2 bg-apple-gray/90 backdrop-blur-xl border border-apple-border rounded-xl shadow-2xl max-h-48 overflow-y-auto">
                  {companyResults.map(c => (
                    <button
                      key={c.company_code}
                      onClick={() => {
                        setQuery(c.name);
                        setCompanyResults([]);
                      }}
                      className="w-full text-left px-5 py-4 hover:bg-white/10 text-sm text-gray-300 border-b border-apple-border last:border-0 transition-colors"
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{t('step1.country')}</label>
              <select
                value={selectedCountry}
                onChange={e => setSelectedCountry(e.target.value)}
                className="w-full px-4 py-3 bg-apple-gray/50 border border-apple-border rounded-xl focus:ring-2 focus:ring-white/20 outline-none text-white transition-all glass-panel-hover appearance-none"
              >
                <option value="">국가를 선택하세요</option>
                {COUNTRIES.map(country => (
                  <option key={country} value={country} className="bg-apple-dark">
                    {country}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{t('step1.visa')}</label>
              <div className="flex gap-2">
                {['E-9', 'E-7'].map(v => (
                  <button
                    key={v}
                    onClick={() => setVisaType(v)}
                    className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-colors ${
                      visaType === v 
                        ? 'bg-white text-black border-white shadow-[0_0_10px_rgba(255,255,255,0.2)]' 
                        : 'bg-apple-gray/50 text-gray-400 border-apple-border hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {v}
                  </button>
                ))}
                <button
                  onClick={() => setVisaType('기타')}
                  className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-colors ${
                    visaType === '기타' || (visaType !== 'E-9' && visaType !== 'E-7' && visaType !== '')
                      ? 'bg-white text-black border-white shadow-[0_0_10px_rgba(255,255,255,0.2)]' 
                      : 'bg-apple-gray/50 text-gray-400 border-apple-border hover:bg-white/10 hover:text-white'
                  }`}
                >
                  기타
                </button>
              </div>
              {(visaType !== 'E-9' && visaType !== 'E-7' && visaType !== '') && (
                <input
                  type="text"
                  value={visaType === '기타' ? '' : visaType}
                  onChange={e => setVisaType(e.target.value)}
                  className="mt-3 w-full px-4 py-3 bg-apple-gray/50 border border-apple-border rounded-xl focus:ring-2 focus:ring-white/20 outline-none text-white transition-all glass-panel-hover"
                  placeholder="비자 종류를 입력하세요 (예: F-2)"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Category & Counselor */}
      {step === 2 && (
        <div className="glass-panel p-8 w-full animate-fade-in-up space-y-10">
          <div>
            <h2 className="text-2xl font-light text-gradient mb-6 tracking-tight">{t('step2.title')}</h2>
            <div className="flex flex-wrap gap-3">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 border ${
                    category === cat 
                      ? 'bg-white text-black border-transparent shadow-[0_0_15px_rgba(255,255,255,0.2)]' 
                      : 'bg-apple-gray/50 text-gray-400 border-apple-border hover:bg-white/10 hover:text-white'
                  }`}
                >{t('category.' + cat as any)}</button>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-light text-gradient mb-6 tracking-tight">{t('step3.title')}</h2>
            <div className="space-y-4">
              {useCounselorStore.getState().counselors.filter(c => c.country === selectedCountry).map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCounselor(c)}
                  className={`w-full flex items-center justify-between p-5 rounded-xl border transition-all duration-300 ${
                    selectedCounselor?.id === c.id 
                      ? 'bg-white/10 border-white/30 text-white shadow-[0_0_15px_rgba(255,255,255,0.1)]' 
                      : 'bg-apple-gray/50 border-apple-border text-gray-400 hover:bg-white/5 hover:border-white/20'
                  }`}
                >
                  <span className="font-medium">{c.name}</span>
                  {selectedCounselor?.id === c.id && <Check className="w-5 h-5 text-white" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Schedule */}
      {step === 3 && (
        <div className="glass-panel p-4 md:p-8 w-full animate-fade-in-up">
          <h2 className="text-xl md:text-2xl font-light text-gradient mb-2 tracking-tight">{t('step4.title')}</h2>
          <p className="text-xs md:text-sm text-gray-400 mb-6 font-medium">{selectedCounselor?.name} {t('step4.desc')}</p>

          <div className="overflow-x-auto pb-2">
            <div className="min-w-[500px]">
              <div className="grid grid-cols-6 gap-2 mb-2">
                <div className="text-center"></div>
                {validDays.map((d, i) => (
                    <div key={i} className="text-center text-xs font-semibold text-gray-400">
                      {format(d, 'MM/dd')}<br />
                      <span className="text-[10px]">{format(d, 'E')}</span>
                    </div>
                ))}
              </div>
              
              <div className="space-y-2">
                {['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'].map(time => (
                  <div key={time} className="grid grid-cols-6 gap-2 items-center">
                    <div className="text-center text-xs font-semibold text-gray-500">{time}</div>
                    {validDays.map((d, i) => {
                      const dateStr = d.toISOString().split('T')[0];
                      
                      const slotStart = new Date(`${dateStr}T${time}:00`);
                      const slotEnd = new Date(slotStart.getTime() + 60 * 60000);
                      
                      const isBookedEvent = scheduleEvents.some(e => {
                        if (e.counselorId !== selectedCounselor?.id) return false;
                        const eStart = safeDate(e.start);
                        const eEnd = safeDate(e.end);
                        return (slotStart < eEnd && slotEnd > eStart);
                      });
                      
                      const isBookedTicket = tickets.some(t => {
                        if ((t.status as string) === '취소' || (t.status as string) === '반려') return false;
                        const cId = t.counselor_id || (t as any).assigned_counselor_id;
                        if (cId !== selectedCounselor?.id) return false;
                        if (!t.reservation_time) return false;
                        const tStart = safeDate(t.reservation_time);
                        const tEnd = new Date(tStart.getTime() + 60 * 60000); // assume 1 hour duration for ticket reservations
                        return (slotStart < tEnd && slotEnd > tStart);
                      });
                      
                      const isBooked = isBookedEvent || isBookedTicket;
                      
                      const isPast = slotStart < new Date();
                      const isLunch = time === '12:00';
                      const isAvailable = !isBooked && !isPast && !isLunch;
                      const isSelected = selectedDate === dateStr && selectedTime === time;

                      return (
                        <button
                          key={i}
                          disabled={!isAvailable}
                          onClick={() => {
                            setSelectedDate(dateStr);
                            setSelectedTime(time);
                          }}
                          className={`py-2 rounded-lg text-xs font-medium transition-all duration-300 border ${
                            isSelected 
                              ? 'bg-white text-black border-transparent shadow-[0_0_10px_rgba(255,255,255,0.3)]' 
                              : isLunch
                                ? 'bg-orange-500/10 text-orange-400 border-orange-500/20 cursor-not-allowed'
                                : isAvailable
                                  ? 'bg-apple-gray/50 text-gray-300 border-apple-border hover:bg-white/10 hover:text-white'
                                  : 'bg-black/20 text-gray-600 border-transparent cursor-not-allowed'
                          }`}
                        >
                          {isLunch ? t('slot.lunch') : (isAvailable ? t('slot.available') : t('slot.closed'))}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

    {/* Navigation Footer */}
      {step < 4 && (
        <div className="mt-8 pt-6 border-t border-apple-border flex justify-between gap-4 w-full z-40">
          {step > 1 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="px-6 py-4 bg-white/5 text-gray-300 font-medium rounded-xl hover:bg-white/10 transition-all flex-1 border border-white/10"
            >{t('btn.prev')}</button>
          )}
          {step < 3 ? (
            <button
              onClick={handleNext}
              className="flex-1 py-4 bg-white text-black font-medium rounded-xl hover:bg-gray-200 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
            >{t('btn.next')} <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleNext}
              disabled={isProcessing}
              className="flex-1 py-4 bg-white text-black font-medium rounded-xl hover:bg-gray-200 transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
            >
              {isProcessing ? t('btn.processing') : t('btn.submit')}
            </button>
          )}
        </div>
      )}
      </>
      )}

      {toastMessage && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 bg-white text-black px-8 py-4 rounded-full text-sm font-semibold shadow-[0_0_30px_rgba(255,255,255,0.2)] animate-fade-in-up whitespace-nowrap z-50">
          {toastMessage}
        </div>
      )}
    </div>
  );
};
