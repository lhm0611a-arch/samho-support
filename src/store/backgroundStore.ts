import { create } from 'zustand';

export interface BackgroundSlide {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  isDefault?: boolean;
  filename?: string;
  createdAt?: string;
}

interface BackgroundStore {
  slides: BackgroundSlide[];
  intervalSeconds: number; // 3, 5, 10, or 0 (pause)
  currentSlideIndex: number;
  setSlides: (slides: BackgroundSlide[]) => void;
  addSlide: (slide: BackgroundSlide) => void;
  removeSlide: (id: string) => void;
  toggleSlide: (id: string) => void;
  updateSlideName: (id: string, name: string) => void;
  setIntervalSeconds: (seconds: number) => void;
  setCurrentSlideIndex: (index: number) => void;
  nextSlide: () => void;
  prevSlide: () => void;
  loadInitialSlides: () => Promise<void>;
}

const DEFAULT_SLIDES: BackgroundSlide[] = [
  {
    id: 'yard-default',
    name: 'HD현대삼호 조선소 야드 전경 (기본)',
    url: '/yard.png',
    enabled: true,
    isDefault: true,
    createdAt: new Date().toISOString()
  }
];

const STORAGE_KEY = 'hd_samho_bg_slides';
const INTERVAL_STORAGE_KEY = 'hd_samho_bg_interval';

export const useBackgroundStore = create<BackgroundStore>((set, get) => {
  // Load initial from localStorage
  let savedSlides = DEFAULT_SLIDES;
  let savedInterval = 5; // Default 5 seconds as requested by user ("3초씩 또는 5초씩")

  try {
    const rawSlides = localStorage.getItem(STORAGE_KEY);
    if (rawSlides) {
      const parsed = JSON.parse(rawSlides);
      if (Array.isArray(parsed) && parsed.length > 0) {
        savedSlides = parsed;
      }
    }
    const rawInterval = localStorage.getItem(INTERVAL_STORAGE_KEY);
    if (rawInterval !== null) {
      const parsedInt = parseInt(rawInterval, 10);
      if (!isNaN(parsedInt)) {
        savedInterval = parsedInt;
      }
    }
  } catch (e) {
    console.warn('Failed to load background settings from localStorage:', e);
  }

  const persist = (slides: BackgroundSlide[], interval?: number) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(slides));
      if (typeof interval === 'number') {
        localStorage.setItem(INTERVAL_STORAGE_KEY, interval.toString());
      }
    } catch (e) {
      console.warn('Failed to save background settings to localStorage:', e);
    }
  };

  return {
    slides: savedSlides,
    intervalSeconds: savedInterval,
    currentSlideIndex: 0,

    setSlides: (slides) => {
      set({ slides });
      persist(slides);
    },

    addSlide: (slide) => {
      set((state) => {
        const updated = [...state.slides, slide];
        persist(updated);
        return { slides: updated, currentSlideIndex: updated.length - 1 };
      });
    },

    removeSlide: (id) => {
      set((state) => {
        const updated = state.slides.filter((s) => s.id !== id);
        // Ensure at least default slide remains
        const finalSlides = updated.length > 0 ? updated : DEFAULT_SLIDES;
        persist(finalSlides);
        return {
          slides: finalSlides,
          currentSlideIndex: Math.min(state.currentSlideIndex, finalSlides.length - 1)
        };
      });
    },

    toggleSlide: (id) => {
      set((state) => {
        const updated = state.slides.map((s) =>
          s.id === id ? { ...s, enabled: !s.enabled } : s
        );
        persist(updated);
        return { slides: updated };
      });
    },

    updateSlideName: (id, name) => {
      set((state) => {
        const updated = state.slides.map((s) =>
          s.id === id ? { ...s, name } : s
        );
        persist(updated);
        return { slides: updated };
      });
    },

    setIntervalSeconds: (seconds) => {
      set({ intervalSeconds: seconds });
      persist(get().slides, seconds);
    },

    setCurrentSlideIndex: (index) => {
      const state = get();
      if (index >= 0 && index < state.slides.length) {
        set({ currentSlideIndex: index });
      }
    },

    nextSlide: () => {
      const state = get();
      const enabledIndices = state.slides
        .map((s, idx) => (s.enabled ? idx : -1))
        .filter((idx) => idx !== -1);

      if (enabledIndices.length <= 1) return;

      const currentPos = enabledIndices.indexOf(state.currentSlideIndex);
      const nextPos = (currentPos + 1) % enabledIndices.length;
      set({ currentSlideIndex: enabledIndices[nextPos] });
    },

    prevSlide: () => {
      const state = get();
      const enabledIndices = state.slides
        .map((s, idx) => (s.enabled ? idx : -1))
        .filter((idx) => idx !== -1);

      if (enabledIndices.length <= 1) return;

      const currentPos = enabledIndices.indexOf(state.currentSlideIndex);
      const prevPos = (currentPos - 1 + enabledIndices.length) % enabledIndices.length;
      set({ currentSlideIndex: enabledIndices[prevPos] });
    },

    loadInitialSlides: async () => {
      try {
        const res = await fetch('/api/bg-slides');
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.slides) && data.slides.length > 0) {
          const currentSlides = get().slides;
          const merged = [...currentSlides];

          data.slides.forEach((serverSlide: any) => {
            const exists = merged.some(
              (s) => s.id === serverSlide.id || s.url === serverSlide.url
            );
            if (!exists) {
              merged.push({
                id: serverSlide.id,
                name: serverSlide.name || '업로드된 사진',
                url: serverSlide.url,
                enabled: true,
                filename: serverSlide.filename
              });
            }
          });

          set({ slides: merged });
          persist(merged);
        }
      } catch (err) {
        console.warn('Could not sync bg-slides from server:', err);
      }
    }
  };
});
