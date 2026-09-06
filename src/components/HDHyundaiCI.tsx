import React, { useState } from 'react';

interface HDHyundaiCIProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  theme?: 'dark' | 'light';
  subtitle?: string;
  hideSubtitle?: boolean;
  className?: string;
  onClick?: () => void;
}

export const HDHyundaiCI: React.FC<HDHyundaiCIProps> = ({
  size = 'md',
  theme = 'dark',
  subtitle = '외국인지원센터',
  hideSubtitle = false,
  className = '',
  onClick
}) => {
  const [imageError, setImageError] = useState(false);

  // Size specifications tailored for the 4365x828 aspect ratio (~5.27:1)
  const sizeConfig = {
    sm: {
      imgHeight: 'h-5 md:h-6', // 20~24px
      subText: 'text-[10px]',
      gap: 'gap-2',
      dividerHeight: 'h-3.5',
    },
    md: {
      imgHeight: 'h-7 md:h-8', // 28~32px
      subText: 'text-xs',
      gap: 'gap-2.5',
      dividerHeight: 'h-4',
    },
    lg: {
      imgHeight: 'h-9 md:h-11', // 36~44px
      subText: 'text-xs md:text-sm',
      gap: 'gap-3',
      dividerHeight: 'h-5',
    },
    xl: {
      imgHeight: 'h-12 md:h-14', // 48~56px
      subText: 'text-sm md:text-base',
      gap: 'gap-3.5',
      dividerHeight: 'h-6',
    },
  };

  const currentSize = sizeConfig[size];
  const isLight = theme === 'light';

  return (
    <div 
      className={`inline-flex items-center select-none ${currentSize.gap} ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      {/* Official HD Hyundai Samho CI Image */}
      {!imageError ? (
        <img
          src="/ci.png"
          alt="HD현대삼호"
          onError={() => setImageError(true)}
          className={`object-contain shrink-0 ${currentSize.imgHeight} w-auto max-w-full drop-shadow-sm transition-opacity duration-200 ${
            isLight ? 'brightness-0 opacity-90' : 'opacity-100'
          } print:brightness-0 print:opacity-100`}
        />
      ) : (
        /* Fallback Vector Graphic */
        <div className="flex items-center gap-2">
          <svg width="32" height="32" viewBox="0 0 64 64" fill="none" className="shrink-0">
            <path d="M38 6 L60 32 L38 58 Z" fill="#00A859" />
            <path d="M6 6 L32 6 L32 30 Z" fill="#003770" />
            <path d="M6 58 L32 58 L32 34 Z" fill="#005BAA" />
            <path d="M8 32 L32 32 L20 44 Z" fill="#00A859" opacity="0.9" />
          </svg>
          <span className="font-extrabold tracking-tight text-white">HD현대삼호</span>
        </div>
      )}

      {/* Subtitle with vertical divider */}
      {!hideSubtitle && subtitle && (
        <div className="flex items-center gap-2 shrink-0">
          <span 
            className={`w-[1px] ${currentSize.dividerHeight} ${
              isLight ? 'bg-slate-400' : 'bg-white/30'
            } print:bg-slate-400`} 
          />
          <span 
            className={`${currentSize.subText} font-bold tracking-tight ${
              isLight ? 'text-[#002c5f]' : 'text-cyan-300'
            } print:text-slate-800`}
          >
            {subtitle}
          </span>
        </div>
      )}
    </div>
  );
};
