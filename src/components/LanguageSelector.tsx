import React from 'react';
import { useLanguageStore, LanguageCode } from '../store/languageStore';
import { clsx } from 'clsx';

const languages: { code: LanguageCode; name: string; flag: string; flagCode: string }[] = [
  { code: 'ko', name: '한국어', flag: '🇰🇷', flagCode: 'kr' },
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳', flagCode: 'vn' },
  { code: 'ne', name: 'नेपाली', flag: '🇳🇵', flagCode: 'np' },
  { code: 'uz', name: 'O\'zbek', flag: '🇺🇿', flagCode: 'uz' },
  { code: 'th', name: 'ภาษาไทย', flag: '🇹🇭', flagCode: 'th' },
  { code: 'si', name: 'සිංහල', flag: '🇱🇰', flagCode: 'lk' },
  { code: 'id', name: 'Indonesia', flag: '🇮🇩', flagCode: 'id' },
];

export const LanguageSelector = () => {
  const language = useLanguageStore(state => state.language);
  const setLanguage = useLanguageStore(state => state.setLanguage);

  return (
    <div className="flex flex-nowrap justify-between items-stretch gap-1 sm:gap-1.5 mb-6 w-full px-0 h-8 sm:h-10">
      {languages.map(lang => (
        <button
          key={lang.code}
          type="button"
          onClick={(e) => { e.preventDefault(); setLanguage(lang.code); }}
          className={clsx(
            "flex items-center justify-center flex-1 p-0 overflow-hidden rounded-[4px] border transition-all duration-300",
            language === lang.code
              ? "border-blue-400 ring-1 ring-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.4)] z-10"
              : "border-white/10 hover:border-white/30"
          )}
        >
          <img 
            src={`https://flagcdn.com/w40/${lang.flagCode}.png`} 
            srcSet={`https://flagcdn.com/w80/${lang.flagCode}.png 2x`} 
            alt={lang.name} 
            className="w-full h-full object-contain" 
          />
        </button>
      ))}
    </div>
  );
};
