import { NextRequest } from 'next/server';

/**
 * Server-side input validation, sanitization, and safe payload parsing for SlotSathi Recover
 */

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const PHONE_REGEX = /^(?:\+?91|0)?[6-9]\d{9}$/;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Safely parse incoming JSON body with Content-Length limits and syntax error handling
 */
export async function parseSafeJson<T = Record<string, unknown>>(
  req: NextRequest,
  maxBytes: number = 65536 // 64 KB default limit
): Promise<{ success: true; data: T } | { success: false; error: string; status: number }> {
  // Check Content-Length if present
  const contentLength = req.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > maxBytes) {
    return {
      success: false,
      error: `Payload too large. Maximum allowed size is ${Math.round(maxBytes / 1024)} KB.`,
      status: 413,
    };
  }

  try {
    const raw = await req.text();
    if (!raw || !raw.trim()) {
      return {
        success: false,
        error: 'Empty request body: JSON payload expected.',
        status: 400,
      };
    }

    if (raw.length > maxBytes) {
      return {
        success: false,
        error: `Payload too large. Maximum allowed size is ${Math.round(maxBytes / 1024)} KB.`,
        status: 413,
      };
    }

    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      return {
        success: false,
        error: 'Malformed JSON payload: JSON object expected.',
        status: 400,
      };
    }

    return { success: true, data: data as T };
  } catch (err) {
    return {
      success: false,
      error: 'Malformed or invalid JSON payload: ' + (err instanceof Error ? err.message : 'Syntax error'),
      status: 400,
    };
  }
}

export function sanitizeString(val: unknown, maxLength: number = 200): string {
  if (typeof val !== 'string') return '';
  return val.trim().replace(/[<>]/g, '').slice(0, maxLength);
}

export function validateEmail(email: unknown): boolean {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim();
  return trimmed.length <= 254 && EMAIL_REGEX.test(trimmed);
}

export function validatePhone(phone: unknown): boolean {
  if (typeof phone !== 'string') return false;
  const digitsOnly = phone.replace(/[^\d+]/g, '');
  return PHONE_REGEX.test(digitsOnly) || digitsOnly.length >= 10;
}

/**
 * Validate that cancellation and recovery-offer tokens cannot be used interchangeably.
 * Supports prefixes: 'cancel', 'cancel-', 'cancel_', 'sec_cancel', 'sec-cancel'.
 */
export function validateCancellationToken(token: string | null | undefined): { valid: boolean; error?: string } {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Cancellation token is required.' };
  }
  const t = token.trim();
  if (t.startsWith('rec') || t.startsWith('offer') || t.startsWith('sec_offer') || t.startsWith('sec-offer')) {
    return { valid: false, error: 'Invalid token type: Recovery offer tokens cannot be used for appointment cancellation.' };
  }
  if (!t.startsWith('cancel') && !t.startsWith('sec_cancel') && !t.startsWith('sec-cancel')) {
    return { valid: false, error: 'Invalid cancellation token format.' };
  }
  return { valid: true };
}

/**
 * Supports prefixes: 'rec', 'rec-', 'rec_', 'offer', 'offer-', 'offer_', 'sec_offer', 'sec-offer'.
 */
export function validateOfferToken(token: string | null | undefined): { valid: boolean; error?: string } {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Recovery offer token is required.' };
  }
  const t = token.trim();
  if (t.startsWith('cancel') || t.startsWith('sec_cancel') || t.startsWith('sec-cancel')) {
    return { valid: false, error: 'Invalid token type: Cancellation tokens cannot be used as recovery offer tokens.' };
  }
  if (!t.startsWith('rec') && !t.startsWith('offer') && !t.startsWith('sec_offer') && !t.startsWith('sec-offer')) {
    return { valid: false, error: 'Invalid recovery offer token format.' };
  }
  return { valid: true };
}

export function validateBookingInput(body: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];

  const name = sanitizeString(body.customer_name, 100);
  if (!name || name.length < 2) {
    errors.push('Student full name must be at least 2 characters long.');
  }

  if (!validateEmail(body.customer_email)) {
    errors.push('A valid student email address is required.');
  }

  if (!validatePhone(body.customer_phone)) {
    errors.push('A valid 10-digit WhatsApp phone number is required.');
  }

  if (!body.start_time || typeof body.start_time !== 'string') {
    errors.push('Valid slot start time is required.');
  } else {
    const start = new Date(body.start_time);
    if (isNaN(start.getTime())) {
      errors.push('Start time must be a valid ISO date timestamp.');
    }
  }

  if (!body.end_time || typeof body.end_time !== 'string') {
    errors.push('Valid slot end time is required.');
  } else if (body.start_time && typeof body.start_time === 'string') {
    const start = new Date(body.start_time).getTime();
    const end = new Date(body.end_time).getTime();
    if (isNaN(end) || end <= start) {
      errors.push('Slot end time must be chronologically after start time.');
    } else {
      const durationMins = (end - start) / 60000;
      if (durationMins < 15 || durationMins > 480) {
        errors.push('Appointment duration must be between 15 minutes and 8 hours.');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateCancellationReason(reason: unknown): string {
  if (typeof reason !== 'string' || !reason.trim()) {
    return 'Customer initiated cancellation';
  }
  return sanitizeString(reason, 250);
}
