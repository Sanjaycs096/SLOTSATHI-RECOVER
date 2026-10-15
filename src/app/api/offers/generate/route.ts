import { NextRequest, NextResponse } from 'next/server';
import { createRecoveryOffer, getAppointmentById } from '@/lib/db';
import { verifyProviderAuth } from '@/lib/auth';
import { parseSafeJson } from '@/lib/validation';

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyProviderAuth(req);
    if (!auth.authenticated || !auth.provider) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized: Provider authentication required' },
        { status: auth.statusCode || 401 }
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
    const appointmentId = (body.appointmentId || body.appointment_id) as string;
    const waitlistEntryId = (body.waitlistEntryId || body.waitlist_entry_id) as string;
    const matchScore = (body.matchScore ?? body.match_score ?? 100) as number;
    const matchReasons = (body.matchReasons || body.match_reasons || []) as string[];
    const expiryMinutes = (body.expiryMinutes || body.expiry_minutes || 120) as number;

    if (!appointmentId || !waitlistEntryId) {
      return NextResponse.json(
        { success: false, error: 'appointmentId (or appointment_id) and waitlistEntryId (or waitlist_entry_id) are required.' },
        { status: 400 }
      );
    }

    // Verify appointment belongs to this provider (IDOR protection)
    const appointment = await getAppointmentById(appointmentId);
    if (!appointment || appointment.provider_id !== auth.provider.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Appointment does not belong to authorized provider.' },
        { status: 403 }
      );
    }

    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const baseUrl = `${protocol}://${host}`;

    const result = await createRecoveryOffer({
      appointmentId,
      waitlistEntryId,
      matchScore: typeof matchScore === 'number' ? matchScore : 100,
      matchReasons: Array.isArray(matchReasons) ? matchReasons : [],
      baseUrl,
      expiryMinutes: typeof expiryMinutes === 'number' ? expiryMinutes : 120,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      offer: result.offer,
      message: 'Recovery offer created successfully!',
    });
  } catch (error) {
    console.error('Error generating recovery offer:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate recovery offer' },
      { status: 500 }
    );
  }
}
