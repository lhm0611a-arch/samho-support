import React, { useState, useRef, useEffect } from 'react';
import { useBackgroundStore, BackgroundSlide } from '../store/backgroundStore';
import { 
  ImageIcon, Upload, Trash2, Check, Clock, Play, Pause, Eye, 
  Sparkles, RefreshCw, AlertCircle, Plus, Camera
} from 'lucide-react';

export const BackgroundSlideManager: React.FC = () => {
  const {
    slides,
    intervalSeconds,
    currentSlideIndex,
    setIntervalSeconds,
    toggleSlide,
    removeSlide,
    addSlide,
    setCurrentSlideIndex,
    updateSlideName,
    loadInitialSlides
  } = useBackgroundStore();

  const [isUploading, setIsUploading] = useState(false);
  const [slideTitle, setSlideTitle] = useState('');
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState('');
  const [uploadErrorMsg, setUploadErrorMsg] = useState('');
  const [editingSlideId, setEditingSlideId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Countdown timer for live preview
  const [progressPercent, setProgressPercent] = useState(0);

  useEffect(() => {
    if (intervalSeconds <= 0) {
      setProgressPercent(0);
      return;
    }

    const totalMs = intervalSeconds * 1000;
    const intervalStep = 100;
    let elapsedMs = 0;

    const timer = setInterval(() => {
      elapsedMs += intervalStep;
      const pct = Math.min(100, (elapsedMs / totalMs) * 100);
      setProgressPercent(pct);
      if (elapsedMs >= totalMs) {
        elapsedMs = 0;
      }
    }, intervalStep);

    return () => clearInterval(timer);
  }, [intervalSeconds, currentSlideIndex]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadSuccessMsg('');
    setUploadErrorMsg('');

    try {
      const formData = new FormData();
      formData.append('image', file);

      const res = await fetch('/api/upload-bg-slide', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '이미지 업로드에 실패했습니다.');
      }

      const data = await res.json();
      const customName = slideTitle.trim() || data.name.replace(/\.[^/.]+$/, '') || '업로드된 사진';

      const newSlide: BackgroundSlide = {
        id: data.id || `slide-${Date.now()}`,
        name: customName,
        url: data.url,
        enabled: true,
        filename: data.filename,
        createdAt: new Date().toISOString()
      };

      addSlide(newSlide);
      setSlideTitle('');
      setUploadSuccessMsg(`"${customName}" 사진이 슬라이드쇼에 성공적으로 등록되었습니다!`);
      setTimeout(() => setUploadSuccessMsg(''), 5000);
    } catch (err: any) {
      console.error(err);
      setUploadErrorMsg(err.message || '사진 업로드 중 오류가 발생했습니다.');
      setTimeout(() => setUploadErrorMsg(''), 6000);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteSlide = async (slide: BackgroundSlide) => {
    if (slides.length <= 1) {
      alert('슬라이드쇼에는 최소 1장의 이미지가 유지되어야 합니다.');
      return;
    }

    if (!confirm(`"${slide.name}" 사진을 슬라이드쇼에서 삭제하시겠습니까?`)) {
      return;
    }

    try {
      if (slide.filename) {
        await fetch(`/api/bg-slides/${encodeURIComponent(slide.filename)}`, {
          method: 'DELETE'
        });
      }
      removeSlide(slide.id);
    } catch (err) {
      console.error('Failed to delete slide file:', err);
      removeSlide(slide.id);
    }
  };

  const activeSlide = slides[currentSlideIndex] || slides[0];

  return (
    <div className="dx-card p-6 flex flex-col gap-6" id="background-slide-manager-card">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1e3a5f] pb-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 shadow-inner">
            <Camera className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              야드 전경 & 통역위원 단체사진 배경 슬라이드쇼
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-semibold flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                {intervalSeconds > 0 ? `${intervalSeconds}초 자동 전환 중` : '일시 정지'}
              </span>
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              조선소 야드 사진뿐만 아니라 통역위원 개인 프로필, 팀 단체사진을 등록하여 3초/5초 주기로 자동 회전시킵니다.
            </p>
          </div>
        </div>

        {/* Rotation Speed Buttons */}
        <div className="flex items-center gap-1.5 bg-[#031326] p-1.5 rounded-xl border border-[#1e3a5f] self-start md:self-auto">
          <span className="text-[11px] font-semibold text-gray-400 px-2 flex items-center gap-1">
            <Clock className="w-3 h-3 text-cyan-400" /> 전환 주기:
          </span>
          {[
            { sec: 3, label: '3초 회전' },
            { sec: 5, label: '5초 (권장)' },
            { sec: 10, label: '10초' },
            { sec: 0, label: '정지' }
          ].map((opt) => (
            <button
              key={opt.sec}
              type="button"
              onClick={() => setIntervalSeconds(opt.sec)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                intervalSeconds === opt.sec
                  ? 'bg-cyan-500 text-black shadow-md'
                  : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Live Preview Card & Current Slide Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Live Visual Preview */}
        <div className="relative rounded-2xl overflow-hidden border border-cyan-500/30 shadow-2xl h-52 bg-black flex flex-col justify-between group">
          <div 
            className="absolute inset-0 bg-cover bg-center transition-all duration-700 group-hover:scale-105"
            style={{ backgroundImage: `url("${activeSlide?.url}")` }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/60 pointer-events-none" />

          {/* Top badge */}
          <div className="relative z-10 p-3 flex items-center justify-between">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 backdrop-blur-md">
              실시간 화면 배경 프리뷰
            </span>
            <span className="text-[11px] text-gray-300 font-mono">
              {currentSlideIndex + 1} / {slides.length}
            </span>
          </div>

          {/* Bottom title & progress bar */}
          <div className="relative z-10 p-3.5">
            <h4 className="text-sm font-bold text-white truncate drop-shadow-md">
              {activeSlide?.name || '기본 배경'}
            </h4>
            <p className="text-[11px] text-gray-300 mt-0.5">
              전체 화면(대시보드, 통역위원 모드, 관리자 모드)의 백그라운드에 적용됩니다.
            </p>

            {/* Countdown progress bar */}
            {intervalSeconds > 0 && (
              <div className="w-full bg-white/20 h-1.5 rounded-full mt-2.5 overflow-hidden">
                <div 
                  className="bg-cyan-400 h-full rounded-full transition-all duration-100 ease-linear shadow-[0_0_8px_#38bdf8]"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Right: Upload Section */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-[#031326]/80 border border-[#1e3a5f] flex flex-col justify-between gap-4">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Upload className="w-4 h-4 text-cyan-400" />
              새로운 배경 사진 추가 (야드 / 통역사 사진 / 단체사진)
            </h4>
            <p className="text-xs text-gray-400 mt-1">
              조선소 도크 야드, 통역실 전경, 외국인 지원센터 통역위원 단체 기념사진 등을 자유롭게 업로드하세요.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                사진 명칭 (선택 사항)
              </label>
              <input
                type="text"
                value={slideTitle}
                onChange={(e) => setSlideTitle(e.target.value)}
                placeholder="예: 2026 상반기 통역위원단 단체사진, 골리앗 크레인 야드 전경"
                className="w-full bg-black/50 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all border shadow-lg ${
                isUploading
                  ? 'bg-gray-800 text-gray-400 border-gray-700 cursor-not-allowed'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-black border-cyan-400 hover:shadow-cyan-500/20'
              }`}>
                <Plus className="w-4 h-4" />
                {isUploading ? '이미지 업로드 및 저장 중...' : '이미지 파일 선택하여 슬라이드에 추가'}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/jpg"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="hidden"
                />
              </label>
              <span className="text-[11px] text-gray-400">
                지원 포맷: PNG, JPG, JPEG, WEBP (가로형 고화질 권장)
              </span>
            </div>

            {uploadSuccessMsg && (
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-xs text-emerald-400 font-semibold animate-fade-in">
                <Check className="w-4 h-4 shrink-0" />
                <span>{uploadSuccessMsg}</span>
              </div>
            )}

            {uploadErrorMsg && (
              <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2 text-xs text-red-400 font-semibold animate-fade-in">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{uploadErrorMsg}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Slide Gallery Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
            <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
            등록된 슬라이드 사진 목록 ({slides.length}장)
          </h4>
          <span className="text-[11px] text-gray-400">
            체크된 사진만 {intervalSeconds > 0 ? `${intervalSeconds}초마다` : ''} 자동 회전됩니다
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {slides.map((slide, idx) => {
            const isCurrent = idx === currentSlideIndex;
            const isEditing = editingSlideId === slide.id;

            return (
              <div
                key={slide.id}
                className={`relative rounded-xl overflow-hidden border transition-all duration-300 flex flex-col bg-[#051326] ${
                  isCurrent
                    ? 'border-cyan-400 shadow-[0_0_15px_rgba(56,189,248,0.25)] ring-1 ring-cyan-400'
                    : 'border-[#1e3a5f] hover:border-cyan-500/40'
                } ${!slide.enabled ? 'opacity-50 grayscale' : ''}`}
              >
                {/* Thumbnail */}
                <div className="relative h-32 w-full bg-black overflow-hidden group">
                  <img
                    src={slide.url}
                    alt={slide.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

                  {/* Active Indicator Badge */}
                  {isCurrent && (
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500 text-black shadow-md flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-black animate-ping" />
                      현재 표시 중
                    </span>
                  )}

                  {/* Quick Action Button to Show this slide right now */}
                  <button
                    type="button"
                    onClick={() => setCurrentSlideIndex(idx)}
                    className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/70 hover:bg-cyan-600 text-white hover:text-black transition-colors text-[10px] font-semibold backdrop-blur-sm flex items-center gap-1"
                    title="지금 바로 배경으로 적용"
                  >
                    <Eye className="w-3 h-3" /> 보기
                  </button>
                </div>

                {/* Body & Controls */}
                <div className="p-3 flex flex-col justify-between gap-2.5 flex-1">
                  {/* Title editing */}
                  <div>
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={editNameValue}
                          onChange={(e) => setEditNameValue(e.target.value)}
                          className="w-full bg-black/60 border border-cyan-400 rounded px-2 py-0.5 text-xs text-white"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              updateSlideName(slide.id, editNameValue.trim() || slide.name);
                              setEditingSlideId(null);
                            } else if (e.key === 'Escape') {
                              setEditingSlideId(null);
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            updateSlideName(slide.id, editNameValue.trim() || slide.name);
                            setEditingSlideId(null);
                          }}
                          className="p-1 text-cyan-400 hover:text-cyan-300"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-1">
                        <h5
                          className="text-xs font-bold text-white truncate cursor-pointer hover:text-cyan-300 transition-colors"
                          title={`${slide.name} (클릭하여 이름 수정)`}
                          onClick={() => {
                            setEditingSlideId(slide.id);
                            setEditNameValue(slide.name);
                          }}
                        >
                          {slide.name}
                        </h5>
                      </div>
                    )}
                    <span className="text-[10px] text-gray-400 mt-0.5 block">
                      {slide.isDefault ? '조선소 야드 기본 제공' : '사용자 업로드 사진'}
                    </span>
                  </div>

                  {/* Toggle Enabled + Delete */}
                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={slide.enabled}
                        onChange={() => toggleSlide(slide.id)}
                        className="rounded border-gray-600 text-cyan-500 focus:ring-cyan-500 w-3.5 h-3.5 bg-black/40"
                      />
                      <span className="text-[11px] text-gray-300">
                        {slide.enabled ? '회전 포함' : '제외'}
                      </span>
                    </label>

                    <button
                      type="button"
                      onClick={() => handleDeleteSlide(slide)}
                      className="p-1 rounded text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="슬라이드 삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
