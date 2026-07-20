import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useCounselorStore } from '../store/counselorStore';
import { useFirestore } from '../hooks/useFirestore';
import { Lock } from 'lucide-react';
import { LanguageSelector } from './LanguageSelector';
import { useLanguageStore } from '../store/languageStore';
import { useTranslation } from '../utils/translations';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const Login = () => {
  const language = useLanguageStore(state => state.language);
  const t = useTranslation(language);
  const login = useAuthStore(state => state.login);
  const counselors = useCounselorStore(state => state.counselors);
  const { updateCounselorPassword } = useFirestore();
  
  const [role, setRole] = useState<'worker' | 'counselor' | 'admin'>('worker');
  const [uid, setUid] = useState('');
  const [counselorInputId, setCounselorInputId] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Password change state
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch (err) {}
    if (role === 'worker' && !uid) return alert('사번을 입력하세요.');
    if (role === 'worker' && (!password || password.length !== 4)) return alert('비밀번호 숫자 4자리를 입력하세요.');
    if (role === 'counselor' && (!counselorInputId || !password)) return alert('통역위원 ID와 비밀번호를 입력하세요.');
    if (role === 'admin' && (!counselorInputId || !password)) return alert('관리자 ID와 비밀번호를 입력하세요.');

    if (role === 'counselor') {
      const input = counselorInputId.trim().toLowerCase();
      const matchNumeric = input.match(/^cs0*(\d+)$/);
      
      const counselor = counselors.find(c => {
        const dbId = c.id.toLowerCase();
        if (dbId === input) return true;
        
        const dbNumeric = dbId.match(/^cs0*(\d+)$/);
        if (matchNumeric && dbNumeric) {
          return matchNumeric[1] === dbNumeric[1];
        }
        return false;
      });

      if (!counselor || counselor.isRetired) {
        return alert('존재하지 않는 통역위원 ID입니다.');
      }
      
      const targetPassword = counselor.password || '1234';
      if (password !== targetPassword) {
        return alert('비밀번호가 틀렸습니다. (기본: 1234)');
      }

      if (isChangingPassword) {
        if (!newPassword || newPassword !== confirmPassword) {
          return alert('새 비밀번호가 일치하지 않거나 비어있습니다.');
        }
        await updateCounselorPassword(counselor.id, newPassword);
        alert('비밀번호가 변경되었습니다. 새 비밀번호로 다시 로그인해주세요.');
        setIsChangingPassword(false);
        setPassword('');
        setNewPassword('');
        setConfirmPassword('');
        return;
      }

      login({ uid: counselor.id, name: counselor.name, country: counselor.country }, role);
    } else if (role === 'admin') {
      const input = counselorInputId.trim().toLowerCase();
      
      // Fallback for default admin
      if (input === 'admin') {
        if (password !== 'admin') {
          return alert('비밀번호가 틀렸습니다. (기본: admin)');
        }
        login({ uid: 'admin', name: '최고 관리자' }, role);
        return;
      }

      const matchNumeric = input.match(/^admin0*(\d+)$/);
      
      let admin = counselors.find(c => {
        const dbId = c.id.toLowerCase();
        if (dbId === input) return true;
        
        const dbNumeric = dbId.match(/^admin0*(\d+)$/);
        if (matchNumeric && dbNumeric) {
          return matchNumeric[1] === dbNumeric[1];
        }
        return false;
      });

      if (!admin) {
        if (matchNumeric) {
          admin = {
            id: `admin${matchNumeric[1]}`,
            name: `관리자 ${matchNumeric[1]}`,
            country: '한국',
            languages: ['한국어'],
            password: '1234',
            isRetired: false
          };
          // Not saving to DB yet, they can change password or configure telegram later
        } else {
          return alert('존재하지 않는 관리자 ID입니다.');
        }
      } else if (admin.isRetired) {
        return alert('존재하지 않는 관리자 ID입니다.');
      }
      
      const targetPassword = admin.password || '1234';
      if (password !== targetPassword) {
        return alert('비밀번호가 틀렸습니다. (기본: 1234)');
      }

      if (isChangingPassword) {
        if (!newPassword || newPassword !== confirmPassword) {
          return alert('새 비밀번호가 일치하지 않거나 비어있습니다.');
        }
        await updateCounselorPassword(admin.id, newPassword);
        alert('비밀번호가 변경되었습니다. 새 비밀번호로 다시 로그인해주세요.');
        setIsChangingPassword(false);
        setPassword('');
        setNewPassword('');
        setConfirmPassword('');
        return;
      }

      login({ uid: admin.id, name: admin.name, country: admin.country }, role);
    } else {
      // role === 'worker'
      if ('Notification' in window) {
        try {
          if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
            await Notification.requestPermission();
          }
        } catch (e) {
          console.error('Notification request failed', e);
        }
      }

      setIsLoading(true);
      try {
        const ticketsRef = collection(db, 'counseling_tickets');
        const q = query(ticketsRef, where('emp_id', '==', uid));
        const querySnapshot = await getDocs(q);
        
        let hasTickets = false;
        const passwordsFound: string[] = [];
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          hasTickets = true;
          if (data.worker_password) {
            passwordsFound.push(data.worker_password);
          }
        });
        
        if (hasTickets && passwordsFound.length > 0) {
          if (!passwordsFound.includes(password)) {
            setIsLoading(false);
            return alert('입력하신 사번으로 예약된 내역이 있으나, 비밀번호가 일치하지 않습니다.');
          }
        }
        
        login({ uid: uid, name: '', password: password }, role);
      } catch (error) {
        console.error("Error verifying worker password:", error);
        // Fallback in case of temporary database issues
        login({ uid: uid, name: '', password: password }, role);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="min-h-full py-8 flex items-center justify-center bg-transparent p-4 relative z-10">
      <div className="glass-panel p-10 w-full max-w-md animate-fade-in-up">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-6">
            <img src="/ci.png" alt="HD현대삼호" className="h-8 md:h-10 object-contain" />
          </div>
          <h3 className="text-[15.125px] font-medium text-gray-400 tracking-widest uppercase">{role === 'worker' ? t('login.welcome') : '외국인지원센터 상담 예약 시스템'}</h3>
        </div>
        
        <div className="flex bg-apple-gray/50 p-1 rounded-2xl mb-8 border border-apple-border">
          {(['worker', 'counselor', 'admin'] as const).map(r => (
            <button
              key={r}
              onClick={() => { setRole(r); setPassword(''); setUid(''); setIsChangingPassword(false); }}
              className={`flex-1 py-3 text-sm font-medium rounded-xl transition-all duration-300 ${
                role === r ? 'bg-white/10 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
              }`}
            >
              {r === 'worker' ? '근로자' : r === 'counselor' ? '통역위원' : '관리자'}
            </button>
          ))}
        </div>

        <form onSubmit={handleLogin} className="space-y-6 h-[327.125px]">
          {role === 'worker' && (
            <div className="space-y-4 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{role === 'worker' ? t('login.emp_id') : '사번 (Employee ID)'}</label>
                <input
                  type="text"
                  value={uid}
                  maxLength={7}
                  onChange={e => setUid(e.target.value)}
                  className="w-full px-5 py-4 bg-apple-gray/50 border border-apple-border rounded-xl focus:ring-2 focus:ring-white/20 focus:border-transparent outline-none text-white transition-all glass-panel-hover"
                  placeholder="사번을 입력하세요 (최대 7자리)"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{role === 'worker' ? t('login.password') : '비밀번호 숫자 4자리 (4-Digit Password)'}</label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={password}
                  onChange={e => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setPassword(val);
                  }}
                  className="w-full px-5 py-4 bg-apple-gray/50 border border-apple-border rounded-xl focus:ring-2 focus:ring-white/20 focus:border-transparent outline-none text-white transition-all glass-panel-hover"
                  placeholder="예약 조회/확인용 비밀번호 4자리"
                />
              </div>
            </div>
          )}

          {role === 'counselor' && (
            <div className="space-y-4 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">통역위원 ID</label>
                <input
                  type="text"
                  value={counselorInputId}
                  onChange={e => setCounselorInputId(e.target.value)}
                  className="w-full px-5 py-4 bg-apple-gray/50 border border-apple-border rounded-xl focus:ring-2 focus:ring-white/20 focus:border-transparent outline-none text-white transition-all glass-panel-hover"
                  placeholder="ID 입력"
                  disabled={isChangingPassword}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">현재 비밀번호</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-5 py-4 bg-apple-gray/50 border border-apple-border rounded-xl focus:ring-2 focus:ring-white/20 focus:border-transparent outline-none text-white transition-all glass-panel-hover"
                  placeholder="비밀번호 입력"
                />
              </div>

              {isChangingPassword && (
                <div className="space-y-4 animate-fade-in-up mt-4 pt-4 border-t border-white/10">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">새 비밀번호</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className="w-full px-5 py-4 bg-apple-gray/50 border border-apple-border rounded-xl focus:ring-2 focus:ring-white/20 focus:border-transparent outline-none text-white transition-all glass-panel-hover"
                      placeholder="새 비밀번호 입력"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">새 비밀번호 확인</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className="w-full px-5 py-4 bg-apple-gray/50 border border-apple-border rounded-xl focus:ring-2 focus:ring-white/20 focus:border-transparent outline-none text-white transition-all glass-panel-hover"
                      placeholder="새 비밀번호 확인"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsChangingPassword(!isChangingPassword);
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                >
                  <Lock className="w-3 h-3" />
                  {isChangingPassword ? '비밀번호 변경 취소' : '비밀번호 변경'}
                </button>
              </div>
            </div>
          )}

          {role === 'admin' && (
            <div className="space-y-4 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">관리자 ID</label>
                <input
                  type="text"
                  value={counselorInputId}
                  onChange={e => setCounselorInputId(e.target.value)}
                  className="w-full px-5 py-4 bg-apple-gray/50 border border-apple-border rounded-xl focus:ring-2 focus:ring-white/20 focus:border-transparent outline-none text-white transition-all glass-panel-hover"
                  placeholder="ID 입력"
                  disabled={isChangingPassword}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">현재 비밀번호</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-5 py-4 bg-apple-gray/50 border border-apple-border rounded-xl focus:ring-2 focus:ring-white/20 focus:border-transparent outline-none text-white transition-all glass-panel-hover"
                  placeholder="비밀번호 입력"
                />
              </div>

              {isChangingPassword && (
                <div className="space-y-4 animate-fade-in-up mt-4 pt-4 border-t border-white/10">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">새 비밀번호</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className="w-full px-5 py-4 bg-apple-gray/50 border border-apple-border rounded-xl focus:ring-2 focus:ring-white/20 focus:border-transparent outline-none text-white transition-all glass-panel-hover"
                      placeholder="새 비밀번호 입력"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">새 비밀번호 확인</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className="w-full px-5 py-4 bg-apple-gray/50 border border-apple-border rounded-xl focus:ring-2 focus:ring-white/20 focus:border-transparent outline-none text-white transition-all glass-panel-hover"
                      placeholder="새 비밀번호 확인"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsChangingPassword(!isChangingPassword);
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                >
                  <Lock className="w-3 h-3" />
                  {isChangingPassword ? '비밀번호 변경 취소' : '비밀번호 변경'}
                </button>
              </div>
            </div>
          )}

          {role === 'worker' && <LanguageSelector />}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 bg-white text-black font-medium rounded-xl hover:bg-gray-200 transition-colors mt-8 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (role === 'worker' ? t('login.checking') : '확인 중...') : (isChangingPassword ? '비밀번호 변경하기' : (role === 'worker' ? t('login.start') : '시작하기'))}
          </button>
        </form>
      </div>
    </div>
  );
};
