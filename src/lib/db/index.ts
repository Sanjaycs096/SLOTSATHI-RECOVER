import {
  Appointment,
  Provider,
  RecoveryMetrics,
  RecoveryOffer,
  Service,
  WaitlistEntry,
} from '@/types';
import { createInitialSeedData } from './seed';
import { generateWhatsAppOffer } from '../whatsapp';
import { generateSecureToken } from '../security';
import { validateCancellationToken, validateOfferToken } from '../validation';

class AsyncMutex {
  private queue = Promise.resolve();

  async runExclusive<T>(callback: () => Promise<T> | T): Promise<T> {
    let release: () => void;
    const ticket = new Promise<void>((resolve) => {
      release = resolve;
    });
    const previous = this.queue;
    this.queue = previous.then(() => ticket);
    await previous;
    try {
      return await callback();
    } finally {
      release!();
    }
  }
}

const bookingMutex = new AsyncMutex();
const offerAcceptMutex = new AsyncMutex();

// Global in-memory storage singleton that persists across Next.js dev hot-reloads
declare global {
  var __slotsathi_db: {
    provider: Provider;
    services: Service[];
    appointments: Appointment[];
    waitlist: WaitlistEntry[];
    offers: RecoveryOffer[];
  } | undefined;
}

function getStore() {
  if (!globalThis.__slotsathi_db) {
    globalThis.__slotsathi_db = createInitialSeedData();
  }
  return globalThis.__slotsathi_db;
}

export function resetDatabase() {
  globalThis.__slotsathi_db = createInitialSeedData();
  return globalThis.__slotsathi_db;
}

// ---------------------------------------------------------------------------
// Provider & Services
// ---------------------------------------------------------------------------

export async function getProvider(idOrSlug?: string): Promise<Provider> {
  const store = getStore();
  if (!idOrSlug) return store.provider;
  if (store.provider.id === idOrSlug || store.provider.slug === idOrSlug) {
    return store.provider;
  }
  return store.provider;
}

export async function getServices(providerId?: string): Promise<Service[]> {
  const store = getStore();
  if (!providerId) return store.services;
  return store.services.filter((s) => s.provider_id === providerId);
}

export async function getServiceById(id: string): Promise<Service | null> {
  const store = getStore();
  return store.services.find((s) => s.id === id) || null;
}

// ---------------------------------------------------------------------------
// Appointments & Overlap Validation
// ---------------------------------------------------------------------------

export async function getAppointments(providerId?: string): Promise<Appointment[]> {
  const store = getStore();
  const list = providerId
    ? store.appointments.filter((a) => a.provider_id === providerId)
    : store.appointments;

  // Sort by start_time ascending
  return [...list].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );
}

export async function getAppointmentById(id: string): Promise<Appointment | null> {
  const store = getStore();
  return store.appointments.find((a) => a.id === id) || null;
}

export async function getAppointmentByToken(cancellationToken: string): Promise<Appointment | null> {
  const tokenValidation = validateCancellationToken(cancellationToken);
  if (!tokenValidation.valid) {
    return null;
  }
  const store = getStore();
  return store.appointments.find((a) => a.cancellation_token === cancellationToken) || null;
}

/**
 * Check if a time range conflicts with any active confirmed appointment for the provider
 */
export function hasTimeConflict(
  appointments: Appointment[],
  providerId: string,
  startTimeIso: string,
  endTimeIso: string,
  ignoreAppointmentId?: string
): boolean {
  const newStart = new Date(startTimeIso).getTime();
  const newEnd = new Date(endTimeIso).getTime();

  return appointments.some((appt) => {
    if (appt.provider_id !== providerId) return false;
    if (appt.status !== 'confirmed') return false;
    if (ignoreAppointmentId && appt.id === ignoreAppointmentId) return false;

    const existingStart = new Date(appt.start_time).getTime();
    const existingEnd = new Date(appt.end_time).getTime();

    // Overlap condition: start < existingEnd AND end > existingStart
    return newStart < existingEnd && newEnd > existingStart;
  });
}

/**
 * Create a new public booking with strict overlap / double-booking prevention
 */
