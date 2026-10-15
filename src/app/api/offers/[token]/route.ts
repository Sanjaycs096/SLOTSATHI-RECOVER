import { NextRequest, NextResponse } from 'next/server';
import { getOfferByToken, getAppointmentById, getProvider, getServiceById } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';
import { validateOfferToken } from '@/lib/validation';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;

    // Validate token format before querying database
    const tokenValidation = validateOfferToken(token);
    if (!tokenValidation.valid) {
      return NextResponse.json(
        { success: false, error: tokenValidation.error || 'Invalid recovery offer token format.' },
        { status: 400 }
      );
    }

    // Rate limit public offer queries per token & IP
    const rateCheck = checkRateLimit(req, 'offer_view', { maxTokens: 30, refillRatePerSec: 2 }, token);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please slow down.' },
        { status: 429, headers: { 'Retry-After': String(rateCheck.resetSec) } }
      );
    }

    const offer = await getOfferByToken(token);

    if (!offer) {
      return NextResponse.json(
        { success: false, error: 'Recovery offer not found or invalid link.' },
        { status: 404 }
      );
    }

    const isExpired = new Date() > new Date(offer.expires_at) || offer.status === 'expired';

    // PRIVACY ENFORCEMENT: Expired or revoked offers MUST NOT disclose appointment or candidate data
    if (isExpired) {
      return NextResponse.json(
        {
          success: false,
          error: 'This recovery offer has expired or is no longer available.',
          isExpired: true,
        },
        { status: 410 }
      );
    }

    if (offer.status === 'revoked') {
      return NextResponse.json(
        {
          success: false,
          error: 'This recovery opportunity is no longer available as the slot has already been refilled.',
          isRevoked: true,
        },
        { status: 410 }
      );
    }

    const appointment = await getAppointmentById(offer.appointment_id);
    const provider = appointment ? await getProvider(appointment.provider_id) : await getProvider();
    const service = appointment ? await getServiceById(appointment.service_id) : null;

    // DTO Allowlist: STRICT PRIVACY ENFORCEMENT
    // NEVER expose original cancelled student name, email, phone, cancellation_token, or cancellation_reason!
    const slotSummary = appointment
      ? {
          start_time: appointment.start_time,
          end_time: appointment.end_time,
          price_inr: appointment.price_inr,
          duration_minutes: service ? service.duration_minutes : 60,
        }
      : null;

    const providerSummary = provider
      ? {
          name: provider.name,
          title: provider.title,
          bio: provider.bio,
          avatar_url: provider.avatar_url,
          location: provider.location,
          timezone: provider.timezone,
        }
      : null;

    const serviceSummary = service
      ? {
          id: service.id,
          title: service.title,
          subject: service.subject,
          duration_minutes: service.duration_minutes,
          price_inr: service.price_inr,
          description: service.description,
        }
      : null;

    const safeOffer = {
      id: offer.id,
      token: offer.token,
      status: offer.status,
      expires_at: offer.expires_at,
      match_score: offer.match_score,
      match_reasons: offer.match_reasons,
      customer_name: offer.customer_name,
      service_title: service?.title || offer.service_title,
      slot_start_time: appointment?.start_time || offer.slot_start_time,
      slot_end_time: appointment?.end_time || offer.slot_end_time,
      price_inr: appointment?.price_inr || offer.price_inr,
    };

    return NextResponse.json({
      success: true,
      offer: safeOffer,
      slot: slotSummary,
      provider: providerSummary,
      service: serviceSummary,
      isExpired: false,
    });
  } catch (error) {
    console.error('Error fetching recovery offer:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve recovery offer' },
      { status: 500 }
    );
  }
}
