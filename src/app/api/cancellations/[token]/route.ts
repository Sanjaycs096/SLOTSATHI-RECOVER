import { NextRequest, NextResponse } from 'next/server';
import { cancelAppointment, getAppointmentByToken, getProvider, getServiceById } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';
import { validateCancellationReason, validateCancellationToken, parseSafeJson } from '@/lib/validation';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;

    // Validate token format before database lookup
    const tokenValidation = validateCancellationToken(token);
    if (!tokenValidation.valid) {
      return NextResponse.json(
        { success: false, error: tokenValidation.error || 'Invalid cancellation token format.' },
        { status: 400 }
      );
    }

    const rateCheck = checkRateLimit(req, 'cancel_view', { maxTokens: 20, refillRatePerSec: 2 }, token);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please wait a moment.' },
        { status: 429, headers: { 'Retry-After': String(rateCheck.resetSec) } }
      );
    }

    const appointment = await getAppointmentByToken(token);

    if (!appointment) {
      return NextResponse.json(
        { success: false, error: 'Appointment not found or invalid cancellation link.' },
        { status: 404 }
      );
    }

    const provider = await getProvider(appointment.provider_id);
    const service = await getServiceById(appointment.service_id);

    return NextResponse.json({
      success: true,
      appointment: {
        id: appointment.id,
        start_time: appointment.start_time,
        end_time: appointment.end_time,
        price_inr: appointment.price_inr,
        status: appointment.status,
        customer_name: appointment.customer_name,
        cancelled_at: appointment.cancelled_at,
        cancellation_reason: appointment.cancellation_reason,
      },
      provider: {
        name: provider.name,
        title: provider.title,
        location: provider.location,
      },
      service: service ? {
        title: service.title,
        subject: service.subject,
        duration_minutes: service.duration_minutes,
      } : null,
    });
  } catch (error) {
    console.error('Error fetching appointment for cancellation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve appointment details.' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;

    const tokenValidation = validateCancellationToken(token);
    if (!tokenValidation.valid) {
      return NextResponse.json(
        { success: false, error: tokenValidation.error || 'Invalid cancellation token format.' },
        { status: 400 }
      );
    }

    const rateCheck = checkRateLimit(req, 'cancel_execute', { maxTokens: 10, refillRatePerSec: 1 }, token);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many cancellation requests.' },
        { status: 429, headers: { 'Retry-After': String(rateCheck.resetSec) } }
      );
    }

    let reason = 'Customer initiated cancellation';
    // Optional JSON body
    const contentType = req.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const parsed = await parseSafeJson<{ reason?: string }>(req);
      if (!parsed.success && parsed.status === 413) {
        return NextResponse.json({ success: false, error: parsed.error }, { status: 413 });
      }
      if (parsed.success && parsed.data.reason) {
        reason = validateCancellationReason(parsed.data.reason);
      }
    }

    const result = await cancelAppointment(token, reason);

    if (!result.success) {
      const isAlreadyCancelled = result.error?.includes('already been cancelled');
      return NextResponse.json(
        { success: false, error: result.error },
        { status: isAlreadyCancelled ? 409 : 400 }
      );
    }

    return NextResponse.json({
      success: true,
      appointment: result.appointment,
      message: 'Appointment has been cancelled successfully. Original record preserved.',
    });
  } catch (error) {
    console.error('Error cancelling appointment:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process cancellation.' },
      { status: 500 }
    );
  }
}
