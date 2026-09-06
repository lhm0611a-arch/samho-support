/**
 * Helper to identify Counselor vs Admin accounts based on company ID rules.
 * Rule: Only IDs starting with 'cs' (case-insensitive) are counselors.
 * All other IDs are administrator/manager accounts.
 */

export const isCounselorId = (id?: string | null): boolean => {
  if (!id) return false;
  return id.trim().toLowerCase().startsWith('cs');
};

export const isAdminId = (id?: string | null): boolean => {
  if (!id) return false;
  return !isCounselorId(id);
};

export const formatCounselorId = (id?: string | null): string => {
  if (!id) return '';
  return id.trim();
};
