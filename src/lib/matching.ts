import { Appointment, Service, WaitlistEntry, MatchResult, MatchScoreFactor, TimeWindow } from '@/types';

/**
 * Determine the general time window of a date
 */
export function getTimeWindow(date: Date): TimeWindow {
  const hour = date.getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

/**
 * Calculate the duration between two ISO timestamps in minutes
 */
export function getDurationMinutes(startTimeIso: string, endTimeIso: string): number {
  const start = new Date(startTimeIso).getTime();
  const end = new Date(endTimeIso).getTime();
  return Math.round((end - start) / (1000 * 60));
}

/**
 * Get day of the week in English ('Monday', etc.)
 */
export function getDayOfWeek(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

/**
 * Deterministic Transparent Recovery Matching Engine
 * Ranks candidates strictly based on explainable, auditable criteria:
 * 1. Hard filters applied first: Service/Subject match, Duration fit, Active waiting status
 * 2. Soft scoring: Preferred time window, Preferred day of week, Waitlist tenure (FIFO), Urgency bonus
 * 3. Ineligible candidates receive 0 points and an explicit disqualification reason
 */
export function matchCandidatesForSlot(
  slot: Appointment,
  service: Service,
  candidates: WaitlistEntry[],
  existingPendingOfferCandidateIds: Set<string> = new Set()
): MatchResult[] {
  const slotStart = new Date(slot.start_time);
  const slotDuration = getDurationMinutes(slot.start_time, slot.end_time);
  const slotWindow = getTimeWindow(slotStart);
  const slotDay = getDayOfWeek(slotStart);
  const now = new Date().getTime();

  const results: MatchResult[] = [];

  for (const candidate of candidates) {
    const factors: MatchScoreFactor[] = [];
    let isEligible = true;
    let ineligibilityReason: string | undefined;

    // Hard filter 1: Status must be 'waiting'
    if (candidate.status !== 'waiting') {
      isEligible = false;
      ineligibilityReason = `Candidate status is '${candidate.status}', not waiting`;
    }

    // Hard filter 2: No active pending offer for this slot already
    if (existingPendingOfferCandidateIds.has(candidate.id)) {
      isEligible = false;
      ineligibilityReason = 'Already has an active pending offer for this slot';
    }

    // Hard filter 3: Service/Subject Match
    const serviceMatch = candidate.service_id === service.id;
    if (!serviceMatch) {
      isEligible = false;
      if (!ineligibilityReason) ineligibilityReason = `Requires ${service.subject} / ${service.title}`;
    }
    factors.push({
      factor: 'Service & Subject Match',
      points: serviceMatch ? 30 : 0,
      max_points: 30,
      satisfied: serviceMatch,
      description: serviceMatch
        ? `Exact match for ${service.title} (${service.subject})`
        : `Service mismatch (requires ${service.subject})`,
    });

    // Hard filter 4: Duration Fit (requested session duration <= available slot duration)
    const durationFit = candidate.duration_minutes <= slotDuration;
    if (!durationFit) {
      isEligible = false;
      if (!ineligibilityReason) ineligibilityReason = `Requested duration (${candidate.duration_minutes}m) exceeds slot (${slotDuration}m)`;
    }
    factors.push({
      factor: 'Duration Compatibility',
      points: durationFit ? 20 : 0,
      max_points: 20,
      satisfied: durationFit,
      description: durationFit
        ? `Requested ${candidate.duration_minutes}m fits within ${slotDuration}m slot`
        : `Requested ${candidate.duration_minutes}m exceeds available ${slotDuration}m`,
    });

    // If hard requirements fail, do not award soft scoring points
    if (!isEligible) {
      results.push({
        waitlist_entry: candidate,
        total_score: 0,
        is_eligible: false,
        ineligibility_reason: ineligibilityReason,
        score_factors: factors,
        match_summary: `Ineligible: ${ineligibilityReason}`,
      });
      continue;
    }

    // Soft scoring 1: Time Window Compatibility (morning/afternoon/evening)
    const prefersWindow = candidate.preferred_time_windows.includes(slotWindow);
    factors.push({
      factor: 'Time Window Preference',
      points: prefersWindow ? 20 : 0,
      max_points: 20,
      satisfied: prefersWindow,
      description: prefersWindow
        ? `Preferred ${slotWindow} slot aligns with ${slotStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        : `Prefers ${candidate.preferred_time_windows.join(', ')}, slot is ${slotWindow}`,
    });

    // Soft scoring 2: Day of Week Preference
    const prefersDay = candidate.preferred_days.includes(slotDay);
    factors.push({
      factor: 'Day of Week Compatibility',
      points: prefersDay ? 15 : 0,
      max_points: 15,
      satisfied: prefersDay,
      description: prefersDay
        ? `Slot is on ${slotDay}, which is in preferred days`
        : `Slot is on ${slotDay}, not in preferred days (${candidate.preferred_days.join(', ')})`,
    });

    // Soft scoring 3: Waitlist Age / Tenure (FIFO seniority)
    const waitlistAgeMs = now - new Date(candidate.created_at).getTime();
    const waitlistAgeHours = Math.max(0, Math.floor(waitlistAgeMs / (1000 * 60 * 60)));
    let agePoints = 0;
    let ageDesc = '';
    if (waitlistAgeHours >= 48) {
      agePoints = 10;
      ageDesc = `On waitlist for ${Math.floor(waitlistAgeHours / 24)} days (+10 pts seniority)`;
    } else if (waitlistAgeHours >= 12) {
      agePoints = 5;
      ageDesc = `On waitlist for ${waitlistAgeHours} hours (+5 pts seniority)`;
    } else {
      agePoints = 2;
      ageDesc = `Recently joined waitlist (${waitlistAgeHours}h ago, +2 pts)`;
    }
    factors.push({
      factor: 'Waitlist Tenure (FIFO)',
      points: agePoints,
      max_points: 10,
      satisfied: agePoints > 0,
      description: ageDesc,
    });

    // Soft scoring 4: Urgency Priority
    const isUrgent = candidate.urgency === 'high';
    factors.push({
      factor: 'Student Urgency Priority',
      points: isUrgent ? 5 : 0,
      max_points: 5,
      satisfied: isUrgent,
      description: isUrgent ? 'Marked high urgency (exam / assignment deadline)' : 'Normal priority',
    });

    // Total score calculation
    const totalScore = factors.reduce((sum, f) => sum + f.points, 0);

    let matchSummary = '';
    if (totalScore >= 80) {
      matchSummary = `Excellent Match (${totalScore}/100) — Matches subject, time of day & day of week`;
    } else if (totalScore >= 60) {
      matchSummary = `Good Match (${totalScore}/100) — Compatible subject with minor preference trade-off`;
    } else {
      matchSummary = `Fair Match (${totalScore}/100) — Available subject match, off-peak timing`;
    }

    results.push({
      waitlist_entry: candidate,
      total_score: totalScore,
      is_eligible: true,
      score_factors: factors,
      match_summary: matchSummary,
    });
  }

  // Sort: Eligible first, then highest total score, then oldest waitlist entry
  return results.sort((a, b) => {
    if (a.is_eligible && !b.is_eligible) return -1;
    if (!a.is_eligible && b.is_eligible) return 1;
    if (b.total_score !== a.total_score) return b.total_score - a.total_score;
    return new Date(a.waitlist_entry.created_at).getTime() - new Date(b.waitlist_entry.created_at).getTime();
  });
}
