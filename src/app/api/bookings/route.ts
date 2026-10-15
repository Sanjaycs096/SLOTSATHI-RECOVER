import { NextRequest, NextResponse } from 'next/server';
import { createBooking, getProvider, getServices, getAppointments } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';
import { validateBookingInput, sanitizeString, parseSafeJson } from '@/lib/validation';

export async function POST(req: NextRequest) {
  try {
    // Rate limit public bookings: max 15 requests, 1/sec refill per IP
    const rateCheck = checkRateLimit(req, 'booking_create', { maxTokens: 15, refillRatePerSec: 1 });
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many booking attempts. Please wait a moment.' },
        { status: 429 }
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

    // Strict input validation
    const validation = validateBookingInput(body);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.errors[0], errors: validation.errors },
        { status: 400 }
      );
    }

    const {
      provider_id,
      service_id,
      customer_name,
      customer_email,
      customer_phone,
      start_time,
      end_time,
    } = body as {
      provider_id?: string;
      service_id?: string;
      customer_name: string;
      customer_email: string;
      customer_phone: string;
      start_time: string;
      end_time?: string;
    };

    const provider = await getProvider(provider_id);
    const services = await getServices(provider.id);
    const service = services.find((s) => s.id === service_id) || services[0];

    if (!service) {
      return NextResponse.json(
        { success: false, error: 'Valid service must be selected.' },
        { status: 400 }
      );
    }

    const effectiveEndTime: string =
      end_time ||
      new Date(new Date(start_time).getTime() + (service.duration_minutes || 60) * 60000).toISOString();

    const result = await createBooking({
      provider_id: provider.id,
      service_id: service.id,
      customer_name: sanitizeString(customer_name, 100),
      customer_email: String(customer_email).trim().toLowerCase(),
      customer_phone: String(customer_phone).trim(),
      start_time,
      end_time: effectiveEndTime,
      price_inr: service.price_inr,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 409 } // Conflict
      );
    }

    return NextResponse.json(
      {
        success: true,
        appointment: result.appointment,
        message: 'Appointment booked successfully!',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating booking:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error while creating booking' },
      { status: 500 }
    );
  }
}

/**
 * Public GET endpoint: returns public tutor profile, services, and booked slot times
 * Ensures privacy: NEVER returns student customer_name, customer_email, or customer_phone
 */
export async function GET() {
  try {
    const provider = await getProvider();
    const services = await getServices(provider.id);
    const appointments = await getAppointments(provider.id);

    // Filter to confirmed slots only and scrub all student PII
    const safeSlots = appointments
      .filter((a) => a.status === 'confirmed')
      .map((a) => ({
        id: a.id,
        service_id: a.service_id,
        start_time: a.start_time,
        end_time: a.end_time,
        status: a.status,
      }));

    return NextResponse.json({
      success: true,
      provider: {
        id: provider.id,
        name: provider.name,
        title: provider.title,
        bio: provider.bio,
        location: provider.location,
        timezone: provider.timezone,
        avatar_url: provider.avatar_url,
        slug: provider.slug,
        hourly_rate_inr: provider.hourly_rate_inr,
      },
      services,
      appointments: safeSlots,
    });
  } catch (error) {
    console.error('Error loading public booking data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load booking schedule' },
      { status: 500 }
    );
  }
}
