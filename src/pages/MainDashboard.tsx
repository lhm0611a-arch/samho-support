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
  const feedbackPending = dateFilteredTickets.filter(t => t.red_flag && t.category !== '기타').length;

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
        if (statusFilter === '주의요망' && (!t.red_flag || t.category === '기타')) return false;
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
      <div className="hidden md:flex dx-card px-4 md:px-6 py-4 md:py-5 shrink-0 w-full flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#002c5f]/20 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none group-hover:bg-[#002c5f]/30 transition-colors duration-700"></div>
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-10 h-10 md:w-11 md:h-11 rounded-xl bg-[#002c5f] flex items-center justify-center border border-[#1e3a5f] shrink-0 shadow-[0_0_15px_rgba(0,44,95,0.4)]">
            <Lightbulb className="w-5 h-5 text-[#38bdf8]" />
          </div>
          <div>
            <h3 className="text-[#f8fafc] text-sm md:text-base font-bold flex items-center gap-2 tracking-wide">
              AI 인사이트 
              <span className="text-xs text-[#94a3b8] font-semibold border border-[#1e3a5f] bg-[#051326] px-2.5 py-0.5 rounded-full">(외국인지원센터 분석)</span>
              {latestInsights.length > 1 && (
                <span className="text-[10px] text-[#38bdf8] font-mono bg-[#002c5f] px-1.5 py-0.5 rounded border border-[#1e3a5f]">
                  {insightIndex + 1}/{latestInsights.length}
                </span>
              )}
            </h3>
            <p className="text-[#cbd5e1] text-xs md:text-sm mt-1.5 leading-relaxed transition-all duration-500 animate-fade-in-up font-medium">
              {latestInsights.length > 0 
                ? latestInsights[insightIndex] 
                : "이번 주 베트남 국적 근로자의 '비자/체류' 문의가 전주 대비 42% 증가했습니다. 통역 리소스 배분을 재조정하는 것이 좋습니다."
              }
            </p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="dx-card px-3.5 py-4 sm:px-4 md:p-6 shrink-0 w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 md:mb-5">
          <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between gap-2.5 w-full sm:w-auto">
            <h3 className="text-base sm:text-lg font-bold text-[#f8fafc] tracking-tight flex items-center gap-2 whitespace-nowrap">
              <span className="w-2.5 h-2.5 rounded-full bg-[#00a859] shrink-0"></span>
              종합상담 Dashboard
            </h3>
            <div className="flex items-center p-0.5 rounded-lg border border-[#1e3a5f] bg-[#051326] shrink-0">
              <button 
                onClick={() => setDateFilter('day')}
                className={`px-2.5 sm:px-3.5 py-1 text-[11px] sm:text-xs font-bold rounded-md transition-all whitespace-nowrap ${dateFilter === 'day' ? 'bg-[#002c5f] text-[#38bdf8] shadow-sm' : 'text-[#94a3b8] hover:text-[#f8fafc]'}`}
              >오늘</button>
              <button 
                onClick={() => setDateFilter('week')}
                className={`px-2.5 sm:px-3.5 py-1 text-[11px] sm:text-xs font-bold rounded-md transition-all whitespace-nowrap ${dateFilter === 'week' ? 'bg-[#002c5f] text-[#38bdf8] shadow-sm' : 'text-[#94a3b8] hover:text-[#f8fafc]'}`}
              >주간</button>
              <button 
                onClick={() => setDateFilter('month')}
                className={`px-2.5 sm:px-3.5 py-1 text-[11px] sm:text-xs font-bold rounded-md transition-all whitespace-nowrap ${dateFilter === 'month' ? 'bg-[#002c5f] text-[#38bdf8] shadow-sm' : 'text-[#94a3b8] hover:text-[#f8fafc]'}`}
              >월간</button>
              <button 
                onClick={() => setDateFilter('')}
                className={`px-2.5 sm:px-3.5 py-1 text-[11px] sm:text-xs font-bold rounded-md transition-all whitespace-nowrap ${dateFilter === '' ? 'bg-[#002c5f] text-[#38bdf8] shadow-sm' : 'text-[#94a3b8] hover:text-[#f8fafc]'}`}
              >전체</button>
            </div>
          </div>
          <span className="text-xs text-[#94a3b8] font-semibold hidden sm:block whitespace-nowrap">실시간 동기화 상태</span>
        </div>
        
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 md:gap-5">
          {/* Card 1: 접수 대기 */}
          <div 
            onClick={() => setStatusFilter(statusFilter === '접수대기' ? '' : '접수대기')}
            className={clsx("dx-card p-3 sm:p-4 md:p-5 text-white cursor-pointer transition-all duration-200 relative overflow-hidden group flex flex-col justify-between min-h-[110px] md:min-h-[145px]", statusFilter === '접수대기' ? "!border-[#38bdf8] !bg-[#002c5f]/40 shadow-[0_0_15px_rgba(56,189,248,0.2)]" : "hover:border-[#38bdf8]/50")}
          >
            <h4 className="text-xs sm:text-sm font-bold mb-1 md:mb-2 text-[#94a3b8] flex justify-between items-center tracking-wide whitespace-nowrap">
              <span>접수 대기</span>
              <span className="type-badge badge-wait text-[10px] shrink-0">대기</span>
            </h4>
            <div className="flex items-baseline gap-1.5 mb-1">
              <span className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-[#f8fafc]">{pendingAssign}</span>
              <span className="text-[11px] sm:text-xs text-[#94a3b8] font-medium whitespace-nowrap">건 대기</span>
            </div>
            <div className="text-[11px] sm:text-xs text-[#94a3b8] flex items-center justify-between bg-[#051326] px-2 sm:px-2.5 py-1.5 rounded border border-[#1e3a5f] gap-1">
              <span className="flex items-center gap-1.5 min-w-0 truncate"><div className="w-1.5 h-1.5 rounded-full bg-[#94a3b8] shrink-0"></div> <span className="truncate whitespace-nowrap">신규 접수</span></span>
              <span className="font-bold text-[#f8fafc] shrink-0 whitespace-nowrap">실시간</span>
            </div>
          </div>
          
          {/* Card 2: 배정 및 진행 */}
          <div 
            onClick={() => setStatusFilter(statusFilter === '배정확정' ? '' : '배정확정')}
            className={clsx("dx-card p-3 sm:p-4 md:p-5 text-white cursor-pointer transition-all duration-200 relative overflow-hidden group flex flex-col justify-between min-h-[110px] md:min-h-[145px]", statusFilter === '배정확정' ? "!border-[#facc15] !bg-[#002c5f]/40 shadow-[0_0_15px_rgba(250,204,21,0.2)]" : "hover:border-[#facc15]/50")}
          >
            <h4 className="text-xs sm:text-sm font-bold mb-1 md:mb-2 text-[#facc15] flex justify-between items-center tracking-wide whitespace-nowrap">
              <span>배정 확정</span>
              <span className="type-badge badge-cond text-[10px] shrink-0">진행</span>
            </h4>
            <div className="flex items-baseline gap-1.5 mb-1">
              <span className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-[#f8fafc]">{inProgress}</span>
              <span className="text-[11px] sm:text-xs text-[#94a3b8] font-medium whitespace-nowrap">건 진행</span>
            </div>
            <div className="text-[11px] sm:text-xs text-[#94a3b8] flex items-center justify-between bg-[#051326] px-2 sm:px-2.5 py-1.5 rounded border border-[#1e3a5f] gap-1">
              <span className="flex items-center gap-1.5 min-w-0 truncate"><div className="w-1.5 h-1.5 rounded-full bg-[#facc15] shrink-0"></div> <span className="truncate whitespace-nowrap">통역 배정</span></span>
              <span className="font-bold text-[#f8fafc] shrink-0 whitespace-nowrap">진행중</span>
            </div>
          </div>

          {/* Card 3: 상담 완료 (HD Green Accent) */}
          <div 
            onClick={() => setStatusFilter(statusFilter === '상담완료' ? '' : '상담완료')}
            className={clsx("dx-card p-3 sm:p-4 md:p-5 text-white cursor-pointer transition-all duration-200 relative overflow-hidden group flex flex-col justify-between min-h-[110px] md:min-h-[145px]", statusFilter === '상담완료' ? "!border-[#00a859] !bg-[#002c5f]/40 shadow-[0_0_15px_rgba(0,168,89,0.2)]" : "hover:border-[#00a859]/50")}
          >
            <h4 className="text-xs sm:text-sm font-bold mb-1 md:mb-2 text-[#4ade80] flex justify-between items-center tracking-wide whitespace-nowrap">
              <span>상담 완료</span>
              <span className="type-badge badge-pass text-[10px] shrink-0">완료</span>
            </h4>
            <div className="flex items-baseline gap-1.5 mb-1">
              <span className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-[#f8fafc]">{completed}</span>
              <span className="text-[11px] sm:text-xs text-[#94a3b8] font-medium whitespace-nowrap">건 완료</span>
            </div>
            <div className="text-[11px] sm:text-xs text-[#94a3b8] flex items-center justify-between bg-[#051326] px-2 sm:px-2.5 py-1.5 rounded border border-[#1e3a5f] gap-1">
              <span className="flex items-center gap-1.5 min-w-0 truncate"><div className="w-1.5 h-1.5 rounded-full bg-[#00a859] shrink-0"></div> <span className="truncate whitespace-nowrap">처리 완료</span></span>
              <span className="font-bold text-[#4ade80] shrink-0 whitespace-nowrap">성공</span>
            </div>
          </div>

          {/* Card 4: Red Flag (Danger Accent) */}
          <div 
            onClick={() => setStatusFilter(statusFilter === '주의요망' ? '' : '주의요망')}
            className={clsx("dx-card p-3 sm:p-4 md:p-5 text-white cursor-pointer transition-all duration-200 relative overflow-hidden group flex flex-col justify-between min-h-[110px] md:min-h-[145px]", statusFilter === '주의요망' ? "!border-[#f87171] !bg-red-950/30 shadow-[0_0_15px_rgba(239,68,68,0.25)]" : "hover:border-[#f87171]/50")}
          >
            <h4 className="text-xs sm:text-sm font-bold mb-1 md:mb-2 text-[#f87171] flex justify-between items-center tracking-wide whitespace-nowrap">
              <span className="flex items-center gap-1 shrink-0 whitespace-nowrap">Red Flag <AlertTriangle className="w-3.5 h-3.5 text-[#f87171] shrink-0" /></span>
              <span className="type-badge badge-fail text-[10px] shrink-0">주의</span>
            </h4>
            <div className="flex items-baseline gap-1.5 mb-1">
              <span className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-[#f8fafc]">{feedbackPending}</span>
              <span className="text-[11px] sm:text-xs text-[#94a3b8] font-medium whitespace-nowrap">건 주의</span>
            </div>
            <div className="text-[11px] sm:text-xs text-[#94a3b8] flex items-center justify-between bg-[#051326] px-2 sm:px-2.5 py-1.5 rounded border border-[#1e3a5f] gap-1">
              <span className="flex items-center gap-1.5 min-w-0 truncate"><div className="w-1.5 h-1.5 rounded-full bg-[#ef4444] shrink-0"></div> <span className="truncate whitespace-nowrap">심층 모니터링</span></span>
              <span className="font-bold text-[#f87171] shrink-0 whitespace-nowrap">집중관리</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Table */}
      <div className="dx-table-wrapper flex flex-col w-full shrink-0">
        {/* Table Search and Filter Bar */}
        <div className="p-3.5 md:p-4 border-b border-[#1e3a5f] bg-[#051326] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <span className="text-sm font-bold text-[#f8fafc] whitespace-nowrap">상담 접수 및 현황 리스트</span>
            <span className="text-xs text-[#38bdf8] bg-[#002c5f] px-2.5 py-0.5 rounded-full border border-[#1e3a5f] font-bold">
              총 {filteredTickets.length}건
            </span>
            {statusFilter && (
              <button 
                onClick={() => setStatusFilter('')} 
                className="text-xs text-[#94a3b8] hover:text-[#f8fafc] flex items-center gap-1 ml-2 underline"
              >
                필터 해제
              </button>
            )}
          </div>
          <div className="w-full sm:w-72 relative">
            <Search className="w-4 h-4 text-[#94a3b8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input 
              type="text"
              placeholder="근로자명, 사번, 소속업체 검색..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="dx-input !py-2 !pl-9 !pr-3 text-xs"
            />
          </div>
        </div>

        {/* Table / Card List */}
        <div className="bg-transparent">
          {filteredTickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-[#94a3b8] min-h-[250px]">
              <div className="w-14 h-14 bg-[#051326] rounded-full flex items-center justify-center mb-3 border border-[#1e3a5f]">
                <Search className="w-7 h-7 text-[#94a3b8]" />
              </div>
              <p className="font-semibold text-sm">조건에 맞는 데이터가 없습니다.</p>
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="block md:hidden p-3 space-y-2.5">
                {filteredTickets.map(ticket => (
                  <div 
                    key={ticket.id} 
                    onClick={() => setModalTicket(ticket)}
                    className={clsx(
                      "dx-card p-3.5 border cursor-pointer transition-colors border-l-4",
                      ticket.status === '접수대기' ? 'border-l-[#94a3b8]' :
                      ticket.status === '배정완료' || ticket.status === '상담중' ? 'border-l-[#facc15]' :
                      ticket.status === '처리완료' ? 'border-l-[#00a859]' :
                      ticket.status === '주의요망' ? 'border-l-[#ef4444]' : 'border-l-[#1e3a5f]'
                    )}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-bold text-[#f8fafc] flex items-center gap-2 text-base">
                          {ticket.worker_name || ticket.worker_id}
                          {ticket.red_flag && ticket.category !== '기타' && <AlertTriangle className="w-4 h-4 text-[#f87171]" />}
                        </div>
                        <div className="text-xs text-[#94a3b8] flex items-center gap-2 mt-0.5">
                          <span>{ticket.company_code || '-'}</span>
                          {ticket.status === '접수대기' && ticket.phone_number && (
                            <a href={`tel:${ticket.phone_number}`} onClick={(e) => e.stopPropagation()} className="text-[#38bdf8] hover:underline font-semibold bg-[#002c5f] px-1.5 py-0.5 rounded flex items-center gap-1 border border-[#1e3a5f]">
                              <Phone className="w-3 h-3" /> {ticket.phone_number}
                            </a>
                          )}
                        </div>
                      </div>
                      <span className={clsx(
                        "type-badge",
                        ticket.status === '접수대기' && "badge-wait",
                        (ticket.status === '배정완료' || ticket.status === '상담중') && "badge-cond",
                        ticket.status === '처리완료' && "badge-pass",
                        ticket.status === '주의요망' && "badge-fail"
                      )}>
                        {ticket.status}
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[#94a3b8] text-xs bg-[#051326] border border-[#1e3a5f]">{ticket.country}</span>
                      {ticket.visa_type && <span className="inline-flex items-center px-2 py-0.5 rounded text-[#94a3b8] text-xs bg-[#051326] border border-[#1e3a5f]">{ticket.visa_type}</span>}
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[#cbd5e1] text-xs bg-[#002c5f]/50 border border-[#1e3a5f]">{ticket.category}</span>
                      {ticket.urgency === 'high' && <span className="inline-flex items-center px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/30">긴급</span>}
                    </div>

                    <div className="flex gap-4 text-xs py-1 border-t border-[#1e3a5f] mt-2">
                      <div className="flex gap-1.5">
                        <span className="text-[#94a3b8]">접수일</span>
                        <span className="text-[#f8fafc] font-medium">{ticket.created_at ? safeFormat(ticket.created_at, 'MM/dd HH:mm') : '-'}</span>
                      </div>
                      <div className="flex gap-1.5">
                        <span className="text-[#94a3b8]">예약일</span>
                        <span className="text-[#38bdf8] font-bold">{ticket.reservation_time ? safeFormat(ticket.reservation_time, 'MM/dd HH:mm') : '미지정'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block w-full overflow-x-auto custom-scrollbar">
                <table className="w-full text-sm text-left whitespace-nowrap dx-table">
                  <thead>
                    <tr>
                      <th onClick={() => handleSort('counselor')} className="cursor-pointer hidden xl:table-cell px-4 py-2.5 font-bold tracking-wide uppercase text-center hover:text-white transition-colors">통역위원 {getSortIcon('counselor')}</th>
                      <th onClick={() => handleSort('worker')} className="cursor-pointer px-4 py-2.5 font-bold tracking-wide uppercase text-center hover:text-white transition-colors">근로자 {getSortIcon('worker')}</th>
                      <th onClick={() => handleSort('created_at')} className="cursor-pointer px-4 py-2.5 font-bold tracking-wide uppercase text-center hover:text-white transition-colors">접수일시 {getSortIcon('created_at')}</th>
                      <th onClick={() => handleSort('reservation_time')} className="cursor-pointer px-4 py-2.5 font-bold tracking-wide uppercase text-center text-[#38bdf8] hover:text-[#7dd3fc] transition-colors">예약일시 {getSortIcon('reservation_time')}</th>
                      <th onClick={() => handleSort('country')} className="cursor-pointer px-4 py-2.5 font-bold tracking-wide uppercase text-center hover:text-white transition-colors">국가 {getSortIcon('country')}</th>
                      <th onClick={() => handleSort('visa_type')} className="cursor-pointer px-4 py-2.5 font-bold tracking-wide uppercase text-center hover:text-white transition-colors">비자 {getSortIcon('visa_type')}</th>
                      <th onClick={() => handleSort('status')} className="cursor-pointer px-4 py-2.5 font-bold tracking-wide uppercase text-center hover:text-white transition-colors">상태 {getSortIcon('status')}</th>
                      <th onClick={() => handleSort('category')} className="cursor-pointer px-4 py-2.5 font-bold tracking-wide uppercase text-center hover:text-white transition-colors">유형 {getSortIcon('category')}</th>
                      <th onClick={() => handleSort('company')} className="cursor-pointer px-4 py-2.5 font-bold tracking-wide uppercase text-center hover:text-white transition-colors">소속업체 {getSortIcon('company')}</th>
                      <th className="px-4 py-2.5 font-bold tracking-wide uppercase text-center">작업</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTickets.map(ticket => (
                      <tr 
                        key={ticket.id} 
                        className={clsx(
                          "transition-colors group cursor-pointer border-l-4",
                          ticket.status === '접수대기' ? 'border-l-[#94a3b8]' :
                          ticket.status === '배정완료' || ticket.status === '상담중' ? 'border-l-[#facc15]' :
                          ticket.status === '처리완료' ? 'border-l-[#00a859]' :
                          ticket.status === '주의요망' ? 'border-l-[#ef4444]' : 'border-l-transparent'
                        )}
                        onDoubleClick={() => setModalTicket(ticket)}
                        onClick={() => setModalTicket(ticket)}
                      >
                        <td className="hidden xl:table-cell px-4 py-2 text-center text-[#94a3b8] font-medium">
                          {counselors.find(c => c.id === ticket.counselor_id)?.name || ticket.counselor_id || '미배정'}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <div className="font-bold text-[#f8fafc] flex items-center justify-center gap-2">
                            {ticket.worker_name || ticket.worker_id}
                            {ticket.red_flag && ticket.category !== '기타' && <AlertTriangle className="w-3.5 h-3.5 text-[#f87171]" />}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-[#94a3b8] text-center text-xs lg:text-sm font-medium">{ticket.created_at ? safeFormat(ticket.created_at, 'yy.MM.dd HH:mm') : '-'}</td>
                        <td className="px-4 py-2 text-[#38bdf8] font-bold text-center text-xs lg:text-sm">{ticket.reservation_time ? safeFormat(ticket.reservation_time, 'yy.MM.dd HH:mm') : '미지정'}</td>
                        <td className="px-4 py-2 text-center">
                          <span className="px-2.5 py-0.5 rounded bg-[#051326] border border-[#1e3a5f] text-[#cbd5e1] text-[11px] font-semibold">{ticket.country || '-'}</span>
                        </td>
                        <td className="px-4 py-2 text-center text-[#94a3b8] text-xs lg:text-sm font-medium">
                          {ticket.visa_type || '-'}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span className={clsx(
                            "type-badge",
                            ticket.status === '접수대기' && "badge-wait",
                            (ticket.status === '배정완료' || ticket.status === '상담중') && "badge-cond",
                            ticket.status === '처리완료' && "badge-pass",
                            ticket.status === '주의요망' && "badge-fail"
                          )}>
                            {ticket.status}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span className="px-2.5 py-0.5 bg-[#051326] border border-[#1e3a5f] rounded text-[11px] text-[#cbd5e1] font-semibold">
                            {ticket.category}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-[#94a3b8] text-center text-xs lg:text-sm font-medium">{ticket.company_code}</td>
                        <td className="px-4 py-2 text-center">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setModalTicket(ticket); }}
                            className="text-[#38bdf8] hover:text-white font-bold text-xs px-3 py-1 border border-[#1e3a5f] rounded-lg bg-[#002c5f] hover:bg-[#003770] hover:border-[#38bdf8] transition-all"
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
