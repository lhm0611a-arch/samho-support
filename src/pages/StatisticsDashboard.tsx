import { safeFormat, safeDate } from '../utils/safeDate';
import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTicketStore } from '../store/ticketStore';
import { useCounselorStore } from '../store/counselorStore';
import { useScheduleStore } from '../store/scheduleStore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, Cell, AreaChart, Area } from 'recharts';
import { COUNTRIES, CATEGORIES } from '../constants';
import { Brain, TrendingUp, AlertTriangle, Users, Download, Calendar, X, FileText, Mail } from 'lucide-react';
import { format, subDays, isSameDay, startOfYear, startOfMonth, subMonths, isAfter } from 'date-fns';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

export const StatisticsDashboard = () => {
  const { tickets: allTickets } = useTicketStore();
  const { counselors } = useCounselorStore();
  const { events: allEvents } = useScheduleStore();
  
  const tickets = useMemo(() => {
    return allTickets.filter(t => {
      const assignedId = t.counselor_id || (t as any).assigned_counselor_id;
      if (assignedId) {
        const counselor = counselors.find(c => c.id === assignedId);
        if (counselor && counselor.id.toLowerCase().startsWith('admin')) {
          return false;
        }
      }
      return true;
    });
  }, [allTickets, counselors]);

  const [period, setPeriod] = useState('month'); // day, week, month, quarter, half, year
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [insights, setInsights] = useState<string[]>([]);
  const [report, setReport] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);

  const stats = useMemo(() => {
    let filteredTickets = tickets;
    let filteredEvents = allEvents;
    const now = new Date();
    
    const getTargetDate = (t: any) => t.reservation_time ? safeDate(t.reservation_time) : (t.created_at ? safeDate(t.created_at) : new Date());
    
    if (period === 'day') {
      filteredTickets = tickets.filter(t => isSameDay(getTargetDate(t), now));
      filteredEvents = allEvents.filter(e => e.start && isSameDay(safeDate(e.start), now));
    } else if (period === 'week') {
      const start = subDays(now, 7);
      filteredTickets = tickets.filter(t => isAfter(getTargetDate(t), start));
      filteredEvents = allEvents.filter(e => e.start && isAfter(safeDate(e.start), start));
    } else if (period === 'month') {
      const start = startOfMonth(now);
      filteredTickets = tickets.filter(t => isAfter(getTargetDate(t), start));
      filteredEvents = allEvents.filter(e => e.start && isAfter(safeDate(e.start), start));
    } else if (period === 'quarter') {
      const start = subMonths(now, 3);
      filteredTickets = tickets.filter(t => isAfter(getTargetDate(t), start));
      filteredEvents = allEvents.filter(e => e.start && isAfter(safeDate(e.start), start));
    } else if (period === 'half') {
      const start = subMonths(now, 6);
      filteredTickets = tickets.filter(t => isAfter(getTargetDate(t), start));
      filteredEvents = allEvents.filter(e => e.start && isAfter(safeDate(e.start), start));
    } else if (period === 'year') {
      const start = startOfYear(now);
      filteredTickets = tickets.filter(t => isAfter(getTargetDate(t), start));
      filteredEvents = allEvents.filter(e => e.start && isAfter(safeDate(e.start), start));
    } else if (period === 'month') {
      const start = startOfMonth(now);
      filteredTickets = tickets.filter(t => t.created_at && isAfter(safeDate(t.created_at), start));
      filteredEvents = allEvents.filter(e => e.start && isAfter(safeDate(e.start), start));
    } else if (period === 'quarter') {
      const start = subMonths(now, 3);
      filteredTickets = tickets.filter(t => t.created_at && isAfter(safeDate(t.created_at), start));
      filteredEvents = allEvents.filter(e => e.start && isAfter(safeDate(e.start), start));
    } else if (period === 'half') {
      const start = subMonths(now, 6);
      filteredTickets = tickets.filter(t => t.created_at && isAfter(safeDate(t.created_at), start));
      filteredEvents = allEvents.filter(e => e.start && isAfter(safeDate(e.start), start));
    } else if (period === 'year') {
      const start = startOfYear(now);
      filteredTickets = tickets.filter(t => t.created_at && isAfter(safeDate(t.created_at), start));
      filteredEvents = allEvents.filter(e => e.start && isAfter(safeDate(e.start), start));
    }

    const byCountry = COUNTRIES.map(country => {
      const count = filteredTickets.filter(t => t.country === country).length;
      return { name: country, count };
    }).filter(item => item.count > 0);

    const byCategory = CATEGORIES.map(category => {
      const count = filteredTickets.filter(t => t.category === category).length;
      return { name: category, count };
    }).filter(item => item.count > 0);

    const completed = filteredTickets.filter(t => t.status === '처리완료').length;
    const total = filteredTickets.length;
    const completionRate = total === 0 ? 0 : Math.round((completed / total) * 100);

    const redFlags = filteredTickets.filter(t => t.red_flag).length;
    
    // Only pass completed tickets to the AI report to prevent it from mentioning future reservations or pending cases
    const counselingDetails = filteredTickets
      .filter(t => t.status === '처리완료')
      .map(t => ({
        업체명: t.company_code || '미상',
        이름: t.worker_name || '익명',
        카테고리: t.category,
        긴급여부: t.red_flag ? '예 (민감/위험)' : '아니오',
        상담내용_및_결과: t.action_result || (t.ai_summary ? (t.ai_summary as any).summary_text : '') || t.summary || ''
      }));

    const otherTasks = filteredEvents
      .filter(e => !['연차', '반차', '상담'].includes(e.type) && e.performanceDetail)
      .map(e => {
        const cInfo = counselors.find(c => c.id === e.counselorId);
        return {
          통역사: cInfo ? `${cInfo.country} - ${cInfo.name}` : '미상',
          업무유형: e.type,
          업무제목: e.title,
          업무실적: e.performanceDetail
        };
      });
    
    // Trend for last 7 days
    const trend = Array.from({ length: 7 }).map((_, i) => {
      const d = subDays(new Date(), 6 - i);
      const count = tickets.filter(t => t.created_at && isSameDay(safeDate(t.created_at), d)).length;
      const completedCount = tickets.filter(t => t.created_at && isSameDay(safeDate(t.created_at), d) && t.status === '처리완료').length;
      return {
        date: format(d, 'MM/dd'),
        '접수 건수': count,
        '처리 건수': completedCount
      };
    });

    return { byCountry, byCategory, total, completed, completionRate, redFlags, trend, counselingDetails, otherTasks };
  }, [tickets, allEvents, period, counselors]);

  const COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];
  const PIE_COLORS = ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#f472b6'];

  // Reset insights when period changes
  useEffect(() => {
    setInsights([]);
    setReport(null);
  }, [period]);

  // Load the latest daily AI insights on mount
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
        if (data) {
          if (data.insights && data.insights.length > 0) setInsights(data.insights);
          if (data.report) setReport(data.report);
        }
      })
      .catch(err => console.error('Failed to load initial insights:', err));
  }, []);

  const handleGenerateReport = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setShowReportModal(true);
    setReport(null);
    try {
      const res = await fetch('/api/generate-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stats })
      });
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await res.text();
        throw new Error('Server returned HTML or non-JSON response. Ensure the backend is running properly. \n' + text.substring(0, 100));
      }
      const data = await res.json();
      if (data.insights) setInsights(data.insights);
      if (data.report) setReport(data.report);
    } catch (err) {
      console.error(err);
      alert('리포트 생성 중 오류가 발생했습니다.');
      setShowReportModal(false);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (isSendingEmail) return;
    setIsSendingEmail(true);
    const reportType = period === 'day' ? 'daily' : period === 'week' ? 'weekly' : 'monthly';
    const periodNameStr = period === 'day' ? '일일' : period === 'week' ? '주간' : period === 'month' ? '월간' : period === 'quarter' ? '분기' : period === 'half' ? '반기' : '전체';
    
    try {
      const res = await fetch('/api/test-email-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          type: reportType,
          customReport: report,
          customInsights: insights,
          customPeriodName: periodNameStr,
          customTotal: stats.total,
          customRedFlags: stats.redFlags
        })
      });
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await res.text();
        throw new Error('Server returned HTML or non-JSON response. Ensure the backend is running properly. \n' + text.substring(0, 100));
      }
      const data = await res.json();
      if (res.ok) {
        if (data.testUrl) {
                    alert(`이메일 전송에 성공했습니다!\n\n현재 환경 변수(SMTP_HOST 등)가 설정되지 않아 실제 발송 대신 테스트 샌드박스로 발송되었습니다.\n\n확인용 가상 편지함 주소:\n${data.testUrl}`);

          window.open(data.testUrl, '_blank');
        } else {
          alert('설정된 수신자 목록으로 AI 실적 보고서가 성공적으로 전송되었습니다!');
        }
      } else {
        alert(`전송 실패: ${data.error || '알 수 없는 오류'}`);
      }
    } catch (err: any) {
      console.error(err);
      alert('이메일 전송 중 오류가 발생했습니다.');
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div className="flex flex-col p-2 gap-6 animate-fade-in-up pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-2 gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gradient tracking-tight">AI 통합 분석 센터</h2>
          <p className="text-gray-400 mt-1 font-bold">실시간 상담 데이터 및 AI 예측 지표</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center p-0.5 rounded-full border border-white/10 bg-[#15151a]">
            <button onClick={() => setPeriod('day')} className={`px-3 md:px-4 py-1 md:py-1.5 text-[11px] md:text-xs font-bold rounded-full transition-all ${period === 'day' ? 'bg-[#1e2b47] text-[#5b9cf6]' : 'text-gray-400 hover:text-gray-200'}`}>오늘</button>
            <button onClick={() => setPeriod('week')} className={`px-3 md:px-4 py-1 md:py-1.5 text-[11px] md:text-xs font-bold rounded-full transition-all ${period === 'week' ? 'bg-[#1e2b47] text-[#5b9cf6]' : 'text-gray-400 hover:text-gray-200'}`}>주간</button>
            <button onClick={() => setPeriod('month')} className={`px-3 md:px-4 py-1 md:py-1.5 text-[11px] md:text-xs font-bold rounded-full transition-all ${period === 'month' ? 'bg-[#1e2b47] text-[#5b9cf6]' : 'text-gray-400 hover:text-gray-200'}`}>월간</button>
            <button onClick={() => setPeriod('year')} className={`px-3 md:px-4 py-1 md:py-1.5 text-[11px] md:text-xs font-bold rounded-full transition-all ${period === 'year' ? 'bg-[#1e2b47] text-[#5b9cf6]' : 'text-gray-400 hover:text-gray-200'}`}>전체</button>
          </div>
          
          <button 
            onClick={handleGenerateReport}
            disabled={isGenerating}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-xl hover:bg-blue-500/30 transition-colors text-sm font-medium shadow-[0_0_15px_rgba(59,130,246,0.1)] w-full md:w-auto"
          >
            {isGenerating ? (
              <><div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /> 생성 중...</>
            ) : (
              <><Brain className="w-4 h-4" /> AI 실적 보고서 생성</>
            )}
          </button>
        </div>
      </div>
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 relative overflow-hidden bg-gradient-to-br from-indigo-900/50 to-purple-900/50 border-indigo-500/30 flex flex-col justify-between cursor-pointer hover:border-indigo-500/50 transition-colors" onClick={() => {
          if (report) setShowReportModal(true);
          else handleGenerateReport();
        }}>
          <div className="absolute top-0 right-0 p-4 opacity-20">
            <Brain className="w-16 h-16 text-purple-400" />
          </div>
          <p className="text-purple-300 font-medium mb-1 uppercase tracking-wider text-xs relative z-10">AI 종합 제언</p>
          <div className="text-sm text-gray-300 mt-2 leading-relaxed relative z-10">
            {insights.length > 0 ? (
              <ul className="list-disc pl-4 space-y-1">
                {insights.slice(0, 2).map((insight, idx) => (
                  <li key={idx} className="line-clamp-2">{insight}</li>
                ))}
              </ul>
            ) : (
              <span className="opacity-70 flex items-center gap-2">
                리포트를 생성하여 맞춤형 인사이트를 확인하세요.
              </span>
            )}
          </div>
        </div>

        <div className="glass-panel p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Users className="w-16 h-16 text-blue-500" />
          </div>
          <p className="text-gray-400 font-medium mb-1 uppercase tracking-wider text-xs flex items-center gap-2">
            누적 상담 건수 <span className="px-1.5 py-0.5 rounded text-[11px] md:text-xs bg-blue-500/20 text-blue-400">+12%</span>
          </p>
          <p className="text-4xl font-normal text-white mt-2">{stats.total}</p>
        </div>
        
        <div className="glass-panel p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <TrendingUp className="w-16 h-16 text-green-500" />
          </div>
          <p className="text-gray-400 font-medium mb-1 uppercase tracking-wider text-xs flex items-center gap-2">
            기간내 처리 완료율 <span className="px-1.5 py-0.5 rounded text-[11px] md:text-xs bg-green-500/20 text-green-400">우수</span>
          </p>
          <p className="text-4xl font-normal text-green-400 mt-2">{stats.completionRate}%</p>
        </div>
        
        <div className="glass-panel p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <AlertTriangle className="w-16 h-16 text-red-500" />
          </div>
          <p className="text-gray-400 font-medium mb-1 uppercase tracking-wider text-xs flex items-center gap-2">
            AI 감지 위험군 (Red Flag) <span className="px-1.5 py-0.5 rounded text-[11px] md:text-xs bg-red-500/20 text-red-400">주의</span>
          </p>
          <p className="text-4xl font-normal text-red-400 mt-2">{stats.redFlags}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4 flex-1 min-h-0">
        {/* Trend Area Chart */}
        <div className="glass-panel p-4 md:p-5 flex flex-col min-h-[260px]">
          <h3 className="text-sm font-medium text-gray-200 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-400" /> 주간 상담 접수 및 처리 트렌드
          </h3>
          <div className="flex-1 w-full h-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.trend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorReceipt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorDone" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="date" stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} dy={5} />
                <YAxis stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: 'rgba(17, 24, 39, 0.95)', borderColor: 'rgba(59, 130, 246, 0.3)', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} 
                  itemStyle={{ color: '#e5e7eb', fontSize: '12px' }}
                />
                <Legend verticalAlign="top" height={24} iconType="circle" wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }}/>
                <Area type="monotone" dataKey="접수 건수" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorReceipt)" />
                <Area type="monotone" dataKey="처리 건수" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorDone)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Bar Chart */}
        <div className="glass-panel p-4 md:p-5 flex flex-col min-h-[260px]">
          <h3 className="text-sm font-medium text-gray-200 mb-4">분야별 상담 비중 (AI 분류)</h3>
          <div className="flex-1 w-full h-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={stats.byCategory} margin={{ top: 0, right: 20, left: 30, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis dataKey="name" type="category" stroke="#e5e7eb" fontSize={11} tickLine={false} axisLine={false} width={80} />
                <RechartsTooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }} 
                  contentStyle={{ backgroundColor: 'rgba(17, 24, 39, 0.95)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff', fontSize: '12px' }}
                />
                <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={24} name="상담 건수">
                  {stats.byCategory.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      {/* Country Bar Chart */}
      <div className="glass-panel p-4 md:p-5 min-h-[160px] flex flex-col shrink-0">
        <h3 className="text-sm font-medium text-gray-200 mb-4">국적별 상담 요청 현황</h3>
        <div className="flex-1 w-full min-h-[120px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.byCountry} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="name" stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} dy={5} />
              <YAxis stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} />
              <RechartsTooltip 
                cursor={{ fill: 'rgba(255,255,255,0.05)' }} 
                contentStyle={{ backgroundColor: 'rgba(17, 24, 39, 0.95)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }} 
              />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40}>
                {stats.byCountry.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Report Modal */}
      {showReportModal && createPortal(
        <div className="fixed top-0 left-0 w-full h-[100dvh] bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="glass-panel w-full max-w-3xl flex flex-col max-h-[90vh] animate-fade-in-up border border-blue-500/30">
            <div className="px-6 py-5 border-b border-white/10 flex justify-between items-center bg-black/30 backdrop-blur-md shrink-0">
              <h2 className="text-lg font-medium text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                AI 실적 보고서
              </h2>
              <button onClick={() => setShowReportModal(false)} className="p-1.5 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar markdown-body">
              {isGenerating && !report ? (
                <div className="flex flex-col items-center justify-center py-20 text-blue-400">
                  <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-lg font-medium">실적 보고서를 작성 중입니다...</p>
                  <p className="text-sm text-gray-400 mt-2 text-center">데이터를 분석하고 통찰을 도출하는 데 약간의 시간이 소요됩니다.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{report?.replace(/valign=(["'][^"']*["']|[^\s>]+)/gi, '')}</Markdown>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-white/10 bg-black/30 backdrop-blur-md flex justify-end gap-3 shrink-0">
              {!isGenerating && report && (
                <button 
                  onClick={handleSendTestEmail}
                  disabled={isSendingEmail}
                  className="px-5 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-xl text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {isSendingEmail ? '전송 중...' : '이메일 보내기'}
                </button>
              )}
              <button 
                onClick={() => setShowReportModal(false)}
                className="px-5 py-2 bg-blue-500 hover:bg-blue-600 rounded-xl text-white text-sm font-medium transition-colors shadow-[0_0_15px_rgba(59,130,246,0.3)]"
              >
                닫기
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
