import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { CATEGORIES } from '../constants';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export const Chatbot = ({ inline }: { inline?: boolean }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [language, setLanguage] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [conciseMode, setConciseMode] = useState(false);
  const [messages, setMessages] = useState<{role: 'user' | 'model' | 'system', text: string}[]>([
    { role: 'model', text: '안녕하세요! HD현대삼호 외국인지원센터 전문 상담 챗봇입니다.\n먼저 원하시는 상담 언어를 선택해 주세요.\nPlease select your preferred language.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const CATEGORY_TRANSLATIONS: Record<string, Record<string, string>> = {
  '임금체불': { '영어': 'Unpaid Wages', '베트남어': 'Chậm lương', '네팔어': 'पारिश्रमिक नपाएको', '우즈벡어': 'Ish haqi to\'lanmagan', '태국어': 'ค้างจ่ายค่าจ้าง', '스리랑카어': 'නොගෙවූ වැටුප්', '인도네시아어': 'Gaji Belum Dibayar', '러시아어': 'Невыплата зарплаты' },
  '비자/체류': { '영어': 'Visa/Stay', '베트남어': 'Visa/Lưu trú', '네팔어': 'भिसा/बसाइ', '우즈벡어': 'Viza/Yashash', '태국어': 'วีซ่า/การพำนัก', '스리랑카어': 'වීසා/රැඳී සිටීම', '인도네시아어': 'Visa/Tinggal', '러시아어': 'Виза/Пребывание' },
  '폭언/폭행': { '영어': 'Verbal/Physical Abuse', '베트남어': 'Bạo hành/Xúc phạm', '네팔어': 'गालीगलौज/कुटपिट', '우즈벡어': 'Haqorat/Zo\'ravonlik', '태국어': 'ด่าทอ/ทำร้าย', '스리랑카어': 'වාචික/කායික හිංසනය', '인도네시아어': 'Kekerasan/Hinaan', '러시아어': 'Оскорбления/Насилие' },
  '산재/치료': { '영어': 'Industrial Accident/Medical', '베트남어': 'Tai nạn/Điều trị', '네팔어': 'दुर्घटना/उपचार', '우즈벡어': 'Baxtsiz hodisa/Davolash', '태국어': 'อุบัติเหตุ/รักษา', '스리랑카어': 'අනතුර/ප්‍රතිකාර', '인도네시아어': 'Kecelakaan/Perawatan', '러시아어': 'Несчастный случай/Лечение' },
  '기숙사': { '영어': 'Dormitory', '베트남어': 'Ký túc xá', '네팔어': 'होस्टेल', '우즈벡어': 'Yotoqxona', '태국어': 'หอพัก', '스리랑카어': 'නේවාසිකාගාරය', '인도네시아어': 'Asrama', '러시아어': 'Общежитие' },
  '정서/심리': { '영어': 'Emotional/Psychological', '베트남어': 'Tâm lý', '네팔어': 'मानसिक', '우즈벡어': 'Psixologik', '태국어': 'จิตวิทยา', '스리랑카어': 'මානසික', '인도네시아어': 'Psikologis', '러시아어': 'Психологические' },
  '기타': { '영어': 'Other', '베트남어': 'Khác', '네팔어': 'अन्य', '우즈벡어': 'Boshqa', '태국어': 'อื่นๆ', '스리랑카어': 'වෙනත්', '인도네시아어': 'Lainnya', '러시아어': 'Другое' }
};

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const CHAT_TRANSLATIONS: Record<string, { selectCategory: string, start: string }> = {
  '한국어': { selectCategory: '한국어로 상담을 진행합니다.\n다음으로 아래에서 상담 유형을 선택해 주세요.', start: '상담을 시작합니다.\n궁금한 점을 자유롭게 물어보세요.' },
  '영어': { selectCategory: 'We will proceed with the consultation in English.\nNext, please select a consultation category below.', start: 'The consultation will now begin.\nFeel free to ask any questions you have.' },
  '베트남어': { selectCategory: 'Chúng tôi sẽ tiến hành tư vấn bằng tiếng Việt.\nTiếp theo, vui lòng chọn một danh mục tư vấn dưới đây.', start: 'Quá trình tư vấn sẽ bắt đầu.\nXin cứ thoải mái hỏi bất kỳ câu hỏi nào.' },
  '네팔어': { selectCategory: 'हामी नेपालीमा परामर्श अगाडि बढाउनेछौं।\nअर्को, कृपया तलको परामर्श श्रेणी चयन गर्नुहोस्।', start: 'परामर्श सुरु हुनेछ।\nकुनै पनि प्रश्न सोध्न नहिचकिचाउनुहोस्।' },
  '우즈벡어': { selectCategory: 'Biz o\'zbek tilida maslahatlashishni davom ettiramiz.\nKeyin, quyidagi maslahat toifasini tanlang.', start: 'Maslahatlashuv boshlanadi.\nHar qanday savollarni berishingiz mumkin.' },
  '태국어': { selectCategory: 'เราจะดำเนินการให้คำปรึกษาเป็นภาษาไทย\nต่อไปโปรดเลือกหมวดหมู่การให้คำปรึกษาด้านล่าง', start: 'การให้คำปรึกษาจะเริ่มขึ้น\nเชิญสอบถามได้ตามสบาย' },
  '스리랑카어': { selectCategory: 'අපි සිංහල භාෂාවෙන් උපදේශනය කරගෙන යන්නෙමු.\nඊළඟට, කරුණාකර පහත උපදේශන වර්ගය තෝරන්න.', start: 'උපදේශනය ආරම්භ වනු ඇත.\nඕනෑම ප්‍රශ්නයක් ඇසීමට නිදහස් වන්න.' },
  '인도네시아어': { selectCategory: 'Kami akan melanjutkan konsultasi dalam bahasa Indonesia.\nSelanjutnya, silakan pilih kategori konsultasi di bawah ini.', start: 'Konsultasi akan dimulai.\nJangan ragu untuk menanyakan pertanyaan apa pun.' },
  '러시아어': { selectCategory: 'Мы продолжим консультацию на русском языке.\nДалее выберите категорию консультации ниже.', start: 'Консультация начнется.\nНе стесняйтесь задавать любые вопросы.' }
};
  const handleLanguageSelect = (selectedLanguage: string) => {
    setLanguage(selectedLanguage);
    setMessages(prev => [
      ...prev,
      { role: 'user', text: selectedLanguage },
      { role: 'model', text: CHAT_TRANSLATIONS[selectedLanguage]?.selectCategory || `${selectedLanguage}로 상담을 진행합니다.\n다음으로 아래에서 상담 유형을 선택해 주세요.` }
    ]);
  };

  const handleCategorySelect = (selectedCategory: string) => {
    setCategory(selectedCategory);
    
    // We get the translated category if available
    const translatedCat = language && CATEGORY_TRANSLATIONS[selectedCategory]?.[language] 
      ? CATEGORY_TRANSLATIONS[selectedCategory][language] 
      : selectedCategory;
      
    setMessages(prev => [
      ...prev,
      { role: 'user', text: translatedCat },
      { role: 'model', text: `[${translatedCat}] ${CHAT_TRANSLATIONS[language]?.start || '상담을 시작합니다.\n궁금한 점을 자유롭게 물어보세요.'}` }
    ]);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          history: messages.filter(m => m.role !== 'system'),
          category: category || '일반',
          language: language || '한국어',
          conciseMode
        })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch response');
      }

      const data = await response.json();
      setMessages(prev => [...prev, { role: 'model', text: data.reply }]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { role: 'system', text: '오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={clsx(
          inline ? "p-2 px-3 rounded-full bg-[#002c5f] text-white border border-[#1e3a5f] hover:border-cyan-400 shadow-xl hover:bg-[#003b80] transition-all z-[9999] flex items-center gap-2" : "fixed bottom-28 md:bottom-6 right-4 md:right-6 p-3 md:p-4 rounded-full bg-[#002c5f] text-white border border-[#1e3a5f] hover:border-cyan-400 shadow-xl hover:bg-[#003b80] transition-all z-[9999] flex items-center gap-2",
          isOpen && "hidden"
        )}
      >
        <MessageSquare className="w-5 h-5 md:w-6 md:h-6 text-cyan-400" />
        <span className="font-semibold pr-1 text-sm md:text-base">상담 챗봇</span>
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-0 right-0 w-full h-[85vh] md:h-[600px] md:bottom-6 md:right-6 md:w-96 max-h-[100vh] md:max-h-[80vh] bg-[#051326]/95 backdrop-blur-xl border border-[#1e3a5f] rounded-t-2xl md:rounded-2xl shadow-2xl flex flex-col z-[9999] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#020b18]/90 border-b border-[#1e3a5f] shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">외국인지원센터 전문 상담 AI</h3>
                <span className="text-[10px] text-cyan-300 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  실시간 최신 지식 검색 & 모국어 뉘앙스 지원
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setConciseMode(!conciseMode)}
                className={clsx(
                  "text-[10px] font-medium px-2 py-0.5 rounded-full border transition-all flex items-center gap-1",
                  !conciseMode 
                    ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-200 hover:bg-cyan-500/30" 
                    : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                )}
                title={conciseMode ? "현재 요약 모드입니다. 클릭 시 상세 전문 상담 모드로 전환합니다." : "현재 상세 전문 상담 모드입니다. 클릭 시 간결 요약 모드로 전환합니다."}
              >
                <span className={clsx("w-1.5 h-1.5 rounded-full", !conciseMode ? "bg-cyan-400 shadow-[0_0_6px_#38bdf8]" : "bg-gray-500")} />
                {!conciseMode ? "상세 상담" : "간결 요약"}
              </button>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, i) => (
              <div 
                key={i} 
                className={clsx(
                  "flex flex-col max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm",
                  msg.role === 'user' ? "ml-auto bg-[#004b99] text-white rounded-br-none border border-blue-400/30" : 
                  msg.role === 'system' ? "mx-auto bg-red-500/20 text-red-300 border border-red-500/30 rounded-xl text-xs" :
                  "mr-auto bg-[#0a1e38] text-gray-200 border border-[#1e3a5f] rounded-bl-none"
                )}
              >
                {msg.role === 'model' ? (
                  <div className="text-sm leading-relaxed">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                        ul: ({node, ...props}) => <ul className="list-disc pl-4 mb-2" {...props} />,
                        ol: ({node, ...props}) => <ol className="list-decimal pl-4 mb-2" {...props} />,
                        li: ({node, ...props}) => <li className="mb-1" {...props} />,
                        strong: ({node, ...props}) => <strong className="font-bold text-cyan-300" {...props} />,
                        a: ({node, ...props}) => <a className="text-cyan-400 hover:underline" target="_blank" rel="noreferrer" {...props} />
                      }}
                    >
                      {msg.text}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">{msg.text}</div>
                )}
              </div>
            ))}
            
            {!language && messages.length === 1 && (
              <div className="flex flex-wrap gap-2 mt-2 mr-auto max-w-[85%]">
                {[
                  { name: '한국어', promptName: '한국어' },
                  { name: 'English', promptName: '영어' },
                  { name: 'Tiếng Việt', promptName: '베트남어' },
                  { name: 'नेपाली', promptName: '네팔어' },
                  { name: 'O\'zbek', promptName: '우즈벡어' },
                  { name: 'ภาษาไทย', promptName: '태국어' },
                  { name: 'සිංහල', promptName: '스리랑카어' },
                  { name: 'Bahasa Indonesia', promptName: '인도네시아어' },
                  { name: 'Русский', promptName: '러시아어' }
                ].map(l => (
                  <button
                    key={l.promptName}
                    onClick={() => handleLanguageSelect(l.promptName)}
                    className="px-3 py-1.5 bg-[#002c5f]/70 hover:bg-[#003b80] border border-[#1e3a5f] hover:border-cyan-400 text-cyan-300 rounded-xl text-xs transition-colors"
                  >
                    {l.name}
                  </button>
                ))}
              </div>
            )}
            
            {language && !category && messages.length === 3 && (
              <div className="flex flex-wrap gap-2 mt-2 mr-auto max-w-[85%]">
                {CATEGORIES.map(c => (
                  <button
                    key={c}
                    onClick={() => handleCategorySelect(c)}
                    className="px-3 py-1.5 bg-[#002c5f]/70 hover:bg-[#003b80] border border-[#1e3a5f] hover:border-cyan-400 text-cyan-300 rounded-xl text-xs transition-colors"
                  >{language && CATEGORY_TRANSLATIONS[c]?.[language] ? CATEGORY_TRANSLATIONS[c][language] : c}</button>
                ))}
              </div>
            )}

            {isLoading && (
              <div className="mr-auto bg-[#0a1e38] border border-[#1e3a5f] text-cyan-300 rounded-2xl rounded-bl-none px-4 py-2.5 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                <span className="text-xs">전문 상담 답변 생성 중...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 bg-[#020b18]/80 border-t border-[#1e3a5f] shrink-0">
            <div className="flex gap-2">
              <input 
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !!category && !!language && handleSend()}
                placeholder={!language ? "위에서 언어를 먼저 선택해주세요." : !category ? "위에서 상담 유형을 먼저 선택해주세요." : "메시지를 입력하세요..."}
                disabled={!category || !language}
                className="flex-1 bg-[#051326] border border-[#1e3a5f] rounded-xl px-4 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-cyan-400 disabled:opacity-50 transition-colors"
              />
              <button 
                onClick={handleSend}
                disabled={isLoading || !input.trim() || !category || !language}
                className="p-2 bg-[#004b99] hover:bg-[#005bb5] disabled:bg-[#051326] disabled:text-gray-600 text-white rounded-xl transition-colors shrink-0 border border-[#1e3a5f]"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
