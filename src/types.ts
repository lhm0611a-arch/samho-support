export interface Worker {
  uid: string;
  name: string;
  nationality: string;
  company_code: string;
  visa_type?: string;
  visa_expiry_date?: string;
  no_show_count?: number;
}

export interface Counselor {
  id: string;
  name: string;
  languages: string[];
  telegram_chat_id?: string;
}

export interface Reservation {
  id?: string;
  worker_id: string;
  counselor_id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  status: 'available' | 'booked' | 'no-show' | 'completed' | 'cancelled';
  overridden?: boolean;
}

export interface CounselingTicket {
  id?: string;
  worker_id: string;
  worker_name?: string;
  emp_id?: string;
  phone_number?: string;
  birth_date?: string;
  country?: string;
  visa_type?: string;
  company_code: string;
  counselor_id?: string;
  category: string;
  status: '접수대기' | '배정완료' | '상담중' | '처리완료' | '주의요망';
  summary: string;
  urgency: 'high' | 'medium' | 'low';
  red_flag: boolean;
  required_action: string;
  created_at?: number;
  reservation_time?: string | number;
  reservation_end_time?: string | number;
  audio_url?: string;
  raw_transcript?: string;
  ai_summary?: {
    summary_text: string;
    keywords: string[];
    urgency: 'high' | 'medium' | 'low';
    risk_flag: boolean;
  };
  action_result?: string;
  worker_password?: string;
  reminder_sent?: boolean;
  reception_notified?: boolean;
  assignment_notified?: boolean;
  counseling_summary?: string;
}

export interface Company {
  id?: string;
  company_code: string;
  name: string;
}

export interface ChatbotLog {
  log_id?: string;
  worker_id: string;
  user_message: string;
  bot_response: string;
  is_resolved: boolean;
}

