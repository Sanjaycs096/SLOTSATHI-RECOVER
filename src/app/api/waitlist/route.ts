import { NextRequest, NextResponse } from 'next/server';
import { addWaitlistEntry, getProvider } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';
import { validateEmail, validatePhone, sanitizeString, parseSafeJson } from '@/lib/validation';

export async function POST(req: NextRequest) {
  try {
    const rateCheck = checkRateLimit(req, 'waitlist_add', { maxTokens: 10, refillRatePerSec: 1 });
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many waitlist submissions. Please wait a moment.' },
        { status: 429, headers: { 'Retry-After': String(rateCheck.resetSec) } }
      );
    }

    const parsed = await parseSafeJson<Record<string, unknown>>(req);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error },
        { status: parsed.status }
      );
    }
    const body = parsed.data;
    const {
      provider_id,
      service_id,
      customer_name,
      customer_email,
      customer_phone,
      preferred_days,
      preferred_time_windows,
      duration_minutes,
      urgency,
      notes,
    } = body as {
      provider_id?: string;
      service_id?: string;
      customer_name?: string;
      customer_email?: string;
      customer_phone?: string;
      preferred_days?: string[];
      preferred_time_windows?: ('morning' | 'afternoon' | 'evening')[];
      duration_minutes?: number;
      urgency?: 'normal' | 'high';
      notes?: string;
    };

    const sanitizedName = sanitizeString(customer_name, 100);
    if (!sanitizedName || sanitizedName.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Student full name must be at least 2 characters.' },
        { status: 400 }
      );
    }

    if (!validateEmail(customer_email)) {
      return NextResponse.json(
        { success: false, error: 'A valid email address is required.' },
        { status: 400 }
      );
    }

    if (!validatePhone(customer_phone)) {
      return NextResponse.json(
        { success: false, error: 'A valid 10-digit WhatsApp phone number is required.' },
        { status: 400 }
      );
    }

    if (!service_id) {
      return NextResponse.json(
        { success: false, error: 'Please choose a target tutoring service.' },
        { status: 400 }
      );
    }

    const provider = await getProvider(provider_id);

    const entry = await addWaitlistEntry({
      provider_id: provider.id,
      service_id,
      customer_name: sanitizedName,
      customer_email: String(customer_email).trim().toLowerCase(),
      customer_phone: String(customer_phone).trim(),
      preferred_days: Array.isArray(preferred_days) && preferred_days.length > 0 ? preferred_days : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      preferred_time_windows: Array.isArray(preferred_time_windows) && preferred_time_windows.length > 0 ? preferred_time_windows : ['afternoon', 'evening'],
      duration_minutes: typeof duration_minutes === 'number' && duration_minutes > 0 ? duration_minutes : 60,
      urgency: urgency === 'high' ? 'high' : 'normal',
      notes: sanitizeString(notes, 300),
    });

    return NextResponse.json({
      success: true,
      entry,
      message: 'Successfully added to priority waitlist!',
    });
  } catch (error) {
    console.error('Error adding waitlist entry:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to join waitlist' },
      { status: 500 }
    );
  }
}
