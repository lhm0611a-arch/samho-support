import React, { useEffect, useState, useMemo } from 'react';
import { useBackgroundStore } from '../store/backgroundStore';
import { Play, Pause, ChevronLeft, ChevronRight, Image as ImageIcon, Sparkles } from 'lucide-react';

interface Props {
  showControls?: boolean;
}

export const BackgroundCarousel: React.FC<Props> = ({ showControls = true }) => {
  const {
    slides,
    intervalSeconds,
    currentSlideIndex,
    nextSlide,
    prevSlide,
    setCurrentSlideIndex,
    setIntervalSeconds,
    loadInitialSlides
  } = useBackgroundStore();

  const [isWidgetHovered, setIsWidgetHovered] = useState(false);

  // Sync slides from server on mount
  useEffect(() => {
    loadInitialSlides();
  }, [loadInitialSlides]);

  // Filter to only enabled slides
  const enabledSlides = useMemo(() => {
    return slides.filter((s) => s.enabled);
  }, [slides]);

  // Ensure currentSlideIndex points to an existing slide
  const safeIndex = currentSlideIndex < slides.length ? currentSlideIndex : 0;
  const currentSlide = slides[safeIndex] || slides[0];

  // Automatic slide rotation
  useEffect(() => {
    if (intervalSeconds <= 0 || enabledSlides.length <= 1) {
      return;
    }

    const timer = setInterval(() => {
      nextSlide();
    }, intervalSeconds * 1000);

    return () => clearInterval(timer);
  }, [intervalSeconds, enabledSlides.length, nextSlide]);

  return (
    <>
      {/* Background Slides Layer */}
      <div 
        id="app-background-carousel-layer"
        className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none bg-[#020b18]"
        aria-hidden="true"
      >
        {slides.map((slide, idx) => {
          const isActive = idx === safeIndex;
          return (
            <div
              key={slide.id}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out bg-cover bg-center bg-no-repeat ${
                isActive ? 'opacity-100 scale-100' : 'opacity-0 scale-105 pointer-events-none'
              }`}
              style={{
                backgroundImage: `url("${slide.url}")`,
                transitionProperty: 'opacity, transform',
                transitionDuration: '1200ms',
                transform: isActive ? 'scale(1)' : 'scale(1.03)'
              }}
            />
          );
        })}

        {/* Bright & Clear Yard Landscape Overlay: Allows yard photos, crane silhouettes, and counselor portraits to be vividly visible */}
        <div 
          className="absolute inset-0 bg-gradient-to-b from-[#020b18]/20 via-[#031326]/30 to-[#020b18]/45" 
        />
        
        {/* Soft edge vignette to focus center content without darkening photos */}
        <div 
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(2,11,24,0.35)_100%)]" 
        />
      </div>

      {/* Interactive Floating Slideshow Control Bar (Bottom Right) */}
      {showControls && (
        <div
          id="bg-slideshow-quick-controller"
          onMouseEnter={() => setIsWidgetHovered(true)}
          onMouseLeave={() => setIsWidgetHovered(false)}
          className={`fixed bottom-4 right-4 z-40 flex items-center gap-2 bg-[#051833]/90 hover:bg-[#071f40]/95 backdrop-blur-md border border-cyan-500/30 hover:border-cyan-400/60 rounded-full px-3 py-1.5 shadow-2xl transition-all duration-300 text-xs text-gray-200 ${
            isWidgetHovered ? 'opacity-100 scale-100' : 'opacity-70 hover:opacity-100'
          }`}
          title="배경 슬라이드쇼 간편 컨트롤러"
        >
          {/* Current Slide Info */}
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-cyan-300 pr-1.5 border-r border-white/10">
            <ImageIcon className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="truncate max-w-[120px]" title={currentSlide?.name}>
              {currentSlide?.name || '야드 배경'}
            </span>
            <span className="text-[10px] text-gray-400 ml-0.5">
              ({safeIndex + 1}/{slides.length})
            </span>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-1">
            <button
              id="bg-slide-prev-btn"
              type="button"
              onClick={prevSlide}
              className="p-1 rounded-full hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
              title="이전 사진"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {/* Play / Pause Toggle */}
            <button
              id="bg-slide-play-pause-btn"
              type="button"
              onClick={() => setIntervalSeconds(intervalSeconds > 0 ? 0 : 5)}
              className={`p-1 rounded-full transition-colors ${
                intervalSeconds > 0
                  ? 'text-cyan-400 hover:bg-cyan-500/20'
                  : 'text-amber-400 hover:bg-amber-500/20'
              }`}
              title={intervalSeconds > 0 ? '슬라이드쇼 일시 정지' : '슬라이드쇼 시작 (5초)'}
            >
              {intervalSeconds > 0 ? (
                <Pause className="w-3.5 h-3.5" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
            </button>

            <button
              id="bg-slide-next-btn"
              type="button"
              onClick={nextSlide}
              className="p-1 rounded-full hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
              title="다음 사진"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Speed Preset Switcher (3초 / 5초) */}
          <div className="flex items-center gap-1 pl-1.5 border-l border-white/10">
            <button
              type="button"
              onClick={() => setIntervalSeconds(3)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                intervalSeconds === 3
                  ? 'bg-cyan-500 text-black shadow-sm'
                  : 'text-gray-400 hover:text-cyan-300 hover:bg-white/5'
              }`}
              title="3초마다 자동 회전"
            >
              3초
            </button>
            <button
              type="button"
              onClick={() => setIntervalSeconds(5)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                intervalSeconds === 5
                  ? 'bg-cyan-500 text-black shadow-sm'
                  : 'text-gray-400 hover:text-cyan-300 hover:bg-white/5'
              }`}
              title="5초마다 자동 회전"
            >
              5초
            </button>
          </div>
        </div>
      )}
    </>
  );
};
