import { safeFormat } from '../utils/safeDate';
import { safeDate } from '../utils/safeDate';
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CounselingTicket } from '../types';
import { X, Check, Mic, Square, Brain, AlertTriangle, Trash2, MessageSquare, Phone } from 'lucide-react';
import { useCounselorStore } from '../store/counselorStore';
import { useFirestore } from '../hooks/useFirestore';
import { useScheduleStore } from '../store/scheduleStore';
import { useAuthStore } from '../store/authStore';
import { format } from 'date-fns';
import { CATEGORIES } from '../constants';
import { useAudioRecorder } from '../hooks/useAudioRecorder';

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

  useEffect(() => {
    setSelectedCounselor(ticket.counselor_id || (ticket as any).assigned_counselor_id || '');
    setNotes(ticket.action_result || '');
    
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

    await updateTicket(ticket.id!, { 
      status: '처리완료',
      action_result: notes,
      counseling_summary: oneLineSummary,
      reservation_time: finalResTime,
      reservation_end_time: finalResEndTime,
      counselor_id: selectedCounselor
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
    if (ticket.status === '접수대기') return <span className="block leading-tight">상담<br className="sm:hidden" /> 접수 현황</span>;
    if (ticket.status === '배정완료' || ticket.status === '상담중') return <span className="block leading-tight">상담자 배정 완료 및<br className="sm:hidden" /> 상담 내용 등록</span>;
    if (ticket.status === '처리완료') return '상담 상세 현황';
    return '상담 내역 상세';
  };

  return createPortal(
    <div className="fixed top-0 left-0 w-full h-[100dvh] bg-black/60 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-fade-in-up">
      <div className="glass-panel w-full max-w-2xl overflow-hidden flex flex-col max-h-full border border-apple-border shadow-2xl">
        <div className="px-5 py-2.5 border-b border-apple-border flex justify-between items-center bg-black/30 backdrop-blur-md">
          <h2 className="text-base font-medium text-white tracking-wide">{getModalTitle()}</h2>
          <div className="flex gap-2 items-center">
            {role === 'admin' && (
              <button onClick={handleDelete} className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-red-500/20 rounded-lg text-red-400/70 hover:text-red-400 transition-colors text-sm font-medium mr-2" title="삭제">
                <Trash2 className="w-4 h-4" />
                삭제
              </button>
            )}
            <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="p-6 pb-24 md:pb-6 overflow-y-auto flex-1 custom-scrollbar">
          <div className="grid grid-cols-2 gap-3 mb-2">
            <div>
              <p className="text-[11px] md:text-xs text-gray-400 font-medium tracking-wide uppercase mb-0.5">근로자</p>
              <p className="text-gray-200 font-medium text-sm">{ticket.worker_name || ticket.worker_id}</p>
            </div>
            <div>
              <p className="text-[11px] md:text-xs text-gray-400 font-medium tracking-wide uppercase mb-0.5">핸드폰번호</p>
              {ticket.phone_number ? (
                <a href={`tel:${ticket.phone_number}`} className="text-blue-400 hover:text-blue-300 font-medium text-sm flex items-center gap-1 w-fit">
                  <Phone className="w-3.5 h-3.5" /> {ticket.phone_number}
                </a>
              ) : (
                <p className="text-gray-300 font-medium text-sm">-</p>
              )}
            </div>
            <div>
              <p className="text-[11px] md:text-xs text-gray-400 font-medium tracking-wide uppercase mb-0.5">접수 일시</p>
              <p className="text-gray-300 font-medium text-sm">{ticket.created_at ? safeFormat(ticket.created_at, 'yyyy-MM-dd HH:mm') : '-'}</p>
            </div>
            <div>
              <p className="text-[11px] md:text-xs text-gray-400 font-medium tracking-wide uppercase mb-0.5">국가</p>
              <p className="text-gray-300 font-medium text-sm">{ticket.country || '-'}</p>
            </div>
            <div>
              <p className="text-[11px] md:text-xs text-gray-400 font-medium tracking-wide uppercase mb-0.5">상담 유형</p>
              <select
                value={ticket.category || ''}
                onChange={(e) => {
                  const newCategory = e.target.value;
                  const CRITICAL_KEYWORDS = ['임금체불', '폭언', '폭행', '범죄', '퇴사', '산재', '치료', '사망', '사고', '우울', '정서/심리'];
                  const isRedFlag = CRITICAL_KEYWORDS.some(k => newCategory.includes(k));
                  updateTicket(ticket.id!, { 
                    category: newCategory,
                    red_flag: isRedFlag
                  });
                }}
                className="bg-apple-dark border border-apple-border rounded-lg px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-white/30 transition-colors"
              >
                <option value="">유형 선택</option>
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-[11px] md:text-xs text-gray-400 font-medium tracking-wide uppercase mb-0.5">소속 업체</p>
              <p className="text-gray-300 font-medium text-sm">{ticket.company_code || '-'}</p>
            </div>
            {ticket.summary && (
              <div className="col-span-2 mt-1">
                <p className="text-[11px] md:text-xs text-gray-400 font-medium tracking-wide uppercase mb-1 flex items-center gap-1.5">
                  <Brain className="w-3 h-3 text-blue-400" />
                  예약/상담 신청 내용 (AI 요약 포함)
                </p>
                <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-xs text-gray-200 whitespace-pre-wrap leading-relaxed shadow-inner">
                  {ticket.summary}
                </div>
              </div>
            )}
            {ticket.required_action && (
              <div className="col-span-2 mt-1">
                <p className="text-[11px] md:text-xs text-red-400 font-medium tracking-wide uppercase mb-1 flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3 text-red-400" />
                  필요 조치 사항 (AI 분석)
                </p>
                <div className="p-3 bg-red-900/10 border border-red-500/20 rounded-xl text-xs text-red-200 whitespace-pre-wrap leading-relaxed shadow-inner">
                  {ticket.required_action}
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-apple-border pt-4">
            <h3 className="text-sm font-medium text-white mb-2 tracking-wide">통역사 배정 및 처리</h3>
            
            <div className="space-y-3 mb-2">
              <div>
                <label className="block text-[11px] md:text-xs font-medium text-gray-400 tracking-wide uppercase mb-1">통역사 선택</label>
                <div className="flex gap-3">
                  <select 
                    value={selectedCounselor}
                    onChange={(e) => setSelectedCounselor(e.target.value)}
                    className="flex-1 bg-apple-dark border border-apple-border rounded-xl px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-white/30 transition-colors appearance-none"
                    disabled={ticket.status === '처리완료' && !isEditing}
                  >
                    <option value="">배정 안됨</option>
                    {counselors.filter(c => (!ticket.country || c.country === ticket.country) && !c.isRetired).map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.country})</option>
                    ))}
                  </select>
                  {ticket.status === '접수대기' && (
                    <button 
                      onClick={handleAssign}
                      disabled={!selectedCounselor}
                      className="px-4 py-1.5 bg-blue-500 text-xs text-white rounded-xl font-medium hover:bg-blue-600 transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      배정하기
                    </button>
                  )}
                </div>
              </div>
              {(ticket.status === '배정완료' || ticket.status === '상담중' || ticket.status === '처리완료') && (
                
                <div className="mt-3 p-3 bg-black/20 border border-white/10 rounded-[16px]">
                  <label className="block text-xs font-medium text-gray-400 tracking-wide uppercase mb-2 flex items-center gap-2">
                    실제 상담 시간
                  </label>
                  <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                    <input 
                      type="date" 
                      value={counselingDate}
                      onChange={(e) => setCounselingDate(e.target.value)}
                      onClick={(e) => (e.target as HTMLInputElement).showPicker && (e.target as HTMLInputElement).showPicker()}
                      className="w-full sm:w-auto bg-apple-dark border border-apple-border rounded-xl px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500/50 transition-colors cursor-pointer"
                      disabled={ticket.status === '처리완료' && !isEditing}
                    />
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <select 
                        value={counselingStartTime}
                        onChange={(e) => setCounselingStartTime(e.target.value)}
                        className="flex-1 sm:flex-none bg-apple-dark border border-apple-border rounded-xl px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500/50 transition-colors cursor-pointer appearance-none text-center"
                        disabled={ticket.status === '처리완료' && !isEditing}
                      >
                        <option value="" disabled>시작 시간</option>
                        {timeOptions.map(time => (
                          <option key={time} value={time}>{time}</option>
                        ))}
                      </select>
                      <span className="text-gray-400 font-medium">-</span>
                      <select 
                        value={counselingEndTime}
                        onChange={(e) => setCounselingEndTime(e.target.value)}
                        className="flex-1 sm:flex-none bg-apple-dark border border-apple-border rounded-xl px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500/50 transition-colors cursor-pointer appearance-none text-center"
                        disabled={ticket.status === '처리완료' && !isEditing}
                      >
                        <option value="" disabled>종료 시간</option>
                        {timeOptions.filter(time => !counselingStartTime || time > counselingStartTime).map(time => (
                          <option key={time} value={time}>{time}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <p className="text-xs text-blue-400 mt-3 flex items-center gap-1.5 opacity-90"><AlertTriangle className="w-3.5 h-3.5"/>상담 시간을 변경하면 캘린더의 기존 일정과 겹칠 경우 자동으로 일정이 조정됩니다.</p>
                </div>

              )}
            </div>

            {(ticket.status === '배정완료' || ticket.status === '상담중' || (ticket.status === '처리완료' && isEditing)) && (
              <div className="space-y-4 mb-6 animate-fade-in-up">
                <div>
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-2 gap-3">
                    <label className="block text-xs font-medium text-gray-400 tracking-wide uppercase">상담 내용 작성</label>
                    
                    {/* AI Recording Controls */}
                    <div className="flex items-center gap-2">
                      {!audioBlob ? (
                        <button
                          onClick={isRecording ? stopRecording : startRecording}
                          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all ${
                            isRecording 
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.3)]' 
                              : 'bg-blue-500/10 text-blue-300 border border-blue-500/20 hover:bg-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.1)]'
                          }`}
                        >
                          {isRecording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                          {isRecording ? '녹음 중지' : '음성으로 상담 기록'}
                        </button>
                      ) : (
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setAudioBlob(null)}
                            className="text-xs text-gray-400 hover:text-white transition-colors underline"
                          >
                            다시 녹음
                          </button>
                          <button
                            onClick={handleAIAnalyze}
                            disabled={isProcessingAI}
                            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-medium hover:bg-indigo-500/30 transition-all disabled:opacity-50 shadow-[0_0_10px_rgba(99,102,241,0.1)]"
                          >
                            {isProcessingAI ? 'AI 텍스트 변환 및 요약 중...' : 'AI 자동 정리 시작'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <textarea 
                    rows={10}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-apple-dark border border-apple-border rounded-xl px-4 py-3 text-sm text-gray-200 focus:outline-none focus:border-white/30 resize-none placeholder:text-gray-600 transition-colors shadow-inner"
                    placeholder="상담 내용을 직접 입력하거나, '음성으로 상담 기록'을 통해 AI 자동 정리를 활용해보세요."
                  />
                  
                  {ticket.summary && (
                    <div className="flex justify-start mt-3">
                      <button 
                        onClick={handleGenerateAIResponse}
                        disabled={isGeneratingResponse}
                        className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-white rounded-xl text-xs font-medium hover:bg-white/10 transition-all disabled:opacity-50 glass-panel-hover"
                      >
                        <Brain className="w-4 h-4" />
                        {isGeneratingResponse ? 'AI 조치 방안 생성 중...' : 'AI 최적 조치 방안 & 다국어 답변 추천'}
                      </button>
                    </div>
                  )}

                  {translatedMessage && (
                    <div className="mt-5 space-y-4">
                      {recommendedAction && (
                        <div className="p-5 bg-blue-900/20 border border-blue-500/30 rounded-[16px] shadow-inner">
                          <p className="text-xs font-medium text-blue-300 tracking-wide mb-2 flex items-center gap-2">💡 AI 담당자 조치 방안 제안</p>
                          <div className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{recommendedAction}</div>
                          <button 
                            onClick={() => setNotes(prev => prev ? `${prev}\n\n[조치 계획]\n${recommendedAction}` : `[조치 계획]\n${recommendedAction}`)}
                            className="mt-4 px-4 py-2 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-xl text-xs font-medium hover:bg-blue-500/30 transition-all shadow-[0_0_10px_rgba(59,130,246,0.1)]"
                          >
                            상담 내용에 추가
                          </button>
                        </div>
                      )}
                      
                      <div className="p-5 bg-indigo-900/20 border border-indigo-500/30 rounded-[16px] shadow-inner">
                        <p className="text-xs font-medium text-indigo-300 tracking-wide mb-2 flex items-center gap-2">🤖 AI 다국어 발송용 메시지 (근로자용)</p>
                        <div className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{translatedMessage}</div>
                        <button onClick={() => alert('근로자에게 알림톡이 발송되었습니다.')} className="mt-4 px-4 py-2 bg-indigo-500 text-white rounded-xl text-xs font-medium hover:bg-indigo-600 transition-all shadow-[0_0_10px_rgba(99,102,241,0.3)]">
                          알림톡으로 발송
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex justify-end items-center pt-4">
                  <button 
                    onClick={handleComplete}
                    disabled={!notes.trim()}
                    className="flex items-center gap-2 px-6 py-2.5 bg-green-500 text-white rounded-xl text-sm font-medium hover:bg-green-600 transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(16,185,129,0.3)] disabled:shadow-none glass-panel-hover"
                  >
                    {isCompleting ? '처리 중...' : <><Check className="w-4 h-4" /> {ticket.status === '처리완료' ? '상담 수정 (완료)' : '상담 등록 (완료)'}</>}
                  </button>
                </div>
              </div>
            )}
            
            {(ticket.status === '처리완료' && !isEditing) && (
              <div className="p-5 bg-white/5 border border-apple-border rounded-[20px]">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-sm text-gray-400 font-medium">처리가 완료된 상담입니다.</p>
                  <button onClick={() => setIsEditing(true)} className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs rounded-lg transition-colors">
                    수정하기
                  </button>
                </div>
                {ticket.action_result && (
                  <div className="mt-4 p-5 bg-apple-dark border border-apple-border rounded-[16px] text-sm text-gray-200 whitespace-pre-wrap leading-relaxed shadow-inner">
                    <span className="text-xs font-medium tracking-wide uppercase block mb-2 text-gray-400">상담 결과 기록</span>
                    {ticket.action_result}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      


      {showDeleteConfirm && (
        <div className="fixed top-0 left-0 w-full h-[100dvh] bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="glass-panel w-full max-w-sm p-6 flex flex-col items-center text-center animate-fade-in-up border border-red-500/30">
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mb-2">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">상담 내역 삭제</h3>
            <p className="text-sm text-gray-400 mb-6">
              정말로 이 상담 내역을 삭제하시겠습니까?<br/>삭제된 데이터는 복구할 수 없습니다.
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
    </div>
  ,
    document.body
  );
};
