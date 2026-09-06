import React, { useEffect, useState } from 'react';
import { useAuthStore } from './store/authStore';
import { Login } from './components/Login';
import { ScheduleManager } from './pages/ScheduleManager';
import { MobileBooking } from './pages/MobileBooking';
import { StatisticsDashboard } from './pages/StatisticsDashboard';
import { MainDashboard } from './pages/MainDashboard';
import { CounselorLoadDashboard } from './pages/CounselorLoadDashboard';
import { Settings as SettingsPage } from './pages/Settings';
import { Chatbot } from './components/Chatbot';
import { PushNotificationManager } from './components/PushNotificationManager';
import { FileText, LayoutDashboard, Calendar, BarChart3, Settings, LogOut, MessageSquare, Search, Menu, X, Users, Settings2 } from 'lucide-react';
import clsx from 'clsx';
import { useTicketStore } from './store/ticketStore';
import { useFirestore } from './hooks/useFirestore';
import { BackgroundCarousel } from './components/BackgroundCarousel';
import { HDHyundaiCI } from './components/HDHyundaiCI';

export default function App() {
  const { user, role, logout, company_code } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'list' | 'kanban' | 'statistics' | 'schedule' | 'counselor-load' | 'settings'>('list');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (role === 'counselor') {
      setActiveTab('list');
    }
  }, [role]);

  // Sync data with Firestore globally
  useFirestore();

  const { tickets: allTickets } = useTicketStore();

  const hasPending = allTickets.some(t => {
    if (t.status !== '접수대기') return false;
    if (role === 'admin') return true;
    if (role === 'sub-admin') return t.company_code === company_code && t.category !== '정서/심리';
    if (role === 'counselor') return t.country === user?.country;
    return false;
  });

  if (!user) {
    return (
      <div className="fixed top-0 left-0 w-full h-[100dvh] text-[#e2e8f0] flex flex-col font-sans overflow-hidden overscroll-none touch-none relative">
        <BackgroundCarousel />
        <div className="flex-1 w-full h-full overflow-y-auto overscroll-none touch-auto relative z-10">
          <Login />
        </div>
      </div>
    );
  }

  if (role === 'admin' || role === 'sub-admin' || role === 'counselor') {
    return (
      <div className="h-[100dvh] w-full flex overflow-hidden font-sans text-[#e2e8f0] relative">
        <BackgroundCarousel />
        {/* Sidebar Overlay */}
        {isSidebarOpen && (
          <div 
            className="fixed top-0 left-0 w-full h-[100dvh] bg-black/40 backdrop-blur-[2px] z-20"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={clsx(
          "fixed inset-y-0 left-0 z-30 w-64 bg-[#08172c]/95 backdrop-blur-xl border-r border-[#1e3a5f] text-gray-300 flex flex-col shrink-0 transition-transform duration-300 ease-in-out shadow-2xl",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="h-20 flex items-center justify-between px-4 border-b border-[#1e3a5f] bg-[#051326]/75">
            <HDHyundaiCI size="md" subtitle="외국인지원센터" />
            <button 
              className="text-gray-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10" 
              onClick={() => setIsSidebarOpen(false)}
              aria-label="사이드바 닫기"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex-1 py-6 overflow-y-auto px-4">
            <nav className="space-y-1.5">
              <button 
                onClick={() => { setActiveTab('list'); setIsSidebarOpen(false); }}
                className={clsx(
                  "w-full flex items-center gap-3 nav-btn text-left",
                  activeTab === 'list' && "active"
                )}
              >
                <FileText className="w-4 h-4 shrink-0" /> 실시간 대시보드
                {hasPending && (
                  <span className="ml-auto bg-red-400/10 text-red-400 text-[10px] px-2 py-0.5 rounded-full border border-red-400/20 font-semibold animate-pulse">
                    New
                  </span>
                )}
              </button>
              <button 
                onClick={() => { setActiveTab('schedule'); setIsSidebarOpen(false); }}
                className={clsx(
                  "w-full flex items-center gap-3 nav-btn text-left",
                  activeTab === 'schedule' && "active"
                )}
              >
                <Calendar className="w-4 h-4 shrink-0" /> 스케줄 관리
              </button>
              {(role === 'admin' || role === 'sub-admin') && (
                <button 
                  onClick={() => { setActiveTab('statistics'); setIsSidebarOpen(false); }}
                  className={clsx(
                    "w-full flex items-center gap-3 nav-btn text-left",
                    activeTab === 'statistics' && "active"
                  )}
                >
                  <BarChart3 className="w-4 h-4 shrink-0" /> 상담 실적 통계
                </button>
              )}
              <button 
                onClick={() => { setActiveTab('counselor-load'); setIsSidebarOpen(false); }}
                className={clsx(
                  "w-full flex items-center gap-3 nav-btn text-left",
                  activeTab === 'counselor-load' && "active"
                )}
              >
                <Users className="w-4 h-4 shrink-0" /> {role === 'counselor' ? '나의 업무 실적' : '통역위원 업무 실적'}
              </button>
              {(role === 'admin' || role === 'sub-admin') && (
                <button 
                  onClick={() => { setActiveTab('settings'); setIsSidebarOpen(false); }}
                  className={clsx(
                    "w-full flex items-center gap-3 nav-btn text-left",
                    activeTab === 'settings' && "active"
                  )}
                >
                  <Settings2 className="w-4 h-4 shrink-0" /> 설정
                </button>
              )}
            </nav>
          </div>

          <div className="p-4 border-t border-[#1e3a5f] bg-[#051326]/50">
            <button onClick={logout} className="flex items-center gap-3 text-sm text-gray-400 hover:text-white transition-colors w-full px-2 py-1.5 font-medium">
              <LogOut className="w-4 h-4" /> 로그아웃
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 relative z-10">
          {/* Header */}
          <header className="h-20 bg-[#002c5f]/40 backdrop-blur-xl border-b border-[#1e3a5f] flex items-center justify-between px-4 sm:px-6 md:px-10 shrink-0">
            <div className="flex items-center gap-3 sm:gap-4 text-white min-w-0">
              <button className="p-2 hover:bg-white/10 rounded-xl transition-colors -ml-1 sm:-ml-2 shrink-0" onClick={() => setIsSidebarOpen(true)}>
                <Menu className="w-5 h-5 text-gray-300 hover:text-white" />
              </button>
              
              <div className="flex items-center gap-3 min-w-0">
                <div className="hidden sm:flex w-9 h-9 rounded-xl bg-gradient-to-br from-[#003770] to-[#00a859] items-center justify-center border border-cyan-400/30 shadow-[0_0_15px_rgba(0,168,89,0.3)] shrink-0">
                  <span className="text-xs font-black text-white tracking-wider">
                    {role === 'counselor' ? 'CS' : role === 'sub-admin' ? 'CO' : 'HQ'}
                  </span>
                </div>

                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm sm:text-base md:text-lg font-bold tracking-tight text-[#f8fafc] truncate">
                      {user?.name || (role === 'counselor' ? '통역위원' : '관리자')}
                    </span>
                    
                    {/* Role Mode Badge */}
                    <span className={clsx(
                      "px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-bold border tracking-tight shrink-0 flex items-center gap-1",
                      role === 'counselor' 
                        ? "bg-emerald-950/60 text-emerald-300 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                        : role === 'sub-admin'
                        ? "bg-amber-950/60 text-amber-300 border-amber-500/40"
                        : "bg-cyan-950/60 text-cyan-300 border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.2)]"
                    )}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
                      <span>
                        {role === 'counselor' 
                          ? `통역위원 모드${user?.country ? ` (${user.country})` : ''}` 
                          : role === 'sub-admin'
                          ? `협력사 관리자 (${company_code || '-'})`
                          : '통합 관리자 모드'}
                      </span>
                    </span>
                  </div>

                  <div className="hidden md:flex items-center gap-1.5 text-[11px] text-slate-300 font-medium tracking-wide">
                    <span className="w-2 h-2 rounded-sm bg-[#00A859] inline-block shadow-sm"></span>
                    <strong className="text-white font-bold">HD현대삼호</strong> 외국인지원센터 · Yard DX Telemetry System
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4 text-gray-400 shrink-0">
              <PushNotificationManager />
              
              <button 
                onClick={logout} 
                className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white transition-all bg-[#04162e]/80 hover:bg-red-950/40 border border-[#1e3a5f] hover:border-red-500/40 px-3 py-1.5 rounded-lg font-semibold shadow-sm"
                title="로그아웃"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">로그아웃</span>
              </button>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 flex flex-col min-h-0 bg-transparent overflow-hidden">
            <div className="flex-1 flex flex-col h-full p-4 md:p-8 pb-32 md:pb-8 overflow-y-auto overflow-x-hidden custom-scrollbar">
              {activeTab === 'list' && <MainDashboard />}
              {activeTab === 'statistics' && (role === 'admin' || role === 'sub-admin') && <div className="dark flex flex-col h-full"><StatisticsDashboard /></div>}
              {activeTab === 'schedule' && <div className="dark flex flex-col h-full flex-1"><ScheduleManager /></div>}
              {activeTab === 'counselor-load' && <div className="dark flex flex-col h-full"><CounselorLoadDashboard /></div>}
              {activeTab === 'settings' && (role === 'admin' || role === 'sub-admin') && <div className="dark flex flex-col h-full"><SettingsPage /></div>}
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed top-0 left-0 w-full h-[100dvh] text-[#e2e8f0] flex flex-col font-sans overflow-hidden overscroll-none touch-none relative">
      <BackgroundCarousel />
      <header className="absolute top-0 right-0 p-4 md:p-8 z-20 flex items-center gap-2 pointer-events-none w-full justify-end">
        <div className="pointer-events-auto mr-auto">
          <PushNotificationManager />
        </div>
        <div className="pointer-events-auto">
          <Chatbot inline />
        </div>
        <button 
          onClick={logout}
          className="text-sm text-gray-300 hover:text-white transition-colors font-semibold whitespace-nowrap bg-[#08172c] px-4 py-2 rounded-lg border border-[#1e3a5f] hover:border-[#3b82f6] backdrop-blur-sm pointer-events-auto"
        >
          로그아웃
        </button>
      </header>

      <main className="flex-1 w-full h-full overflow-y-auto overscroll-none touch-auto bg-transparent relative z-10 flex flex-col items-center justify-start p-4 pt-24 md:pt-28 pb-32 md:pb-10">
        <div className="w-full max-w-lg mx-auto my-auto">
          <MobileBooking />
        </div>
      </main>
    </div>
  );
}
