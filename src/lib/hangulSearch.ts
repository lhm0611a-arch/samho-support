import * as Hangul from 'hangul-js';
import { Company } from '../types';

const CHO_HANGUL = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ',
  'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ',
  'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
];

export function getChosung(str: string): string {
  let result = "";
  for(let i=0; i<str.length; i++) {
    const code = str.charCodeAt(i) - 44032;
    if(code > -1 && code < 11172) {
      result += CHO_HANGUL[Math.floor(code / 588)];
    } else {
      result += str.charAt(i);
    }
  }
  return result;
}

export const searchCompanies = (companies: Company[], query: string): Company[] => {
  if (!query) return [];
  
  const searcher = new Hangul.Searcher(query);
  const isPureChosung = query.split('').every(char => CHO_HANGUL.includes(char) || char === ' ');

  return companies.filter(company => {
    if (company.name.includes(query)) return true;
    
    if (isPureChosung) {
      const companyChosung = getChosung(company.name);
      return companyChosung.includes(query);
    }
    
    return searcher.search(company.name) >= 0;
  });
};

export function debounce<T extends (...args: any[]) => void>(func: T, wait: number): T {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return function(this: any, ...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      func.apply(this, args);
    }, wait);
  } as T;
}
