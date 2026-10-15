import { test, expect, APIResponse } from '@playwright/test';
import { Appointment } from '@/types';

test.describe('SlotSathi Recover — Comprehensive E2E Browser & Security Suite', () => {

  test.beforeEach(async ({ request }) => {
    // Reset seed data before each test for test isolation
    const res = await request.post('/api/seed/reset', {
      headers: { 'Authorization': 'Bearer tutor-session-verified' }
    });
    expect(res.status()).toBe(200);
  });

  test('Flow 1: Public tutor booking page loads and displays profile, services, and slots', async ({ page }) => {
    await page.goto('/book/aditi-sharma');
    await expect(page).toHaveTitle(/SlotSathi/i);
    
    // Check tutor verified header
    await expect(page.locator('h1:has-text("Dr. Aditi Sharma")')).toBeVisible();
    await expect(page.locator('text=Verified Tutor Profile')).toBeVisible();

    // Check services are rendered
    await expect(page.locator('text=Advanced Calculus & Analytical Geometry')).toBeVisible();
    await expect(page.locator('text=1. Choose Subject / Service')).toBeVisible();
    await expect(page.locator('text=3. Available Time Slots')).toBeVisible();
  });

  test('Flow 2: Student can book an available session and receive a secure cancellation link', async ({ page }) => {
    await page.goto('/book/aditi-sharma');

    // Select the first service
    await page.click('text=Advanced Calculus & Analytical Geometry');

    // Select an available slot
    const availableSlot = page.locator('button:has-text("AVAILABLE")').first();
    await expect(availableSlot).toBeVisible();
    await availableSlot.click();

    // Fill in student information
    await page.fill('input[placeholder="e.g. Priyanshu Roy"]', 'Aarav Malhotra');
    await page.fill('input[placeholder="priyanshu@example.com"]', 'aarav.malhotra@example.com');
    await page.fill('input[placeholder="+91 98765 00112"]', '+919876543210');
    await page.fill('textarea[placeholder*="JEE Mains Math"]', 'Need help with Integration By Parts');

    // Submit booking
    await page.click('button:has-text("Confirm Booking")');

    // Verify confirmation screen
    await expect(page.locator('text=BOOKING CONFIRMED')).toBeVisible();
    await expect(page.locator('text=Aarav Malhotra')).toBeVisible();
    await expect(page.locator('text=Your Secure Cancellation Link')).toBeVisible();
  });

  test('Flow 3: Conflicting overlapping booking is rejected', async ({ request }) => {
    // Query active appointments to get an existing slot time
    const dashRes = await request.get('/api/dashboard', {
      headers: { 'Authorization': 'Bearer tutor-session-verified' }
    });
    const dashData = await dashRes.json();
    const existing = dashData.appointments.find((a: Appointment) => a.status === 'confirmed');
    expect(existing).toBeDefined();

    // Attempt to book exactly the same slot via API
    const conflictRes = await request.post('/api/bookings', {
      data: {
        provider_id: existing.provider_id,
        service_id: existing.service_id,
        start_time: existing.start_time,
        end_time: existing.end_time,
        customer_name: 'Imposter Student',
        customer_email: 'imposter@example.com',
        customer_phone: '+919999900000',
      }
    });

    expect(conflictRes.status()).toBe(409);
    const conflictJson = await conflictRes.json();
    expect(conflictJson.success).toBe(false);
    expect(conflictJson.error).toMatch(/conflict|already booked/i);
  });

  test('Flow 4: Student can cancel a booking; original record is preserved as cancelled', async ({ page, request }) => {
    // Get an upcoming booking cancellation token
    const dashRes = await request.get('/api/dashboard', {
      headers: { 'Authorization': 'Bearer tutor-session-verified' }
    });
    const dashData = await dashRes.json();
    const appt = dashData.appointments.find((a: Appointment) => a.status === 'confirmed' && a.cancellation_token);
    expect(appt).toBeDefined();

    // Navigate to the cancellation page
    await page.goto(`/cancel/${appt.cancellation_token}`);
    await expect(page.locator('text=Cancel Tutoring Session')).toBeVisible();
    await expect(page.locator(`text=${appt.customer_name}`)).toBeVisible();

    // Submit cancellation
    await page.click('button:has-text("Confirm & Cancel Slot")');

    // Verify confirmation and preserved record
    await expect(page.locator('text=Appointment Successfully Cancelled')).toBeVisible();
    await expect(page.locator('text=Slot Transferred to Recovery Queue')).toBeVisible();

    // Assert database state: appointment is marked cancelled, not deleted
    const verifyRes = await request.get(`/api/cancellations/${appt.cancellation_token}`);
    const verifyData = await verifyRes.json();
    expect(verifyData.success).toBe(true);
    expect(verifyData.appointment.status).toBe('cancelled');
    expect(verifyData.appointment.cancelled_at).toBeTruthy();
  });

  test('Flow 5: Public offer page loads and NEVER leaks original student PII', async ({ page, request }) => {
    // Simulate a cancellation to open a recovery opportunity
    const dashRes = await request.get('/api/dashboard', {
      headers: { 'Authorization': 'Bearer tutor-session-verified' }
    });
    const dashData = await dashRes.json();
    const apptToCancel = dashData.appointments.find((a: Appointment) => a.status === 'confirmed' && a.cancellation_token);
    
    await request.post(`/api/cancellations/${apptToCancel.cancellation_token}`, {
      data: { reason: 'Academic exam prep conflict' }
    });

    // Generate an offer for the first waitlist student
    const waitlistCandidate = dashData.waitlist[0];
    const genRes = await request.post('/api/offers/generate', {
      headers: { 'Authorization': 'Bearer tutor-session-verified' },
      data: {
        appointment_id: apptToCancel.id,
        waitlist_entry_id: waitlistCandidate.id,
        match_score: 95,
        match_reasons: ['Subject match', 'Duration match'],
      }
    });
    const genData = await genRes.json();
    expect(genData.success).toBe(true);
    const offerToken = genData.offer.token;

    // Direct API inspection for PII leak prevention
    const publicOfferApiRes = await request.get(`/api/offers/${offerToken}`);
    expect(publicOfferApiRes.status()).toBe(200);
    const publicOfferJson = await publicOfferApiRes.json();

    // SECURITY CHECK: Assert that original customer PII is ABSENT from public offer endpoint
    expect(publicOfferJson.appointment?.customer_name).toBeUndefined();
    expect(publicOfferJson.appointment?.customer_email).toBeUndefined();
    expect(publicOfferJson.appointment?.customer_phone).toBeUndefined();
    expect(publicOfferJson.appointment?.cancellation_token).toBeUndefined();
    expect(publicOfferJson.appointment?.cancellation_reason).toBeUndefined();

    // Browser check: loads with safe details
    await page.goto(`/offer/${offerToken}`);
    await expect(page.locator('text=A 1-on-1 Tutoring Slot Just Opened Up!')).toBeVisible();
    await expect(page.locator(`text=${waitlistCandidate.customer_name}`)).toBeVisible();
    await expect(page.locator('h3:has-text("Dr. Aditi Sharma")')).toBeVisible();

    // Verify original student name does NOT appear on the replacement student's offer screen
    await expect(page.locator(`text=${apptToCancel.customer_name}`)).not.toBeVisible();
  });

  test('Flow 6: Offer acceptance creates exactly one replacement appointment and rejects double-acceptance', async ({ page, request }) => {
    // Cancel appointment
    const dashRes = await request.get('/api/dashboard', {
      headers: { 'Authorization': 'Bearer tutor-session-verified' }
    });
    const dashData = await dashRes.json();
    const appt = dashData.appointments.find((a: Appointment) => a.status === 'confirmed');

    await request.post(`/api/cancellations/${appt.cancellation_token}`, {
      data: { reason: 'Travel emergency' }
    });

    // Generate offer
    const candidate = dashData.waitlist[0];
    const genRes = await request.post('/api/offers/generate', {
      headers: { 'Authorization': 'Bearer tutor-session-verified' },
      data: {
        appointment_id: appt.id,
        waitlist_entry_id: candidate.id,
        match_score: 90,
        match_reasons: ['High urgency', 'Time window fit'],
      }
    });
    const genData = await genRes.json();
    const offerToken = genData.offer.token;

    // Accept via browser page
    await page.goto(`/offer/${offerToken}`);
    const acceptBtn = page.locator('button:has-text("Accept & Confirm This Session")');
    await expect(acceptBtn).toBeVisible();
    await acceptBtn.click();

    // Verify confirmation
    await expect(page.locator('text=SLOT RECOVERED & CONFIRMED')).toBeVisible();
    await expect(page.locator('text=Atomically Reserved').first()).toBeVisible();

    // Double-acceptance rejection test: attempt second accept
    const secondAcceptRes = await request.post(`/api/offers/${offerToken}/accept`);
    const secondAcceptJson = await secondAcceptRes.json();
    expect(secondAcceptJson.success).toBe(false);
    expect(secondAcceptJson.error).toMatch(/already.*accepted|already.*filled/i);
  });

  test('Flow 7: Unauthorized request to private dashboard endpoint is rejected with 401', async ({ request }) => {
    // Attempt request without Authorization header
    const unauthorizedRes = await request.get('/api/dashboard');
    expect(unauthorizedRes.status()).toBe(401);
    const json = await unauthorizedRes.json();
    expect(json.success).toBe(false);
  });

  test('Flow 8: Dashboard shows explicit demo-seed badges and correct empty refill metrics', async ({ page }) => {
    await page.goto('/');

    // Check that illustrative demo seed badges appear
    await expect(page.locator('text=Turn Last-Minute Cancellations into Recovered Tutoring Value')).toBeVisible();
    await expect(page.locator('text=Deterministic Matching Engine Active')).toBeVisible();

    // Navigate to schedule tab
    await page.click('#tab-btn-schedule');
    await expect(page.locator('text=Illustrative Seed Record').first()).toBeVisible();

    // Navigate to acceptance test suite tab
    await page.click('#tab-btn-tests');
    await expect(page.locator('text=In-Process API & Contract Verification Suite')).toBeVisible();

    // Trigger in-process test suite from UI
    await page.click('button:has-text("Run All 10 Tests Live")');
    await expect(page.locator('text=All 10 Acceptance Tests Passed')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=10 / 10')).toBeVisible();
  });

  test('Flow 9: Concurrent overlapping bookings — exactly one succeeds, others rejected with 409', async ({ request }) => {
    const dashRes = await request.get('/api/dashboard', {
      headers: { 'Authorization': 'Bearer tutor-session-verified' }
    });
    const dashData = await dashRes.json();
    const providerId = dashData.provider.id;
    const serviceId = dashData.services[0].id;

    // Pick a future time slot not yet occupied
    const futureSlotStart = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    futureSlotStart.setHours(14, 0, 0, 0);
    const futureSlotEnd = new Date(futureSlotStart.getTime() + 60 * 60 * 1000);

    const bookingPayload = {
      provider_id: providerId,
      service_id: serviceId,
      start_time: futureSlotStart.toISOString(),
      end_time: futureSlotEnd.toISOString(),
      customer_email: 'concurrent@student-test.com',
      customer_phone: '+919876543210',
    };

    // Fire 5 concurrent requests simultaneously
    const responses = await Promise.all([
      request.post('/api/bookings', { data: { ...bookingPayload, customer_name: 'Student 1' } }),
      request.post('/api/bookings', { data: { ...bookingPayload, customer_name: 'Student 2' } }),
      request.post('/api/bookings', { data: { ...bookingPayload, customer_name: 'Student 3' } }),
      request.post('/api/bookings', { data: { ...bookingPayload, customer_name: 'Student 4' } }),
      request.post('/api/bookings', { data: { ...bookingPayload, customer_name: 'Student 5' } }),
    ]);

    const statuses = responses.map((r) => r.status());
    const successes = statuses.filter((s) => s === 201);
    const conflicts = statuses.filter((s) => s === 409);

    expect(successes.length).toBe(1);
    expect(conflicts.length).toBe(4);
  });

  test('Flow 10: Concurrent offer acceptances — exactly one replacement created, others rejected with 409', async ({ request }) => {
    const dashRes = await request.get('/api/dashboard', {
      headers: { 'Authorization': 'Bearer tutor-session-verified' }
    });
    const dashData = await dashRes.json();
    const appt = dashData.appointments.find((a: Appointment) => a.status === 'confirmed');

    // Cancel appointment
    await request.post(`/api/cancellations/${appt.cancellation_token}`, {
      data: { reason: 'Academic reschedule' }
    });

    // Generate offer
    const candidate = dashData.waitlist[0];
    const genRes = await request.post('/api/offers/generate', {
      headers: { 'Authorization': 'Bearer tutor-session-verified' },
      data: {
        appointment_id: appt.id,
        waitlist_entry_id: candidate.id,
        match_score: 95,
        match_reasons: ['Subject match'],
      }
    });
    const genData = await genRes.json();
    const offerToken = genData.offer.token;

    // Fire 5 concurrent acceptance requests simultaneously
    const responses = await Promise.all([
      request.post(`/api/offers/${offerToken}/accept`),
      request.post(`/api/offers/${offerToken}/accept`),
      request.post(`/api/offers/${offerToken}/accept`),
      request.post(`/api/offers/${offerToken}/accept`),
      request.post(`/api/offers/${offerToken}/accept`),
    ]);

    const statuses = responses.map((r) => r.status());
    const successes = statuses.filter((s) => s === 200);
    const conflicts = statuses.filter((s) => s === 409);

    expect(successes.length).toBe(1);
    expect(conflicts.length).toBe(4);

    // Verify DB invariant: exactly one confirmed replacement exists for this slot
    const verifyDash = await request.get('/api/dashboard', {
      headers: { 'Authorization': 'Bearer tutor-session-verified' }
    });
    const verifyData = await verifyDash.json();
    const replacements = verifyData.appointments.filter(
      (a: Appointment) => a.recovered_from_appointment_id === appt.id && a.status === 'confirmed'
    );
    expect(replacements.length).toBe(1);
  });

  test('Flow 11: Privacy audit — complete public offer response body contains zero original student PII', async ({ request }) => {
    const dashRes = await request.get('/api/dashboard', {
      headers: { 'Authorization': 'Bearer tutor-session-verified' }
    });
    const dashData = await dashRes.json();
    const appt = dashData.appointments.find((a: Appointment) => a.status === 'confirmed');

    const privateStudentName = appt.customer_name;
    const privateStudentEmail = appt.customer_email;
    const privateStudentPhone = appt.customer_phone;
    const privateCancelToken = appt.cancellation_token;

    await request.post(`/api/cancellations/${privateCancelToken}`, {
      data: { reason: 'Confidential medical leave 998877' }
    });

    const genRes = await request.post('/api/offers/generate', {
      headers: { 'Authorization': 'Bearer tutor-session-verified' },
      data: {
        appointment_id: appt.id,
        waitlist_entry_id: dashData.waitlist[0].id,
        match_score: 90,
      }
    });
    const genData = await genRes.json();
    const offerToken = genData.offer.token;

    // Fetch the raw response text from the public endpoint
    const publicRes = await request.get(`/api/offers/${offerToken}`);
    expect(publicRes.status()).toBe(200);
    const rawBody = await publicRes.text();

    // Assert that the raw body text does not contain ANY prohibited personal data
    expect(rawBody).not.toContain(privateStudentName);
    expect(rawBody).not.toContain(privateStudentEmail);
    expect(rawBody).not.toContain(privateStudentPhone);
    expect(rawBody).not.toContain(privateCancelToken);
    expect(rawBody).not.toContain('Confidential medical leave 998877');
    expect(rawBody).not.toContain('cancellation_reason');
  });

  test('Flow 12: Authentication & authorization negative matrix', async ({ request }) => {
    // 1. Forged same-origin header without credentials must be rejected
    const forgedOriginRes = await request.get('/api/dashboard', {
      headers: { 'Origin': 'http://localhost:3000', 'Referer': 'http://localhost:3000/' }
    });
    expect(forgedOriginRes.status()).toBe(401);

    // 2. Tampered Bearer token must be rejected with 403 Forbidden
    const tamperedRes = await request.get('/api/dashboard', {
      headers: { 'Authorization': 'Bearer invalid-forged-tutor-token-888' }
    });
    expect(tamperedRes.status()).toBe(403);

    // 3. Cross-provider IDOR attempt must be rejected with 403 Forbidden
    const crossProviderRes = await request.get('/api/dashboard?providerId=prov-different-unauthorized-tutor', {
      headers: { 'Authorization': 'Bearer tutor-session-verified' }
    });
    expect(crossProviderRes.status()).toBe(403);

    // 4. Unauthorized offer generation must be rejected with 401
    const unauthOfferRes = await request.post('/api/offers/generate', {
      data: { appointment_id: 'appt-1', waitlist_entry_id: 'wait-1' }
    });
    expect(unauthOfferRes.status()).toBe(401);

    // 5. Unauthorized seed reset must be rejected with 401
    const unauthResetRes = await request.post('/api/seed/reset');
    expect(unauthResetRes.status()).toBe(401);
  });

  test('Flow 13: Token type isolation — cancellation tokens and offer tokens cannot be used interchangeably', async ({ request }) => {
    const dashRes = await request.get('/api/dashboard', {
      headers: { 'Authorization': 'Bearer tutor-session-verified' }
    });
    const dashData = await dashRes.json();
    const appt = dashData.appointments.find((a: Appointment) => a.status === 'confirmed' && a.cancellation_token);
    const cancelToken = appt.cancellation_token;

    // 1. Pass cancellation token to offer endpoint -> rejected with 400
    const offerWithCancelToken = await request.get(`/api/offers/${cancelToken}`);
    expect(offerWithCancelToken.status()).toBe(400);
    const offerWithCancelJson = await offerWithCancelToken.json();
    expect(offerWithCancelJson.error).toMatch(/invalid.*format|cannot be used/i);

    // 2. Pass cancellation token to offer accept endpoint -> rejected with 400
    const acceptWithCancelToken = await request.post(`/api/offers/${cancelToken}/accept`);
    expect(acceptWithCancelToken.status()).toBe(400);

    // 3. Pass offer token to cancellation endpoint -> rejected with 400
    const fakeOfferToken = 'rec_0123456789abcdef0123456789abcdef';
    const cancelWithOfferToken = await request.get(`/api/cancellations/${fakeOfferToken}`);
    expect(cancelWithOfferToken.status()).toBe(400);
    const cancelWithOfferJson = await cancelWithOfferToken.json();
    expect(cancelWithOfferJson.error).toMatch(/invalid.*format|cannot be used/i);
  });

  test('Flow 14: Expired recovery offer returns 410 Gone and zero appointment data', async ({ request }) => {
    const dashRes = await request.get('/api/dashboard', {
      headers: { 'Authorization': 'Bearer tutor-session-verified' }
    });
    const dashData = await dashRes.json();
    const appt = dashData.appointments.find((a: Appointment) => a.status === 'confirmed');

    await request.post(`/api/cancellations/${appt.cancellation_token}`);

    // Generate an offer with 0 expiry minutes (immediately expired)
    const genRes = await request.post('/api/offers/generate', {
      headers: { 'Authorization': 'Bearer tutor-session-verified' },
      data: {
        appointment_id: appt.id,
        waitlist_entry_id: dashData.waitlist[0].id,
        match_score: 85,
        expiry_minutes: -1, // Expired in the past
      }
    });
    const genData = await genRes.json();
    const expiredToken = genData.offer.token;

    // Query the expired offer
    const expiredRes = await request.get(`/api/offers/${expiredToken}`);
    expect(expiredRes.status()).toBe(410);
    const expiredJson = await expiredRes.json();
    expect(expiredJson.success).toBe(false);
    expect(expiredJson.isExpired).toBe(true);

    // Verify appointment details and candidate names are NOT disclosed
    expect(expiredJson.slot).toBeUndefined();
    expect(expiredJson.appointment).toBeUndefined();
    expect(expiredJson.offer).toBeUndefined();
  });

  test('Flow 15: Input validation & malformed payload rejection', async ({ request }) => {
    const dashRes = await request.get('/api/dashboard', {
      headers: { 'Authorization': 'Bearer tutor-session-verified' }
    });
    const dashData = await dashRes.json();
    const providerId = dashData.provider.id;
    const serviceId = dashData.services[0].id;

    // 1. Malformed JSON payload -> rejected with 400 Bad Request (not 500)
    const malformedRes = await request.post('/api/bookings', {
      headers: { 'Content-Type': 'application/json' },
      data: '{ this is invalid json syntax }',
    });
    expect(malformedRes.status()).toBe(400);
    const malformedJson = await malformedRes.json();
    expect(malformedJson.success).toBe(false);
    expect(malformedJson.error).toMatch(/malformed|syntax|invalid json|expected/i);

    // 2. Reversed timestamp interval (end_time before start_time) -> rejected with 400
    const reversedRes = await request.post('/api/bookings', {
      data: {
        provider_id: providerId,
        service_id: serviceId,
        customer_name: 'Test Student',
        customer_email: 'test@student.com',
        customer_phone: '+919876543210',
        start_time: '2026-10-20T14:00:00Z',
        end_time: '2026-10-20T12:00:00Z', // 2 hours BEFORE start!
      }
    });
    expect(reversedRes.status()).toBe(400);
    const reversedJson = await reversedRes.json();
    expect(reversedJson.success).toBe(false);
    expect(reversedJson.error).toMatch(/chronologically after/i);

    // 3. Oversized payload (> 64 KB) -> rejected with 413 Payload Too Large
    const oversizedBody = JSON.stringify({
      provider_id: providerId,
      service_id: serviceId,
      customer_name: 'A'.repeat(70000),
    });
    const oversizedRes = await request.post('/api/bookings', {
      headers: { 'Content-Type': 'application/json' },
      data: oversizedBody,
    });
    expect(oversizedRes.status()).toBe(413);
    const oversizedJson = await oversizedRes.json();
    expect(oversizedJson.error).toMatch(/payload too large/i);

    // 4. Rate limiting threshold enforcement -> 11th request triggers 429 Too Many Requests
    const testIp = '198.51.100.99';
    let rateLimitedRes: APIResponse | null = null;
    for (let i = 0; i < 11; i++) {
      const res = await request.post('/api/waitlist', {
        headers: { 'X-Forwarded-For': testIp },
        data: {
          provider_id: providerId,
          service_id: serviceId,
          customer_name: `Rate Test Student ${i}`,
          customer_email: `ratetest${i}@example.com`,
          customer_phone: '+919876543210',
          duration_minutes: 60,
        }
      });
      if (res.status() === 429) {
        rateLimitedRes = res;
        break;
      }
    }
    expect(rateLimitedRes).not.toBeNull();
    if (!rateLimitedRes) throw new Error('Expected request to be rate limited with 429');
    expect(rateLimitedRes.status()).toBe(429);
    expect(rateLimitedRes.headers()['retry-after']).toBeDefined();
    const rateLimitedJson = await rateLimitedRes.json();
    expect(rateLimitedJson.error).toMatch(/too many waitlist submissions/i);
  });
});
