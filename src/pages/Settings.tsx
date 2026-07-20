import React, { useState, useEffect } from 'react';
import { useCounselorStore, CounselorUser } from '../store/counselorStore';
import { useFirestore } from '../hooks/useFirestore';
import { useAuthStore } from '../store/authStore';
import { COUNTRIES } from '../constants';
import { Plus, Edit2, Trash2, Key, X, Check, Mail, Send, Bell } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const Settings = () => {
  const { counselors } = useCounselorStore();
  const { role } = useAuthStore();
  const { 
    updateCounselorPassword, 
    addCounselorToDB, 
    updateCounselorInDB, 
    removeCounselorFromDB,
    reinstateCounselorInDB,
    permanentlyDeleteCounselorFromDB
  } = useFirestore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<CounselorUser>>({});
  const [newlyAddedId, setNewlyAddedId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);

    const [telegramBotToken, setTelegramBotToken] = useState('');
  
  const [orgsSub, setOrgsSub] = useState<string>('');
  const [orgsDirect, setOrgsDirect] = useState<string>('');
  const [isSavingOrgs, setIsSavingOrgs] = useState(false);

  const [telegramGroupChatId, setTelegramGroupChatId] = useState('');
  const [isSavingTelegram, setIsSavingTelegram] = useState(false);
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);
  const [isTelegramConfigUnlocked, setIsTelegramConfigUnlocked] = useState(false);

  useEffect(() => {
    const fetchEmails = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'settings', 'email_config'));
        if (docSnap.exists() && docSnap.data().recipients) {
          setEmailRecipients(docSnap.data().recipients);
        } else {
          setEmailRecipients(['p021435@hd.com']);
        }
      } catch (err) {
        console.error('Failed to fetch email config:', err);
      }
    };

    const fetchTelegramConfig = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'settings', 'telegram_config'));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setTelegramBotToken(data.bot_token || '');
          setTelegramGroupChatId(data.group_chat_id || '');
        }
      } catch (err) {
        console.error('Failed to fetch telegram config:', err);
      }
    };

    const fetchOrgs = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'settings', 'organizations'));
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.subcontractors) setOrgsSub(data.subcontractors.join('\n'));
          if (data.direct) setOrgsDirect(data.direct.join('\n'));
        }
      } catch (err) {
        console.error('Failed to fetch orgs config:', err);
      }
    };

    fetchEmails();
    fetchTelegramConfig();
    fetchOrgs();
  }, []);


  const handleSaveOrgs = async () => {
    setIsSavingOrgs(true);
    try {
      const subList = orgsSub.split('\n').map(s => s.trim()).filter(s => s);
      const dirList = orgsDirect.split('\n').map(s => s.trim()).filter(s => s);
      await setDoc(doc(db, 'settings', 'organizations'), {
        subcontractors: subList,
        direct: dirList
      }, { merge: true });
      alert('조직 명단이 성공적으로 저장되었습니다.');
    } catch (e: any) {
      alert(`저장 실패: ${e.message}`);
    } finally {
      setIsSavingOrgs(false);
    }
  };

  const handleSaveTelegram = async () => {

    setIsSavingTelegram(true);
    try {
      await setDoc(doc(db, 'settings', 'telegram_config'), {
        bot_token: telegramBotToken.trim(),
        group_chat_id: telegramGroupChatId.trim(),
        updated_at: new Date().toISOString()
      });
      alert('텔레그램 단체방 설정이 성공적으로 저장되었습니다.');
    } catch (err) {
      console.error('Error saving telegram config:', err);
      alert('설정 저장에 실패했습니다.');
    } finally {
      setIsSavingTelegram(false);
    }
  };

  const handleUnlockTelegram = () => {
    const answer = prompt('진짜 수정하겠냐?\n아래 입력창에 "수정하겠다" 라고 똑같이 입력해주세요.');
    if (answer === '수정하겠다') {
      setIsTelegramConfigUnlocked(true);
    } else if (answer !== null) {
      alert('입력이 일치하지 않습니다.');
    }
  };

  const handleTestTelegram = async () => {
    if (!telegramGroupChatId) {
      alert('그룹 Chat ID를 입력해주세요.');
      return;
    }
    setIsTestingTelegram(true);
    try {
      const response = await fetch('/api/test-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bot_token: telegramBotToken.trim(),
          group_chat_id: telegramGroupChatId.trim()
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '테스트 전송 실패');
      }
      alert('테스트 메시지가 성공적으로 발송되었습니다. 지정하신 텔레그램 단체방을 확인해보세요!');
    } catch (err: any) {
      console.error(err);
      alert(`테스트 발송 실패: ${err.message}`);
    } finally {
      setIsTestingTelegram(false);
    }
  };

  const handleAddEmail = async () => {
    if (!newEmail || !newEmail.includes('@') || emailRecipients.includes(newEmail)) return;
    setIsSavingEmail(true);
    try {
      const updated = [...emailRecipients, newEmail];
      await setDoc(doc(db, 'settings', 'email_config'), { recipients: updated });
      setEmailRecipients(updated);
      setNewEmail('');
    } catch (err) {
      console.error('Error adding email:', err);
      alert('이메일 추가에 실패했습니다.');
    } finally {
      setIsSavingEmail(false);
    }
  };

  const handleRemoveEmail = async (email: string) => {
    setIsSavingEmail(true);
    try {
      const updated = emailRecipients.filter(e => e !== email);
      await setDoc(doc(db, 'settings', 'email_config'), { recipients: updated });
      setEmailRecipients(updated);
    } catch (err) {
      console.error('Error removing email:', err);
      alert('이메일 삭제에 실패했습니다.');
    } finally {
      setIsSavingEmail(false);
    }
  };

  const handleTestEmail = async () => {
    setIsTestingEmail(true);
    try {
      const response = await fetch('/api/test-email-report', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '발송 실패');
      }
      if (data.testUrl) {
        alert(`테스트 메일이 테스트 샌드박스로 발송되었습니다!\n\n가상 편지함 주소:\n${data.testUrl}\n\n(참고: 환경 설정(SMTP_HOST 등)이 설정되지 않아 Ethereal 가상 메일로 발송되었습니다.)`);
        window.open(data.testUrl, '_blank');
      } else {
        alert('테스트 메일이 실제 수신자에게 성공적으로 발송되었습니다.');
      }

    } catch (err: any) {
      console.error(err);
      if (err.message && err.message.includes('Username and Password not accepted')) {
         alert('발송 실패: 발신자 이메일 계정의 비밀번호 또는 App Password 설정이 올바르지 않습니다. AI Studio 환경 변수(SMTP_USER, SMTP_PASS)를 확인해주세요. Gmail의 경우 2단계 인증 설정 후 "앱 비밀번호"를 생성하여 SMTP_PASS에 입력해야 합니다.');
      } else {
         alert(`발송 실패: ${err.message}`);
      }
    } finally {
      setIsTestingEmail(false);
    }
  };

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => Promise<void> | void;
    isWarning?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: async () => {},
  });

  const triggerConfirm = (title: string, message: string, onConfirm: () => Promise<void> | void, isWarning = false) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      onConfirm,
      isWarning
    });
  };

  const handleEdit = (c: CounselorUser) => {
    setEditingId(c.id);
    setEditForm(c);
  };

  const handleSave = async () => {
    if (editingId && editForm.name) {
      await updateCounselorInDB(editingId, editForm);
      setEditingId(null);
      setNewlyAddedId(null);
    }
  };

  const handleCancel = async () => {
    if (editingId && editingId === newlyAddedId) {
      // If it was newly created and cancelled, remove it from DB to keep clean
      await permanentlyDeleteCounselorFromDB(editingId);
    }
    setEditingId(null);
    setNewlyAddedId(null);
  };

  const handleResetPassword = (id: string) => {
    triggerConfirm(
      '비밀번호 초기화',
      '해당 통역위원의 비밀번호를 기본값(1234)으로 초기화하시겠습니까?',
      async () => {
        await updateCounselorPassword(id, '1234');
        alert('초기화되었습니다.');
      }
    );
  };

  const handleAdd = async () => {
    if (isAdding || newlyAddedId) return;
    setIsAdding(true);
    try {
      // Calculate new ID: CS01, CS02...
      let maxNum = 0;
      counselors.forEach(c => {
        if (c.id.toUpperCase().startsWith('CS')) {
          const num = parseInt(c.id.substring(2), 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      });
      const nextNum = maxNum + 1;
      const newId = `CS${nextNum.toString().padStart(2, '0')}`;
      
      const newCounselor = {
        id: newId,
        name: '새 통역위원',
        country: COUNTRIES[0],
        languages: [COUNTRIES[0] + '어'],
        password: '1234',
        isRetired: false
      };
      
      await addCounselorToDB(newCounselor);
      setNewlyAddedId(newId);
      handleEdit(newCounselor);
    } catch (error) {
      console.error('Error adding counselor:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleAddManager = async () => {
    if (isAdding || newlyAddedId) return;
    setIsAdding(true);
    try {
      let maxNum = 0;
      counselors.forEach(c => {
        if (c.id.toLowerCase().startsWith('admin')) {
          const num = parseInt(c.id.substring(2), 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      });
      const nextNum = maxNum + 1;
      const newId = `admin${nextNum}`;
      
      const newCounselor = {
        id: newId,
        name: '새 관리자',
        country: COUNTRIES[0],
        languages: ['한국어'],
        password: '1234',
        isRetired: false
      };
      
      await addCounselorToDB(newCounselor);
      setNewlyAddedId(newId);
      handleEdit(newCounselor);
    } catch (error) {
      console.error('Error adding manager:', error);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="flex flex-col h-full gap-4 md:gap-6 animate-fade-in-up pb-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 shrink-0">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gradient tracking-tight mb-2">관리자 설정</h2>
          <p className="text-sm font-bold text-gray-400">통역위원/관리자 계정 관리 및 시스템 설정</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          {newlyAddedId && (
            <span className="text-xs text-yellow-400 bg-yellow-400/10 px-3 py-1.5 border border-yellow-400/20 rounded-xl animate-pulse">
              ※ 저장되지 않은 신규 계정이 있습니다. 먼저 저장해주세요.
            </span>
          )}
          <button
            onClick={handleAddManager}
            disabled={isAdding || !!newlyAddedId}
            className="px-4 py-2 bg-purple-500/20 disabled:opacity-40 disabled:cursor-not-allowed text-purple-400 hover:bg-purple-500/30 border border-purple-500/30 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> {isAdding ? '추가 중...' : '관리자 추가'}
          </button>
          <button
            onClick={handleAdd}
            disabled={isAdding || !!newlyAddedId}
            className="px-4 py-2 bg-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> {isAdding ? '추가 중...' : '통역위원 추가'}
          </button>
        </div>
      </div>

      <div className="glass-panel p-0 flex flex-col mt-4">
        <div className="p-4 md:p-5 border-b border-white/5 flex items-center gap-2">
          <Mail className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-medium text-gray-200">일일 리포트 수신 이메일 설정</h3>
        </div>
        <div className="p-4 md:p-5">
          <div className="flex flex-wrap gap-2 mb-4">
            {emailRecipients.map(email => (
              <div key={email} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-1.5 text-sm text-gray-300">
                {email}
                <button
                  onClick={() => handleRemoveEmail(email)}
                  disabled={isSavingEmail}
                  className="text-gray-500 hover:text-red-400 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 max-w-sm">
            <input
              type="email"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              placeholder="새로운 수신자 이메일 주소"
              className="flex-1 bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
              onKeyDown={e => e.key === 'Enter' && handleAddEmail()}
            />
            <button
              onClick={handleAddEmail}
              disabled={isSavingEmail || !newEmail || !newEmail.includes('@')}
              className="px-4 py-2 bg-blue-500/20 disabled:opacity-40 hover:bg-blue-500/30 border border-blue-500/30 rounded-xl text-sm font-medium text-blue-400 transition-colors whitespace-nowrap"
            >
              추가
            </button>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-4 pt-4 border-t border-white/5">
            <p className="text-xs text-gray-500">매일 아침 8시에 해당 이메일 주소들로 AI 실적 보고서가 발송됩니다.</p>
            <button
              onClick={handleTestEmail}
              disabled={isTestingEmail}
              className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-xl text-sm font-medium text-purple-400 transition-colors whitespace-nowrap flex items-center gap-2 disabled:opacity-50"
            >
              <Mail className="w-4 h-4" />
              {isTestingEmail ? '테스트 메일 발송 중...' : '지금 테스트 메일 발송'}
            </button>
          </div>
        </div>
      </div>

      <div className="glass-panel p-0 flex flex-col mt-4 animate-fade-in">
        <div className="p-4 md:p-5 border-b border-white/5 flex items-center gap-2">
          <Bell className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-medium text-gray-200">텔레그램 알림 및 단체방 설정</h3>
        </div>
        <div className="p-4 md:p-5 flex flex-col gap-4">
          <p className="text-xs text-gray-400">
            신규 예약 및 긴급 상담이 발생했을 때 텔레그램을 통해 실시간 알림을 받아볼 수 있습니다.
            (각 통역위원별 개인 텔레그램 Chat ID뿐만 아니라, 지정된 <strong>단체톡방(Group Chat)</strong>으로도 동시에 실시간 발송이 가능합니다.)
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5 flex justify-between items-center">
                <span>텔레그램 Bot Token (API)</span>
                {!isTelegramConfigUnlocked && (
                  <button onClick={handleUnlockTelegram} className="text-[10px] text-blue-400 hover:text-blue-300">
                    수정하기
                  </button>
                )}
              </label>
              <input
                type="password"
                value={telegramBotToken}
                onChange={e => setTelegramBotToken(e.target.value)}
                readOnly={!isTelegramConfigUnlocked}
                placeholder="Environment fallback (TELEGRAM_BOT_TOKEN) 사용 중"
                className={`w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 ${!isTelegramConfigUnlocked ? 'opacity-50 cursor-not-allowed' : ''}`}
              />
              <p className="text-[10px] text-gray-500 mt-1">
                BotFather를 통해 생성한 @봇의 토큰값을 입력해주세요. 비워둘 경우 시스템 환경변수(TELEGRAM_BOT_TOKEN)를 기본값으로 사용합니다.
              </p>
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                텔레그램 기본 (개인/단체방) Chat ID
              </label>
              <input
                type="text"
                value={telegramGroupChatId}
                onChange={e => setTelegramGroupChatId(e.target.value)}
                readOnly={!isTelegramConfigUnlocked}
                placeholder="예: -1001234567890 또는 6397895519"
                className={`w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 ${!isTelegramConfigUnlocked ? 'opacity-50 cursor-not-allowed' : ''}`}
              />
              <p className="text-[10px] text-gray-500 mt-1">
                ※ 단체방은 보통 마이너스(-)로 시작하며, 개인 ID는 숫자로 시작합니다. 봇에 먼저 /start 메시지를 보내야 알림 수신이 가능합니다.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-2 pt-4 border-t border-white/5">
            <span className="text-[11px] text-yellow-500 bg-yellow-500/10 px-2.5 py-1 rounded-lg border border-yellow-500/20">
              💡 개인 ID인 경우 봇에게 먼저 말을 걸어야 하며, 단체방인 경우 봇이 멤버로 초대되어 있어야 정상 발송됩니다.
            </span>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                onClick={handleTestTelegram}
                disabled={isTestingTelegram}
                className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-xl text-sm font-medium text-purple-400 transition-colors whitespace-nowrap flex items-center gap-2 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {isTestingTelegram ? '테스트 발송 중...' : '단체톡 테스트 발송'}
              </button>
              <button
                onClick={handleSaveTelegram}
                disabled={isSavingTelegram}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-xl text-sm font-medium text-white transition-colors whitespace-nowrap disabled:opacity-50"
              >
                {isSavingTelegram ? '저장 중...' : '설정 저장'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-panel p-0 flex flex-col mt-4">
        <div className="p-4 md:p-5 border-b border-white/5 flex items-center gap-2">
          <h3 className="text-sm font-medium text-gray-200">통역위원 계정 목록</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/10 text-xs text-gray-400">
                <th className="py-3 px-4 font-medium whitespace-nowrap">ID</th>
                <th className="py-3 px-4 font-medium whitespace-nowrap">이름</th>
                <th className="py-3 px-4 font-medium whitespace-nowrap">상태</th>
                <th className="py-3 px-4 font-medium whitespace-nowrap">국가</th>
                <th className="py-3 px-4 font-medium whitespace-nowrap">텔레그램 Chat ID</th>
                <th className="py-3 px-4 font-medium whitespace-nowrap text-right">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {counselors.slice().sort((a, b) => {
                // Newly added counselor goes to the absolute top of the list for editing
                if (a.id === newlyAddedId) return -1;
                if (b.id === newlyAddedId) return 1;

                const aIsMg = a.id.toLowerCase().startsWith('admin');
                const bIsMg = b.id.toLowerCase().startsWith('admin');
                
                if (aIsMg && !bIsMg) return -1;
                if (!aIsMg && bIsMg) return 1;

                const aNum = parseInt(a.id.replace(/[^0-9]/g, '')) || 0;
                const bNum = parseInt(b.id.replace(/[^0-9]/g, '')) || 0;
                return aNum - bNum;
              }).map(c => (
                <tr key={c.id} className={`hover:bg-white/5 transition-colors ${c.isRetired ? 'bg-red-500/5' : ''}`}>
                  <td className={`py-3 px-4 text-gray-300 whitespace-nowrap ${c.isRetired ? 'opacity-50 line-through' : ''}`}>
                    {c.id.toUpperCase()}
                  </td>
                  <td className="py-3 px-4 text-gray-300 whitespace-nowrap">
                    {editingId === c.id ? (
                      <input 
                        type="text" 
                        value={editForm.name || ''} 
                        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                        className="bg-black/50 border border-white/20 rounded px-2 py-1 text-sm text-white w-32"
                      />
                    ) : (
                      <span className={c.isRetired ? 'opacity-50 line-through' : ''}>
                        {c.name}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    {c.isRetired ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-400/10 text-red-400 border border-red-400/20">
                        활동 종료 (퇴사)
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-400/10 text-green-400 border border-green-400/20">
                        활동중
                      </span>
                    )}
                  </td>
                  <td className={`py-3 px-4 text-gray-300 whitespace-nowrap ${c.isRetired ? 'opacity-50' : ''}`}>
                    {editingId === c.id ? (
                      <select 
                        value={editForm.country || ''} 
                        onChange={e => setEditForm({ ...editForm, country: e.target.value })}
                        className="bg-black/50 border border-white/20 rounded px-2 py-1 text-sm text-white"
                      >
                        {COUNTRIES.map(country => (
                          <option key={country} value={country}>{country}</option>
                        ))}
                      </select>
                    ) : (
                      c.country
                    )}
                  </td>
                  <td className={`py-3 px-4 text-gray-300 whitespace-nowrap ${c.isRetired ? 'opacity-50' : ''}`}>
                    {editingId === c.id ? (
                      <input 
                        type="text" 
                        value={editForm.telegram_chat_id || ''} 
                        onChange={e => setEditForm({ ...editForm, telegram_chat_id: e.target.value })}
                        placeholder="Chat ID"
                        className="bg-black/50 border border-white/20 rounded px-2 py-1 text-sm text-white w-24"
                      />
                    ) : (
                      c.telegram_chat_id || '-'
                    )}
                  </td>
                  <td className="py-3 px-4 flex justify-end gap-2 items-center">
                    {editingId === c.id ? (
                      <>
                        <button onClick={handleSave} className="p-1.5 text-green-400 hover:bg-green-400/10 rounded" title="저장">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={handleCancel} className="p-1.5 text-gray-400 hover:bg-white/10 rounded" title="취소">
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => handleResetPassword(c.id)} title="비밀번호 초기화(1234)" className="p-1.5 text-yellow-400 hover:bg-yellow-400/10 rounded">
                          <Key className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleEdit(c)} title="수정" className="p-1.5 text-blue-400 hover:bg-blue-400/10 rounded">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {(role === 'admin' || role === 'sub-admin') && (
                          c.isRetired ? (
                            <>
                              <button 
                                onClick={() => {
                                  triggerConfirm(
                                    '활동 재개 (복직)',
                                    `${c.name} 위원의 활동을 재개(복직)하시겠습니까?`,
                                    async () => { await reinstateCounselorInDB(c.id); }
                                  );
                                }} 
                                title="활동 재개 (복직)" 
                                className="px-2 py-1 text-xs text-green-400 bg-green-400/10 border border-green-400/20 hover:bg-green-400/20 rounded-md transition-colors"
                              >
                                복직
                              </button>
                              <button 
                                onClick={() => {
                                  triggerConfirm(
                                    '완전 삭제 (경고)',
                                    `[경고] ${c.name} 위원의 계정 정보 및 모든 일정/실적 기록을 데이터베이스에서 영구히 완전히 삭제하시겠습니까? 과거 통계 및 실적에서 제외되므로 가급적 퇴사 처리 상태 유지를 권장합니다.`,
                                    async () => { await permanentlyDeleteCounselorFromDB(c.id); },
                                    true
                                  );
                                }} 
                                title="완전 삭제 (권장하지 않음)" 
                                className="p-1.5 text-red-500 hover:bg-red-500/10 rounded"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button 
                                onClick={() => {
                                  triggerConfirm(
                                    '활동 종료 (퇴사)',
                                    `${c.name} 위원을 활동 종료(퇴사) 처리하시겠습니까?\n퇴사 후에도 기존에 수행한 실적과 상담 데이터는 모두 완벽하게 보존됩니다.`,
                                    async () => { await removeCounselorFromDB(c.id); },
                                    true
                                  );
                                }} 
                                title="활동 종료 (퇴사)" 
                                className="px-2 py-1 text-xs text-orange-400 bg-orange-400/10 border border-orange-400/20 hover:bg-orange-400/20 rounded-md transition-colors"
                              >
                                퇴사
                              </button>
                              <button 
                                onClick={() => {
                                  triggerConfirm(
                                    '완전 삭제 (경고)',
                                    `[경고] ${c.name} 위원의 모든 정보와 이력을 데이터베이스에서 영구히 완전히 삭제하시겠습니까? 복구할 수 없습니다.`,
                                    async () => { await permanentlyDeleteCounselorFromDB(c.id); },
                                    true
                                  );
                                }} 
                                title="완전 삭제" 
                                className="p-1.5 text-red-400 hover:bg-red-400/10 rounded"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

            <div className="glass-panel p-5 md:p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center border border-green-500/20">
            <Check className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h3 className="text-base font-medium text-white">조직(업체/부서) 명단 관리</h3>
            <p className="text-sm font-bold text-gray-400 mt-0.5">근로자 접수 시 선택할 수 있는 조직 명단을 관리합니다. (줄바꿈으로 구분하여 입력)</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-bold text-gray-400 mb-2">협력사 명단</label>
            <textarea
              value={orgsSub}
              onChange={e => setOrgsSub(e.target.value)}
              placeholder={"협력사A\n협력사B\n협력사C"}
              className="w-full h-48 bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white resize-none focus:ring-2 focus:ring-green-500/20 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-400 mb-2">직영 부서 명단</label>
            <textarea
              value={orgsDirect}
              onChange={e => setOrgsDirect(e.target.value)}
              placeholder={"직영부서A\n직영부서B\n직영부서C"}
              className="w-full h-48 bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white resize-none focus:ring-2 focus:ring-green-500/20 outline-none"
            />
          </div>
        </div>
        
        <div className="flex justify-end">
          <button
            onClick={handleSaveOrgs}
            disabled={isSavingOrgs}
            className="px-5 py-2.5 bg-green-500/20 disabled:opacity-40 text-green-400 hover:bg-green-500/30 border border-green-500/30 rounded-xl text-sm font-medium transition-all flex items-center gap-2"
          >
            <Check className="w-4 h-4" /> {isSavingOrgs ? '저장 중...' : '명단 저장'}
          </button>
        </div>
      </div>

      {confirmDialog.isOpen && (

        <div className="fixed top-0 left-0 w-full h-[100dvh] bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="glass-panel p-6 max-w-md w-full border border-white/10 animate-fade-in-up">
            <h4 className={`text-lg font-medium mb-3 ${confirmDialog.isWarning ? 'text-red-400' : 'text-white'}`}>
              {confirmDialog.title}
            </h4>
            <p className="text-sm text-gray-300 mb-6 whitespace-pre-wrap leading-relaxed">
              {confirmDialog.message}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium text-gray-300 transition-colors"
              >
                취소
              </button>
              <button
                onClick={async () => {
                  try {
                    await confirmDialog.onConfirm();
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                  }
                }}
                className={`px-4 py-2 rounded-xl text-sm font-medium text-white transition-colors ${
                  confirmDialog.isWarning 
                    ? 'bg-red-500/20 hover:bg-red-500/30 border border-red-500/30' 
                    : 'bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30'
                }`}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
