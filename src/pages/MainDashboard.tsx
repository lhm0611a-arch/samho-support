import { safeFormat, safeDate } from '../utils/safeDate';
import React, { useState, useMemo, useEffect } from 'react';
import { useTicketStore } from '../store/ticketStore';
import { useAuthStore } from '../store/authStore';
import { useCounselorStore } from '../store/counselorStore';
import { 
  Search, ChevronLeft, ChevronRight, Settings, MessageSquare, Plus, Edit2, Phone, 
  Trash2, TrendingUp, AlertTriangle, Lightbulb, ArrowUpDown, ArrowDown, ArrowUp,
  CheckCircle2, Clock, Activity, ShieldAlert, ShieldCheck, Sparkles, Radio, Layers, 
  Globe, Building2, Flame
} from 'lucide-react';
import { format, isToday, isThisWeek, isThisMonth } from 'date-fns';
import { CounselingTicket } from '../types';
import clsx from 'clsx';
import { useFirestore } from '../hooks/useFirestore';
import { TicketDetailModal } from '../components/TicketDetailModal';
import { isCounselorId } from '../utils/counselorHelper';
import { HDHyundaiCI } from '../components/HDHyundaiCI';

const COUNTRY_FLAGS: Record<string, string> = {
  '베트남': '🇻🇳',
  'Vietnam': '🇻🇳',
  '네팔': '🇳🇵',
  'Nepal': '🇳🇵',
  '우즈베키스탄': '🇺🇿',
  '우즈벡': '🇺🇿',
  'Uzbekistan': '🇺🇿',
  '캄보디아': '🇰🇭',
  'Cambodia': '🇰🇭',
  '인도네시아': '🇮🇩',
  'Indonesia': '🇮🇩',
  '미얀마': '🇲🇲',
  'Myanmar': '🇲🇲',
  '스리랑카': '🇱🇰',
  'Sri Lanka': '🇱🇰',
  '태국': '🇹🇭',
  'Thailand': '🇹🇭',
  '필리핀': '🇵🇭',
  'Philippines': '🇵🇭',
  '중국': '🇨🇳',
  'China': '🇨🇳',
  '몽골': '🇲🇳',
  'Mongolia': '🇲🇳',
  '한국': '🇰🇷',
  'Korea': '🇰🇷',
};

const getCountryFlag = (country?: string) => {
  if (!country) return '🌐';
  for (const [key, flag] of Object.entries(COUNTRY_FLAGS)) {
    if (country.includes(key)) return flag;
  }
  return '🌐';
};

