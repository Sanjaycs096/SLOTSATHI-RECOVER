'use client';

import React, { Suspense, use, useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/icon';
import confetti from 'canvas-confetti';
import { Appointment, Provider, RecoveryOffer, Service } from '@/types';
import { formatDateTime } from '@/lib/whatsapp';

function OfferContent({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const unwrappedParams = use(params);
  const token = unwrappedParams.token;

  const [loading, setLoading] = useState(true);
  const [offer, setOffer] = useState<RecoveryOffer | null>(null);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [error, setError] = useState('');

  // Acceptance state
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptedAppointment, setAcceptedAppointment] = useState<Appointment | null>(null);

  // Remaining time in seconds
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);

  useEffect(() => {
    async function loadOffer() {
      try {
        const res = await fetch(`/api/offers/${token}`);
        const data = await res.json();
        if (data.success) {
          setOffer(data.offer);
          setAppointment(data.appointment || null);
          setProvider(data.provider || null);
          setService(data.service || null);

          // Calculate remaining seconds
          const expiresAt = new Date(data.offer.expires_at).getTime();
          const now = Date.now();
          const diffSeconds = Math.max(0, Math.floor((expiresAt - now) / 1000));
          setSecondsRemaining(diffSeconds);
        } else {
          setError(data.error || 'Offer not found or expired');
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load recovery offer');
      } finally {
        setLoading(false);
      }
    }
    loadOffer();
  }, [token]);

  // Live countdown timer
  useEffect(() => {
    if (secondsRemaining <= 0) return;
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [secondsRemaining]);

  const formatCountdown = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
  };

  const handleAcceptOffer = async () => {
    if (!offer) return;
    try {
      setIsAccepting(true);
      const res = await fetch(`/api/offers/${token}/accept`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success && data.replacementAppointment) {
        setOffer({ ...offer, status: 'accepted' });
        setAcceptedAppointment(data.replacementAppointment);
        // Trigger celebratory confetti
        confetti({
          particleCount: 120,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#10B981', '#4F46E5', '#F59E0B', '#3B82F6'],
        });
      } else {
        alert(data.error || 'Failed to claim recovery offer.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error claiming offer');
    } finally {
      setIsAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <Icon name="auto_awesome" className="text-3xl text-emerald-400 animate-spin mb-3" />
        <h2 className="text-sm font-semibold text-white">Loading Priority Offer...</h2>
      </div>
    );
  }

  if (error || !offer) {
    return (
      <div className="min-h-screen bg-[#090D16] text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full p-8 rounded-3xl glass-panel bg-slate-900/90 border border-rose-500/30 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <Icon name="cancel" className="text-3xl" />
          </div>
          <h1 className="text-xl font-bold text-white">Offer Not Available</h1>
          <p className="text-xs text-slate-300">
            {error || 'This recovery offer link is invalid or no longer active.'}
          </p>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium transition cursor-pointer"
            >
              ← Back to SlotSathi Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isExpired = secondsRemaining <= 0 || offer.status === 'expired';
  const isAccepted = offer.status === 'accepted' || !!acceptedAppointment;
  const isRevoked = offer.status === 'revoked';

  const startTimeIso = appointment?.start_time || offer.slot_start_time || new Date().toISOString();
  const { dateStr, timeStr } = formatDateTime(startTimeIso);

  // Accepted confirmation screen
  if (isAccepted) {
    return (
      <div className="min-h-screen bg-[#090D16] text-white flex flex-col items-center justify-center p-4 selection:bg-emerald-500 selection:text-white">
        <div className="max-w-lg w-full p-8 rounded-3xl glass-panel bg-slate-900/90 border border-emerald-500/40 shadow-2xl space-y-6 text-center animate-in zoom-in-95 duration-300">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
            <Icon name="auto_awesome" className="text-4xl" />
          </div>

          <div className="space-y-1">
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
              SLOT RECOVERED &amp; CONFIRMED
            </span>
            <h1 className="text-2xl font-extrabold text-white mt-2">
              You&apos;re Confirmed with {provider?.name}!
            </h1>
            <p className="text-xs text-slate-300">
              Your priority offer has been atomically reserved. We&apos;ve added this 1-on-1 tutoring session to {provider?.name}&apos;s verified schedule.
            </p>
          </div>

          {/* Session Details Card */}
          <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 text-left space-y-2.5 text-xs">
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Student Name</span>
              <span className="text-white font-bold">{offer.customer_name}</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Subject</span>
              <span className="text-indigo-300 font-bold">{service?.title || offer.service_title}</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Session Date &amp; Time</span>
              <span className="text-white font-semibold">{dateStr} at {timeStr}</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Duration &amp; Fee</span>
              <span className="text-emerald-400 font-mono font-bold">
                {service?.duration_minutes || 60}m • ₹{appointment?.price_inr || offer.price_inr}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Recovery Status</span>
              <span className="text-emerald-400 font-mono font-medium">Atomically Reserved (Record Created)</span>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/"
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-indigo-600/25 cursor-pointer"
            >
              ← Return to Tutor Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-white">
      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition cursor-pointer"
          >
            <Icon name="arrow_back" className="text-sm" />
            <span>SlotSathi Dashboard</span>
          </Link>
          <span className="text-xs text-emerald-400 font-mono flex items-center gap-1.5">
            <Icon name="verified_user" className="text-sm" />
            Priority Waitlist Offer
          </span>
        </div>
      </header>

      <main className="max-w-2xl w-full mx-auto px-4 py-8 space-y-6 flex-1">
        <div className="p-6 sm:p-8 rounded-3xl glass-panel bg-slate-900/85 border border-emerald-500/30 shadow-2xl space-y-6">
          {/* Priority Header */}
          <div className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5">
                <Icon name="auto_awesome" className="text-sm text-emerald-400" />
                PRIORITY RECOVERY OFFER RESERVED FOR YOU
              </span>

              {/* Countdown Badge */}
              {!isExpired && !isRevoked && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-xs">
                  <Icon name="schedule" className="text-sm text-amber-400" />
                  <span>Expires in: {formatCountdown(secondsRemaining)}</span>
                </div>
              )}
            </div>

            <h1 className="text-2xl font-extrabold text-white mt-2">
              A 1-on-1 Tutoring Slot Just Opened Up!
            </h1>
            <p className="text-xs text-slate-300 leading-relaxed">
              Hi <strong className="text-white">{offer.customer_name}</strong>, a student cancellation has opened an earlier session with <strong className="text-white">{provider?.name}</strong>. Because of your priority waitlist rank, this slot is temporarily reserved for you.
            </p>
          </div>

          {/* Tutor & Session Card */}
          <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
            <div className="flex items-center gap-4 border-b border-slate-800/80 pb-4">
              <div className="w-14 h-14 rounded-2xl overflow-hidden bg-indigo-600/20 border border-indigo-500/30 flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={provider?.avatar_url}
                  alt={provider?.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">{provider?.name}</h3>
                <p className="text-xs text-slate-400">{provider?.title}</p>
                <p className="text-[11px] text-emerald-400 font-mono mt-0.5">
                  ⭐ IIT Bombay Alumna • 8+ Yrs Mentoring
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[11px] text-slate-400 block mb-0.5">Subject / Topic</span>
                <span className="font-bold text-white">{service?.title || offer.service_title}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[11px] text-slate-400 block mb-0.5">Date &amp; Time</span>
                <span className="font-bold text-indigo-300">{dateStr} at {timeStr}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[11px] text-slate-400 block mb-0.5">Session Duration</span>
                <span className="font-bold text-white">{service?.duration_minutes || 60} Minutes</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[11px] text-slate-400 block mb-0.5">Session Fee</span>
                <span className="font-bold text-emerald-400 font-mono">
                  ₹{appointment?.price_inr || offer.price_inr} INR
                </span>
              </div>
            </div>
          </div>

          {/* Explainability Callout */}
          <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-800/40 space-y-2">
            <h4 className="text-xs font-semibold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
              <Icon name="verified_user" className="text-sm text-indigo-400" />
              Why Did You Receive This Offer?
            </h4>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              SlotSathi matched your waitlist submission with a score of <strong className="text-white font-mono">{offer.match_score}/100</strong>. Your requested duration, subject requirements, and preferred afternoon time window directly fit this opening.
            </p>
          </div>

          {/* State Warnings or Accept Button */}
          {isRevoked ? (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/50 text-xs text-rose-300 flex items-center gap-2">
              <Icon name="warning" className="text-sm flex-shrink-0" />
              <span>This offer was revoked because another student already claimed this recovery slot.</span>
            </div>
          ) : isExpired ? (
            <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/50 text-xs text-amber-300 flex items-center gap-2">
              <Icon name="schedule" className="text-sm flex-shrink-0" />
              <span>This offer has expired. The slot has been released to the next candidate on the waitlist.</span>
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <button
                onClick={handleAcceptOffer}
                disabled={isAccepting}
                className="w-full py-3.5 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-98 text-slate-950 font-bold text-sm shadow-xl shadow-emerald-500/25 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Icon name="auto_awesome" className="text-base" />
                {isAccepting ? 'Reserving Slot Atomically...' : 'Accept & Confirm This Session'}
              </button>
              <p className="text-[11px] text-slate-400 text-center">
                One-click confirmation. No upfront prepayment required for this hackathon preview.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function OfferClaimPage(props: {
  params: Promise<{ token: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#090D16] flex items-center justify-center text-slate-300 text-xs">
          Loading recovery offer...
        </div>
      }
    >
      <OfferContent {...props} />
    </Suspense>
  );
}
