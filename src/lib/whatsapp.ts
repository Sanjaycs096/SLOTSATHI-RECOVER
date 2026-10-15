import { Appointment, Provider, Service, WaitlistEntry } from '@/types';

/**
 * Clean phone number for WhatsApp deep link (digits only, country code included)
 * Default to India (+91) if not explicitly prefixed
 */
export function formatWhatsAppPhone(phone: string): string {
  let cleaned = phone.replace(/[^\d]/g, '');
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }
  return cleaned;
}

/**
 * Generate human-readable date and time formatted in Indian Standard Time / local format
 */
export function formatDateTime(isoString: string): { dateStr: string; timeStr: string } {
  const d = new Date(isoString);
  const dateStr = d.toLocaleDateString('en-IN', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const timeStr = d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return { dateStr, timeStr };
}

/**
 * Generate the prefilled WhatsApp offer message and direct deep link
 */
export function generateWhatsAppOffer(params: {
  provider: Provider;
  service: Service;
  slot: Appointment;
  candidate: WaitlistEntry;
  offerToken: string;
  baseUrl: string;
  expiryMinutes?: number;
}): {
  rawMessage: string;
  encodedUrl: string;
  offerLink: string;
} {
  const { provider, service, slot, candidate, offerToken, baseUrl, expiryMinutes = 120 } = params;
  const { dateStr, timeStr } = formatDateTime(slot.start_time);
  const offerLink = `${baseUrl.replace(/\/$/, '')}/offer/${offerToken}`;

  const rawMessage = [
    `👋 Hello ${candidate.customer_name}!`,
    ``,
    `Great news from *${provider.name}* (${provider.title})!`,
    `A priority recovery slot has just opened up for:`,
    `📚 *${service.title}* (${service.subject})`,
    `🗓️ *${dateStr}* at *${timeStr}*`,
    `⏱️ Duration: ${service.duration_minutes} mins | Fee: ₹${slot.price_inr}`,
    ``,
    `Because you are on our priority waitlist, this slot is temporarily reserved for you for the next ${expiryMinutes} minutes.`,
    ``,
    `👉 *Tap to claim this recovered slot:*`,
    `${offerLink}`,
    ``,
    `_If this timing does not work for you, no worries at all! No action is needed and you will remain on our waitlist for upcoming slots._`,
  ].join('\n');

  const phone = formatWhatsAppPhone(candidate.customer_phone);
  const encodedUrl = `https://wa.me/${phone}?text=${encodeURIComponent(rawMessage)}`;

  return {
    rawMessage,
    encodedUrl,
    offerLink,
  };
}

/**
 * Generate WhatsApp reminder or booking confirmation link
 */
export function generateWhatsAppBookingNotice(params: {
  provider: Provider;
  service: Service;
  appointment: Appointment;
  baseUrl: string;
}): {
  rawMessage: string;
  encodedUrl: string;
} {
  const { provider, service, appointment, baseUrl } = params;
  const { dateStr, timeStr } = formatDateTime(appointment.start_time);
  const cancelLink = `${baseUrl.replace(/\/$/, '')}/cancel/${appointment.cancellation_token}`;

  const rawMessage = [
    `✅ *Booking Confirmed with ${provider.name}*`,
    ``,
    `Hi ${appointment.customer_name}, your 1-on-1 session is confirmed:`,
    `📚 *${service.title}*`,
    `🗓️ *${dateStr}* at *${timeStr}*`,
    `📍 Mode: ${provider.location}`,
    `💰 Session Fee: ₹${appointment.price_inr}`,
    ``,
    `Need to reschedule or cancel? Use your secure link:`,
    `${cancelLink}`,
    ``,
    `See you in class!`,
  ].join('\n');

  const phone = formatWhatsAppPhone(appointment.customer_phone);
  const encodedUrl = `https://wa.me/${phone}?text=${encodeURIComponent(rawMessage)}`;

  return {
    rawMessage,
    encodedUrl,
  };
}
