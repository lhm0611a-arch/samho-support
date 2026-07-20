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
      <div className="fixed top-0 left-0 w-full h-[100dvh] w-full h-[100dvh] bg-apple-dark text-gray-200 flex flex-col font-sans overflow-hidden overscroll-none touch-none">
        <div className="flex-1 w-full h-full overflow-y-auto overscroll-none touch-auto">
          <Login />
        </div>
      </div>
    );
  }

  if (role === 'admin' || role === 'sub-admin' || role === 'counselor') {
    return (
      <div className="h-[100dvh] w-full flex overflow-hidden bg-apple-dark font-sans text-gray-200">
        {/* Sidebar Overlay */}
        {isSidebarOpen && (
          <div 
            className="fixed top-0 left-0 w-full h-[100dvh] bg-black/20 backdrop-blur-[1px] z-20"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={clsx(
          "fixed inset-y-0 left-0 z-30 w-64 bg-apple-gray/80 backdrop-blur-xl border-r border-apple-border text-gray-300 flex flex-col shrink-0 transition-transform duration-300 ease-in-out",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="h-20 flex items-center justify-between pl-[10px] pr-[15px] border-b border-apple-border">
            <div className="flex items-center gap-3 w-[161.234px] h-[41.5px]">
              <img src="/ci.png" alt="HD현대삼호" className="h-[19.5px] w-[87.4688px] object-contain" />
              <span className="text-white tracking-wide leading-tight text-center font-normal text-[12.75px] mt-[5px] h-[34.9688px] w-[53.6406px]">외국인<br />지원센터</span>
            </div>
            <button className="text-gray-400 hover:text-white" onClick={() => setIsSidebarOpen(false)}>
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex-1 py-8 overflow-y-auto px-4">
            <nav className="space-y-2">
              <button 
                onClick={() => { setActiveTab('list'); setIsSidebarOpen(false); }}
                className={clsx(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-300",
                  activeTab === 'list' ? "bg-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.05)] border border-white/10" : "hover:bg-white/5 hover:text-white border border-transparent"
                )}
              >
                <FileText className="w-4 h-4" /> 실시간 대시보드
                {hasPending && (
                  <span className="ml-auto bg-red-400/10 text-red-400 text-[10px] px-2 py-0.5 rounded-full border border-red-400/20 font-semibold animate-pulse">
                    New
                  </span>
                )}
              </button>
              <button 
                onClick={() => { setActiveTab('schedule'); setIsSidebarOpen(false); }}
                className={clsx(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-300",
                  activeTab === 'schedule' ? "bg-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.05)] border border-white/10" : "hover:bg-white/5 hover:text-white border border-transparent"
                )}
              >
                <Calendar className="w-4 h-4" /> 스케줄 관리
              </button>
              {(role === 'admin' || role === 'sub-admin') && (
                <button 
                  onClick={() => { setActiveTab('statistics'); setIsSidebarOpen(false); }}
                  className={clsx(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-300",
                    activeTab === 'statistics' ? "bg-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.05)] border border-white/10" : "hover:bg-white/5 hover:text-white border border-transparent"
                  )}
                >
                                    <BarChart3 className="w-4 h-4" /> 상담 실적 통계

                </button>
              )}
              <button 
                onClick={() => { setActiveTab('counselor-load'); setIsSidebarOpen(false); }}
                className={clsx(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-300",
                  activeTab === 'counselor-load' ? "bg-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.05)] border border-white/10" : "hover:bg-white/5 hover:text-white border border-transparent"
                )}
              >
                <Users className="w-4 h-4" /> {role === 'counselor' ? '나의 업무 실적' : '통역위원 업무 실적'}
              </button>
              {(role === 'admin' || role === 'sub-admin') && (
                <button 
                  onClick={() => { setActiveTab('settings'); setIsSidebarOpen(false); }}
                  className={clsx(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-300",
                    activeTab === 'settings' ? "bg-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.05)] border border-white/10" : "hover:bg-white/5 hover:text-white border border-transparent"
                  )}
                >
                  <Settings2 className="w-4 h-4" /> 설정
                </button>
              )}
            </nav>
          </div>

          <div className="p-6 border-t border-apple-border">
            <button onClick={logout} className="flex items-center gap-3 text-sm text-gray-400 hover:text-white transition-colors w-full px-2">
              <LogOut className="w-4 h-4" /> 로그아웃
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 relative z-10">
          {/* Header */}
          <header className="h-20 bg-[#1a1a1f]/80 backdrop-blur-xl border-b border-white/10 flex items-center justify-between px-6 md:px-10 shrink-0">
            <div className="flex items-center gap-4 text-white">
              <button className="p-2 hover:bg-white/10 rounded-xl transition-colors -ml-2" onClick={() => setIsSidebarOpen(true)}>
                <Menu className="w-5 h-5" />
              </button>
              <div className="hidden md:flex w-9 h-9 rounded-full bg-white/10 items-center justify-center border border-white/20 shadow-[0_0_10px_rgba(255,255,255,0.05)]">
                <span className="text-xs font-semibold text-gray-200">
                  {role === 'counselor' ? 'CS' : 'AD'}
                </span>
              </div>
              <span className="text-base sm:text-lg font-bold tracking-wide text-gray-200 uppercase truncate max-w-[150px] sm:max-w-none">
                Welcome, {user?.name || (role === 'counselor' ? '통역위원' : 'Admin')}
              </span>
            </div>
            <div className="flex items-center gap-3 md:gap-6 text-gray-400">
              {/* Header utilities */}
              <PushNotificationManager />
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
    <div className="fixed top-0 left-0 w-full h-[100dvh] w-full h-[100dvh] bg-apple-dark text-gray-200 flex flex-col font-sans overflow-hidden overscroll-none touch-none">
      <header className="absolute top-0 right-0 p-4 md:p-8 z-20 flex items-center gap-2 pointer-events-none w-full justify-end">
        <div className="pointer-events-auto mr-auto">
          <PushNotificationManager />
        </div>
        <div className="pointer-events-auto">
          <Chatbot inline />
        </div>
        <button 
          onClick={logout}
          className="text-sm text-gray-400 hover:text-white transition-colors font-medium whitespace-nowrap bg-apple-gray/50 px-4 py-2 rounded-full border border-apple-border backdrop-blur-sm pointer-events-auto"
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
