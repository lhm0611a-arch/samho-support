import { safeFormat } from '../utils/safeDate';
import { safeDate } from '../utils/safeDate';
import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTicketStore } from '../store/ticketStore';
import { useScheduleStore } from '../store/scheduleStore';
import { useAuthStore } from '../store/authStore';
import { useCounselorStore } from '../store/counselorStore';
import { CATEGORIES } from '../constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { Users, Clock, Briefcase, Calendar as CalendarIcon, Filter, FileText, X } from 'lucide-react';
import { format, subDays, isAfter, startOfMonth, isSameDay } from 'date-fns';
import clsx from 'clsx';
import { TicketDetailModal } from '../components/TicketDetailModal';
import { CounselingTicket } from '../types';

export const CounselorLoadDashboard = () => {
  const { tickets } = useTicketStore();
  const { events } = useScheduleStore();
  const { role, user } = useAuthStore();
  const counselors = useCounselorStore(state => state.counselors);
  const [period, setPeriod] = useState('week'); // 'day', 'week', 'month', 'all'
  
  // If role is counselor, lock selection to their own ID
  const isCounselor = role === 'counselor';
  const [selectedCounselorId, setSelectedCounselorId] = useState<string>(isCounselor ? (user?.uid || 'all') : 'all');
  const [selectedTicket, setSelectedTicket] = useState<CounselingTicket | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);

  useEffect(() => {
    if (isCounselor && user?.uid) {
      setSelectedCounselorId(user.uid);
    }
  }, [isCounselor, user]);

  const stats = useMemo(() => {
    const now = new Date();
    
    // 1. Filter Tickets by Date
    let filteredTickets = tickets;
    let filteredEvents = events;
    
    const getTargetDate = (t: any) => t.reservation_time ? safeDate(t.reservation_time) : (t.created_at ? safeDate(t.created_at) : new Date());

    if (period === 'day') {
      filteredTickets = tickets.filter(t => isSameDay(getTargetDate(t), now));
      filteredEvents = events.filter(e => isSameDay(safeDate(e.start), now));
    } else if (period === 'week') {
      const start = subDays(now, 7);
      filteredTickets = tickets.filter(t => isAfter(getTargetDate(t), start));
      filteredEvents = events.filter(e => isAfter(safeDate(e.start), start));
    } else if (period === 'month') {
      const start = startOfMonth(now);
      filteredTickets = tickets.filter(t => isAfter(getTargetDate(t), start));
      filteredEvents = events.filter(e => isAfter(safeDate(e.start), start));
    }

    // Prepare Activities
    const activities: Array<{
      id: string;
      counselorId: string;
      counselorName: string;
      type: 'counseling' | 'event';
      date: Date;
      title: string;
      category: string;
      durationMinutes: number;
      ticket?: CounselingTicket;
      event?: any;
    }> = [];

    // Filter counselors if limited by role or selection
    let activeCounselors = counselors.filter(c => !c.id.toLowerCase().startsWith('admin'));
    if (isCounselor && user?.uid) {
      activeCounselors = counselors.filter(c => c.id === user.uid);
    } else if (selectedCounselorId !== 'all') {
      activeCounselors = counselors.filter(c => c.id === selectedCounselorId);
    }

    // 2. Aggregate Data per Counselor
    const loadByCounselor = activeCounselors.map(counselor => {
      // Tickets handled by this counselor
      const counselorTickets = filteredTickets.filter(t => (t.counselor_id || (t as any).assigned_counselor_id) === counselor.id);
      
      let estimatedMinutes = 0;
      let actualTicketCount = 0;

      counselorTickets.forEach(t => {
        let durationMinutes = 60;
        let isPast = true;
        
        if ((t as any).reservation_time && (t as any).reservation_end_time) {
          const start = safeDate((t as any).reservation_time).getTime();
          const end = safeDate((t as any).reservation_end_time).getTime();
          durationMinutes = Math.max(60, (end - start) / (1000 * 60));
          isPast = end <= Date.now();
        } else if ((t as any).reservation_time) {
          const start = safeDate((t as any).reservation_time).getTime();
          const end = start + 60 * 60 * 1000;
          isPast = end <= Date.now();
        }

        // if (!isPast) return;
        // if (t.status !== '처리완료') return;

        actualTicketCount++;
        estimatedMinutes += durationMinutes;

        activities.push({
          id: t.id || Math.random().toString(),
          counselorId: counselor.id,
          counselorName: counselor.name,
          type: 'counseling',
          date: safeDate(t.reservation_time || t.created_at || Date.now()),
          title: t.summary || '일반 상담',
          category: t.category || '기타',
          durationMinutes: durationMinutes,
          ticket: t
        });
      });

      // Events (calendar schedules)
      const counselorEvents = filteredEvents.filter(e => e.counselorId === counselor.id);
      
      const eventTypes = {
        '교육통역': 0,
        '번역업무': 0,
        '현장지원': 0,
        '외근': 0,
        '연차': 0,
        '기타': 0
      };
      
      const eventCounts = {
        '교육통역건수': 0,
        '번역업무건수': 0,
        '현장지원건수': 0,
        '외근건수': 0,
        '기타건수': 0
      };

      counselorEvents.forEach(e => {

        const start = safeDate(e.start);
        const end = safeDate(e.end || e.start);
        
        // if (end.getTime() > Date.now()) return; // Skip future events

        const diffMins = Math.max(30, (end.getTime() - start.getTime()) / (1000 * 60)); // minimum 30 min block
        
        if (e.type !== '연차') {
          estimatedMinutes += diffMins;
        }
        
        if (e.type in eventTypes) {
          eventTypes[e.type as keyof typeof eventTypes] += diffMins;
          if (e.type !== '연차') {
            const countKey = (e.type + '건수') as keyof typeof eventCounts;
            if (countKey in eventCounts) {
              eventCounts[countKey] += 1;
            } else {
              eventCounts['기타건수'] += 1;
            }
          }
        } else {
          eventTypes['기타'] += diffMins;
          eventCounts['기타건수'] += 1;
        }


        if (!['연차', '반차', '월차'].includes(e.type)) {
          activities.push({
            id: e.id,
            counselorId: counselor.id,
            counselorName: counselor.name,
            type: 'event',
            date: start,
            title: e.title || e.type,
            category: e.type,
            durationMinutes: diffMins,
            event: e
          });
        }
      });

      return {
        id: counselor.id,
        name: counselor.name,
        country: counselor.country,
        ticketCount: actualTicketCount,
        estimatedHours: Number((estimatedMinutes / 60).toFixed(1)),
        ...eventTypes,
        ...eventCounts
      };
    });


    // Sort by ticket count descending
    const sortedByTickets = [...loadByCounselor].sort((a, b) => b.ticketCount - a.ticketCount);
    
    // Filter and Sort Activities
    const filteredActivities = activities
      .filter(a => selectedCounselorId === 'all' || a.counselorId === selectedCounselorId)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    // Calculate aggregated event types from filtered activities
    const totalEventTypes = [
      { name: '상담', value: filteredActivities.filter(a => a.type === 'counseling').reduce((acc, a) => acc + a.durationMinutes, 0) },
      { name: '교육통역', value: filteredActivities.filter(a => a.type === 'event' && a.category === '교육통역').reduce((acc, a) => acc + a.durationMinutes, 0) },
      { name: '번역업무', value: filteredActivities.filter(a => a.type === 'event' && a.category === '번역업무').reduce((acc, a) => acc + a.durationMinutes, 0) },
      { name: '현장지원', value: filteredActivities.filter(a => a.type === 'event' && a.category === '현장지원').reduce((acc, a) => acc + a.durationMinutes, 0) },
      { name: '외근', value: filteredActivities.filter(a => a.type === 'event' && a.category === '외근').reduce((acc, a) => acc + a.durationMinutes, 0) },
      { name: '기타', value: filteredActivities.filter(a => a.type === 'event' && a.category === '기타').reduce((acc, a) => acc + a.durationMinutes, 0) },
    ].filter(v => v.value > 0);

    const totalEventCounts = [
      { name: '상담', value: filteredActivities.filter(a => a.type === 'counseling').length },
      { name: '교육통역', value: filteredActivities.filter(a => a.type === 'event' && a.category === '교육통역').length },
      { name: '번역업무', value: filteredActivities.filter(a => a.type === 'event' && a.category === '번역업무').length },
      { name: '현장지원', value: filteredActivities.filter(a => a.type === 'event' && a.category === '현장지원').length },
      { name: '외근', value: filteredActivities.filter(a => a.type === 'event' && a.category === '외근').length },
      { name: '기타', value: filteredActivities.filter(a => a.type === 'event' && a.category === '기타').length },
    ].filter(v => v.value > 0);

    // Calculate counseling types specifically
    const counselingTypesObj: Record<string, number> = {};
    filteredActivities.forEach(a => {
      if (a.type === 'counseling') {
        const cat = a.category || '기타';
        counselingTypesObj[cat] = (counselingTypesObj[cat] || 0) + a.durationMinutes;
      }
    });

    const counselingTypes = Object.entries(counselingTypesObj)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    return {
      loadByCounselor: sortedByTickets,
      totalEventTypes,
      totalEventCounts,
      counselingTypes,
      totalHours: loadByCounselor.reduce((acc, c) => acc + c.estimatedHours, 0),
      activities: filteredActivities
    };
  }, [tickets, events, period, selectedCounselorId, isCounselor, user]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

  return (
    <div className="flex flex-col h-full gap-4 md:gap-6 animate-fade-in-up pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 shrink-0">
        <div>
          <h2 className="text-[20.5px] font-bold text-gradient tracking-tight mb-2">
            {isCounselor ? '나의 업무 실적' : '통역위원 업무 실적'}
          </h2>
          <p className="text-[12.375px] font-bold text-[#28fe00]">
            {isCounselor ? '본인의 업무량 및 상담 횟수 통계' : '통역사별 업무량 및 상담 횟수 통계'}
          </p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
          {!isCounselor && (
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select
                value={selectedCounselorId}
                onChange={(e) => setSelectedCounselorId(e.target.value)}
                className="w-full md:w-auto pl-9 pr-8 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500/50 appearance-none"
              >
                <option value="all">전체 통역위원</option>
                {counselors.filter(c => !c.id.toLowerCase().startsWith('admin')).map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.country})</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex bg-black/40 p-1 rounded-xl border border-white/10 w-full md:w-auto overflow-x-auto">
            {['day', 'week', 'month', 'all'].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all capitalize whitespace-nowrap ${
                  period === p 
                    ? 'bg-blue-500/20 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.15)]' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {p === 'day' ? '오늘' : p === 'week' ? '주간' : p === 'month' ? '월간' : '전체'}
              </button>
            ))}
          </div>
        </div>
      </div>

                  {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 shrink-0">
        <div className="glass-panel px-5 py-[10px] h-[90px] relative overflow-hidden md:col-span-1 flex">
          <div className="flex-1 border-r border-white/10 pr-4">
            <p className="text-sm text-gray-400 font-medium relative z-10">총 추정 업무시간</p>
            <div className="flex items-end gap-2 mt-2 relative z-10">
              <p className="text-3xl font-light text-white">{Math.round(stats.totalHours)}</p>
              <span className="text-sm text-gray-500 mb-1">시간</span>
            </div>
          </div>
          <div className="flex-1 pl-4">
            <p className="text-sm text-gray-400 font-medium relative z-10">총 업무 건수</p>
            <div className="flex items-end gap-2 mt-2 relative z-10">
              <p className="text-3xl font-light text-white">{stats.activities.length}</p>
              <span className="text-sm text-gray-500 mb-1">건</span>
            </div>
          </div>
          <div className="absolute -right-4 -bottom-4 opacity-10">
            <Clock className="w-24 h-24 text-green-400" />
          </div>
        </div>

        <div className="glass-panel px-5 py-[10px] min-h-[90px] relative overflow-hidden md:col-span-2 flex flex-col justify-center">
          <p className="text-sm text-gray-400 font-medium relative z-10 mb-2">세부 업무 건수</p>
          <div className="flex flex-wrap gap-x-6 gap-y-1.5 relative z-10">
            {stats.totalEventCounts.map((item, idx) => (
              <div key={item.name} className="flex items-end gap-2">
                <span className="text-[13px] text-gray-300 mb-0.5">{item.name}</span>
                <span className="text-xl font-light text-white">{item.value}</span>
                <span className="text-[11px] text-gray-500 mb-1">건</span>
              </div>
            ))}
            {stats.totalEventCounts.length === 0 && (
              <span className="text-sm text-gray-500">내역 없음</span>
            )}
          </div>
          <div className="absolute -right-4 -bottom-4 opacity-10">
            <Briefcase className="w-24 h-24 text-purple-400" />
          </div>
        </div>
      </div>

      {!isCounselor && (


        <div className="glass-panel p-4 md:p-5 flex flex-col min-h-[200px] md:min-h-[300px] shrink-0">
                    <h3 className="text-sm font-medium text-gray-200 mb-4">통역사별 업무 건수 및 업무시간</h3>

          <div className="flex-1 w-full h-full relative">
            <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.loadByCounselor} margin={{ top: 20, right: 0, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="#9ca3af" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                  interval={0}
                  tickFormatter={(val) => {
                    if (typeof window !== 'undefined' && window.innerWidth < 768) {
                      return val && val.length > 2 ? val.substring(0, 2) : val;
                    }
                    return val;
                  }}
                />
                <YAxis yAxisId="left" stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} width={25} />
                <YAxis yAxisId="right" orientation="right" stroke="#10b981" fontSize={10} tickLine={false} axisLine={false} width={25} />

                <RechartsTooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{ backgroundColor: 'rgba(17, 24, 39, 0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }} 
                  itemStyle={{ color: '#fff', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }} />
                <Bar yAxisId="left" dataKey="교육통역건수" name="교육통역" stackId="a" fill="#8b5cf6" maxBarSize={40} />
                <Bar yAxisId="left" dataKey="기타건수" name="기타" stackId="a" fill="#64748b" maxBarSize={40} />
                <Bar yAxisId="left" dataKey="번역업무건수" name="번역업무" stackId="a" fill="#ec4899" maxBarSize={40} />
                <Bar yAxisId="left" dataKey="ticketCount" name="상담 건수" stackId="a" fill="#3b82f6" maxBarSize={40} />
                <Bar yAxisId="left" dataKey="외근건수" name="외근" stackId="a" fill="#06b6d4" maxBarSize={40} />
                <Bar yAxisId="left" dataKey="현장지원건수" name="현장지원" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar yAxisId="right" dataKey="estimatedHours" name="추정 업무시간(h)" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />

              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4 flex-none">
        {/* Work Type Distribution */}
        <div className="glass-panel p-4 md:p-5 flex flex-col min-h-[250px] md:min-h-[300px]">
          <h3 className="text-sm font-medium text-gray-200 mb-4">세부 업무 비중 (시간)</h3>
          <div className="flex-1 w-full h-full relative flex items-center justify-center">
            {stats.totalEventTypes.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.totalEventTypes}
                    cx="50%"
                    cy="50%"
                    innerRadius="40%"
                    outerRadius="75%"
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {stats.totalEventTypes.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: 'rgba(17, 24, 39, 0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }} 
                    itemStyle={{ color: '#fff', fontSize: '12px' }}
                    formatter={(value: number) => [`${Math.round(value / 60)}시간`, '']}
                  />
                  <Legend iconType="circle" layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center text-gray-500 gap-2">
                <CalendarIcon className="w-8 h-8 opacity-50" />
                <p className="text-sm">등록된 업무 일정이 없습니다.</p>
              </div>
            )}
          </div>
        </div>

        {/* Counseling Type Distribution */}
        <div className="glass-panel p-4 md:p-5 flex flex-col min-h-[250px] md:min-h-[300px]">
          <h3 className="text-sm font-medium text-gray-200 mb-4">상담 유형별 비중 (시간)</h3>
          <div className="flex-1 w-full h-full relative flex items-center justify-center">
            {stats.counselingTypes.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.counselingTypes}
                    cx="50%"
                    cy="50%"
                    innerRadius="40%"
                    outerRadius="75%"
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {stats.counselingTypes.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: 'rgba(17, 24, 39, 0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }} 
                    itemStyle={{ color: '#fff', fontSize: '12px' }}
                    formatter={(value: number) => [`${Math.round(value / 60)}시간`, '']}
                  />
                  <Legend iconType="circle" layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center text-gray-500 gap-2">
                <Briefcase className="w-8 h-8 opacity-50" />
                <p className="text-sm">등록된 상담 내역이 없습니다.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detailed Activity Table */}
      <div className="glass-panel p-0 flex flex-col mt-4">
        <div className="p-4 md:p-5 border-b border-white/5 flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-medium text-gray-200">
            업무 상세 현황
            {selectedCounselorId !== 'all' && !isCounselor && (
              <span className="ml-2 text-blue-400 font-normal">
                ({counselors.find(c => c.id === selectedCounselorId)?.name})
              </span>
            )}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/10 text-xs text-gray-400">
                <th className="py-3 px-4 font-medium whitespace-nowrap text-center">일시</th>
                {selectedCounselorId === 'all' && !isCounselor && <th className="py-3 px-4 font-medium whitespace-nowrap text-center">담당자</th>}
                <th className="py-3 px-4 font-medium whitespace-nowrap text-center">유형</th>
                <th className="py-3 px-4 font-medium whitespace-nowrap text-center">상세/제목</th>
                
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {stats.activities.length === 0 ? (
                <tr>
                  <td colSpan={selectedCounselorId === 'all' && !isCounselor ? 4 : 3} className="py-8 text-center text-gray-500">
                    해당 기간에 등록된 업무 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                stats.activities.map((activity, index) => (
                  <tr 
                    key={`${activity.id}-${activity.type}-${index}`} 
                    className={`hover:bg-white/5 transition-colors cursor-pointer`}
                    onClick={() => {
                      if (activity.type === 'counseling' && activity.ticket) {
                        setSelectedTicket(activity.ticket);
                      } else if (activity.type === 'event' && activity.event) {
                        setSelectedEvent(activity.event);
                      }
                    }}
                  >
                    <td className="py-3 px-4 text-gray-300 whitespace-nowrap text-center">
                      {format(activity.date, 'yy.MM.dd HH시')}
                    </td>
                    {selectedCounselorId === 'all' && !isCounselor && (
                      <td className="py-3 px-4 text-gray-300 whitespace-nowrap text-center">
                        {activity.counselorName}
                      </td>
                    )}
                    <td className="py-3 px-4 whitespace-nowrap text-center">
                      <span className={clsx(
                        "px-2 py-1 rounded text-xs font-medium border",
                        activity.type === 'counseling' 
                          ? "bg-blue-500/10 text-blue-400 border-blue-500/20" 
                          : "bg-purple-500/10 text-purple-400 border-purple-500/20"
                      )}>
                        {activity.type === 'counseling' ? '상담' : activity.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-300 max-w-[200px] md:max-w-[400px] text-center">
                      <div className="line-clamp-1">
                        {activity.type === 'counseling' ? (activity.ticket?.counseling_summary || activity.ticket?.action_result || activity.title) : activity.title}
                      </div>
                    </td>
                    
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
        />
      )}

      {selectedEvent && createPortal(
        <div className="fixed top-0 left-0 w-full h-[100dvh] bg-black/60 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-fade-in-up">
          <div className="glass-panel w-full max-w-lg rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="py-2.5 px-4 md:px-5 border-b border-white/10 flex items-center justify-between shrink-0 bg-black/30 backdrop-blur-md">
              <h2 className="text-base font-medium text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                업무 실적 상세
              </h2>
              <button 
                onClick={() => setSelectedEvent(null)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 md:p-6 overflow-y-auto custom-scrollbar flex-1 bg-black/20">
              <div className="space-y-6">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-400">유형 / 제목</label>
                  <div className="text-white font-medium flex items-center gap-2">
                    <span className="px-2 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded text-xs">
                      {selectedEvent.type}
                    </span>
                    {selectedEvent.title}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-400">일시</label>
                    <div className="text-sm text-gray-200">
                      {safeFormat(selectedEvent.start, 'yyyy.MM.dd HH:mm')} - {safeFormat(selectedEvent.end || selectedEvent.start, 'HH:mm')}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs text-gray-400">세부 업무 실적</label>
                  <div className="bg-black/30 p-4 rounded-xl border border-white/5 text-sm text-gray-200 min-h-[100px] whitespace-pre-wrap">
                    {selectedEvent.performanceDetail || '등록된 내용이 없습니다.'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

