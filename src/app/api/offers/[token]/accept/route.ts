import { NextRequest, NextResponse } from 'next/server';
import { acceptRecoveryOffer } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';
import { validateOfferToken } from '@/lib/validation';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;

    const tokenValidation = validateOfferToken(token);
    if (!tokenValidation.valid) {
      return NextResponse.json(
        { success: false, error: tokenValidation.error || 'Invalid recovery offer token format.' },
        { status: 400 }
      );
    }

    const rateCheck = checkRateLimit(req, 'offer_accept', { maxTokens: 10, refillRatePerSec: 1 }, token);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many acceptance requests. Please wait a moment.' },
        { status: 429, headers: { 'Retry-After': String(rateCheck.resetSec) } }
      );
    }

    const result = await acceptRecoveryOffer(token);

    if (!result.success) {
      const isAlreadyAccepted = result.error?.includes('already been accepted') || result.error?.includes('already been refilled');
      const isExpired = result.error?.includes('expired');
      const statusCode = isAlreadyAccepted ? 409 : isExpired ? 410 : 400;

      return NextResponse.json(
        { success: false, error: result.error },
        { status: statusCode }
      );
    }

    return NextResponse.json({
      success: true,
      replacementAppointment: result.replacementAppointment,
      message: 'Recovery offer accepted successfully! Your appointment is confirmed.',
    });
  } catch (error) {
    console.error('Error accepting recovery offer:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process offer acceptance' },
      { status: 500 }
    );
  }
}
