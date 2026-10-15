'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/icon';
import { Badge } from '@/components/ui/badge';
import {
  Appointment,
  Provider,
  RecoveryMetrics,
  RecoveryOffer,
  Service,
  WaitlistEntry,
  MatchResult,
} from '@/types';
import { Navbar } from '@/components/Navbar';
import { WhatsAppPreviewModal } from '@/components/WhatsAppPreviewModal';
import { AddWaitlistModal } from '@/components/AddWaitlistModal';
import { TestRunnerView } from '@/components/TestRunnerView';
import { formatDateTime } from '@/lib/whatsapp';

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [offers, setOffers] = useState<RecoveryOffer[]>([]);
  const [metrics, setMetrics] = useState<RecoveryMetrics | null>(null);
  const [recoveryOpportunities, setRecoveryOpportunities] = useState<
    Array<{
      slot: Appointment;
      service: Service;
      pendingOffers: RecoveryOffer[];
      matches: MatchResult[];
    }>
  >([]);

  // Navigation tab state
  const [activeTab, setActiveTab] = useState<
    'recovery' | 'schedule' | 'cancellations' | 'waitlist' | 'offers' | 'tests' | 'business'
  >('recovery');

  // WhatsApp modal state
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<RecoveryOffer | null>(null);
  const [modalRawMessage, setModalRawMessage] = useState('');
  const [modalWhatsAppUrl, setModalWhatsAppUrl] = useState('');

  // Add waitlist modal
  const [addWaitlistOpen, setAddWaitlistOpen] = useState(false);

  // Resetting state
  const [isResetting, setIsResetting] = useState(false);
  const [isSimulatingCancel, setIsSimulatingCancel] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');

  // Reusable dashboard fetcher
  const fetchDashboardData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard', {
        headers: { 'Authorization': 'Bearer tutor-session-verified' },
        cache: 'no-store',
      });
      const data = await res.json();
      if (data.success) {
        setProvider(data.provider);
        setServices(data.services);
        setAppointments(data.appointments);
        setWaitlist(data.waitlist);
        setOffers(data.offers);
        setMetrics(data.metrics);
        setRecoveryOpportunities(data.recoveryOpportunities);
      }
    } catch (err) {
      console.error('Error fetching dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load using mounted flag pattern to satisfy React 19 ESLint
  useEffect(() => {
    let isMounted = true;
    const loadInitialData = async () => {
      try {
        const res = await fetch('/api/dashboard', {
          headers: { 'Authorization': 'Bearer tutor-session-verified' },
          cache: 'no-store',
        });
        const data = await res.json();
        if (isMounted && data.success) {
          setProvider(data.provider);
          setServices(data.services);
          setAppointments(data.appointments);
          setWaitlist(data.waitlist);
          setOffers(data.offers);
          setMetrics(data.metrics);
          setRecoveryOpportunities(data.recoveryOpportunities);
        }
      } catch (err) {
        console.error('Error fetching dashboard:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadInitialData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Show a temporary banner notification
  const showNotification = (msg: string) => {
    setActionSuccessMsg(msg);
    setTimeout(() => setActionSuccessMsg(''), 4000);
  };

  // Reset database to initial seed data
  const handleResetDemo = async () => {
    try {
      setIsResetting(true);
      const res = await fetch('/api/seed/reset', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer tutor-session-verified' },
      });
      const data = await res.json();
      if (data.success) {
        await fetchDashboardData();
        showNotification('Demo state successfully reset to original seed data.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsResetting(false);
    }
  };

  // Quick simulation: Cancel an upcoming appointment to show instant recovery matching
  const handleSimulateCancellation = async () => {
    try {
      setIsSimulatingCancel(true);
      // Find a confirmed upcoming non-replacement appointment
      const upcomingConfirmed = appointments.find(
        (a) => a.status === 'confirmed' && !a.is_replacement && a.cancellation_token
      );

      if (!upcomingConfirmed) {
        alert('No upcoming confirmed appointments available to cancel.');
        return;
      }

      const res = await fetch(`/api/cancellations/${upcomingConfirmed.cancellation_token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: 'Student unwell with flu (Simulated Live Demo)',
        }),
      });

      const data = await res.json();
      if (data.success) {
        await fetchDashboardData();
        setActiveTab('recovery');
        showNotification(
          `Appointment cancelled! SlotSathi engine has identified replacement candidates.`
        );
      } else {
        alert(data.error || 'Failed to simulate cancellation');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSimulatingCancel(false);
    }
  };

  // Generate WhatsApp offer link for a candidate
  const handleInitiateOffer = async (
    appointmentId: string,
    candidate: WaitlistEntry,
    matchScore: number,
    reasons: string[]
  ) => {
    try {
      const res = await fetch('/api/offers/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer tutor-session-verified',
        },
        body: JSON.stringify({
          appointment_id: appointmentId,
          waitlist_entry_id: candidate.id,
          match_score: matchScore,
          match_reasons: reasons,
        }),
      });

      const data = await res.json();
      if (data.success && data.offer) {
        setSelectedOffer(data.offer);

        const appt = appointments.find((a) => a.id === appointmentId);
        const { dateStr, timeStr } = formatDateTime(appt?.start_time || new Date().toISOString());
        const offerUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/offer/${data.offer.token}`;

        const rawMessage = `Hi ${candidate.customer_name}! A 1-on-1 tutoring session with Dr. Aditi Sharma just opened up for ${dateStr} at ${timeStr}. Because you are on our priority waitlist, you have first access to claim this slot. Tap to confirm: ${offerUrl}`;

        setModalRawMessage(rawMessage);
        setModalWhatsAppUrl(data.offer.whatsapp_url);
        setPreviewModalOpen(true);
        await fetchDashboardData();
      } else {
        alert(data.error || 'Failed to generate recovery offer');
      }
    } catch (err) {
      console.error(err);
      alert('Network error initiating offer');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-400 flex items-center justify-center animate-pulse mb-4">
          <Icon name="auto_awesome" className="text-2xl animate-spin" />
        </div>
        <h2 className="text-sm font-semibold text-white">Loading SlotSathi Recover...</h2>
        <p className="text-xs text-slate-400 mt-1">Initializing recovery matching engine</p>
      </div>
    );
  }

  const upcomingAppointments = appointments.filter((a) => a.status === 'confirmed');
  const cancelledAppointments = appointments.filter((a) => a.status === 'cancelled');

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Navbar */}
      <Navbar
        provider={provider}
        onResetDemo={handleResetDemo}
        isResetting={isResetting}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Banner Alert for Action Feedback */}
        {actionSuccessMsg && (
          <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-200 text-xs flex items-center justify-between gap-3 shadow-lg shadow-emerald-950/40 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2.5">
              <Icon name="check_circle" className="text-base text-emerald-400 flex-shrink-0" />
              <span>{actionSuccessMsg}</span>
            </div>
            <button
              onClick={() => setActionSuccessMsg('')}
              className="text-emerald-400 hover:text-white cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Hero Section: Value Proposition & Live Demo Actions */}
        <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-indigo-950/40 border border-slate-800 shadow-2xl">
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="max-w-2xl space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
                <Icon name="auto_awesome" className="text-xs" />
                Mobile-First Appointment Recovery for Independent Tutors
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Turn Last-Minute Cancellations into Recovered Tutoring Value
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                SlotSathi instantly identifies eligible waitlist students, ranks them using a transparent matching engine, and generates pre-filled WhatsApp offers so tutors never leave empty slots unbilled.
              </p>
            </div>

            {/* Quick Demo Trigger Actions for Evaluators */}
            <div className="flex flex-wrap lg:flex-col items-stretch gap-2.5 flex-shrink-0">
              <button
                onClick={handleSimulateCancellation}
                disabled={isSimulatingCancel}
                className="px-4 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-semibold flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
              >
                <Icon name="warning" className="text-xs" />
                {isSimulatingCancel ? 'Simulating...' : 'Simulate Student Cancellation'}
              </button>

              <Link
                href="/book/aditi-sharma"
                target="_blank"
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 transition active:scale-95 cursor-pointer"
              >
                <Icon name="calendar_today" className="text-xs" />
                Public Student Booking Page
                <Icon name="open_in_new" className="text-[10px] ml-0.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Essential Recovery Metrics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Recovery Rate */}
          <div className="p-5 rounded-2xl glass-panel bg-slate-900/60 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Recovery Rate</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                <Icon name="trending_up" className="text-sm" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-white font-mono">
                {metrics?.recovery_rate}%
              </span>
              <span className="text-[11px] text-slate-400">
                ({metrics?.recovered_appointments} of {metrics?.total_cancelled} cancelled refilled)
              </span>
            </div>
            <div className="mt-2 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, metrics?.recovery_rate || 0)}%` }}
              />
            </div>
          </div>

          {/* Recovered Value in INR */}
          <div className="p-5 rounded-2xl glass-panel bg-slate-900/60 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Recovered Value</span>
              <div className="w-8 h-8 rounded-lg bg-indigo-500/15 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                <Icon name="currency_rupee" className="text-sm" />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono">
                ₹{metrics?.recovered_value_inr.toLocaleString('en-IN')}
              </span>
              <span className="text-[11px] text-slate-400">INR</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              Unrecovered at risk: ₹{metrics?.total_lost_value_inr.toLocaleString('en-IN')}
            </p>
          </div>

          {/* Average Refill Time */}
          <div className="p-5 rounded-2xl glass-panel bg-slate-900/60 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Avg Time to Refill</span>
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center border border-amber-500/20">
                <Icon name="schedule" className="text-sm" />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-extrabold text-white font-mono">
                {metrics?.average_refill_time_minutes}
              </span>
              <span className="text-xs text-slate-300 font-medium">
                {metrics?.average_refill_time_minutes === 0 ? 'N/A (no refills yet)' : 'minutes'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              From cancellation to confirmed replacement
            </p>
          </div>

          {/* Active Opportunities */}
          <div className="p-5 rounded-2xl glass-panel bg-slate-900/60 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Refill Opportunities</span>
              <div className="w-8 h-8 rounded-lg bg-rose-500/15 text-rose-400 flex items-center justify-center border border-rose-500/20">
                <Icon name="warning" className="text-sm" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-amber-400 font-mono">
                {recoveryOpportunities.length}
              </span>
              <span className="text-[11px] text-slate-400">
                ({waitlist.length} waitlisted students)
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              {recoveryOpportunities.length > 0 ? 'Actionable cancellations awaiting offer' : 'All slots fully booked!'}
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-800 overflow-x-auto pb-1 scrollbar-none relative z-10">
          <button
            id="tab-btn-recovery"
            onClick={() => setActiveTab('recovery')}
            className={`cursor-pointer px-4 py-2.5 text-xs font-semibold rounded-t-xl transition whitespace-nowrap flex items-center gap-2 border-b-2 ${
              activeTab === 'recovery'
                ? 'border-indigo-500 text-white bg-slate-900/80'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Icon name="auto_awesome" className="text-xs text-indigo-400" />
            Recovery Opportunities
            {recoveryOpportunities.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {recoveryOpportunities.length}
              </span>
            )}
          </button>

          <button
            id="tab-btn-schedule"
            onClick={() => setActiveTab('schedule')}
            className={`cursor-pointer px-4 py-2.5 text-xs font-semibold rounded-t-xl transition whitespace-nowrap flex items-center gap-2 border-b-2 ${
              activeTab === 'schedule'
                ? 'border-indigo-500 text-white bg-slate-900/80'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Icon name="calendar_today" className="text-xs text-indigo-400" />
            Upcoming Schedule
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300">
              {upcomingAppointments.length}
            </span>
          </button>

          <button
            id="tab-btn-cancellations"
            onClick={() => setActiveTab('cancellations')}
            className={`cursor-pointer px-4 py-2.5 text-xs font-semibold rounded-t-xl transition whitespace-nowrap flex items-center gap-2 border-b-2 ${
              activeTab === 'cancellations'
                ? 'border-indigo-500 text-white bg-slate-900/80'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Icon name="warning" className="text-xs text-amber-400" />
            Cancellation History
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300">
              {cancelledAppointments.length}
            </span>
          </button>

          <button
            id="tab-btn-waitlist"
            onClick={() => setActiveTab('waitlist')}
            className={`cursor-pointer px-4 py-2.5 text-xs font-semibold rounded-t-xl transition whitespace-nowrap flex items-center gap-2 border-b-2 ${
              activeTab === 'waitlist'
                ? 'border-indigo-500 text-white bg-slate-900/80'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Icon name="groups" className="text-xs text-indigo-400" />
            Priority Waitlist
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300">
              {waitlist.length}
            </span>
          </button>

          <button
            id="tab-btn-offers"
            onClick={() => setActiveTab('offers')}
            className={`cursor-pointer px-4 py-2.5 text-xs font-semibold rounded-t-xl transition whitespace-nowrap flex items-center gap-2 border-b-2 ${
              activeTab === 'offers'
                ? 'border-indigo-500 text-white bg-slate-900/80'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Icon name="chat" className="text-xs text-emerald-400" />
            Recovery Offers Log
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300">
              {offers.length}
            </span>
          </button>

          <button
            id="tab-btn-tests"
            onClick={() => setActiveTab('tests')}
            className={`cursor-pointer px-4 py-2.5 text-xs font-semibold rounded-t-xl transition whitespace-nowrap flex items-center gap-2 border-b-2 ${
              activeTab === 'tests'
                ? 'border-indigo-500 text-white bg-slate-900/80'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Icon name="verified_user" className="text-xs text-emerald-400" />
            10-Point Acceptance Test Suite
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              P0 Audit
            </span>
          </button>

          <button
            id="tab-btn-business"
            onClick={() => setActiveTab('business')}
            className={`cursor-pointer px-4 py-2.5 text-xs font-semibold rounded-t-xl transition whitespace-nowrap flex items-center gap-2 border-b-2 ${
              activeTab === 'business'
                ? 'border-indigo-500 text-white bg-slate-900/80'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Icon name="business_center" className="text-xs text-indigo-400" />
            Business Model &amp; Hypotheses
          </button>
        </div>

        {/* TAB 1: RECOVERY ENGINE OPPORTUNITIES */}
        {activeTab === 'recovery' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  Active Recovery Opportunities
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-normal bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                    Deterministic Matching
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  When a cancellation occurs, SlotSathi evaluates waitlist candidates and ranks them with an explainable match score.
                </p>
              </div>

              {recoveryOpportunities.length === 0 && (
                <button
                  onClick={handleSimulateCancellation}
                  className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold border border-amber-500/30 transition flex items-center gap-2 cursor-pointer"
                >
                  <Icon name="warning" className="text-xs" />
                  Simulate Cancellation to Test Matching
                </button>
              )}
            </div>

            {recoveryOpportunities.length > 0 ? (
              <div className="space-y-6">
                {recoveryOpportunities.map(({ slot, service, pendingOffers, matches }) => {
                  const { dateStr, timeStr } = formatDateTime(slot.start_time);
                  const topMatches = matches.slice(0, 3);

                  return (
                    <div
                      key={slot.id}
                      className="p-6 rounded-2xl glass-panel bg-slate-900/70 border border-slate-700/80 shadow-xl space-y-6"
                    >
                      {/* Cancelled Slot Header Card */}
                      <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-800/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold">
                              CANCELLED SLOT REQUIRING REFILL
                            </span>
                            {slot.is_demo_seed ? (
                              <Badge variant="demo">Illustrative Seed Record</Badge>
                            ) : (
                              <Badge variant="success">Live Booking</Badge>
                            )}
                            <span className="text-xs text-slate-400">
                              Cancelled at: {slot.cancelled_at ? new Date(slot.cancelled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}
                            </span>
                          </div>
                          <h3 className="text-base font-bold text-white">
                            {service.title} ({service.subject})
                          </h3>
                          <p className="text-xs text-slate-300">
                            🗓️ <strong className="text-white">{dateStr}</strong> at <strong className="text-white">{timeStr}</strong> ({service.duration_minutes} mins) • Fee: <strong className="text-emerald-400">₹{slot.price_inr}</strong>
                          </p>
                          <p className="text-xs text-slate-400">
                            Original Student: <span className="text-slate-200">{slot.customer_name}</span> • Reason: &ldquo;{slot.cancellation_reason || 'Personal emergency'}&rdquo;
                          </p>
                        </div>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-shrink-0">
                          {pendingOffers.length > 0 && (
                            <div className="px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-1.5">
                              <Icon name="schedule" className="text-xs" />
                              <span>{pendingOffers.length} Pending Offer Dispatched</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Matching Candidates Recommendations */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                            <Icon name="auto_awesome" className="text-xs text-indigo-400" />
                            Ranked Waitlist Candidates (Explainable Scoring)
                          </h4>
                          <span className="text-[11px] text-slate-400">
                            {matches.filter((m) => m.is_eligible).length} eligible matches
                          </span>
                        </div>

                        {topMatches.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {topMatches.map((match, idx) => {
                              const candidate = match.waitlist_entry;
                              const isOffered = pendingOffers.some((o) => o.waitlist_entry_id === candidate.id);

                              return (
                                <div
                                  key={candidate.id}
                                  className={`p-4 rounded-xl border flex flex-col justify-between transition ${
                                    match.is_eligible
                                      ? 'bg-slate-900/90 border-slate-700 hover:border-indigo-500/50'
                                      : 'bg-slate-950/50 border-slate-800 opacity-60'
                                  }`}
                                >
                                  <div className="space-y-3">
                                    {/* Candidate Header */}
                                    <div className="flex items-start justify-between gap-2">
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <h5 className="text-sm font-bold text-white">
                                            {candidate.customer_name}
                                          </h5>
                                          {candidate.urgency === 'high' && (
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                              Urgent
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-xs text-slate-400">{candidate.customer_phone}</p>
                                      </div>

                                      <div className="text-right">
                                        <div
                                          className={`text-sm font-mono font-extrabold px-2 py-0.5 rounded-lg border ${
                                            match.total_score >= 80
                                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                              : match.total_score >= 50
                                              ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                                              : 'bg-slate-800 text-slate-400 border-slate-700'
                                          }`}
                                        >
                                          {match.total_score}/100
                                        </div>
                                        <span className="text-[10px] text-slate-500 font-mono">
                                          Rank #{idx + 1}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Score Breakdown Factors */}
                                    <div className="space-y-1.5 pt-1">
                                      {match.score_factors.map((factor, fIdx) => (
                                        <div
                                          key={fIdx}
                                          className="text-[11px] flex items-center justify-between text-slate-300"
                                        >
                                          <span className="flex items-center gap-1.5 truncate">
                                            {factor.satisfied ? (
                                              <Icon name="check_circle" className="text-xs text-emerald-400 flex-shrink-0" />
                                            ) : (
                                              <Icon name="cancel" className="text-xs text-slate-600 flex-shrink-0" />
                                            )}
                                            <span className="truncate">{factor.factor}</span>
                                          </span>
                                          <span className="font-mono text-slate-400 text-[10px] flex-shrink-0 ml-1">
                                            +{factor.points}p
                                          </span>
                                        </div>
                                      ))}
                                    </div>

                                    {/* Student Notes */}
                                    {candidate.notes && (
                                      <p className="text-[11px] text-slate-400 italic bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
                                        &ldquo;{candidate.notes}&rdquo;
                                      </p>
                                    )}
                                  </div>

                                  {/* Action CTA */}
                                  <div className="pt-4 border-t border-slate-800/80 mt-4">
                                    {isOffered ? (
                                      <div className="py-2 px-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-medium text-center flex items-center justify-center gap-1.5">
                                        <Icon name="schedule" className="text-xs" />
                                        Offer Pending Response
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() =>
                                          handleInitiateOffer(
                                            slot.id,
                                            candidate,
                                            match.total_score,
                                            match.score_factors
                                              .filter((f) => f.satisfied)
                                              .map((f) => f.description)
                                          )
                                        }
                                        disabled={!match.is_eligible}
                                        className={`w-full py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer ${
                                          match.is_eligible
                                            ? 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-lg shadow-emerald-500/20'
                                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                        }`}
                                      >
                                        <Icon name="chat" className="text-xs text-slate-950" />
                                        Review &amp; Send WhatsApp Offer
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="p-8 text-center rounded-xl bg-slate-950/40 border border-slate-800 text-slate-400 text-xs">
                            No matching students found in the waitlist for this specific subject.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* All Recovered / No Cancellations State */
              <div className="p-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                  <Icon name="check_circle" className="text-3xl" />
                </div>
                <div className="max-w-md mx-auto">
                  <h3 className="text-base font-bold text-white">No Unrecovered Cancellations!</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    All cancellations have either been successfully refilled or no new cancellations have occurred. All current upcoming slots are confirmed.
                  </p>
                </div>
                <div className="pt-2 flex items-center justify-center gap-3">
                  <button
                    onClick={handleSimulateCancellation}
                    className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold border border-amber-500/30 transition flex items-center gap-2 cursor-pointer"
                  >
                    <Icon name="warning" className="text-xs" />
                    Simulate Student Cancellation (Test Engine)
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: UPCOMING SCHEDULE */}
        {activeTab === 'schedule' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Upcoming Confirmed Appointments</h2>
                <p className="text-xs text-slate-400">
                  Includes both original confirmed bookings and successfully recovered replacement sessions.
                </p>
              </div>

              <Link
                href="/book/aditi-sharma"
                target="_blank"
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/25 transition cursor-pointer"
              >
                <Icon name="calendar_today" className="text-xs" />
                + Book New Session
              </Link>
            </div>

            <div className="space-y-3">
              {upcomingAppointments.map((appt) => {
                const service = services.find((s) => s.id === appt.service_id) || services[0];
                const { dateStr, timeStr } = formatDateTime(appt.start_time);

                return (
                  <div
                    key={appt.id}
                    className={`p-4 sm:p-5 rounded-2xl glass-panel border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition ${
                      appt.is_replacement
                        ? 'border-emerald-500/40 bg-emerald-950/15'
                        : 'border-slate-800 bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          appt.is_replacement
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                        }`}
                      >
                        {appt.is_replacement ? (
                          <Icon name="auto_awesome" className="text-xl" />
                        ) : (
                          <Icon name="how_to_reg" className="text-xl" />
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-white">{appt.customer_name}</h4>
                          {appt.is_replacement ? (
                            <span className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                              <Icon name="auto_awesome" className="text-[10px]" />
                              RECOVERED VIA SLOTSATHI
                            </span>
                          ) : (
                            <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-slate-800 text-slate-300">
                              Original Booking
                            </span>
                          )}
                          {appt.is_demo_seed ? (
                            <Badge variant="demo">Illustrative Seed Record</Badge>
                          ) : (
                            <Badge variant="success">Live Booking</Badge>
                          )}
                          <span className="text-xs px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                            {service.subject}
                          </span>
                        </div>

                        <p className="text-xs text-slate-300">
                          {service.title} • 🗓️ <strong className="text-white">{dateStr}</strong> at <strong className="text-white">{timeStr}</strong> ({service.duration_minutes}m)
                        </p>

                        <p className="text-xs text-slate-400">
                          Phone: {appt.customer_phone} • Email: {appt.customer_email} • Fee: <strong className="text-emerald-400">₹{appt.price_inr}</strong>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:self-center">
                      {/* Customer Cancellation Link Shortcut for testing */}
                      <Link
                        href={`/cancel/${appt.cancellation_token}`}
                        target="_blank"
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-300 hover:text-rose-200 text-xs border border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
                        title="Open student cancellation link to test recovery workflow"
                      >
                        <Icon name="cancel" className="text-xs text-rose-400" />
                        <span>Cancel Link</span>
                        <Icon name="open_in_new" className="text-[10px] text-slate-400" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: CANCELLATION HISTORY (Audit Trail) */}
        {activeTab === 'cancellations' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white">Cancellation Audit Trail</h2>
              <p className="text-xs text-slate-400">
                Original cancelled appointment records are strictly preserved for historical compliance and metric derivation.
              </p>
            </div>

            <div className="space-y-3">
              {cancelledAppointments.map((appt) => {
                const service = services.find((s) => s.id === appt.service_id) || services[0];
                const { dateStr, timeStr } = formatDateTime(appt.start_time);
                // Check if refilled
                const replacement = appointments.find(
                  (a) => a.recovered_from_appointment_id === appt.id && a.status === 'confirmed'
                );

                return (
                  <div
                    key={appt.id}
                    className="p-5 rounded-2xl glass-panel bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          CANCELLED
                        </span>
                        {appt.is_demo_seed ? (
                          <Badge variant="demo">Illustrative Seed Record</Badge>
                        ) : (
                          <Badge variant="success">Live Record</Badge>
                        )}
                        <h4 className="text-sm font-bold text-white">{appt.customer_name}</h4>
                        <span className="text-xs text-slate-400">• {service.title}</span>
                      </div>

                      <p className="text-xs text-slate-300">
                        Scheduled for: {dateStr} at {timeStr} • Fee: ₹{appt.price_inr}
                      </p>

                      <p className="text-xs text-slate-400">
                        Reason: &ldquo;{appt.cancellation_reason || 'Unspecified'}&rdquo; • Cancelled: {appt.cancelled_at ? new Date(appt.cancelled_at).toLocaleString() : 'N/A'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {replacement ? (
                        <div className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center gap-1.5">
                          <Icon name="check_circle" className="text-xs text-emerald-400" />
                          <span>Refilled by {replacement.customer_name}</span>
                        </div>
                      ) : (
                        <div className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-medium flex items-center gap-1.5">
                          <Icon name="schedule" className="text-xs text-amber-400" />
                          <span>Awaiting Recovery</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: PRIORITY WAITLIST */}
        {activeTab === 'waitlist' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Priority Waitlist</h2>
                <p className="text-xs text-slate-400">
                  Interested students waiting for openings, indexed by subject, duration, and time preferences.
                </p>
              </div>

              <button
                onClick={() => setAddWaitlistOpen(true)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/25 transition cursor-pointer"
              >
                <Icon name="groups" className="text-xs" />
                + Add Student to Waitlist
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {waitlist.map((w) => {
                const service = services.find((s) => s.id === w.service_id) || services[0];
                return (
                  <div
                    key={w.id}
                    className="p-5 rounded-2xl glass-panel bg-slate-900/60 border border-slate-800 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-white">{w.customer_name}</h4>
                          {w.urgency === 'high' && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              High Urgency
                            </span>
                          )}
                          {w.is_demo_seed ? (
                            <Badge variant="demo">Illustrative Seed Record</Badge>
                          ) : (
                            <Badge variant="success">Live Record</Badge>
                          )}
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full capitalize ${
                              w.status === 'matched'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : w.status === 'offered'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {w.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {w.customer_phone} • {w.customer_email}
                        </p>
                      </div>

                      <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                        {service.subject}
                      </span>
                    </div>

                    <div className="text-xs text-slate-300 space-y-1">
                      <div>
                        Target Service: <strong className="text-white">{service.title}</strong> ({w.duration_minutes}m)
                      </div>
                      <div>
                        Preferred Windows: <span className="text-indigo-300 capitalize">{w.preferred_time_windows.join(', ')}</span>
                      </div>
                      <div>
                        Preferred Days: <span className="text-slate-400">{w.preferred_days.join(', ')}</span>
                      </div>
                      {w.notes && (
                        <p className="text-[11px] text-slate-400 italic bg-slate-950/60 p-2 rounded-lg border border-slate-800/60 mt-1">
                          &ldquo;{w.notes}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 5: ACTIVE & SENT OFFERS */}
        {activeTab === 'offers' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white">Recovery Offers Audit Log</h2>
              <p className="text-xs text-slate-400">
                Log of WhatsApp offer links dispatched to waitlisted students, with real-time status and security tokens.
              </p>
            </div>

            <div className="space-y-3">
              {offers.map((off) => (
                <div
                  key={off.id}
                  className="p-5 rounded-2xl glass-panel bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-mono uppercase font-semibold ${
                          off.status === 'accepted'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : off.status === 'pending'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {off.status}
                      </span>
                      <h4 className="text-sm font-bold text-white">{off.customer_name}</h4>
                      <span className="text-xs text-slate-400">• Match Score: {off.match_score}/100</span>
                    </div>

                    <p className="text-xs text-slate-300">
                      Service: {off.service_title} • Sent: {new Date(off.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Expires: {new Date(off.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>

                    <p className="text-[11px] font-mono text-slate-400">
                      Token: {off.token}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/offer/${off.token}`}
                      target="_blank"
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <span>Inspect Student Offer Page</span>
                      <Icon name="open_in_new" className="text-xs text-slate-400" />
                    </Link>

                    {off.whatsapp_url && (
                      <a
                        href={off.whatsapp_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-medium border border-emerald-500/30 flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Icon name="chat" className="text-xs" />
                        <span>WhatsApp Deep Link</span>
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 6: ACCEPTANCE TEST RUNNER */}
        {activeTab === 'tests' && (
          <TestRunnerView onResetDemo={handleResetDemo} />
        )}

        {/* TAB 7: BUSINESS MODEL & ARCHITECTURE */}
        {activeTab === 'business' && (
          <div className="space-y-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-mono">
                  BUSINESS &amp; FINANCE
                </span>
                <span className="text-xs text-slate-400">Freemium Hypothesis Requiring Validation</span>
              </div>
              <h2 className="text-xl font-bold text-white">Proposed Freemium Subscription Model</h2>
              <p className="text-xs text-slate-300 max-w-2xl mt-1">
                Designed specifically for independent Indian tutors whose hourly session value ranges between ₹800 and ₹2,500. A single recovered session easily repays 3 to 10 months of software fees.
              </p>
            </div>

            {/* Pricing Tiers Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Free Tier */}
              <div className="p-6 rounded-2xl glass-panel bg-slate-900/60 border border-slate-800 space-y-4">
                <div>
                  <h3 className="text-base font-bold text-white">Free Starter</h3>
                  <p className="text-xs text-slate-400 mt-1">Basic public booking &amp; calendar</p>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-white font-mono">₹0</span>
                  <span className="text-xs text-slate-400">/ month forever</span>
                </div>
                <ul className="space-y-2 text-xs text-slate-300">
                  <li className="flex items-center gap-2">✓ Public booking page (/book/slug)</li>
                  <li className="flex items-center gap-2">✓ Up to 15 appointments / month</li>
                  <li className="flex items-center gap-2">✓ 1 recovered cancellation per month</li>
                  <li className="flex items-center gap-2 text-slate-500">✕ WhatsApp deep link engine</li>
                  <li className="flex items-center gap-2 text-slate-500">✕ Custom ranking rules</li>
                </ul>
              </div>

              {/* Solo Tier (Recommended) */}
              <div className="p-6 rounded-2xl glass-panel bg-gradient-to-b from-indigo-950/40 via-slate-900/90 to-slate-900/90 border-2 border-indigo-500 shadow-xl shadow-indigo-500/10 space-y-4 relative">
                <div className="absolute -top-3 right-4 px-3 py-0.5 rounded-full bg-indigo-500 text-white text-[10px] font-bold tracking-wider uppercase">
                  Solo Tutor Choice
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Solo Tutor</h3>
                  <p className="text-xs text-slate-400 mt-1">Full recovery engine &amp; WhatsApp workflows</p>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-white font-mono">₹199</span>
                  <span className="text-xs text-slate-400">/ month (Hypothesis)</span>
                </div>
                <ul className="space-y-2 text-xs text-slate-300">
                  <li className="flex items-center gap-2 font-medium text-emerald-300">✓ Unlimited appointment recovery</li>
                  <li className="flex items-center gap-2 font-medium text-emerald-300">✓ Transparent deterministic matching engine</li>
                  <li className="flex items-center gap-2 font-medium text-emerald-300">✓ 1-Click WhatsApp prefilled offer generator</li>
                  <li className="flex items-center gap-2">✓ Priority student waitlist management</li>
                  <li className="flex items-center gap-2">✓ Financial recovery dashboard (INR metrics)</li>
                </ul>
                <div className="p-3 rounded-xl bg-indigo-950/60 border border-indigo-800/40 text-[11px] text-indigo-300 leading-relaxed">
                  💡 <strong>ROI Math:</strong> 1 recovered ₹1,200 Calculus session recovers <strong>6x</strong> the monthly software cost!
                </div>
              </div>

              {/* Studio Tier */}
              <div className="p-6 rounded-2xl glass-panel bg-slate-900/60 border border-slate-800 space-y-4">
                <div>
                  <h3 className="text-base font-bold text-white">Tutoring Studio</h3>
                  <p className="text-xs text-slate-400 mt-1">Multi-tutor and academy management</p>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-white font-mono">₹499</span>
                  <span className="text-xs text-slate-400">/ month (Hypothesis)</span>
                </div>
                <ul className="space-y-2 text-xs text-slate-300">
                  <li className="flex items-center gap-2">✓ Up to 5 tutor profiles &amp; subjects</li>
                  <li className="flex items-center gap-2">✓ Pooled academy waitlist distribution</li>
                  <li className="flex items-center gap-2">✓ Advanced analytics &amp; export</li>
                  <li className="flex items-center gap-2">✓ Custom branding on offer links</li>
                </ul>
              </div>
            </div>

            {/* Architecture & Engineering Integrity Card */}
            <div className="p-6 rounded-2xl glass-panel bg-slate-900/60 border border-slate-800 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Icon name="verified_user" className="text-sm text-emerald-400" />
                Technical Execution Highlights
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                • <strong>Atomic Stored Procedure / Concurrency Guard:</strong> Offers use atomic verification to prevent double-booking or stale offers from creating phantom appointments.
                <br />
                • <strong>Cancellation Preservation:</strong> When a student cancels, the appointment record is not deleted; its status is set to &lsquo;cancelled&rsquo; with the timestamp and reason recorded.
                <br />
                • <strong>Separation of Concerns:</strong> Replacements are inserted as distinct records (`is_replacement = true`, `recovered_from_appointment_id = ...`) ensuring independent auditability.
                <br />
                • <strong>Derived Metrics:</strong> Recovery rate, recovered INR, and average refill time are computed dynamically from database rows.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* WhatsApp Modal */}
      <WhatsAppPreviewModal
        isOpen={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        offer={selectedOffer}
        rawMessage={modalRawMessage}
        whatsappUrl={modalWhatsAppUrl}
        onOfferAcceptedLocally={() => {
          showNotification('Offer accepted! Replacement appointment atomically created.');
          fetchDashboardData();
        }}
      />

      {/* Add Waitlist Modal */}
      <AddWaitlistModal
        isOpen={addWaitlistOpen}
        onClose={() => setAddWaitlistOpen(false)}
        services={services}
        onAdded={() => {
          showNotification('Student added to priority waitlist!');
          fetchDashboardData();
        }}
      />
    </div>
  );
}
