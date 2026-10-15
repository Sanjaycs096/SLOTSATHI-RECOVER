import { NextRequest, NextResponse } from 'next/server';
import {
  getServices,
  getAppointments,
  getWaitlist,
  getOffers,
  getRecoveryMetrics,
} from '@/lib/db';
import { matchCandidatesForSlot } from '@/lib/matching';
import { verifyProviderAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const requestedProviderId = req.nextUrl.searchParams.get('providerId') || undefined;
    const auth = await verifyProviderAuth(req, requestedProviderId);
    if (!auth.authenticated || !auth.provider) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized: Provider credentials required' },
        { status: auth.statusCode || 401 }
      );
    }

    const provider = auth.provider;
    const services = await getServices(provider.id);
    const appointments = await getAppointments(provider.id);
    const waitlist = await getWaitlist(provider.id);
    const offers = await getOffers();
    const metrics = await getRecoveryMetrics(provider.id);

    // Identify Cancelled Appointments that do NOT yet have an accepted replacement
    const recoveredOriginalIds = new Set(
      appointments
        .filter((a) => a.is_replacement && a.status === 'confirmed')
        .map((a) => a.recovered_from_appointment_id)
        .filter(Boolean)
    );

    const cancelledAwaitingRecovery = appointments.filter(
      (a) => a.status === 'cancelled' && !recoveredOriginalIds.has(a.id)
    );

    // For each cancelled appointment awaiting recovery, run the matching engine
    const recoveryOpportunities = cancelledAwaitingRecovery.map((slot) => {
      const service = services.find((s) => s.id === slot.service_id) || services[0];
      const pendingOffersForSlot = offers.filter(
        (o) => o.appointment_id === slot.id && o.status === 'pending'
      );
      const pendingCandidateIds = new Set(pendingOffersForSlot.map((o) => o.waitlist_entry_id));

      const matchedCandidates = matchCandidatesForSlot(
        slot,
        service,
        waitlist,
        pendingCandidateIds
      );

      return {
        slot,
        service,
        pendingOffers: pendingOffersForSlot,
        matches: matchedCandidates,
      };
    });

    return NextResponse.json({
      success: true,
      provider,
      services,
      appointments,
      waitlist,
      offers,
      metrics,
      recoveryOpportunities,
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load dashboard data' },
      { status: 500 }
    );
  }
}
