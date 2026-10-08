import { safeFormat } from '../utils/safeDate';
import { safeDate } from '../utils/safeDate';
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CounselingTicket } from '../types';
import { X, Check, Mic, Square, Brain, AlertTriangle, Trash2, MessageSquare, Phone, Edit2, Save, UserCheck } from 'lucide-react';
import { useCounselorStore } from '../store/counselorStore';
import { useFirestore } from '../hooks/useFirestore';
import { useScheduleStore } from '../store/scheduleStore';
import { useAuthStore } from '../store/authStore';
import { format } from 'date-fns';
import { CATEGORIES, CATEGORY_GROUPS, REQUESTER_TYPES, VISA_TYPES, COUNTRIES, cleanCountryName } from '../constants';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { isCounselorId } from '../utils/counselorHelper';

interface Props {
  ticket: CounselingTicket;
  onClose: () => void;
}

import { useTicketStore } from '../store/ticketStore';
export const TicketDetailModal: React.FC<Props> = ({ ticket: initialTicket, onClose }) => {
  const allTickets = useTicketStore(state => state.tickets);
  const ticket = allTickets.find(t => t.id === initialTicket.id) || initialTicket;


  const timeOptions = Array.from({ length: 19 }, (_, i) => {
    const h = Math.floor(i / 2) + 8;
    const m = i % 2 === 0 ? '00' : '30';
    return `${h.toString().padStart(2, '0')}:${m}`;
  });

  const counselors = useCounselorStore(state => state.counselors);
  const { role } = useAuthStore();
  const { updateTicket, deleteTicket, addEventToDB, removeEventFromDB } = useFirestore();
  const { addEvent, events } = useScheduleStore();
  const [selectedCounselor, setSelectedCounselor] = useState(ticket.counselor_id || (ticket as any).assigned_counselor_id || '');
  const [notes, setNotes] = useState(ticket.action_result || '');
  
  const [counselingDate, setCounselingDate] = useState('');
  const [counselingStartTime, setCounselingStartTime] = useState('');
  const [counselingEndTime, setCounselingEndTime] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Worker profile edit state (상담내용 작성 시 인적사항 수정 기능)
  const [isEditingWorkerInfo, setIsEditingWorkerInfo] = useState(false);
  const [workerName, setWorkerName] = useState(ticket.worker_name || '');
  const [phoneNumber, setPhoneNumber] = useState(ticket.phone_number || '');
  const [visaType, setVisaType] = useState(ticket.visa_type || '');
  const [customVisa, setCustomVisa] = useState('');
  const [requesterType, setRequesterType] = useState(ticket.requester_type || '근로자 본인');
  const [companyCode, setCompanyCode] = useState(ticket.company_code || '');
  const [country, setCountry] = useState(ticket.country || '');
  const [isSavingWorkerInfo, setIsSavingWorkerInfo] = useState(false);
  const [workerSaveSuccess, setWorkerSaveSuccess] = useState(false);

  useEffect(() => {
    setSelectedCounselor(ticket.counselor_id || (ticket as any).assigned_counselor_id || '');
    setNotes(ticket.action_result || '');
    
    setWorkerName(ticket.worker_name || '');
    setPhoneNumber(ticket.phone_number || '');
    if (ticket.visa_type && !VISA_TYPES.includes(ticket.visa_type)) {
      setVisaType('기타');
      setCustomVisa(ticket.visa_type);
    } else {
      setVisaType(ticket.visa_type || 'E-9');
      setCustomVisa('');
    }
    setRequesterType(ticket.requester_type || '근로자 본인');
    setCompanyCode(ticket.company_code || '');
    setCountry(ticket.country || '');
    
    if (ticket.reservation_time) {
      const start = safeDate(ticket.reservation_time);
      if (!isNaN(start.getTime())) {
        setCounselingDate(format(start, 'yyyy-MM-dd'));
        setCounselingStartTime(format(start, 'HH:mm'));
        
        if (ticket.reservation_end_time) {
          setCounselingEndTime(safeFormat(ticket.reservation_end_time, 'HH:mm'));
        } else {
          const end = new Date(start.getTime() + 60 * 60 * 1000);
          setCounselingEndTime(format(end, 'HH:mm'));
        }
      }
    }
  }, [ticket]);

  const handleSaveWorkerInfo = async () => {
    if (!ticket.id) return;
    setIsSavingWorkerInfo(true);
    const finalVisa = visaType === '기타' ? (customVisa.trim() || '기타') : visaType;
    try {
      await updateTicket(ticket.id, {
        worker_name: workerName.trim(),
        phone_number: phoneNumber.trim(),
        visa_type: finalVisa,
        requester_type: requesterType,
        company_code: companyCode.trim(),
        country: country.trim()
      });
      setWorkerSaveSuccess(true);
      setTimeout(() => setWorkerSaveSuccess(false), 2500);
      setIsEditingWorkerInfo(false);
    } catch (err) {
      console.error('Failed to update worker info:', err);
      alert('인적사항 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSavingWorkerInfo(false);
    }
  };

  const { isRecording, startRecording, stopRecording, audioBlob, setAudioBlob } = useAudioRecorder();
  const [isProcessingAI, setIsProcessingAI] = useState(false);

  const handleAssign = async () => {
    if (!selectedCounselor) return;
    
    const updates: Partial<CounselingTicket> = {
      status: '배정완료', 
      counselor_id: selectedCounselor 
    };
    
    if (!ticket.reservation_time) {
      updates.reservation_time = new Date().toISOString();
    }
    
    await updateTicket(ticket.id!, updates);
    
    let start = new Date();
    if (updates.reservation_time) {
      const parsed = safeDate(updates.reservation_time);
      if (!isNaN(parsed.getTime())) {
        start = parsed;
      }
    }
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    
    addEvent({
      id: ticket.id!,
      counselorId: selectedCounselor,
      title: `[배정] ${ticket.worker_name} (${ticket.category})`,
      start: start.toISOString(),
      end: end.toISOString(),
      type: '상담'
    });

    try {
      const assignedCounselor = counselors.find(c => c.id === selectedCounselor);
      await fetch('/api/notify-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ticket: { ...ticket, status: '배정완료', counselor_id: selectedCounselor },
          telegram_chat_id: assignedCounselor?.telegram_chat_id,
          counselor_name: assignedCounselor?.name,
          type: 'ASSIGNED'
        })
      });
    } catch (err) {
      console.error('Failed to send assignment notification:', err);
    }
    
    onClose();
  };

  const [isCompleting, setIsCompleting] = useState(false);
  const handleComplete = async () => {
    setIsCompleting(true);
    let finalResTime = ticket.reservation_time;
    let finalResEndTime = ticket.reservation_end_time;

    let oneLineSummary = notes;
    try {
      const response = await fetch('/api/generate-one-line-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.summary) {
          oneLineSummary = data.summary;
        }
      }
    } catch (e) {
      console.error('Failed to generate summary', e);
    }

    if (counselingDate && counselingStartTime && counselingEndTime) {
      const newStart = new Date(`${counselingDate}T${counselingStartTime}:00`);
      const newEnd = new Date(`${counselingDate}T${counselingEndTime}:00`);
      
      if (!isNaN(newStart.getTime()) && !isNaN(newEnd.getTime())) {
        finalResTime = newStart.toISOString();
        finalResEndTime = newEnd.toISOString();

        if (selectedCounselor) {
          const counselorEvents = events.filter(e => e.counselorId === selectedCounselor && e.type !== '상담');
          for (const ev of counselorEvents) {
            const evStart = safeDate(ev.start);
            const evEnd = safeDate(ev.end);
            
            // Check if there is overlap
            if (evStart < newEnd && evEnd > newStart) {
              if (newStart > evStart && newEnd < evEnd) {
                // Split event
                await addEventToDB({ ...ev, end: newStart.toISOString() });
                await addEventToDB({ ...ev, id: undefined, start: newEnd.toISOString() });
              } else if (newStart <= evStart && newEnd < evEnd) {
                // Shrink start
                await addEventToDB({ ...ev, start: newEnd.toISOString() });
              } else if (newStart > evStart && newEnd >= evEnd) {
                // Shrink end
                await addEventToDB({ ...ev, end: newStart.toISOString() });
              } else if (newStart <= evStart && newEnd >= evEnd) {
                // Remove entirely
                await removeEventFromDB(ev.id);
              }
            }
          }
        }
      }
    }

    const finalVisa = visaType === '기타' ? (customVisa.trim() || '기타') : visaType;

    await updateTicket(ticket.id!, { 
      status: '처리완료',
      action_result: notes,
      counseling_summary: oneLineSummary,
      reservation_time: finalResTime,
      reservation_end_time: finalResEndTime,
      counselor_id: selectedCounselor,
      worker_name: workerName.trim() || ticket.worker_name,
      phone_number: phoneNumber.trim() || ticket.phone_number,
      visa_type: finalVisa || ticket.visa_type,
      requester_type: requesterType || ticket.requester_type,
      company_code: companyCode.trim() || ticket.company_code,
      country: country.trim() || ticket.country
    });
    setIsCompleting(false);
    onClose();
  };

  const [isGeneratingResponse, setIsGeneratingResponse] = useState(false);
  const [translatedMessage, setTranslatedMessage] = useState('');
  const [recommendedAction, setRecommendedAction] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleAIAnalyze = async () => {
    if (!audioBlob) return;
    setIsProcessingAI(true);
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('workerName', ticket.worker_name || '');
      formData.append('companyCode', ticket.company_code || '');
      formData.append('counselorName', counselors.find(c => c.id === selectedCounselor)?.name || '');
      const response = await fetch('/api/analyze-audio', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        const minutes = data.ai_summary?.meeting_minutes || '인식 실패';
        setNotes(prev => prev ? `${prev}\n\n[상담록]\n${minutes}` : `[상담록]\n${minutes}`);
      } else {
        alert('AI 분석 중 오류가 발생했습니다.');
      }
    } catch (e) {
      alert('AI 분석 중 오류가 발생했습니다.');
    } finally {
      setIsProcessingAI(false);
      setAudioBlob(null);
    }
  };

  const handleGenerateAIResponse = async () => {
    setIsGeneratingResponse(true);
    try {
      const response = await fetch('/api/generate-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: ticket.summary || '',
          notes: notes || '',
          category: ticket.category || '',
          country: ticket.country || ''
        })
      });

      if (response.ok) {
        const data = await response.json();
        setRecommendedAction(data.recommended_action || '');
        setTranslatedMessage(data.translated_message || '');
      } else {
        alert('AI 조치 제안 중 오류가 발생했습니다.');
      }
    } catch (e) {
      alert('AI 조치 제안 중 오류가 발생했습니다.');
    } finally {
      setIsGeneratingResponse(false);
    }
  };

  const handleDelete = async () => {
    setShowDeleteConfirm(true);
  };

  const executeDelete = async () => {
    if (ticket.id) {
      await deleteTicket(ticket.id);
    }
    onClose();
  };

  const getModalTitle = () => {
    if (ticket.status === '접수대기') return <span className="block leading-tight">상담 접수 현황</span>;
    if (ticket.status === '배정완료' || ticket.status === '상담중') return <span className="block leading-tight">상담자 배정 및 상담 내용 등록</span>;
    if (ticket.status === '처리완료') return '상담 상세 현황';
    return '상담 내역 상세';
  };

  return createPortal(
    <div className="fixed top-0 left-0 w-full h-[100dvh] bg-black/70 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-fade-in-up">
      <div className="dx-card w-full max-w-2xl overflow-hidden flex flex-col max-h-full border border-[#1e3a5f] shadow-2xl !p-0">
        <div className="px-5 py-3.5 border-b border-[#1e3a5f] flex justify-between items-center bg-[#051326]">
          <h2 className="text-base font-bold text-[#f8fafc] tracking-wide flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#00a859]"></span>
            {getModalTitle()}
          </h2>
          <div className="flex gap-2 items-center">
            {role === 'admin' && (
              <button onClick={handleDelete} className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-red-500/20 rounded-lg text-red-400 hover:text-red-300 transition-colors text-xs font-bold border border-transparent hover:border-red-500/30 mr-1" title="삭제">
                <Trash2 className="w-3.5 h-3.5" />
                삭제
              </button>
            )}
            <button onClick={onClose} className="p-1.5 hover:bg-[#002c5f] rounded-lg text-[#94a3b8] hover:text-[#f8fafc] transition-colors border border-transparent hover:border-[#1e3a5f]">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="p-6 pb-24 md:pb-6 overflow-y-auto flex-1 custom-scrollbar space-y-5 bg-[#08172c]">
          {/* Worker Info Card */}
          <div className="p-4 rounded-xl bg-[#051326] border border-[#1e3a5f] relative">
            <div className="flex justify-between items-center pb-2.5 mb-3 border-b border-[#1e3a5f]/80">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#38bdf8]"></span>
                <span className="text-xs font-bold text-[#f8fafc] tracking-wider uppercase">상담 요청자 인적사항</span>
                {workerSaveSuccess && (
                  <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1 animate-fade-in">
                    <Check className="w-3.5 h-3.5" /> 저장 완료
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!isEditingWorkerInfo ? (
                  <button
                    type="button"
                    onClick={() => setIsEditingWorkerInfo(true)}
                    className="px-2.5 py-1 bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25 border border-cyan-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                  >
                    <Edit2 className="w-3 h-3" />
                    인적사항 수정
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditingWorkerInfo(false)}
                    className="px-2.5 py-1 bg-white/5 text-gray-300 hover:bg-white/10 rounded-lg text-xs font-medium transition-colors"
                  >
                    취소
                  </button>
                )}
              </div>
            </div>

            {isEditingWorkerInfo ? (
              /* Inline Edit Mode */
              <div className="space-y-3.5 animate-fade-in text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#94a3b8] font-bold mb-1">근로자 이름 <span className="text-red-400">*</span></label>
                    <input
                      type="text"
                      value={workerName}
                      onChange={e => setWorkerName(e.target.value)}
                      className="w-full dx-input !py-1.5 !px-3 text-xs text-white"
                      placeholder="근로자 이름"
                    />
                  </div>
                  <div>
                    <label className="block text-[#94a3b8] font-bold mb-1">핸드폰번호 <span className="text-red-400">*</span></label>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={e => setPhoneNumber(e.target.value)}
                      className="w-full dx-input !py-1.5 !px-3 text-xs text-white"
                      placeholder="010-0000-0000"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#94a3b8] font-bold mb-1">상담 요청자 및 대상자 구분</label>
                    <select
                      value={requesterType}
                      onChange={e => setRequesterType(e.target.value)}
                      className="w-full dx-input !py-1.5 !px-3 text-xs text-white cursor-pointer"
                    >
                      {REQUESTER_TYPES.map(rt => (
                        <option key={rt} value={rt} className="bg-slate-900">{rt}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[#94a3b8] font-bold mb-1">체류자격 (비자 종류)</label>
                    <div className="flex gap-2">
                      <select
                        value={visaType}
                        onChange={e => setVisaType(e.target.value)}
                        className="flex-1 dx-input !py-1.5 !px-3 text-xs text-white cursor-pointer"
                      >
                        {VISA_TYPES.map(v => (
                          <option key={v} value={v} className="bg-slate-900">{v}</option>
                        ))}
                      </select>
                      {visaType === '기타' && (
                        <input
                          type="text"
                          value={customVisa}
                          onChange={e => setCustomVisa(e.target.value)}
                          className="flex-1 dx-input !py-1.5 !px-2.5 text-xs text-white"
                          placeholder="비자 직접 입력"
                        />
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#94a3b8] font-bold mb-1">소속 업체</label>
                    <input
                      type="text"
                      value={companyCode}
                      onChange={e => setCompanyCode(e.target.value)}
                      className="w-full dx-input !py-1.5 !px-3 text-xs text-white"
                      placeholder="업체명 또는 부서명"
                    />
                  </div>
                  <div>
                    <label className="block text-[#94a3b8] font-bold mb-1">국가</label>
                    <select
                      value={country}
                      onChange={e => setCountry(e.target.value)}
                      className="w-full dx-input !py-1.5 !px-3 text-xs text-white cursor-pointer"
                    >
                      <option value="">국가 선택</option>
                      {COUNTRIES.map(c => (
                        <option key={c} value={c} className="bg-slate-900">{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="pt-2 flex justify-end items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingWorkerInfo(false)}
                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-xs font-semibold transition-colors"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    disabled={isSavingWorkerInfo}
                    onClick={handleSaveWorkerInfo}
                    className="dx-btn-primary !py-1.5 !px-4 text-xs font-bold flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {isSavingWorkerInfo ? '저장 중...' : '인적사항 저장하기'}
                  </button>
                </div>
              </div>
            ) : (
              /* View Mode */
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                <div>
                  <p className="text-[11px] md:text-xs text-[#94a3b8] font-bold tracking-wide uppercase mb-0.5">근로자</p>
                  <p className="text-[#f8fafc] font-bold text-sm flex items-center gap-1.5">
                    {ticket.worker_name || ticket.worker_id}
                    {ticket.red_flag && ticket.category !== '기타' && (
                      <span className="type-badge badge-fail text-[10px]">Red Flag</span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] md:text-xs text-[#94a3b8] font-bold tracking-wide uppercase mb-0.5">핸드폰번호</p>
                  {ticket.phone_number ? (
                    <a href={`tel:${ticket.phone_number}`} className="text-[#38bdf8] hover:underline font-bold text-sm flex items-center gap-1 w-fit">
                      <Phone className="w-3.5 h-3.5" /> {ticket.phone_number}
                    </a>
                  ) : (
                    <p className="text-[#cbd5e1] font-medium text-sm text-yellow-400/80">미등록 (수정 필요)</p>
                  )}
                </div>
                <div>
                  <p className="text-[11px] md:text-xs text-[#94a3b8] font-bold tracking-wide uppercase mb-0.5">체류자격 (비자)</p>
                  <p className="text-cyan-300 font-bold text-sm">
                    {ticket.visa_type || <span className="text-gray-500 font-normal">-</span>}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] md:text-xs text-[#94a3b8] font-bold tracking-wide uppercase mb-0.5">상담 요청자 구분</p>
                  <p className="text-[#cbd5e1] font-medium text-sm">
                    {ticket.requester_type || '근로자 본인'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] md:text-xs text-[#94a3b8] font-bold tracking-wide uppercase mb-0.5">국가</p>
                  <p className="text-[#cbd5e1] font-medium text-sm">{cleanCountryName(ticket.country)}</p>
                </div>
                <div>
                  <p className="text-[11px] md:text-xs text-[#94a3b8] font-bold tracking-wide uppercase mb-0.5">소속 업체</p>
                  <p className="text-[#cbd5e1] font-medium text-sm">{ticket.company_code || '-'}</p>
                </div>
                <div>
                  <p className="text-[11px] md:text-xs text-[#94a3b8] font-bold tracking-wide uppercase mb-0.5">접수 일시</p>
                  <p className="text-[#cbd5e1] font-medium text-sm">{ticket.created_at ? safeFormat(ticket.created_at, 'yyyy-MM-dd HH:mm') : '-'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-[11px] md:text-xs text-[#94a3b8] font-bold tracking-wide uppercase mb-0.5">상담 유형</p>
                  <select
                    value={ticket.category || ''}
                    onChange={(e) => {
                      const newCategory = e.target.value;
                      const CRITICAL_KEYWORDS = ['임금체불', '폭언', '폭행', '범죄', '퇴사', '산재', '치료', '사망', '사고', '안전사고', '우울', '정서/심리'];
                      const isRedFlag = newCategory !== '기타' && CRITICAL_KEYWORDS.some(k => newCategory.includes(k));
                      updateTicket(ticket.id!, { 
                        category: newCategory,
                        red_flag: isRedFlag
                      });
                    }}
                    className="dx-input !py-1 !px-2.5 text-xs text-[#f8fafc] font-semibold cursor-pointer w-full"
                  >
                    <option value="">유형 선택</option>
                    {/* Support existing legacy category value if not matched */}
                    {ticket.category && !CATEGORIES.includes(ticket.category) && (
                      <option value={ticket.category}>{ticket.category}</option>
                    )}
                    {CATEGORY_GROUPS.map(group => (
                      <optgroup key={group.group} label={group.group} className="bg-slate-900 text-cyan-300 font-bold">
                        {group.items.map(c => (
                          <option key={c} value={c} className="bg-slate-800 text-white font-normal">
                            {c}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {ticket.summary && (
              <div className="mt-3 pt-3 border-t border-[#1e3a5f]/60">
                <p className="text-[11px] md:text-xs text-[#38bdf8] font-bold tracking-wide uppercase mb-1.5 flex items-center gap-1.5">
                  <Brain className="w-3.5 h-3.5 text-[#38bdf8]" />
                  예약/상담 신청 내용 (AI 요약 포함)
                </p>
                <div className="p-3 bg-[#08172c] border border-[#1e3a5f] rounded-lg text-xs text-[#cbd5e1] whitespace-pre-wrap leading-relaxed">
                  {ticket.summary}
                </div>
              </div>
            )}
            {ticket.required_action && (
              <div className="mt-3">
                <p className="text-[11px] md:text-xs text-[#f87171] font-bold tracking-wide uppercase mb-1.5 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#f87171]" />
                  필요 조치 사항 (AI 분석)
                </p>
                <div className="p-3 bg-red-950/20 border border-red-500/30 rounded-lg text-xs text-red-200 whitespace-pre-wrap leading-relaxed">
                  {ticket.required_action}
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-[#1e3a5f] pt-4">
            <h3 className="text-sm font-bold text-[#f8fafc] mb-3 tracking-wide flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#38bdf8]"></span>
              통역사 배정 및 처리
            </h3>
            
            <div className="space-y-3 mb-2">
              <div>
                <label className="block text-[11px] md:text-xs font-bold text-[#94a3b8] tracking-wide uppercase mb-1.5">통역사 선택</label>
                <div className="flex gap-2.5">
                  <select 
                    value={selectedCounselor}
                    onChange={(e) => setSelectedCounselor(e.target.value)}
                    className="flex-1 dx-input !py-1.5 !px-3 text-xs font-medium"
                    disabled={ticket.status === '처리완료' && !isEditing}
                  >
                    <option value="">배정 안됨</option>
                    {counselors.filter(c => isCounselorId(c.id) && (!ticket.country || c.country === ticket.country) && !c.isRetired).map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({cleanCountryName(c.country)})</option>
                    ))}
                  </select>
                  {ticket.status === '접수대기' && (
                    <button 
                      onClick={handleAssign}
                      disabled={!selectedCounselor}
                      className="dx-btn-primary !py-1.5 !px-4 text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      배정하기
                    </button>
                  )}
                </div>
              </div>
              {(ticket.status === '배정완료' || ticket.status === '상담중' || ticket.status === '처리완료') && (
                
                <div className="mt-3 p-3.5 bg-[#051326] border border-[#1e3a5f] rounded-xl">
                  <label className="block text-xs font-bold text-[#94a3b8] tracking-wide uppercase mb-2 flex items-center gap-2">
                    실제 상담 시간
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2.5 items-start sm:items-center">
                    <input 
                      type="date" 
                      value={counselingDate}
                      onChange={(e) => setCounselingDate(e.target.value)}
                      onClick={(e) => (e.target as HTMLInputElement).showPicker && (e.target as HTMLInputElement).showPicker()}
                      className="w-full sm:w-auto dx-input !py-1.5 !px-3 text-xs font-medium cursor-pointer"
                      disabled={ticket.status === '처리완료' && !isEditing}
                    />
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <select 
                        value={counselingStartTime}
                        onChange={(e) => setCounselingStartTime(e.target.value)}
                        className="flex-1 sm:flex-none dx-input !py-1.5 !px-3 text-xs font-medium cursor-pointer text-center"
                        disabled={ticket.status === '처리완료' && !isEditing}
                      >
                        <option value="" disabled>시작 시간</option>
                        {timeOptions.map(time => (
                          <option key={time} value={time}>{time}</option>
                        ))}
                      </select>
                      <span className="text-[#94a3b8] font-bold">-</span>
                      <select 
                        value={counselingEndTime}
                        onChange={(e) => setCounselingEndTime(e.target.value)}
                        className="flex-1 sm:flex-none dx-input !py-1.5 !px-3 text-xs font-medium cursor-pointer text-center"
                        disabled={ticket.status === '처리완료' && !isEditing}
                      >
                        <option value="" disabled>종료 시간</option>
                        {timeOptions.filter(time => !counselingStartTime || time > counselingStartTime).map(time => (
                          <option key={time} value={time}>{time}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <p className="text-xs text-[#38bdf8] mt-2.5 flex items-center gap-1.5 font-medium"><AlertTriangle className="w-3.5 h-3.5"/>상담 시간을 변경하면 캘린더의 기존 일정과 겹칠 경우 자동으로 일정이 조정됩니다.</p>
                </div>

              )}
            </div>

            {(ticket.status === '배정완료' || ticket.status === '상담중' || (ticket.status === '처리완료' && isEditing)) && (
              <div className="space-y-4 mb-6 animate-fade-in-up mt-4">
                <div>
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-2 gap-3">
                    <label className="block text-xs font-bold text-[#94a3b8] tracking-wide uppercase">상담 내용 작성</label>
                    
                    {/* AI Recording Controls */}
                    <div className="flex items-center gap-2">
                      {!audioBlob ? (
                        <button
                          onClick={isRecording ? stopRecording : startRecording}
                          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                            isRecording 
                              ? 'bg-red-500/20 text-red-400 border-red-500/30 animate-pulse' 
                              : 'bg-[#002c5f] text-[#38bdf8] border-[#1e3a5f] hover:border-[#38bdf8]'
                          }`}
                        >
                          {isRecording ? <Square className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                          {isRecording ? '녹음 중지' : '음성으로 상담 기록'}
                        </button>
                      ) : (
                        <div className="flex items-center gap-2.5">
                          <button
                            onClick={() => setAudioBlob(null)}
                            className="text-xs text-[#94a3b8] hover:text-white transition-colors underline"
                          >
                            다시 녹음
                          </button>
                          <button
                            onClick={handleAIAnalyze}
                            disabled={isProcessingAI}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#002c5f] text-[#38bdf8] border border-[#1e3a5f] rounded-lg text-xs font-bold hover:border-[#38bdf8] transition-all disabled:opacity-50"
                          >
                            {isProcessingAI ? 'AI 정리 중...' : 'AI 자동 정리 시작'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <textarea 
                    rows={8}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="dx-input w-full !p-3.5 text-xs sm:text-sm text-[#f8fafc] resize-none placeholder:text-[#64748b]"
                    placeholder="상담 내용을 직접 입력하거나, '음성으로 상담 기록'을 통해 AI 자동 정리를 활용해보세요."
                  />
                  
                  {ticket.summary && (
                    <div className="flex justify-start mt-2.5">
                      <button 
                        onClick={handleGenerateAIResponse}
                        disabled={isGeneratingResponse}
                        className="flex items-center gap-2 px-3.5 py-1.5 bg-[#051326] border border-[#1e3a5f] text-[#38bdf8] rounded-lg text-xs font-bold hover:bg-[#002c5f] hover:border-[#38bdf8] transition-all disabled:opacity-50"
                      >
                        <Brain className="w-3.5 h-3.5" />
                        {isGeneratingResponse ? 'AI 조치 방안 생성 중...' : 'AI 최적 조치 방안 & 다국어 답변 추천'}
                      </button>
                    </div>
                  )}

                  {translatedMessage && (
                    <div className="mt-4 space-y-3.5">
                      {recommendedAction && (
                        <div className="p-4 bg-[#002c5f]/30 border border-[#1e3a5f] rounded-xl">
                          <p className="text-xs font-bold text-[#38bdf8] tracking-wide mb-1.5 flex items-center gap-1.5">💡 AI 담당자 조치 방안 제안</p>
                          <div className="text-xs sm:text-sm text-[#cbd5e1] whitespace-pre-wrap leading-relaxed">{recommendedAction}</div>
                          <button 
                            onClick={() => setNotes(prev => prev ? `${prev}\n\n[조치 계획]\n${recommendedAction}` : `[조치 계획]\n${recommendedAction}`)}
                            className="mt-3 px-3 py-1.5 bg-[#051326] text-[#38bdf8] border border-[#1e3a5f] rounded-lg text-xs font-bold hover:border-[#38bdf8] transition-all"
                          >
                            상담 내용에 추가
                          </button>
                        </div>
                      )}
                      
                      <div className="p-4 bg-[#051326] border border-[#1e3a5f] rounded-xl">
                        <p className="text-xs font-bold text-[#38bdf8] tracking-wide mb-1.5 flex items-center gap-1.5">🤖 AI 다국어 발송용 메시지 (근로자용)</p>
                        <div className="text-xs sm:text-sm text-[#cbd5e1] whitespace-pre-wrap leading-relaxed">{translatedMessage}</div>
                        <button onClick={() => alert('근로자에게 알림톡이 발송되었습니다.')} className="mt-3 px-3.5 py-1.5 dx-btn-primary text-xs font-bold">
                          알림톡으로 발송
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex justify-end items-center pt-3">
                  <button 
                    onClick={handleComplete}
                    disabled={!notes.trim()}
                    className="dx-btn-primary !py-2.5 !px-6 text-sm font-bold flex items-center gap-2 disabled:opacity-50"
                  >
                    {isCompleting ? '처리 중...' : <><Check className="w-4 h-4" /> {ticket.status === '처리완료' ? '상담 수정 (완료)' : '상담 등록 (완료)'}</>}
                  </button>
                </div>
              </div>
            )}
            
            {(ticket.status === '처리완료' && !isEditing) && (
              <div className="p-4 bg-[#051326] border border-[#1e3a5f] rounded-xl">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-xs sm:text-sm text-[#94a3b8] font-bold">처리가 완료된 상담입니다.</p>
                  <button onClick={() => setIsEditing(true)} className="px-3 py-1.5 bg-[#002c5f] hover:bg-[#003770] border border-[#1e3a5f] hover:border-[#38bdf8] text-[#38bdf8] text-xs font-bold rounded-lg transition-all">
                    수정하기
                  </button>
                </div>
                {ticket.action_result && (
                  <div className="mt-3 p-3.5 bg-[#08172c] border border-[#1e3a5f] rounded-lg text-xs sm:text-sm text-[#cbd5e1] whitespace-pre-wrap leading-relaxed">
                    <span className="text-xs font-bold tracking-wide uppercase block mb-1.5 text-[#94a3b8]">상담 결과 기록</span>
                    {ticket.action_result}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      

      {showDeleteConfirm && (
        <div className="fixed top-0 left-0 w-full h-[100dvh] bg-black/80 backdrop-blur-sm flex items-center justify-center z-[120] p-4">
          <div className="dx-card w-full max-w-sm p-6 flex flex-col items-center text-center animate-fade-in-up border border-red-500/30">
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mb-3">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <h3 className="text-lg font-bold text-[#f8fafc] mb-2">상담 내역 삭제</h3>
            <p className="text-xs sm:text-sm text-[#94a3b8] mb-6">
              정말로 이 상담 내역을 삭제하시겠습니까?<br/>삭제된 데이터는 복구할 수 없습니다.
            </p>
            <div className="flex gap-3 w-full">
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 bg-[#051326] border border-[#1e3a5f] hover:border-[#38bdf8] rounded-xl text-[#f8fafc] text-xs font-bold transition-colors"
              >
                취소
              </button>
              <button 
                onClick={executeDelete}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 rounded-xl text-white text-xs font-bold transition-colors shadow-[0_0_15px_rgba(239,68,68,0.3)]"
              >
                삭제하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  ,
    document.body
  );
};
