// Domain Types for SlotSathi Recover

export type AppointmentStatus = 'confirmed' | 'cancelled' | 'completed' | 'no_show';
export type WaitlistStatus = 'waiting' | 'offered' | 'matched' | 'inactive';
export type OfferStatus = 'pending' | 'accepted' | 'expired' | 'revoked';
export type TimeWindow = 'morning' | 'afternoon' | 'evening';
export type UrgencyLevel = 'normal' | 'high';

export interface Provider {
  id: string;
  name: string;
  title: string;
  bio: string;
  email: string;
  phone: string;
  whatsapp_number: string;
  avatar_url: string;
  slug: string;
  location: string;
  timezone: string;
  hourly_rate_inr: number;
}

export interface Service {
  id: string;
  provider_id: string;
  title: string;
  subject: string;
  duration_minutes: number;
  price_inr: number;
  color: string;
  description: string;
}

export interface Appointment {
  id: string;
  provider_id: string;
  service_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  start_time: string; // ISO string
  end_time: string;   // ISO string
  price_inr: number;
  status: AppointmentStatus;
  cancellation_token: string;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  is_replacement: boolean;
  recovered_from_appointment_id: string | null;
  recovered_at: string | null;
  is_demo_seed: boolean;
  created_at: string;
}

export interface WaitlistEntry {
  id: string;
  provider_id: string;
  service_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  preferred_days: string[];
  preferred_time_windows: TimeWindow[];
  duration_minutes: number;
  urgency: UrgencyLevel;
  status: WaitlistStatus;
  notes: string;
  is_demo_seed: boolean;
  created_at: string;
}

export interface MatchScoreFactor {
  factor: string;
  points: number;
  max_points: number;
  satisfied: boolean;
  description: string;
}

export interface MatchResult {
  waitlist_entry: WaitlistEntry;
  total_score: number;
  is_eligible: boolean;
  ineligibility_reason?: string;
  score_factors: MatchScoreFactor[];
  match_summary: string;
}

export interface RecoveryOffer {
  id: string;
  appointment_id: string;
  waitlist_entry_id: string;
  token: string;
  status: OfferStatus;
  expires_at: string;
  sent_at: string;
  channel: 'whatsapp';
  match_score: number;
  match_reasons: string[];
  whatsapp_url: string;
  accepted_at: string | null;
  created_at: string;
  // Joined fields for display
  customer_name?: string;
  customer_phone?: string;
  service_title?: string;
  slot_start_time?: string;
  slot_end_time?: string;
  price_inr?: number;
}

export interface RecoveryMetrics {
  total_appointments: number;
  active_upcoming: number;
  total_cancelled: number;
  recovered_appointments: number;
  recovery_rate: number; // percentage (0-100)
  total_lost_value_inr: number;
  recovered_value_inr: number;
  average_refill_time_minutes: number;
  pending_offers_count: number;
  waitlist_total_count: number;
}

export interface AcceptanceTestResult {
  id: number;
  name: string;
  description: string;
  passed: boolean;
  status: 'passed' | 'failed' | 'running' | 'pending';
  execution_time_ms: number;
  details: string;
  timestamp: string;
}
