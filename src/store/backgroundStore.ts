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
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'yard-bg3',
    name: 'HD현대삼호 선박 건조 전경 (bg3)',
    url: '/bg3.png',
    enabled: true,
    isDefault: true,
    createdAt: '2026-01-01T00:00:01.000Z'
  },
  {
    id: 'yard-bg4',
    name: 'HD현대삼호 골리앗 크레인 전경 (bg4)',
    url: '/bg4.png',
    enabled: true,
    isDefault: true,
    createdAt: '2026-01-01T00:00:02.000Z'
  },
  {
    id: 'yard-bg5',
    name: 'HD현대삼호 야드 항공 전경 (bg5)',
    url: '/bg5.png',
    enabled: true,
    isDefault: true,
    createdAt: '2026-01-01T00:00:03.000Z'
  }
];

const STORAGE_KEY = 'hd_samho_bg_slides';
const INTERVAL_STORAGE_KEY = 'hd_samho_bg_interval';

// Helper to synchronize slide configuration to backend server so all devices/PCs share identical settings
const syncToServer = async (slides: BackgroundSlide[], interval?: number) => {
  try {
    await fetch('/api/bg-slides/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slides, intervalSeconds: interval })
    });
  } catch (err) {
    console.warn('Failed to sync background config to server:', err);
  }
};

export const useBackgroundStore = create<BackgroundStore>((set, get) => {
  // Load initial from localStorage
  let savedSlides = DEFAULT_SLIDES;
  let savedInterval = 5; // Default 5 seconds

  try {
    const rawSlides = localStorage.getItem(STORAGE_KEY);
    if (rawSlides) {
      const parsed = JSON.parse(rawSlides);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Ensure that DEFAULT_SLIDES (especially new bg3, bg4, bg5) are always present even if an old cache exists
        const mergedInitial = [...parsed];
        for (const def of DEFAULT_SLIDES) {
          if (!mergedInitial.some(m => m.id === def.id || m.url === def.url)) {
            mergedInitial.push(def);
          }
        }
        savedSlides = mergedInitial;
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
    // Also sync to backend so other PCs and devices see the change
    syncToServer(slides, interval ?? get().intervalSeconds);
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
        // Ensure at least default slides remain
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
          const serverSlides: BackgroundSlide[] = data.slides;
          const serverInterval = typeof data.intervalSeconds === 'number' ? data.intervalSeconds : get().intervalSeconds;

          const merged: BackgroundSlide[] = [];

          // 1. Add all server slides (guaranteed to contain git/public images bg3, bg4, bg5, yard)
          serverSlides.forEach((serverSlide) => {
            merged.push({
              id: serverSlide.id,
              name: serverSlide.name || '조선소 야드 풍경',
              url: serverSlide.url,
              enabled: serverSlide.enabled !== undefined ? serverSlide.enabled : true,
              isDefault: serverSlide.isDefault,
              filename: serverSlide.filename,
              createdAt: serverSlide.createdAt
            });
          });

          // 2. Make sure any default slide isn't missed
          for (const def of DEFAULT_SLIDES) {
            if (!merged.some(m => m.id === def.id || m.url === def.url)) {
              merged.push(def);
            }
          }

          set({ slides: merged, intervalSeconds: serverInterval });
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
            localStorage.setItem(INTERVAL_STORAGE_KEY, serverInterval.toString());
          } catch (e) {}
        }
      } catch (err) {
        console.warn('Could not sync bg-slides from server:', err);
      }
    }
  };
});