export async function createBooking(data: {
  provider_id: string;
  service_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  start_time: string;
  end_time: string;
  price_inr?: number;
}): Promise<{ success: boolean; appointment?: Appointment; error?: string }> {
  return bookingMutex.runExclusive(async () => {
    const store = getStore();

    const service = store.services.find((s) => s.id === data.service_id);
    if (!service) {
      return { success: false, error: 'Requested service not found' };
    }

    // Conflict protection: check if slot is already occupied
    const conflict = hasTimeConflict(store.appointments, data.provider_id, data.start_time, data.end_time);
    if (conflict) {
      return {
        success: false,
        error: 'This appointment slot is already reserved or conflicts with an existing booking.',
      };
    }

    const cancellationToken = generateSecureToken('cancel');

    const newAppointment: Appointment = {
      id: `appt-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      provider_id: data.provider_id,
      service_id: data.service_id,
      customer_name: data.customer_name.trim(),
      customer_email: data.customer_email.trim(),
      customer_phone: data.customer_phone.trim(),
      start_time: data.start_time,
      end_time: data.end_time,
      price_inr: data.price_inr ?? service.price_inr,
      status: 'confirmed',
      cancellation_token: cancellationToken,
      cancelled_at: null,
      cancellation_reason: null,
      is_replacement: false,
      recovered_from_appointment_id: null,
      recovered_at: null,
      is_demo_seed: false,
      created_at: new Date().toISOString(),
    };

    store.appointments.push(newAppointment);

    return { success: true, appointment: newAppointment };
  });
}

/**
 * Cancel an appointment using its secure unguessable cancellation token
 * Preserves the original record, updates status to 'cancelled', records timestamp & reason.
 */
export async function cancelAppointment(
  cancellationToken: string,
  reason: string = 'Customer initiated cancellation'
): Promise<{ success: boolean; appointment?: Appointment; error?: string }> {
  const tokenValidation = validateCancellationToken(cancellationToken);
  if (!tokenValidation.valid) {
    return { success: false, error: tokenValidation.error || 'Invalid cancellation token format.' };
  }

  const store = getStore();

  const appointment = store.appointments.find((a) => a.cancellation_token === cancellationToken);
  if (!appointment) {
    return { success: false, error: 'Invalid or expired cancellation link.' };
  }

  if (appointment.status === 'cancelled') {
    return { success: false, error: 'This appointment has already been cancelled.' };
  }

  // Preserve record, update status and cancellation metadata
  appointment.status = 'cancelled';
  appointment.cancelled_at = new Date().toISOString();
  appointment.cancellation_reason = reason;

  return { success: true, appointment };
}

// ---------------------------------------------------------------------------
// Waitlist Management
// ---------------------------------------------------------------------------

export async function getWaitlist(providerId?: string): Promise<WaitlistEntry[]> {
  const store = getStore();
  const list = providerId
    ? store.waitlist.filter((w) => w.provider_id === providerId)
    : store.waitlist;

  return [...list].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

export async function addWaitlistEntry(data: {
  provider_id: string;
  service_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  preferred_days: string[];
  preferred_time_windows: ('morning' | 'afternoon' | 'evening')[];
  duration_minutes?: number;
  urgency?: 'normal' | 'high';
  notes?: string;
}): Promise<WaitlistEntry> {
  const store = getStore();

  const entry: WaitlistEntry = {
    id: `wt-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
    provider_id: data.provider_id,
    service_id: data.service_id,
    customer_name: data.customer_name.trim(),
    customer_email: data.customer_email.trim(),
    customer_phone: data.customer_phone.trim(),
    preferred_days: data.preferred_days.length > 0 ? data.preferred_days : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    preferred_time_windows: data.preferred_time_windows.length > 0 ? data.preferred_time_windows : ['afternoon', 'evening'],
    duration_minutes: data.duration_minutes || 60,
    urgency: data.urgency || 'normal',
    status: 'waiting',
    notes: data.notes || '',
    is_demo_seed: false,
    created_at: new Date().toISOString(),
  };

  store.waitlist.push(entry);
  return entry;
}

// ---------------------------------------------------------------------------
// Recovery Offers
// ---------------------------------------------------------------------------

export async function getOffers(): Promise<RecoveryOffer[]> {
  const store = getStore();
  return [...store.offers].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export async function getOfferByToken(token: string): Promise<RecoveryOffer | null> {
  const tokenValidation = validateOfferToken(token);
  if (!tokenValidation.valid) {
    return null;
  }

  const store = getStore();
  const offer = store.offers.find((o) => o.token === token);
  if (!offer) return null;

  // Auto-expire if past expiry date
  if (offer.status === 'pending' && new Date() > new Date(offer.expires_at)) {
    offer.status = 'expired';
  }

  return offer;
}

/**
 * Generate a recovery offer for a waitlisted student
 */
export async function createRecoveryOffer(params: {
  appointmentId: string;
  waitlistEntryId: string;
  matchScore: number;
  matchReasons: string[];
  baseUrl: string;
  expiryMinutes?: number;
}): Promise<{ success: boolean; offer?: RecoveryOffer; error?: string }> {
  const store = getStore();

  const appointment = store.appointments.find((a) => a.id === params.appointmentId);
  if (!appointment) return { success: false, error: 'Appointment not found.' };
  if (appointment.status !== 'cancelled') {
    return { success: false, error: 'Cannot issue recovery offer for a non-cancelled appointment.' };
  }

  const waitlistEntry = store.waitlist.find((w) => w.id === params.waitlistEntryId);
  if (!waitlistEntry) return { success: false, error: 'Waitlist candidate not found.' };

  const service = store.services.find((s) => s.id === appointment.service_id);
  if (!service) return { success: false, error: 'Service not found.' };

  // Check if candidate already has a pending offer for this slot
  const existingPending = store.offers.find(
    (o) =>
      o.appointment_id === appointment.id &&
      o.waitlist_entry_id === waitlistEntry.id &&
      o.status === 'pending'
  );
  if (existingPending) {
    return { success: true, offer: existingPending };
  }

  const expiryMinutes = typeof params.expiryMinutes === 'number' ? params.expiryMinutes : 120;
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString();
  const token = generateSecureToken('rec');

  const { encodedUrl } = generateWhatsAppOffer({
    provider: store.provider,
    service,
    slot: appointment,
    candidate: waitlistEntry,
    offerToken: token,
    baseUrl: params.baseUrl,
    expiryMinutes,
  });

  const newOffer: RecoveryOffer = {
    id: `off-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
    appointment_id: appointment.id,
    waitlist_entry_id: waitlistEntry.id,
    token,
    status: 'pending',
    expires_at: expiresAt,
    sent_at: new Date().toISOString(),
    channel: 'whatsapp',
    match_score: params.matchScore,
    match_reasons: params.matchReasons,
    whatsapp_url: encodedUrl,
    accepted_at: null,
    created_at: new Date().toISOString(),
    customer_name: waitlistEntry.customer_name,
    customer_phone: waitlistEntry.customer_phone,
    service_title: service.title,
    slot_start_time: appointment.start_time,
    slot_end_time: appointment.end_time,
    price_inr: appointment.price_inr,
  };

  store.offers.push(newOffer);
  waitlistEntry.status = 'offered';

  return { success: true, offer: newOffer };
}

/**
 * Atomically accept a recovery offer
 * Enforces:
 * 1. Valid token
 * 2. Unexpired status
 * 3. Offer must be 'pending'
 * 4. Slot must remain cancelled
 * 5. Slot has not already been refilled by another replacement
 * 6. No overlapping confirmed booking
 * 7. Creates distinct replacement appointment record
 * 8. Preserves original cancelled record
 * 9. Marks offer 'accepted', waitlist 'matched', other slot offers 'revoked'
 */
export async function acceptRecoveryOffer(
  token: string
): Promise<{
  success: boolean;
  replacementAppointment?: Appointment;
  error?: string;
}> {
  const tokenValidation = validateOfferToken(token);
  if (!tokenValidation.valid) {
    return { success: false, error: tokenValidation.error || 'Invalid recovery offer token format.' };
  }

  return offerAcceptMutex.runExclusive(async () => {
    const store = getStore();

    const offer = store.offers.find((o) => o.token === token);
    if (!offer) {
      return { success: false, error: 'Recovery offer not found or token is invalid.' };
    }

    if (offer.status === 'accepted') {
      return { success: false, error: 'This recovery offer has already been accepted.' };
    }

    if (offer.status === 'revoked') {
      return { success: false, error: 'This recovery offer is no longer valid as the slot has been filled.' };
    }

    if (new Date() > new Date(offer.expires_at)) {
      offer.status = 'expired';
      return { success: false, error: 'This recovery offer has expired.' };
    }

    if (offer.status !== 'pending') {
      return { success: false, error: `Offer is in '${offer.status}' state.` };
    }

    // Find original cancelled appointment
    const originalAppt = store.appointments.find((a) => a.id === offer.appointment_id);
    if (!originalAppt || originalAppt.status !== 'cancelled') {
      return {
        success: false,
        error: 'The slot is no longer available for recovery (not in cancelled state).',
      };
    }

    // Explicit duplicate replacement prevention: check if this slot was ALREADY refilled
    const alreadyRecovered = store.appointments.some(
      (a) => a.recovered_from_appointment_id === originalAppt.id && a.status === 'confirmed'
    );
    if (alreadyRecovered) {
      offer.status = 'revoked';
      return {
        success: false,
        error: 'This cancelled appointment slot has already been refilled by a confirmed replacement.',
      };
    }

    // Double-check no other confirmed appointment overlaps this time window
    const conflict = hasTimeConflict(
      store.appointments,
      originalAppt.provider_id,
      originalAppt.start_time,
      originalAppt.end_time
    );
    if (conflict) {
      return {
        success: false,
        error: 'Conflict detected: an active booking already exists in this time slot.',
      };
    }

    // Find waitlist candidate
    const waitlistEntry = store.waitlist.find((w) => w.id === offer.waitlist_entry_id);
    const customerName = waitlistEntry ? waitlistEntry.customer_name : offer.customer_name || 'Replacement Student';
    const customerEmail = waitlistEntry ? waitlistEntry.customer_email : 'student@example.com';
    const customerPhone = waitlistEntry ? waitlistEntry.customer_phone : offer.customer_phone || '+91 99999 99999';

    const cancellationToken = generateSecureToken('cancel_repl');
    const nowIso = new Date().toISOString();

    // Create SEPARATE replacement appointment
    const replacementAppointment: Appointment = {
      id: `appt-repl-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      provider_id: originalAppt.provider_id,
      service_id: originalAppt.service_id,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      start_time: originalAppt.start_time,
      end_time: originalAppt.end_time,
      price_inr: originalAppt.price_inr,
      status: 'confirmed',
      cancellation_token: cancellationToken,
      cancelled_at: null,
      cancellation_reason: null,
      is_replacement: true,
      recovered_from_appointment_id: originalAppt.id,
      recovered_at: nowIso,
      is_demo_seed: false,
      created_at: nowIso,
    };

    store.appointments.push(replacementAppointment);

    // Update offer status
    offer.status = 'accepted';
    offer.accepted_at = nowIso;

    // Revoke any other pending offers for this slot
    for (const otherOffer of store.offers) {
      if (otherOffer.appointment_id === originalAppt.id && otherOffer.id !== offer.id && otherOffer.status === 'pending') {
        otherOffer.status = 'revoked';
      }
    }

    // Update waitlist entry status
    if (waitlistEntry) {
      waitlistEntry.status = 'matched';
    }

    return { success: true, replacementAppointment };
  });
}

// ---------------------------------------------------------------------------
// Recovery Metrics (strictly derived from database records)
// ---------------------------------------------------------------------------

export async function getRecoveryMetrics(providerId?: string): Promise<RecoveryMetrics> {
  const store = getStore();
  const appointments = providerId
    ? store.appointments.filter((a) => a.provider_id === providerId)
    : store.appointments;

  const totalAppointments = appointments.length;
  const activeUpcoming = appointments.filter(
    (a) => a.status === 'confirmed' && new Date(a.end_time) > new Date()
  ).length;

  const cancelledAppointments = appointments.filter((a) => a.status === 'cancelled');
  const totalCancelled = cancelledAppointments.length;

  // Replacements confirmed
  const replacements = appointments.filter(
    (a) => a.is_replacement && a.status === 'confirmed'
  );
  const recoveredAppointments = replacements.length;

  // Recovery Rate: recovered / total_cancelled
  const recoveryRate = totalCancelled > 0 ? (recoveredAppointments / totalCancelled) * 100 : 0;

  // Recovered Value in INR
  const recoveredValueInr = replacements.reduce((sum, a) => sum + a.price_inr, 0);

  // Total Lost Value INR (cancelled appointments that have not been recovered)
  const recoveredOriginalIds = new Set(
    replacements.map((r) => r.recovered_from_appointment_id).filter(Boolean)
  );
  const unrecoveredCancelled = cancelledAppointments.filter(
    (c) => !recoveredOriginalIds.has(c.id)
  );
  const totalLostValueInr = unrecoveredCancelled.reduce((sum, a) => sum + a.price_inr, 0);

  // Average refill time calculation
  let totalRefillMinutes = 0;
  let refillCount = 0;

  for (const repl of replacements) {
    if (repl.recovered_from_appointment_id && repl.recovered_at) {
      const orig = cancelledAppointments.find((c) => c.id === repl.recovered_from_appointment_id);
      if (orig && orig.cancelled_at) {
        const cancelledTime = new Date(orig.cancelled_at).getTime();
        const recoveredTime = new Date(repl.recovered_at).getTime();
        const diffMinutes = Math.max(1, Math.round((recoveredTime - cancelledTime) / (1000 * 60)));
        totalRefillMinutes += diffMinutes;
        refillCount++;
      }
    }
  }

  // Correct calculation: 0 minutes if no refills exist (never hardcoded to 45!)
  const averageRefillTimeMinutes = refillCount > 0 ? Math.round(totalRefillMinutes / refillCount) : 0;

  const pendingOffersCount = store.offers.filter((o) => o.status === 'pending').length;
  const waitlistTotalCount = store.waitlist.filter((w) => w.status === 'waiting').length;

  return {
    total_appointments: totalAppointments,
    active_upcoming: activeUpcoming,
    total_cancelled: totalCancelled,
    recovered_appointments: recoveredAppointments,
    recovery_rate: Math.round(recoveryRate * 10) / 10,
    total_lost_value_inr: totalLostValueInr,
    recovered_value_inr: recoveredValueInr,
    average_refill_time_minutes: averageRefillTimeMinutes,
    pending_offers_count: pendingOffersCount,
    waitlist_total_count: waitlistTotalCount,
  };
}
