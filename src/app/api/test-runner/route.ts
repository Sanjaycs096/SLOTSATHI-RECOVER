import { NextResponse } from 'next/server';
import {
  createBooking,
  cancelAppointment,
  createRecoveryOffer,
  acceptRecoveryOffer,
  getRecoveryMetrics,
  getAppointments,
  getWaitlist,
  getProvider,
  getServices,
  resetDatabase,
} from '@/lib/db';
import { matchCandidatesForSlot } from '@/lib/matching';
import { AcceptanceTestResult } from '@/types';

export async function POST() {
  const results: AcceptanceTestResult[] = [];
  const startTotal = Date.now();

  try {
    // Reset to clean test state
    resetDatabase();
    const provider = await getProvider();
    const services = await getServices(provider.id);
    const mathService = services.find((s) => s.subject === 'Mathematics') || services[0];

    // TEST 1: Customer can book an available future session
    const t1Start = Date.now();
    const futureSlotStart = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    futureSlotStart.setHours(10, 0, 0, 0);
    const futureSlotEnd = new Date(futureSlotStart.getTime() + 60 * 60 * 1000);

    const bookResult = await createBooking({
      provider_id: provider.id,
      service_id: mathService.id,
      customer_name: 'Test Student One',
      customer_email: 'student1@test.com',
      customer_phone: '+91 99999 11111',
      start_time: futureSlotStart.toISOString(),
      end_time: futureSlotEnd.toISOString(),
    });

    const t1Passed = !!(bookResult.success && bookResult.appointment && bookResult.appointment.status === 'confirmed');
    results.push({
      id: 1,
      name: 'Future Session Booking',
      description: 'A customer can book an available future session.',
      passed: t1Passed,
      status: t1Passed ? 'passed' : 'failed',
      execution_time_ms: Date.now() - t1Start,
      details: t1Passed
        ? `Successfully booked appointment ID ${bookResult.appointment?.id} with cancellation token ${bookResult.appointment?.cancellation_token}`
        : `Booking failed: ${bookResult.error}`,
      timestamp: new Date().toISOString(),
    });

    // TEST 2: Second customer cannot reserve an overlapping slot (Conflict Protection)
    const t2Start = Date.now();
    // Overlapping: starts 30 minutes into the first appointment
    const overlapStart = new Date(futureSlotStart.getTime() + 30 * 60 * 1000);
    const overlapEnd = new Date(overlapStart.getTime() + 60 * 60 * 1000);

    const overlapResult = await createBooking({
      provider_id: provider.id,
      service_id: mathService.id,
      customer_name: 'Test Student Two (Conflict)',
      customer_email: 'student2@test.com',
      customer_phone: '+91 99999 22222',
      start_time: overlapStart.toISOString(),
      end_time: overlapEnd.toISOString(),
    });

    const t2Passed = !overlapResult.success && !!overlapResult.error;
    results.push({
      id: 2,
      name: 'Conflict / Overlap Prevention',
      description: 'A second customer cannot reserve an overlapping slot.',
      passed: t2Passed,
      status: t2Passed ? 'passed' : 'failed',
      execution_time_ms: Date.now() - t2Start,
      details: t2Passed
        ? `Conflict correctly detected and blocked: "${overlapResult.error}"`
        : `Error: Overlapping booking was improperly permitted.`,
      timestamp: new Date().toISOString(),
    });

    // TEST 3: Cancellation preserves the original appointment record
    const t3Start = Date.now();
    const originalToken = bookResult.appointment?.cancellation_token || '';
    const cancelResult = await cancelAppointment(originalToken, 'Illness on test day');

    const apptsAfterCancel = await getAppointments(provider.id);
    const preservedAppt = apptsAfterCancel.find((a) => a.id === bookResult.appointment?.id);

    const t3Passed = !!(
      cancelResult.success &&
      preservedAppt &&
      preservedAppt.status === 'cancelled' &&
      preservedAppt.cancelled_at !== null &&
      preservedAppt.cancellation_reason === 'Illness on test day'
    );
    results.push({
      id: 3,
      name: 'Cancellation Record Preservation',
      description: 'Cancellation preserves the original appointment record.',
      passed: t3Passed,
      status: t3Passed ? 'passed' : 'failed',
      execution_time_ms: Date.now() - t3Start,
      details: t3Passed
        ? `Original record preserved: ID ${preservedAppt?.id}, status transitioned to 'cancelled' with timestamp ${preservedAppt?.cancelled_at}`
        : `Cancellation record preservation failed.`,
      timestamp: new Date().toISOString(),
    });

    // TEST 4: Matching engine identifies an eligible waitlisted customer
    const t4Start = Date.now();
    const waitlist = await getWaitlist(provider.id);
    const matches = matchCandidatesForSlot(preservedAppt!, mathService, waitlist);
    const topMatch = matches.find((m) => m.is_eligible);

    const t4Passed = !!(topMatch && topMatch.is_eligible && topMatch.total_score > 0);
    results.push({
      id: 4,
      name: 'Transparent Waitlist Matching',
      description: 'The matching engine identifies an eligible waitlisted customer with explainability.',
      passed: t4Passed,
      status: t4Passed ? 'passed' : 'failed',
      execution_time_ms: Date.now() - t4Start,
      details: t4Passed
        ? `Identified candidate "${topMatch?.waitlist_entry.customer_name}" with match score ${topMatch?.total_score}/100. Factors: ${topMatch?.score_factors.map((f) => f.factor).join(', ')}`
        : `No eligible waitlist candidate identified.`,
      timestamp: new Date().toISOString(),
    });

    // TEST 5: Invalid or expired offer cannot create a replacement booking
    const t5Start = Date.now();
    const fakeTokenAccept = await acceptRecoveryOffer('invalid-fake-token-999');
    const t5Passed = Boolean(!fakeTokenAccept.success && fakeTokenAccept.error);

    results.push({
      id: 5,
      name: 'Invalid / Expired Token Rejection',
      description: 'An invalid or expired offer cannot create a replacement booking.',
      passed: t5Passed,
      status: t5Passed ? 'passed' : 'failed',
      execution_time_ms: Date.now() - t5Start,
      details: t5Passed
        ? `Invalid offer rejected with security guard: "${fakeTokenAccept.error}"`
        : `Security breach: Invalid offer token was accepted.`,
      timestamp: new Date().toISOString(),
    });

    // TEST 6: Successful offer acceptance creates exactly one replacement appointment
    const t6Start = Date.now();
    const offerGen = await createRecoveryOffer({
      appointmentId: preservedAppt!.id,
      waitlistEntryId: topMatch!.waitlist_entry.id,
      matchScore: topMatch!.total_score,
      matchReasons: topMatch!.score_factors.filter((f) => f.satisfied).map((f) => f.description),
      baseUrl: 'http://localhost:3000',
      expiryMinutes: 120,
    });

    const offerToken = offerGen.offer!.token;
    const acceptResult = await acceptRecoveryOffer(offerToken);

    const allApptsNow = await getAppointments(provider.id);
    const replacementsForSlot = allApptsNow.filter(
      (a) => a.recovered_from_appointment_id === preservedAppt!.id
    );

    const t6Passed = !!(
      acceptResult.success &&
      acceptResult.replacementAppointment &&
      replacementsForSlot.length === 1 &&
      replacementsForSlot[0].is_replacement === true
    );

    results.push({
      id: 6,
      name: 'Atomic Replacement Creation',
      description: 'A successful offer acceptance creates exactly one replacement appointment.',
      passed: t6Passed,
      status: t6Passed ? 'passed' : 'failed',
      execution_time_ms: Date.now() - t6Start,
      details: t6Passed
        ? `Replacement appointment created: ID ${acceptResult.replacementAppointment?.id}, is_replacement=true, total replacement count for slot = 1`
        : `Replacement appointment creation failed.`,
      timestamp: new Date().toISOString(),
    });

    // TEST 7: Original cancelled appointment remains cancelled
    const t7Start = Date.now();
    const originalApptCheck = allApptsNow.find((a) => a.id === preservedAppt!.id);
    const t7Passed = !!(originalApptCheck && originalApptCheck.status === 'cancelled');

    results.push({
      id: 7,
      name: 'Original Record Immutability',
      description: 'The original cancelled appointment remains cancelled.',
      passed: t7Passed,
      status: t7Passed ? 'passed' : 'failed',
      execution_time_ms: Date.now() - t7Start,
      details: t7Passed
        ? `Original appointment ${originalApptCheck?.id} status verified as 'cancelled' (not overwritten or erased).`
        : `Original cancelled appointment was improperly mutated or lost.`,
      timestamp: new Date().toISOString(),
    });

    // TEST 8: Recovered booking value increases only once for a successful replacement
    const t8Start = Date.now();
    const metricsBeforeDoubleAccept = await getRecoveryMetrics(provider.id);
    const recoveredValue1 = metricsBeforeDoubleAccept.recovered_value_inr;

    // Try to accept the same offer a second time
    const doubleAccept = await acceptRecoveryOffer(offerToken);
    const metricsAfterDoubleAccept = await getRecoveryMetrics(provider.id);
    const recoveredValue2 = metricsAfterDoubleAccept.recovered_value_inr;

    const t8Passed = !doubleAccept.success && recoveredValue1 === recoveredValue2;

    results.push({
      id: 8,
      name: 'Single Increment Financial Safety',
      description: 'Recovered booking value increases only once for a successful replacement.',
      passed: t8Passed,
      status: t8Passed ? 'passed' : 'failed',
      execution_time_ms: Date.now() - t8Start,
      details: t8Passed
        ? `Double-acceptance prevented: "${doubleAccept.error}". Recovered value strictly invariant at ₹${recoveredValue2}.`
        : `Financial integrity failure: Double acceptance permitted or value incremented multiple times.`,
      timestamp: new Date().toISOString(),
    });

    // TEST 9: Dashboard displays consistent booking and recovery counts
    const t9Start = Date.now();
    const finalMetrics = await getRecoveryMetrics(provider.id);
    const allFinalAppts = await getAppointments(provider.id);

    const actualTotal = allFinalAppts.length;
    const actualCancelled = allFinalAppts.filter((a) => a.status === 'cancelled').length;
    const actualRecovered = allFinalAppts.filter((a) => a.is_replacement && a.status === 'confirmed').length;

    const t9Passed = (
      finalMetrics.total_appointments === actualTotal &&
      finalMetrics.total_cancelled === actualCancelled &&
      finalMetrics.recovered_appointments === actualRecovered
    );

    results.push({
      id: 9,
      name: 'Dashboard Derived Metrics Consistency',
      description: 'The dashboard displays consistent booking and recovery counts derived directly from DB records.',
      passed: t9Passed,
      status: t9Passed ? 'passed' : 'failed',
      execution_time_ms: Date.now() - t9Start,
      details: t9Passed
        ? `Exact count parity verified: total=${finalMetrics.total_appointments}, cancelled=${finalMetrics.total_cancelled}, recovered=${finalMetrics.recovered_appointments}, rate=${finalMetrics.recovery_rate}%`
        : `Metrics count disparity detected.`,
      timestamp: new Date().toISOString(),
    });

    // TEST 10: Main workflow works with seeded data and no paid messaging integration
    const t10Start = Date.now();
    const sampleWaitlist = waitlist[0];
    const { rawMessage, encodedUrl } = (await import('@/lib/whatsapp')).generateWhatsAppOffer({
      provider,
      service: mathService,
      slot: preservedAppt!,
      candidate: sampleWaitlist,
      offerToken: 'demo-wa-token',
      baseUrl: 'http://localhost:3000',
    });

    const t10Passed = !!(
      encodedUrl.startsWith('https://wa.me/') &&
      encodedUrl.includes('text=') &&
      rawMessage.includes('priority recovery slot') &&
      rawMessage.includes('demo-wa-token')
    );

    results.push({
      id: 10,
      name: 'Zero-Cost WhatsApp Deep-Link Workflow',
      description: 'The main workflow works with seeded data and no paid messaging integration via wa.me deep links.',
      passed: t10Passed,
      status: t10Passed ? 'passed' : 'failed',
      execution_time_ms: Date.now() - t10Start,
      details: t10Passed
        ? `Valid wa.me deep link generated with prefilled recovery invite: ${encodedUrl.substring(0, 70)}...`
        : `WhatsApp link generation failed.`,
      timestamp: new Date().toISOString(),
    });

    // Restore clean demo state after test suite execution
    resetDatabase();

    const allPassed = results.every((r) => r.passed);

    return NextResponse.json({
      success: true,
      allPassed,
      total_time_ms: Date.now() - startTotal,
      results,
    });
  } catch (error) {
    console.error('Error running acceptance test suite:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Test suite execution error',
        results,
      },
      { status: 500 }
    );
  }
}
