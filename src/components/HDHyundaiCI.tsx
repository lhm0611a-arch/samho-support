import React, { useState } from 'react';

interface HDHyundaiCIProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  layout?: 'horizontal' | 'vertical';
  theme?: 'dark' | 'light';
  subtitle?: string;
  hideSubtitle?: boolean;
  className?: string;
  onClick?: () => void;
}

export const HDHyundaiCI: React.FC<HDHyundaiCIProps> = ({
  size = 'md',
  layout = 'horizontal',
  theme = 'dark',
  subtitle = '외국인지원센터',
  hideSubtitle = false,
  className = '',
  onClick
}) => {
  const [imageError, setImageError] = useState(false);

  // Size specifications tailored for the 4365x828 aspect ratio (~5.27:1)
  const sizeConfig = {
    xs: {
      imgHeight: 'h-4', // 16px (width ~84px)
      subText: 'text-[9.5px]',
      gap: 'gap-1.5',
      dividerHeight: 'h-2.5',
    },
    sm: {
      imgHeight: 'h-5', // 20px (width ~105px)
      subText: 'text-[10px]',
      gap: 'gap-2',
      dividerHeight: 'h-3',
    },
    md: {
      imgHeight: 'h-6 sm:h-7', // 24~28px (width ~126~148px)
      subText: 'text-xs',
      gap: 'gap-2.5',
      dividerHeight: 'h-3.5',
    },
    lg: {
      imgHeight: 'h-8 sm:h-9', // 32~36px (width ~168~190px)
      subText: 'text-xs sm:text-sm',
      gap: 'gap-3',
      dividerHeight: 'h-4',
    },
    xl: {
      imgHeight: 'h-10 sm:h-12', // 40~48px
      subText: 'text-sm sm:text-base',
      gap: 'gap-3.5',
      dividerHeight: 'h-5',
    },
  };

  const currentSize = sizeConfig[size] || sizeConfig.md;
  const isLight = theme === 'light';

  // Fallback vector logo
  const renderFallback = () => (
    <div className="flex items-center gap-1.5 shrink-0">
      <svg width="22" height="22" viewBox="0 0 64 64" fill="none" className="shrink-0">
        <path d="M38 6 L60 32 L38 58 Z" fill="#00A859" />
        <path d="M6 6 L32 6 L32 30 Z" fill="#003770" />
        <path d="M6 58 L32 58 L32 34 Z" fill="#005BAA" />
      </svg>
      <span className="font-extrabold tracking-tight text-white text-sm">HD현대삼호</span>
    </div>
  );

  // Vertical layout: Logo on top, subtitle beneath (best for sidebars & narrow cards)
  if (layout === 'vertical') {
    return (
      <div 
        className={`flex flex-col items-start select-none max-w-full overflow-hidden ${onClick ? 'cursor-pointer' : ''} ${className}`}
        onClick={onClick}
      >
        {!imageError ? (
          <img
            src="/ci.png"
            alt="HD현대삼호"
            onError={() => setImageError(true)}
            className={`object-contain shrink-0 ${currentSize.imgHeight} w-auto max-w-[160px] drop-shadow-sm ${
              isLight ? 'brightness-0 opacity-90' : 'opacity-100'
            } print:brightness-0 print:opacity-100`}
          />
        ) : (
          renderFallback()
        )}

        {!hideSubtitle && subtitle && (
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00A859] shrink-0" />
            <span 
              className={`${currentSize.subText} font-bold tracking-tight whitespace-nowrap truncate ${
                isLight ? 'text-[#002c5f]' : 'text-cyan-300'
              } print:text-slate-800`}
            >
              {subtitle}
            </span>
          </div>
        )}
      </div>
    );
  }

  // Horizontal layout: Logo and subtitle side-by-side with divider
  return (
    <div 
      className={`inline-flex items-center select-none max-w-full overflow-hidden ${currentSize.gap} ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      {!imageError ? (
        <img
          src="/ci.png"
          alt="HD현대삼호"
          onError={() => setImageError(true)}
          className={`object-contain shrink-0 ${currentSize.imgHeight} w-auto max-w-[180px] drop-shadow-sm transition-opacity duration-200 ${
            isLight ? 'brightness-0 opacity-90' : 'opacity-100'
          } print:brightness-0 print:opacity-100`}
        />
      ) : (
        renderFallback()
      )}

      {!hideSubtitle && subtitle && (
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <span 
            className={`w-[1px] ${currentSize.dividerHeight} shrink-0 ${
              isLight ? 'bg-slate-400' : 'bg-white/30'
            } print:bg-slate-400`} 
          />
          <span 
            className={`${currentSize.subText} font-bold tracking-tight whitespace-nowrap shrink-0 ${
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
