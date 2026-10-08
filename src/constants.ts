import { Counselor, Company } from './types';

export const DUMMY_COMPANIES: Company[] = [
  { company_code: 'HD-001', name: '현대중공업' },
  { company_code: 'HD-002', name: '현대미포조선' },
  { company_code: 'HD-003', name: '현대삼호중공업' },
];

export const COUNTRIES = ['한국', '네팔', '베트남', '태국', '우즈베키스탄', '인도네시아', '스리랑카'];

export const COUNTRY_COLORS: Record<string, { bg: string, text: string, border: string }> = {
  '한국': { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20' },
  '네팔': { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
  '베트남': { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20' },
  '태국': { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  '우즈베키스탄': { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20' },
  '인도네시아': { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
  '스리랑카': { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' },
};

export const DUMMY_COUNSELORS: (Counselor & { country: string })[] = [
  { id: 'cs1', name: '네팔 A', languages: ['네팔어'], country: '네팔' },
  { id: 'cs2', name: '네팔 B', languages: ['네팔어'], country: '네팔' },
  { id: 'cs3', name: '베트남 A', languages: ['베트남어'], country: '베트남' },
  { id: 'cs4', name: '베트남 B', languages: ['베트남어'], country: '베트남' },
  { id: 'cs5', name: '베트남 C', languages: ['베트남어'], country: '베트남' },
  { id: 'cs6', name: '태국 A', languages: ['태국어'], country: '태국' },
  { id: 'cs7', name: '태국 B', languages: ['태국어'], country: '태국' },
  { id: 'cs8', name: '우즈벡 A', languages: ['우즈벡어'], country: '우즈베키스탄' },
  { id: 'cs9', name: '우즈벡 B', languages: ['우즈벡어'], country: '우즈베키스탄' },
  { id: 'cs10', name: '인도네시아 A', languages: ['인도네시아어'], country: '인도네시아' },
  { id: 'cs11', name: '스리랑카 A', languages: ['스리랑카어'], country: '스리랑카' },
];

export interface CategoryGroup {
  group: string;
  items: string[];
}

export const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    group: '근로/노무',
    items: [
      '[근로/노무] 입사/퇴사',
      '[근로/노무] 이직/해고',
      '[근로/노무] 근로계약',
      '[근로/노무] 업무변경',
      '[근로/노무] 근태/휴가/휴직',
      '[근로/노무] 징계/합의',
    ],
  },
  {
    group: '임금/보험',
    items: [
      '[임금/보험] 임금/4대보험',
      '[임금/보험] 자격면허/보험',
    ],
  },
  {
    group: '안전/보건',
    items: [
      '[안전/보건] 산재/사고',
      '[안전/보건] 안전사고',
      '[안전/보건] 건강/의료',
    ],
  },
  {
    group: '체류/비자',
    items: [
      '[체류/비자] 비자',
      '[체류/비자] 사회통합/토픽',
    ],
  },
  {
    group: '생활/고충',
    items: [
      '[생활/고충] 사내문제/갈등',
      '[생활/고충] 숙소/통신/금융',
      '[생활/고충] 생활고충상담',
      '[생활/고충] 규정위반/범죄',
    ],
  },
  {
    group: '교육',
    items: [
      '[교육] 입문교육/신규입사자',
      '[교육] 직무교육',
      '[교육] 안전교육',
    ],
  },
  {
    group: '번역',
    items: [
      '[번역] 교육자료 번역',
      '[번역] 안내자료 번역',
    ],
  },
  {
    group: '통역',
    items: [
      '[통역] 현장점검활동 통역',
    ],
  },
  {
    group: '행사/봉사',
    items: [
      '[행사/봉사] 사내행사',
      '[행사/봉사] 사외행사',
      '[행사/봉사] 봉사활동',
    ],
  },
  {
    group: '기타',
    items: [
      '기타',
    ],
  },
];

export const CATEGORIES = CATEGORY_GROUPS.flatMap(g => g.items);

/**
 * 카테고리 접두어([교육], [근로/노무] 등)를 분리하거나 정규화하는 유틸리티
 */
export const normalizeCategory = (cat?: string): string => {
  if (!cat) return '';
  if (CATEGORIES.includes(cat)) return cat;
  const found = CATEGORIES.find(c => c.endsWith(cat) || c.includes(cat));
  return found || cat;
};

/**
 * 기존 레거시 티켓(카테고리가 '기타', '비자/체류', '임금체불' 등이거나 상세 내용에 상담 내용이 있는 경우)을
 * 체계적인 세분화 카테고리로 정밀 자동 분류하는 함수
 */
export const resolveTicketCategory = (ticket: { category?: string; summary?: string; action_result?: string; details?: string }): string => {
  const cat = (ticket.category || '').trim();
  const text = `${cat} ${ticket.summary || ''} ${ticket.action_result || ''} ${ticket.details || ''}`.toLowerCase();

  // 이미 세분화 접두어가 있는 경우
  if (cat.startsWith('[') && CATEGORIES.includes(cat)) {
    return cat;
  }

  // 1. 비자 / 체류 / 사회통합
  if (cat === '비자/체류' || cat === '비자' || text.includes('체류자격') || text.includes('외국인등록') || text.includes('kiip') || text.includes('사회통합') || text.includes('토픽') || text.includes('비자') || text.includes('가족 초청') || text.includes('초청')) {
    if (text.includes('kiip') || text.includes('사회통합') || text.includes('토픽')) {
      return '[체류/비자] 사회통합/토픽';
    }
    return '[체류/비자] 비자';
  }

  // 2. 임금 / 4대보험 / 퇴직금
  if (cat === '임금체불' || cat === '임금/4대보험' || text.includes('퇴직금') || text.includes('급여') || text.includes('임금') || text.includes('주휴') || text.includes('수당') || text.includes('건강보험') || text.includes('국민연금') || text.includes('4대보험') || text.includes('피부양자')) {
    return '[임금/보험] 임금/4대보험';
  }

  // 3. 자격면허 / 보험
  if (text.includes('자격면허') || text.includes('운전면허') || text.includes('자격증')) {
    return '[임금/보험] 자격면허/보험';
  }

  // 4. 산재 / 사고 / 건강 / 의료
  if (cat === '산재/치료' || cat === '산재/사고' || text.includes('산재') || text.includes('부상') || text.includes('골절') || text.includes('사고') || text.includes('안전사고') || text.includes('입원') || text.includes('병원') || text.includes('치료') || text.includes('진료') || text.includes('고열') || text.includes('신장') || text.includes('통증') || text.includes('의료')) {
    if (text.includes('부상') || text.includes('골절') || text.includes('산재') || text.includes('사고')) {
      return '[안전/보건] 산재/사고';
    }
    return '[안전/보건] 건강/의료';
  }

  // 5. 기숙사 / 숙소 / 통신 / 금융
  if (cat === '기숙사' || text.includes('기숙사') || text.includes('숙소') || text.includes('아파트') || text.includes('임대') || text.includes('통신') || text.includes('유심') || text.includes('통장') || text.includes('은행') || text.includes('금융')) {
    return '[생활/고충] 숙소/통신/금융';
  }

  // 6. 사내문제 / 갈등
  if (text.includes('폭언') || text.includes('갈등') || text.includes('괴롭힘') || text.includes('동료') || text.includes('반장') || text.includes('사내문제')) {
    return '[생활/고충] 사내문제/갈등';
  }

  // 7. 규정위반 / 범죄
  if (text.includes('범죄') || text.includes('음주') || text.includes('무면허') || text.includes('경찰') || text.includes('벌금') || text.includes('규정위반')) {
    return '[생활/고충] 규정위반/범죄';
  }

  // 8. 근로계약 / 입퇴사 / 이직 / 근태
  if (text.includes('퇴사') || text.includes('입사') || text.includes('이탈') || text.includes('계약해지')) {
    return '[근로/노무] 입사/퇴사';
  }
  if (text.includes('이직') || text.includes('사업장 변경') || text.includes('해고')) {
    return '[근로/노무] 이직/해고';
  }
  if (text.includes('근로계약') || text.includes('계약서') || text.includes('계약기간')) {
    return '[근로/노무] 근로계약';
  }
  if (text.includes('휴가') || text.includes('연차') || text.includes('결근') || text.includes('휴직')) {
    return '[근로/노무] 근태/휴가/휴직';
  }
  if (text.includes('징계') || text.includes('합의')) {
    return '[근로/노무] 징계/합의';
  }
  if (text.includes('업무변경') || text.includes('보직변경')) {
    return '[근로/노무] 업무변경';
  }

  // 9. 교육 / 번역 / 통역 / 행사
  if (text.includes('교육') && text.includes('안전')) return '[교육] 안전교육';
  if (text.includes('교육') && (text.includes('신규') || text.includes('입문') || text.includes('입사자'))) return '[교육] 입문교육/신규입사자';
  if (text.includes('교육')) return '[교육] 직무교육';
  if (text.includes('번역')) return '[번역] 안내자료 번역';
  if (text.includes('통역')) return '[통역] 현장점검활동 통역';
  if (text.includes('봉사')) return '[행사/봉사] 봉사활동';
  if (text.includes('행사')) return '[행사/봉사] 사내행사';

  // 10. 일상 문의 및 안내
  if (cat === '기타' || !cat) {
    if (text.includes('예매') || text.includes('버스') || text.includes('생활') || text.includes('문의') || text.includes('안내') || text.includes('상담')) {
      return '[생활/고충] 생활고충상담';
    }
  }

  // 매칭되는 항목이 있으면 normalizeCategory 시도
  const normalized = normalizeCategory(cat);
  if (normalized && normalized !== '기타') return normalized;

  return '[생활/고충] 생활고충상담';
};

export const getCategoryBadge = (cat?: string): { group: string; name: string } => {
  if (!cat) return { group: '기타', name: '-' };
  const m = cat.match(/^\[([^\]]+)\]\s*(.+)$/);
  if (m) {
    return { group: m[1], name: m[2] };
  }
  return { group: '일반', name: cat };
};

export const REQUESTER_TYPES = [
  '근로자 본인',
  '직영 부서',
  '협력사 담당자',
  '기타'
];

export const VISA_TYPES = [
  'E-7',
  'E-9',
  'F-2',
  'F-4',
  'F-5',
  'F-6',
  'G-1',
  'H-2',
  '기타'
];

export const WORK_DUTY_TYPES = [
  '연차',
  '반차',
  '신규입사자 교육/통역',
  '직무교육',
  '안전교육',
  '현장점검활동',
  '교육자료 번역',
  '안내자료 번역',
  '사내행사 통역',
  '사외행사 통역',
  '봉사활동 지원',
  '외근',
  '기타 (직접 입력)'
];

/**
 * 국가명 앞의 불필요한 영문 약자(예: vn베트남, VN 베트남, np네팔 등)를 정리하여
 * 순수 한글 국가명만 반환하는 함수
 */
export const cleanCountryName = (country?: string): string => {
  if (!country) return '-';
  const trimmed = country.trim();
  // 영문 1~4자 약자(대소문자 무관) + 공백/특수문자 뒤 한글이 올 경우 한글만 추출
  const cleaned = trimmed.replace(/^[a-zA-Z]{1,4}[\s_·\-\/]*([가-힣]+)/, '$1').trim();
  return cleaned || trimmed;
};
