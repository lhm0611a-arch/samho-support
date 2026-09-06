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

export const CATEGORIES = ['임금체불', '비자/체류', '폭언/폭행', '산재/치료', '기숙사', '정서/심리', '기타'];
