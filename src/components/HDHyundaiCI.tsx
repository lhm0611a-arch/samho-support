import React from 'react';

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
  // Dimension and typography mapping
  const sizeConfig = {
    sm: {
      symbolWidth: 26,
      symbolHeight: 26,
      titleText: 'text-sm font-bold',
      hdText: 'text-base font-extrabold',
      subText: 'text-[9.5px]',
      gap: 'gap-2',
      dividerHeight: 'h-2.5',
    },
    md: {
      symbolWidth: 32,
      symbolHeight: 32,
      titleText: 'text-base font-bold',
      hdText: 'text-lg font-extrabold',
      subText: 'text-[11px]',
      gap: 'gap-2.5',
      dividerHeight: 'h-3',
    },
    lg: {
      symbolWidth: 42,
      symbolHeight: 42,
      titleText: 'text-xl font-bold tracking-tight',
      hdText: 'text-2xl font-black',
      subText: 'text-xs',
      gap: 'gap-3.5',
      dividerHeight: 'h-3.5',
    },
    xl: {
      symbolWidth: 54,
      symbolHeight: 54,
      titleText: 'text-2xl sm:text-3xl font-bold tracking-tight',
      hdText: 'text-3xl sm:text-4xl font-black',
      subText: 'text-sm',
      gap: 'gap-4',
      dividerHeight: 'h-4',
    },
  };

  const currentSize = sizeConfig[size];
  const isLight = theme === 'light';

  return (
    <div 
      className={`inline-flex items-center select-none ${currentSize.gap} ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      {/* Official HD Hyundai Forward Mark Geometry */}
      <svg 
        width={currentSize.symbolWidth} 
        height={currentSize.symbolHeight} 
        viewBox="0 0 64 64" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 drop-shadow-sm"
      >
        {/* Vibrant Emerald Green Forward Arrow (Growth & Future) */}
        <path d="M38 6 L60 32 L38 58 Z" fill="#00A859" />
        {/* Deep Navy Top Wing */}
        <path d="M6 6 L32 6 L32 30 Z" fill="#003770" />
        {/* Ocean Blue Bottom Wing */}
        <path d="M6 58 L32 58 L32 34 Z" fill="#005BAA" />
        {/* Dynamic Center Wedge */}
        <path d="M8 32 L32 32 L20 44 Z" fill="#00A859" opacity="0.9" />
      </svg>

      {/* Brand Typography */}
      <div className="flex flex-col justify-center leading-none">
        <div className="flex items-baseline tracking-tight">
          <span className={`${currentSize.hdText} tracking-tighter ${isLight ? 'text-[#002244]' : 'text-white'}`}>
            HD
          </span>
          <span className={`ml-1 ${currentSize.titleText} ${isLight ? 'text-[#003770]' : 'text-white'}`}>
            현대삼호
          </span>
        </div>

        {!hideSubtitle && (
          <div className="flex items-center gap-1.5 mt-1">
            <span className={`${currentSize.subText} font-semibold ${isLight ? 'text-[#00a859]' : 'text-[#38bdf8]'}`}>
              {subtitle}
            </span>
            <span className={`w-[1px] ${currentSize.dividerHeight} ${isLight ? 'bg-slate-300' : 'bg-white/20'}`} />
            <span className={`${currentSize.subText} font-medium ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              YARD DX
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
