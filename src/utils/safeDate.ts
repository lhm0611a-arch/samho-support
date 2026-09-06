import { format } from 'date-fns';

export const safeFormat = (dateVal: any, formatStr: string): string => {
  if (!dateVal) return '';
  let d: Date;
  if (dateVal instanceof Date) {
    d = dateVal;
  } else if (typeof dateVal === 'string') {
    d = new Date(dateVal.replace(' ', 'T'));
  } else {
    d = new Date(dateVal);
  }
  
  if (isNaN(d.getTime())) return '';
  return format(d, formatStr);
};

export const safeDate = (dateVal: any): Date => {
  if (!dateVal) return new Date();
  if (dateVal instanceof Date) return dateVal;
  if (typeof dateVal === 'string') {
    const d = new Date(dateVal.replace(' ', 'T'));
    if (!isNaN(d.getTime())) return d;
  }
  const d = new Date(dateVal);
  if (!isNaN(d.getTime())) return d;
  return new Date();
};