const getCategoryStyle = (category?: string) => {
  switch (category) {
    case '임금체불':
      return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    case '산재/치료':
      return 'bg-red-500/15 text-red-300 border-red-500/30';
    case '비자/체류':
      return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
    case '기숙사/식당/생활':
    case '기숙사':
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    case '업무소통':
      return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
    case '정서/심리':
      return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
    case '법률/행정':
      return 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30';
    default:
      return 'bg-gray-500/15 text-gray-300 border-gray-500/30';
  }
};

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

  // Summary counts and pipeline statistics
  const pendingAssign = dateFilteredTickets.filter(t => t.status === '접수대기').length;
  const inProgress = dateFilteredTickets.filter(t => t.status === '배정완료' || t.status === '상담중').length;
  const completed = dateFilteredTickets.filter(t => t.status === '처리완료').length;
  const feedbackPending = dateFilteredTickets.filter(t => t.red_flag && t.category !== '기타').length;

  const totalCount = dateFilteredTickets.length;
  const completionRate = totalCount > 0 ? Math.round((completed / totalCount) * 100) : 0;
  const inProgressRate = totalCount > 0 ? Math.round((inProgress / totalCount) * 100) : 0;
  const pendingRate = totalCount > 0 ? Math.round((pendingAssign / totalCount) * 100) : 0;
  const redFlagRate = totalCount > 0 ? Math.round((feedbackPending / totalCount) * 100) : 0;

  // Real-time shipyard yard clock
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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
      {/* Live Shipyard Operations HUD Telemetry Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-[#031326]/75 backdrop-blur-md border border-cyan-500/25 text-xs shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
        <div className="flex items-center gap-3">
          <HDHyundaiCI size="sm" subtitle="야드 상담 관제" />
          <span className="relative flex h-2 w-2 ml-1">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[10px] text-cyan-300 font-mono font-bold bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/40">
            LIVE ONLINE
          </span>
        </div>
        <div className="flex items-center gap-3 sm:gap-4 text-gray-300">
          <div className="hidden sm:flex items-center gap-1.5 font-mono text-[11px] text-cyan-300">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>{format(currentTime, 'yyyy.MM.dd HH:mm:ss')} KST</span>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="bg-[#051833] px-2.5 py-1 rounded-md border border-cyan-500/20 text-gray-300">
              등록 통역위원 <strong className="text-white font-bold">{counselors.filter(c => isCounselorId(c.id) && !c.isRetired).length}명</strong>
            </span>
            <span className="bg-[#051833] px-2.5 py-1 rounded-md border border-cyan-500/20 text-gray-300">
              전체 누적 <strong className="text-cyan-400 font-bold">{allTickets.length}건</strong>
            </span>
          </div>
        </div>
      </div>

      {/* AI Smart Banner */}
      <div className="hidden md:flex dx-card px-4 md:px-6 py-4 shrink-0 w-full flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden group border-cyan-500/30">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#002c5f]/25 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none group-hover:bg-[#002c5f]/40 transition-colors duration-700"></div>
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-10 h-10 md:w-11 md:h-11 rounded-xl bg-gradient-to-br from-[#002c5f] to-[#041d3d] flex items-center justify-center border border-cyan-500/40 shrink-0 shadow-[0_0_15px_rgba(0,44,95,0.5)]">
            <Sparkles className="w-5 h-5 text-cyan-400 animate-pulse" />
          </div>
          <div>
            <h3 className="text-[#f8fafc] text-sm md:text-base font-bold flex items-center gap-2 tracking-wide">
              <span>AI 지능형 상담 인사이트</span>
              <span className="text-[11px] text-[#38bdf8] font-semibold border border-cyan-500/30 bg-[#051326] px-2.5 py-0.5 rounded-full">외국인지원센터 분석</span>
              {latestInsights.length > 1 && (
                <div className="flex items-center gap-1 ml-2">
                  {latestInsights.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setInsightIndex(idx)}
                      className={clsx(
                        "w-2 h-2 rounded-full transition-all",
                        idx === insightIndex ? "bg-cyan-400 w-4" : "bg-gray-600 hover:bg-gray-400"
                      )}
                      title={`${idx + 1}번 인사이트`}
                    />
                  ))}
                </div>
              )}
            </h3>
            <p className="text-[#cbd5e1] text-xs md:text-sm mt-1 leading-relaxed transition-all duration-500 font-medium">
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between gap-2.5 w-full sm:w-auto">
            <h3 className="text-base sm:text-lg font-bold text-[#f8fafc] tracking-tight flex items-center gap-2 whitespace-nowrap">
              <span className="w-2.5 h-2.5 rounded-full bg-[#00a859] shadow-[0_0_8px_#00a859] shrink-0"></span>
              종합상담 관제 Dashboard
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
          <div className="flex items-center gap-3 text-xs text-[#94a3b8] font-semibold">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
              실시간 상태 동기화
            </span>
          </div>
        </div>

        {/* Visual Pipeline Distribution Bar */}
        <div className="mb-4 bg-[#031022]/80 p-3 rounded-xl border border-cyan-500/15 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-semibold text-gray-300">
            <span className="flex items-center gap-1.5 text-cyan-300">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              실시간 프로세스 흐름 파이프라인
            </span>
            <span className="text-xs text-white font-mono">
              완료율 <strong className="text-[#4ade80] font-bold text-sm">{completionRate}%</strong> ({completed}/{totalCount}건)
            </span>
          </div>
          <div className="w-full h-3 bg-black/40 rounded-full overflow-hidden flex p-0.5 gap-0.5 border border-white/5">
            {pendingRate > 0 && (
              <div 
                style={{ width: `${pendingRate}%` }} 
                className="h-full bg-gradient-to-r from-sky-500 to-sky-400 rounded-full transition-all duration-700" 
                title={`접수 대기: ${pendingAssign}건 (${pendingRate}%)`}
              />
            )}
            {inProgressRate > 0 && (
              <div 
                style={{ width: `${inProgressRate}%` }} 
                className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all duration-700" 
                title={`배정 및 진행: ${inProgress}건 (${inProgressRate}%)`}
              />
            )}
            {completionRate > 0 && (
              <div 
                style={{ width: `${completionRate}%` }} 
                className="h-full bg-gradient-to-r from-emerald-500 to-[#00a859] rounded-full transition-all duration-700" 
                title={`처리 완료: ${completed}건 (${completionRate}%)`}
              />
            )}
            {redFlagRate > 0 && (
              <div 
                style={{ width: `${redFlagRate}%` }} 
                className="h-full bg-gradient-to-r from-red-500 to-rose-400 rounded-full transition-all duration-700" 
                title={`주의 요망: ${feedbackPending}건 (${redFlagRate}%)`}
              />
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between text-[10px] text-gray-400 pt-0.5">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-400" /> 접수대기 {pendingRate}% ({pendingAssign}건)</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> 배정·진행 {inProgressRate}% ({inProgress}건)</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#00a859]" /> 처리완료 {completionRate}% ({completed}건)</span>
            {feedbackPending > 0 ? (
              <span className="flex items-center gap-1 text-red-400 font-bold"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Red Flag {feedbackPending}건</span>
            ) : (
              <span className="flex items-center gap-1 text-emerald-400"><ShieldCheck className="w-3 h-3" /> 안심 관제 중</span>
            )}
          </div>
        </div>
        
        {/* 4 Dynamic KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 md:gap-5">
          {/* Card 1: 접수 대기 */}
          <div 
            onClick={() => setStatusFilter(statusFilter === '접수대기' ? '' : '접수대기')}
            className={clsx(
              "dx-card p-3 sm:p-4 md:p-5 text-white cursor-pointer transition-all duration-300 relative overflow-hidden group flex flex-col justify-between min-h-[120px] md:min-h-[155px]",
              statusFilter === '접수대기' 
                ? "!border-sky-400 !bg-[#002c5f]/60 shadow-[0_0_20px_rgba(56,189,248,0.35)]" 
                : "hover:border-sky-400/60 hover:-translate-y-0.5"
            )}
          >
            <div className="flex justify-between items-center mb-1 md:mb-2">
              <span className="text-xs sm:text-sm font-bold text-sky-200 flex items-center gap-1.5 tracking-wide">
                <Clock className="w-4 h-4 text-sky-400" />
                <span>접수 대기</span>
              </span>
              {pendingAssign > 0 ? (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
                </span>
              ) : (
                <span className="type-badge badge-wait text-[10px]">대기</span>
              )}
            </div>
            
            <div className="flex items-baseline justify-between my-1">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white">{pendingAssign}</span>
                <span className="text-[11px] sm:text-xs text-sky-200/70 font-medium">건</span>
              </div>
              <span className="text-[11px] font-mono text-sky-400 bg-sky-950/60 px-2 py-0.5 rounded border border-sky-500/20">
                {pendingRate}%
              </span>
            </div>

            <div className="text-[11px] sm:text-xs text-sky-100 flex items-center justify-between bg-[#04162e] px-2.5 py-1.5 rounded-lg border border-sky-500/20 gap-1">
              <span className="flex items-center gap-1.5 truncate">
                <div className={clsx("w-1.5 h-1.5 rounded-full shrink-0", pendingAssign > 0 ? "bg-sky-400 animate-pulse" : "bg-gray-400")}></div> 
                <span className="truncate">{pendingAssign > 0 ? "통역 배정 대기중" : "대기 없음"}</span>
              </span>
              <span className="font-bold text-sky-300 shrink-0 text-[10px]">즉시할당</span>
            </div>
          </div>
          
          {/* Card 2: 배정 및 진행 */}
          <div 
            onClick={() => setStatusFilter(statusFilter === '배정확정' ? '' : '배정확정')}
            className={clsx(
              "dx-card p-3 sm:p-4 md:p-5 text-white cursor-pointer transition-all duration-300 relative overflow-hidden group flex flex-col justify-between min-h-[120px] md:min-h-[155px]",
              statusFilter === '배정확정' 
                ? "!border-amber-400 !bg-[#002c5f]/60 shadow-[0_0_20px_rgba(250,204,21,0.35)]" 
                : "hover:border-amber-400/60 hover:-translate-y-0.5"
            )}
          >
            <div className="flex justify-between items-center mb-1 md:mb-2">
              <span className="text-xs sm:text-sm font-bold text-amber-300 flex items-center gap-1.5 tracking-wide">
                <Activity className="w-4 h-4 text-amber-400" />
                <span>배정 및 진행</span>
              </span>
              <span className="type-badge badge-cond text-[10px]">진행</span>
            </div>

            <div className="flex items-baseline justify-between my-1">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white">{inProgress}</span>
                <span className="text-[11px] sm:text-xs text-amber-200/70 font-medium">건</span>
              </div>
              <span className="text-[11px] font-mono text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/20">
                {inProgressRate}%
              </span>
            </div>

            <div className="text-[11px] sm:text-xs text-amber-100 flex items-center justify-between bg-[#04162e] px-2.5 py-1.5 rounded-lg border border-amber-500/20 gap-1">
              <span className="flex items-center gap-1.5 truncate">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"></div> 
                <span className="truncate">통역 세션 운영</span>
              </span>
              <span className="font-bold text-amber-300 shrink-0 text-[10px]">실시간 통역</span>
            </div>
          </div>

          {/* Card 3: 상담 완료 (Donut Ring Gauge Hero) */}
          <div 
            onClick={() => setStatusFilter(statusFilter === '상담완료' ? '' : '상담완료')}
            className={clsx(
              "dx-card p-3 sm:p-4 md:p-5 text-white cursor-pointer transition-all duration-300 relative overflow-hidden group flex flex-col justify-between min-h-[120px] md:min-h-[155px]",
              statusFilter === '상담완료' 
                ? "!border-[#00a859] !bg-[#002c5f]/60 shadow-[0_0_20px_rgba(0,168,89,0.35)]" 
                : "hover:border-[#00a859]/60 hover:-translate-y-0.5"
            )}
          >
            <div className="flex justify-between items-center mb-1 md:mb-2">
              <span className="text-xs sm:text-sm font-bold text-emerald-300 flex items-center gap-1.5 tracking-wide">
                <CheckCircle2 className="w-4 h-4 text-[#00a859]" />
                <span>상담 완료</span>
              </span>
              <span className="type-badge badge-pass text-[10px]">완료</span>
            </div>

            <div className="flex items-center justify-between my-1">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white">{completed}</span>
                <span className="text-[11px] sm:text-xs text-emerald-200/70 font-medium">건</span>
              </div>
              
              {/* Circular Gauge Ring */}
              <div className="relative w-11 h-11 md:w-12 md:h-12 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-[#052033]"
                    strokeWidth="3.8"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-[#00a859] transition-all duration-1000 ease-out"
                    strokeDasharray={`${completionRate}, 100`}
                    strokeWidth="3.8"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                  />
                </svg>
                <span className="absolute text-[10px] md:text-[11px] font-black text-[#4ade80] tracking-tighter">
                  {completionRate}%
                </span>
              </div>
            </div>

            <div className="text-[11px] sm:text-xs text-emerald-100 flex items-center justify-between bg-[#04162e] px-2.5 py-1.5 rounded-lg border border-emerald-500/20 gap-1">
              <span className="flex items-center gap-1.5 truncate">
                <div className="w-1.5 h-1.5 rounded-full bg-[#00a859] shrink-0"></div> 
                <span className="truncate">솔루션 제공 완료</span>
              </span>
              <span className="font-bold text-[#4ade80] shrink-0 text-[10px]">종결</span>
            </div>
          </div>

          {/* Card 4: Red Flag (Safety Watch) */}
          <div 
            onClick={() => setStatusFilter(statusFilter === '주의요망' ? '' : '주의요망')}
            className={clsx(
              "dx-card p-3 sm:p-4 md:p-5 text-white cursor-pointer transition-all duration-300 relative overflow-hidden group flex flex-col justify-between min-h-[120px] md:min-h-[155px]",
              statusFilter === '주의요망' 
                ? "!border-red-500 !bg-red-950/40 shadow-[0_0_20px_rgba(239,68,68,0.4)]" 
                : "hover:border-red-500/60 hover:-translate-y-0.5"
            )}
          >
            <div className="flex justify-between items-center mb-1 md:mb-2">
              <span className="text-xs sm:text-sm font-bold text-red-300 flex items-center gap-1.5 tracking-wide">
                {feedbackPending > 0 ? (
                  <ShieldAlert className="w-4 h-4 text-red-400 animate-pulse" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                )}
                <span>Red Flag 관제</span>
              </span>
              <span className={clsx(
                "type-badge text-[10px]",
                feedbackPending > 0 ? "badge-fail" : "badge-pass"
              )}>
                {feedbackPending > 0 ? "주의" : "안심"}
              </span>
            </div>

            <div className="flex items-baseline justify-between my-1">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white">{feedbackPending}</span>
                <span className="text-[11px] sm:text-xs text-red-200/70 font-medium">건</span>
              </div>
              <span className={clsx(
                "text-[11px] font-mono px-2 py-0.5 rounded border",
                feedbackPending > 0 ? "text-red-400 bg-red-950/60 border-red-500/30" : "text-emerald-400 bg-emerald-950/40 border-emerald-500/20"
              )}>
                {feedbackPending > 0 ? "긴급 중재" : "이상 없음"}
              </span>
            </div>

            <div className={clsx(
              "text-[11px] sm:text-xs flex items-center justify-between px-2.5 py-1.5 rounded-lg border gap-1",
              feedbackPending > 0 
                ? "bg-red-950/50 border-red-500/30 text-red-200" 
                : "bg-[#04162e] border-emerald-500/20 text-gray-300"
            )}>
              <span className="flex items-center gap-1.5 truncate">
                <div className={clsx("w-1.5 h-1.5 rounded-full shrink-0", feedbackPending > 0 ? "bg-red-400 animate-ping" : "bg-emerald-400")}></div> 
                <span className="truncate">{feedbackPending > 0 ? "고위험군 심층 관리" : "평온 유지"}</span>
              </span>
              <span className={clsx("font-bold shrink-0 text-[10px]", feedbackPending > 0 ? "text-red-300" : "text-emerald-400")}>
                {feedbackPending > 0 ? "즉시 개입" : "정상"}
              </span>
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
                        "type-badge inline-flex items-center gap-1",
                        ticket.status === '접수대기' && "badge-wait",
                        (ticket.status === '배정완료' || ticket.status === '상담중') && "badge-cond",
                        ticket.status === '처리완료' && "badge-pass",
                        ticket.status === '주의요망' && "badge-fail"
                      )}>
                        {ticket.status === '접수대기' && <Clock className="w-3 h-3" />}
                        {(ticket.status === '배정완료' || ticket.status === '상담중') && <Activity className="w-3 h-3" />}
                        {ticket.status === '처리완료' && <CheckCircle2 className="w-3 h-3" />}
                        {ticket.status === '주의요망' && <AlertTriangle className="w-3 h-3" />}
                        <span>{ticket.status}</span>
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-white text-xs bg-[#04162e] border border-cyan-500/20 shadow-sm">
                        <span>{getCountryFlag(ticket.country)}</span>
                        <span>{ticket.country}</span>
                      </span>
                      {ticket.visa_type && <span className="inline-flex items-center px-2 py-0.5 rounded text-[#94a3b8] text-xs bg-[#051326] border border-[#1e3a5f]">{ticket.visa_type}</span>}
                      <span className={clsx("inline-flex items-center px-2.5 py-0.5 rounded text-xs border font-medium", getCategoryStyle(ticket.category))}>
                        {ticket.category}
                      </span>
                      {ticket.urgency === 'high' && <span className="inline-flex items-center px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/30">긴급</span>}
                    </div>

                    <div className="flex gap-4 text-xs py-1 border-t border-[#1e3a5f]/60 mt-2">
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
                          "transition-all duration-150 group cursor-pointer border-l-4",
                          ticket.status === '접수대기' ? 'border-l-sky-400 hover:bg-sky-950/20' :
                          ticket.status === '배정완료' || ticket.status === '상담중' ? 'border-l-amber-400 hover:bg-amber-950/20' :
                          ticket.status === '처리완료' ? 'border-l-[#00a859] hover:bg-emerald-950/20' :
                          ticket.status === '주의요망' ? 'border-l-red-500 hover:bg-red-950/25' : 'border-l-transparent hover:bg-white/[0.04]'
                        )}
                        onDoubleClick={() => setModalTicket(ticket)}
                        onClick={() => setModalTicket(ticket)}
                      >
                        <td className="hidden xl:table-cell px-4 py-2.5 text-center text-[#cbd5e1] font-medium">
                          {counselors.find(c => c.id === ticket.counselor_id)?.name || ticket.counselor_id || '미배정'}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <div className="font-bold text-[#f8fafc] flex items-center justify-center gap-1.5">
                            <span>{ticket.worker_name || ticket.worker_id}</span>
                            {ticket.red_flag && ticket.category !== '기타' && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 text-[10px] font-bold border border-red-500/30">
                                <AlertTriangle className="w-3 h-3 mr-0.5" /> Red Flag
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-[#94a3b8] text-center text-xs lg:text-sm font-medium">{ticket.created_at ? safeFormat(ticket.created_at, 'yy.MM.dd HH:mm') : '-'}</td>
                        <td className="px-4 py-2.5 text-[#38bdf8] font-bold text-center text-xs lg:text-sm">{ticket.reservation_time ? safeFormat(ticket.reservation_time, 'yy.MM.dd HH:mm') : '미지정'}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#04162e] border border-cyan-500/20 text-[#f8fafc] text-xs font-semibold shadow-sm">
                            <span className="text-sm">{getCountryFlag(ticket.country)}</span>
                            <span>{ticket.country || '-'}</span>
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center text-[#94a3b8] text-xs lg:text-sm font-medium">
                          {ticket.visa_type || '-'}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={clsx(
                            "type-badge inline-flex items-center gap-1",
                            ticket.status === '접수대기' && "badge-wait",
                            (ticket.status === '배정완료' || ticket.status === '상담중') && "badge-cond",
                            ticket.status === '처리완료' && "badge-pass",
                            ticket.status === '주의요망' && "badge-fail"
                          )}>
                            {ticket.status === '접수대기' && <Clock className="w-3 h-3" />}
                            {(ticket.status === '배정완료' || ticket.status === '상담중') && <Activity className="w-3 h-3" />}
                            {ticket.status === '처리완료' && <CheckCircle2 className="w-3 h-3" />}
                            {ticket.status === '주의요망' && <AlertTriangle className="w-3 h-3" />}
                            <span>{ticket.status}</span>
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={clsx(
                            "px-2.5 py-0.5 rounded text-xs font-semibold border inline-flex items-center",
                            getCategoryStyle(ticket.category)
                          )}>
                            {ticket.category}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-[#94a3b8] text-center text-xs lg:text-sm font-medium">{ticket.company_code}</td>
                        <td className="px-4 py-2.5 text-center">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setModalTicket(ticket); }}
                            className="text-cyan-300 hover:text-white font-bold text-xs px-3 py-1 border border-cyan-500/30 rounded-lg bg-[#002c5f]/80 hover:bg-cyan-600/30 hover:border-cyan-400 transition-all shadow-sm"
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
