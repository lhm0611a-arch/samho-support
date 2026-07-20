import { safeFormat, safeDate } from '../utils/safeDate';
import React, { useState, useMemo, useEffect } from 'react';
import { useTicketStore } from '../store/ticketStore';
import { useAuthStore } from '../store/authStore';
import { useCounselorStore } from '../store/counselorStore';
import { Search, ChevronLeft, ChevronRight, Settings, MessageSquare, Plus, Edit2, Phone, Trash2, TrendingUp, AlertTriangle, Lightbulb, ArrowUpDown, ArrowDown, ArrowUp } from 'lucide-react';
import { format, isToday, isThisWeek, isThisMonth } from 'date-fns';
import { CounselingTicket } from '../types';
import clsx from 'clsx';
import { useFirestore } from '../hooks/useFirestore';
import { TicketDetailModal } from '../components/TicketDetailModal';

export const MainDashboard = () => {
  const { tickets: allTickets } = useTicketStore();
  const { role, user } = useAuthStore();
  const { counselors } = useCounselorStore();
  const { updateTicketStatus, deleteTicket } = useFirestore();
  const [modalTicket, setModalTicket] = useState<CounselingTicket | null>(null);
  const [selectedTickets, setSelectedTickets] = useState<Set<string>>(new Set());
  const [latestInsights, setLatestInsights] = useState<string[]>([]);
  const [insightIndex, setInsightIndex] = useState(0);

  useEffect(() => {
    fetch('/api/get-latest-insights')
      .then(res => {
        if (!res.ok) throw new Error('Network response was not ok');
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new TypeError('Response is not JSON');
        }
        return res.json();
      })
      .then(data => {
        if (data && data.insights && data.insights.length > 0) {
          setLatestInsights(data.insights);
        }
      })
      .catch(err => console.error('Failed to load daily insights:', err));
  }, []);

  useEffect(() => {
    if (latestInsights.length <= 1) return;
    const interval = setInterval(() => {
      setInsightIndex(prev => (prev + 1) % latestInsights.length);
    }, 10000); // cycle every 10 seconds
    return () => clearInterval(interval);
  }, [latestInsights]);
  
  const tickets = role === 'counselor' ? allTickets.filter(t => t.counselor_id === user?.uid || (t as any).assigned_counselor_id === user?.uid) : allTickets;

  // Filter States
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<'day' | 'week' | 'month' | ''>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  
  const dateFilteredTickets = React.useMemo(() => {
    if (!dateFilter) return tickets;
    return tickets.filter(t => {
      if (!t.created_at) return false;
      const d = safeDate(t.created_at);
      if (dateFilter === 'day' && !isToday(d)) return false;
      if (dateFilter === 'week' && !isThisWeek(d, { weekStartsOn: 1 })) return false;
      if (dateFilter === 'month' && !isThisMonth(d)) return false;
      return true;
    });
  }, [tickets, dateFilter]);

  // Summary counts
  const pendingAssign = dateFilteredTickets.filter(t => t.status === '접수대기').length;
  const inProgress = dateFilteredTickets.filter(t => t.status === '배정완료' || t.status === '상담중').length;
  const completed = dateFilteredTickets.filter(t => t.status === '처리완료').length;
  const feedbackPending = dateFilteredTickets.filter(t => t.red_flag).length;

  const handleSort = (key: string) => {

    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown className="w-3 h-3 opacity-30 inline-block ml-1" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 inline-block ml-1" /> : <ArrowDown className="w-3 h-3 inline-block ml-1" />;
  };

  const filteredTickets = React.useMemo(() => {
    let result = dateFilteredTickets.filter(t => {
      if (statusFilter) {
        if (statusFilter === '배정확정' && t.status !== '배정완료' && t.status !== '상담중') return false;
        if (statusFilter === '상담완료' && t.status !== '처리완료') return false;
        if (statusFilter === '주의요망' && !t.red_flag) return false;
        if (statusFilter === '접수대기' && t.status !== '접수대기') return false;
      }
      
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchName = t.worker_name?.toLowerCase().includes(q);
        const matchEmpId = t.emp_id?.toLowerCase().includes(q);
        const matchCompany = t.company_code?.toLowerCase().includes(q);
        if (!matchName && !matchEmpId && !matchCompany) return false;
      }

      return true;
    });

    if (sortConfig) {
      result.sort((a, b) => {
        let aValue;
        let bValue;
        
        switch (sortConfig.key) {
          case 'counselor':
            aValue = counselors.find(c => c.id === a.counselor_id)?.name || a.counselor_id || '';
            bValue = counselors.find(c => c.id === b.counselor_id)?.name || b.counselor_id || '';
            break;
          case 'worker':
            aValue = a.worker_name || '';
            bValue = b.worker_name || '';
            break;
          case 'emp_id':
            aValue = a.emp_id || '';
            bValue = b.emp_id || '';
            break;
          case 'company':
            aValue = a.company_code || '';
            bValue = b.company_code || '';
            break;
          case 'status':
            aValue = a.status;
            bValue = b.status;
            break;
          case 'category':
            aValue = a.category;
            bValue = b.category;
            break;
          case 'urgency':
            const urgencyWeight = { 'high': 3, 'medium': 2, 'low': 1 };
            aValue = urgencyWeight[a.urgency as keyof typeof urgencyWeight] || 0;
            bValue = urgencyWeight[b.urgency as keyof typeof urgencyWeight] || 0;
            break;
          case 'date':
            aValue = a.created_at || 0;
            bValue = b.created_at || 0;
            break;
          default:
            aValue = '';
            bValue = '';
        }
        
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
      if (statusFilter === '접수대기') {
        result.sort((a, b) => (a.created_at || 0) - (b.created_at || 0));
      } else if (statusFilter === '배정확정' || statusFilter === '주의요망') {
        result.sort((a, b) => {
          const tA = safeDate(a.reservation_time || a.created_at || 0).getTime();
          const tB = safeDate(b.reservation_time || b.created_at || 0).getTime();
          return tA - tB;
        });
      } else if (statusFilter === '상담완료') {
        result.sort((a, b) => {
          const tA = safeDate(a.reservation_end_time || a.reservation_time || a.created_at || 0).getTime();
          const tB = safeDate(b.reservation_end_time || b.reservation_time || b.created_at || 0).getTime();
          return tB - tA;
        });
      } else {
        result.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
      }
    }
    
    return result;
  }, [dateFilteredTickets, statusFilter, searchQuery, sortConfig, counselors]);

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedTickets);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedTickets(newSet);
  };

  return (
    <div className="flex flex-col gap-4 md:gap-6 text-gray-200 animate-fade-in-up">
      {/* AI Smart Banner */}
      <div className="hidden md:flex glass-panel px-4 md:px-6 py-4 md:py-6 shrink-0 w-full flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none group-hover:bg-white/10 transition-colors duration-700"></div>
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-white/10 flex items-center justify-center border border-white/10 shrink-0 shadow-[0_0_15px_rgba(255,255,255,0.05)]">
            <Lightbulb className="w-5 h-5 md:w-6 md:h-6 text-white" />
          </div>
          <div>
            <h3 className="text-white text-sm md:text-base font-medium flex items-center gap-2 tracking-wide">
              AI 인사이트 
              <span className="text-xs text-gray-400 font-normal border border-white/10 px-2.5 py-1 rounded-full">(외국인지원센터 분석)</span>
              {latestInsights.length > 1 && (
                <span className="text-[10px] text-blue-400 font-mono bg-blue-400/10 px-1.5 py-0.5 rounded border border-blue-400/20">
                  {insightIndex + 1}/{latestInsights.length}
                </span>
              )}
            </h3>
            <p className="text-gray-300 text-xs md:text-sm mt-1.5 leading-relaxed transition-all duration-500 animate-fade-in-up">
              {latestInsights.length > 0 
                ? latestInsights[insightIndex] 
                : "이번 주 베트남 국적 근로자의 '비자/체류' 문의가 전주 대비 42% 증가했습니다. 통역 리소스 배분을 재조정하는 것이 좋습니다."
              }
            </p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="glass-panel px-4 py-4 md:p-6 shrink-0 w-full">
        <div className="flex items-center justify-between mb-4 md:mb-6">
          <div className="flex items-center gap-4">
            <h3 className="text-[16px] font-bold text-center text-gradient tracking-tight">종합상담 Dashboard</h3>
            <div className="flex items-center p-0.5 rounded-full border border-white/10 bg-[#15151a]">
              <button 
                onClick={() => setDateFilter('day')}
                className={`px-3 md:px-4 py-1 md:py-1.5 text-[11px] md:text-xs font-bold rounded-full transition-all ${dateFilter === 'day' ? 'bg-[#1e2b47] text-[#5b9cf6]' : 'text-gray-400 hover:text-gray-200'}`}
              >오늘</button>
              <button 
                onClick={() => setDateFilter('week')}
                className={`px-3 md:px-4 py-1 md:py-1.5 text-[11px] md:text-xs font-bold rounded-full transition-all ${dateFilter === 'week' ? 'bg-[#1e2b47] text-[#5b9cf6]' : 'text-gray-400 hover:text-gray-200'}`}
              >주간</button>
              <button 
                onClick={() => setDateFilter('month')}
                className={`px-3 md:px-4 py-1 md:py-1.5 text-[11px] md:text-xs font-bold rounded-full transition-all ${dateFilter === 'month' ? 'bg-[#1e2b47] text-[#5b9cf6]' : 'text-gray-400 hover:text-gray-200'}`}
              >월간</button>
              <button 
                onClick={() => setDateFilter('')}
                className={`px-3 md:px-4 py-1 md:py-1.5 text-[11px] md:text-xs font-bold rounded-full transition-all ${dateFilter === '' ? 'bg-[#1e2b47] text-[#5b9cf6]' : 'text-gray-400 hover:text-gray-200'}`}
              >전체</button>
            </div>
          </div>
          <span className="text-xs text-gray-500 font-medium hidden sm:block">최근 업데이트: 방금 전</span>
        </div>
        
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-6">
          {/* Card 1 */}
          <div 
            onClick={() => setStatusFilter('접수대기')}
            className={clsx("glass-panel-hover rounded-[20px] p-3 md:p-5 text-white bg-apple-gray/50 border shadow-lg cursor-pointer transition-all duration-300 relative overflow-hidden group flex flex-col justify-between min-h-[100px] md:min-h-[160px]", statusFilter === '접수대기' ? "ring-1 ring-purple-500/50 bg-purple-500/10 border-purple-500/30" : "border-apple-border hover:border-purple-500/30 hover:bg-purple-500/5")}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none group-hover:bg-purple-500/20 transition-colors duration-500"></div>
            <h4 className="text-sm font-medium mb-1 md:mb-3 text-purple-300 flex justify-between tracking-wide relative z-10">접수 대기 <TrendingUp className="w-3 h-3 md:w-4 md:h-4 opacity-70" /></h4>
            <div className="flex items-end gap-1 md:gap-2 mb-0 md:mb-1 relative z-10">
              <span className="text-3xl md:text-4xl font-normal tracking-tight">{pendingAssign}</span>
              <span className="text-xs text-purple-200/50 mb-0.5 md:mb-1.5">건 처리 대기</span>
            </div>
            <div className="text-xs mt-3 md:mt-4 text-purple-200/70 flex items-center justify-between bg-black/30 px-2 py-1 md:py-1.5 rounded-lg border border-purple-500/10 relative z-10">
              <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-purple-400"></div> 신규 접수 내역</span>
              <span className="font-semibold text-purple-200 hidden sm:inline">+12% (전주대비)</span>
            </div>
          </div>
          
          {/* Card 2 */}
          <div 
            onClick={() => setStatusFilter('배정확정')}
            className={clsx("glass-panel-hover rounded-[20px] p-3 md:p-5 text-white bg-apple-gray/50 border shadow-lg cursor-pointer transition-all duration-300 relative overflow-hidden group flex flex-col justify-between min-h-[100px] md:min-h-[160px]", statusFilter === '배정확정' ? "ring-1 ring-orange-500/50 bg-orange-500/10 border-orange-500/30" : "border-apple-border hover:border-orange-500/30 hover:bg-orange-500/5")}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none group-hover:bg-orange-500/20 transition-colors duration-500"></div>
            <h4 className="text-sm font-medium mb-1 md:mb-3 text-orange-300 flex justify-between tracking-wide relative z-10">배정 확정 <TrendingUp className="w-3 h-3 md:w-4 md:h-4 opacity-70" /></h4>
            <div className="flex items-end gap-1 md:gap-2 mb-0 md:mb-1 relative z-10">
              <span className="text-3xl md:text-4xl font-normal tracking-tight">{inProgress}</span>
              <span className="text-xs text-orange-200/50 mb-0.5 md:mb-1.5">건 진행 중</span>
            </div>
            <div className="text-xs mt-3 md:mt-4 text-orange-200/70 flex items-center justify-between bg-black/30 px-2 py-1 md:py-1.5 rounded-lg border border-orange-500/10 relative z-10">
              <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-orange-400"></div> 배정 및 상담중</span>
              <span className="font-semibold text-orange-200 hidden sm:inline">-5% (전주대비)</span>
            </div>
          </div>

          {/* Card 3 */}
          <div 
            onClick={() => setStatusFilter('상담완료')}
            className={clsx("glass-panel-hover rounded-[20px] p-3 md:p-5 text-white bg-apple-gray/50 border shadow-lg cursor-pointer transition-all duration-300 relative overflow-hidden group flex flex-col justify-between min-h-[100px] md:min-h-[160px]", statusFilter === '상담완료' ? "ring-1 ring-cyan-500/50 bg-cyan-500/10 border-cyan-500/30" : "border-apple-border hover:border-cyan-500/30 hover:bg-cyan-500/5")}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none group-hover:bg-cyan-500/20 transition-colors duration-500"></div>
            <h4 className="text-sm font-medium mb-1 md:mb-3 text-cyan-300 flex justify-between tracking-wide relative z-10">상담 완료 <TrendingUp className="w-3 h-3 md:w-4 md:h-4 opacity-70" /></h4>
            <div className="flex items-end gap-1 md:gap-2 mb-0 md:mb-1 relative z-10">
              <span className="text-3xl md:text-4xl font-normal tracking-tight">{completed}</span>
              <span className="text-xs text-cyan-200/50 mb-0.5 md:mb-1.5">건 완료</span>
            </div>
            <div className="text-xs mt-3 md:mt-4 text-cyan-200/70 flex items-center justify-between bg-black/30 px-2 py-1 md:py-1.5 rounded-lg border border-cyan-500/10 relative z-10">
              <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-cyan-400"></div> 상담이 완료된 내역</span>
              <span className="font-semibold text-cyan-200 hidden sm:inline">+24% (전주대비)</span>
            </div>
          </div>

          {/* Card 4 */}
          <div 
            onClick={() => setStatusFilter('주의요망')}
            className={clsx("glass-panel-hover rounded-[20px] p-3 md:p-5 text-white bg-apple-gray/50 border shadow-lg cursor-pointer transition-all duration-300 relative overflow-hidden group flex flex-col justify-between min-h-[100px] md:min-h-[160px]", statusFilter === '주의요망' ? "ring-1 ring-pink-500/50 bg-pink-500/10 border-pink-500/30" : "border-apple-border hover:border-pink-500/30 hover:bg-pink-500/5")}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none group-hover:bg-pink-500/20 transition-colors duration-500"></div>
            <h4 className="text-sm font-medium mb-1 md:mb-3 text-pink-400 flex justify-between tracking-wide relative z-10">Red Flag <AlertTriangle className="w-3 h-3 md:w-4 md:h-4 opacity-70" /></h4>
            <div className="flex items-end gap-1 md:gap-2 mb-0 md:mb-1 relative z-10">
              <span className="text-3xl md:text-4xl font-normal tracking-tight text-white">{feedbackPending}</span>
              <span className="text-xs text-pink-200/50 mb-0.5 md:mb-1.5">건 주의</span>
            </div>
            <div className="text-xs mt-3 md:mt-4 text-pink-200/70 flex items-center justify-between bg-black/30 px-2 py-1 md:py-1.5 rounded-lg border border-pink-500/10 relative z-10">
              <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-pink-500"></div> 심층 모니터링 필요</span>
              <span className="font-semibold text-pink-200 hidden sm:inline">+2건 (전일비)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Table */}
      <div className="glass-panel flex flex-col w-full shrink-0">
        {/* Table / Card List */}
        <div className="bg-transparent">
          {filteredTickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-gray-500 min-h-[300px]">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4 border border-white/10">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <p>조건에 맞는 데이터가 없습니다.</p>
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="block md:hidden p-2 space-y-2">
                {filteredTickets.map(ticket => (
                  <div 
                    key={ticket.id} 
                    onClick={() => setModalTicket(ticket)}
                    className={clsx(
                      "glass-panel glass-panel-hover p-3 border cursor-pointer transition-colors border-l-4",
                      ticket.status === '접수대기' ? 'border-l-purple-500 border-apple-border' :
                      ticket.status === '배정완료' ? 'border-l-orange-500 border-apple-border' :
                      ticket.status === '상담중' ? 'border-l-blue-500 border-apple-border' :
                      ticket.status === '처리완료' ? 'border-l-cyan-500 border-apple-border' :
                      ticket.status === '주의요망' ? 'border-l-pink-500 border-apple-border' : 'border-apple-border'
                    )}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-medium text-white flex items-center gap-2 text-base">
                          {ticket.worker_name || ticket.worker_id}
                          {ticket.red_flag && <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
                        </div>
                        <div className="text-xs text-gray-400 flex items-center gap-2 mt-0.5">
                          <span>{ticket.company_code || '-'}</span>
                          {ticket.status === '접수대기' && ticket.phone_number && (
                            <a href={`tel:${ticket.phone_number}`} onClick={(e) => e.stopPropagation()} className="text-blue-400 hover:text-blue-300 font-medium bg-blue-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                              <Phone className="w-3 h-3" /> {ticket.phone_number}
                            </a>
                          )}
                        </div>
                      </div>
                      <span className={clsx(
                        "px-2.5 py-1 rounded-full text-xs font-semibold border",
                        ticket.status === '접수대기' && "bg-purple-500/20 text-purple-300 border-purple-500/30",
                        ticket.status === '배정완료' && "bg-orange-500/20 text-orange-300 border-orange-500/30",
                        ticket.status === '상담중' && "bg-blue-500/20 text-blue-300 border-blue-500/30",
                        ticket.status === '처리완료' && "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
                        ticket.status === '주의요망' && "bg-pink-500/20 text-pink-300 border-pink-500/30"
                      )}>
                        {ticket.status}
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <span className="inline-flex items-center px-2.5 py-1 rounded text-gray-300 text-xs bg-white/5">{ticket.country}</span>
                      {ticket.visa_type && <span className="inline-flex items-center px-2.5 py-1 rounded text-gray-300 text-xs bg-white/5 border border-white/10">{ticket.visa_type}</span>}
                      <span className="inline-flex items-center px-2.5 py-1 rounded text-gray-300 text-xs bg-white/5">{ticket.category}</span>
                      {ticket.urgency === 'high' && <span className="inline-flex items-center px-2.5 py-1 rounded bg-red-500/20 text-red-400 text-xs font-medium">긴급</span>}
                    </div>

                    <div className="flex gap-4 text-xs py-0.5 border-t border-apple-border mt-2">
                      <div className="flex gap-1.5">
                        <span className="text-gray-500">접수일</span>
                        <span className="text-gray-300">{ticket.created_at ? safeFormat(ticket.created_at, 'MM/dd HH:mm') : '-'}</span>
                      </div>
                      <div className="flex gap-1.5">
                        <span className="text-gray-500">예약일</span>
                        <span className="text-blue-300 font-medium">{ticket.reservation_time ? safeFormat(ticket.reservation_time, 'MM/dd HH:mm') : '미지정'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block w-full overflow-x-auto custom-scrollbar">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="bg-apple-dark sticky top-0 border-b border-apple-border z-10">
                    <tr>
                      <th onClick={() => handleSort('counselor')} className="cursor-pointer hidden xl:table-cell px-2 lg:px-6 pt-[4.75px] pb-[3.75px] font-medium text-gray-300 tracking-wide uppercase text-[14.75px] text-center hover:text-white transition-colors">통역위원 {getSortIcon('counselor')}</th>
                      <th onClick={() => handleSort('worker')} className="cursor-pointer px-2 lg:px-6 pt-[4.75px] pb-[3.75px] font-medium text-gray-300 tracking-wide uppercase text-[14.75px] text-center hover:text-white transition-colors">근로자 {getSortIcon('worker')}</th>
                      <th onClick={() => handleSort('created_at')} className="cursor-pointer px-2 lg:px-6 pt-[4.75px] pb-[3.75px] font-medium text-gray-300 tracking-wide uppercase text-[14.75px] text-center hover:text-white transition-colors">접수일시 {getSortIcon('created_at')}</th>
                      <th onClick={() => handleSort('reservation_time')} className="cursor-pointer px-2 lg:px-6 pt-[4.75px] pb-[3.75px] font-medium text-blue-300 tracking-wide uppercase text-[14.75px] text-center hover:text-blue-200 transition-colors">예약일시 {getSortIcon('reservation_time')}</th>
                      <th onClick={() => handleSort('country')} className="cursor-pointer px-2 lg:px-6 pt-[4.75px] pb-[3.75px] font-medium text-gray-300 tracking-wide uppercase text-[14.75px] text-center hover:text-white transition-colors">국가 {getSortIcon('country')}</th>
                      <th onClick={() => handleSort('visa_type')} className="cursor-pointer px-2 lg:px-6 pt-[4.75px] pb-[3.75px] font-medium text-gray-300 tracking-wide uppercase text-[14.75px] text-center hover:text-white transition-colors">비자 {getSortIcon('visa_type')}</th>
                      <th onClick={() => handleSort('status')} className="cursor-pointer px-2 lg:px-6 pt-[4.75px] pb-[3.75px] font-medium text-gray-300 tracking-wide uppercase text-[14.75px] text-center hover:text-white transition-colors">상태 {getSortIcon('status')}</th>
                      <th onClick={() => handleSort('category')} className="cursor-pointer px-2 lg:px-6 pt-[4.75px] pb-[3.75px] font-medium text-gray-300 tracking-wide uppercase text-[14.75px] text-center hover:text-white transition-colors">유형 {getSortIcon('category')}</th>
                      <th onClick={() => handleSort('company')} className="cursor-pointer px-2 lg:px-6 pt-[4.75px] pb-[3.75px] font-medium text-gray-300 tracking-wide uppercase text-[14.75px] text-center hover:text-white transition-colors">소속업체 {getSortIcon('company')}</th>
                      <th className="px-2 lg:px-6 pt-[4.75px] pb-[3.75px] font-medium text-gray-300 tracking-wide uppercase text-[14.75px] text-center">작업</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-apple-border bg-transparent">
                    {filteredTickets.map(ticket => (
                      <tr 
                        key={ticket.id} 
                        className={clsx(
                          "hover:bg-white/5 transition-colors group cursor-pointer border-l-4",
                          ticket.status === '접수대기' ? 'border-l-purple-500' :
                          ticket.status === '배정완료' ? 'border-l-orange-500' :
                          ticket.status === '상담중' ? 'border-l-blue-500' :
                          ticket.status === '처리완료' ? 'border-l-cyan-500' :
                          ticket.status === '주의요망' ? 'border-l-pink-500' : 'border-l-transparent'
                        )}
                        onDoubleClick={() => setModalTicket(ticket)}
                        onClick={() => setModalTicket(ticket)}
                      >
                        <td className="hidden xl:table-cell px-2 lg:px-6 pt-[4.75px] pb-[3.75px] text-gray-300 font-medium text-[14.75px] text-center">
                          {counselors.find(c => c.id === ticket.counselor_id)?.name || ticket.counselor_id || '미배정'}
                        </td>
                        <td className="px-2 lg:px-6 pt-[4.75px] pb-[3.75px] text-center">
                          <div className="font-medium text-gray-200 flex items-center justify-center gap-2">
                            {ticket.worker_name || ticket.worker_id}
                            {ticket.red_flag && <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
                          </div>
                        </td>
                        <td className="px-2 lg:px-6 pt-[4.75px] pb-[3.75px] text-gray-400 text-center text-xs lg:text-sm">{ticket.created_at ? safeFormat(ticket.created_at, 'yy.MM.dd HH:mm') : '-'}</td>
                        <td className="px-2 lg:px-6 pt-[4.75px] pb-[3.75px] text-blue-300 font-medium text-center text-xs lg:text-sm">{ticket.reservation_time ? safeFormat(ticket.reservation_time, 'yy.MM.dd HH:mm') : '미지정'}</td>
                        <td className="px-2 lg:px-6 pt-[4.75px] pb-[3.75px] text-center">
                          <span className="px-2 lg:px-3 py-1 rounded-lg bg-black/30 border border-white/5 text-gray-300 text-[10px] lg:text-xs font-medium">{ticket.country || '-'}</span>
                        </td>
                        <td className="px-2 lg:px-6 pt-[4.75px] pb-[3.75px] text-center text-gray-300 text-xs lg:text-sm">
                          {ticket.visa_type || '-'}
                        </td>
                        <td className="px-2 lg:px-6 pt-[4.75px] pb-[3.75px] text-center">
                          <span className={clsx(
                            "px-2 lg:px-3 py-1 rounded-full text-[10px] lg:text-xs font-medium border",
                            ticket.status === '접수대기' && "bg-purple-500/20 text-purple-300 border-purple-500/30",
                            ticket.status === '배정완료' && "bg-orange-500/20 text-orange-300 border-orange-500/30",
                            ticket.status === '상담중' && "bg-blue-500/20 text-blue-300 border-blue-500/30",
                            ticket.status === '처리완료' && "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
                            ticket.status === '주의요망' && "bg-pink-500/20 text-pink-300 border-pink-500/30"
                          )}>
                            {ticket.status}
                          </span>
                        </td>
                        <td className="px-2 lg:px-6 pt-[4.75px] pb-[3.75px] text-center">
                          <span className="px-2 lg:px-3 py-1 bg-black/30 border border-white/5 rounded-lg text-[10px] lg:text-xs text-gray-300">
                            {ticket.category}
                          </span>
                        </td>
                        <td className="px-2 lg:px-6 pt-[4.75px] pb-[3.75px] text-gray-300 text-center text-xs lg:text-sm">{ticket.company_code}</td>
                        <td className="px-2 lg:px-6 pt-[4.75px] pb-[3.75px] text-center">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setModalTicket(ticket); }}
                            className="text-white hover:text-blue-300 font-medium text-xs px-2 lg:px-3 py-1 lg:py-1.5 border border-white/10 rounded-lg bg-white/5 opacity-0 group-hover:opacity-100 transition-all hover:bg-white/10"
                          >
                            상세
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
      
      {modalTicket && (
        <TicketDetailModal 
          ticket={modalTicket}
          onClose={() => setModalTicket(null)}
        />
      )}
    </div>
  );
};
