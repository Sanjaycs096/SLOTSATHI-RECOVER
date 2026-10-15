'use client';

import React, { Suspense, use, useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/icon';
import { Appointment, Provider, Service } from '@/types';
import { formatDateTime } from '@/lib/whatsapp';

function CancellationContent({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const unwrappedParams = use(params);
  const token = unwrappedParams.token;

  const [loading, setLoading] = useState(true);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [error, setError] = useState('');

  // Cancellation form
  const [reasonCategory, setReasonCategory] = useState('Academic schedule clash');
  const [customReason, setCustomReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelledSuccess, setCancelledSuccess] = useState(false);

  useEffect(() => {
    async function fetchAppointment() {
      try {
        const res = await fetch(`/api/cancellations/${token}`);
        const data = await res.json();
        if (data.success) {
          setAppointment(data.appointment);
          setProvider(data.provider);
          setService(data.service);
          if (data.appointment.status === 'cancelled') {
            setCancelledSuccess(true);
          }
        } else {
          setError(data.error || 'Invalid cancellation link');
        }
      } catch (err) {
        console.error(err);
        setError('Failed to fetch appointment details');
      } finally {
        setLoading(false);
      }
    }
    fetchAppointment();
  }, [token]);

  const handleConfirmCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsCancelling(true);
      const fullReason = customReason
        ? `${reasonCategory}: ${customReason}`
        : reasonCategory;

      const res = await fetch(`/api/cancellations/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: fullReason }),
      });

      const data = await res.json();
      if (data.success && data.appointment) {
        setAppointment(data.appointment);
        setCancelledSuccess(true);
      } else {
        setError(data.error || 'Failed to cancel appointment');
      }
    } catch (err) {
      console.error(err);
      setError('Network error processing cancellation');
    } finally {
      setIsCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <Icon name="schedule" className="text-3xl text-amber-400 animate-spin mb-3" />
        <h2 className="text-sm font-semibold text-white">Loading Cancellation Portal...</h2>
      </div>
    );
  }

  if (error || !appointment) {
    return (
      <div className="min-h-screen bg-[#090D16] text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full p-8 rounded-3xl glass-panel bg-slate-900/90 border border-rose-500/30 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <Icon name="cancel" className="text-3xl" />
          </div>
          <h1 className="text-xl font-bold text-white">Cancellation Link Expired or Invalid</h1>
          <p className="text-xs text-slate-300">
            {error || 'We could not locate an active appointment corresponding to this security token.'}
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

  const { dateStr, timeStr } = formatDateTime(appointment.start_time);

  // Success screen after cancellation
  if (cancelledSuccess) {
    return (
      <div className="min-h-screen bg-[#090D16] text-white flex flex-col items-center justify-center p-4 selection:bg-rose-500 selection:text-white">
        <div className="max-w-lg w-full p-8 rounded-3xl glass-panel bg-slate-900/90 border border-slate-700 shadow-2xl space-y-6 text-center animate-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto">
            <Icon name="check_circle" className="text-4xl" />
          </div>

          <div className="space-y-1">
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
              SESSION CANCELLED
            </span>
            <h1 className="text-2xl font-extrabold text-white mt-2">
              Appointment Successfully Cancelled
            </h1>
            <p className="text-xs text-slate-300">
              {provider?.name} has been notified and your schedule has been updated.
            </p>
          </div>

          {/* Preserved Cancellation Audit Info */}
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 text-left space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Original Student</span>
              <span className="text-white font-medium">{appointment.customer_name}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Subject</span>
              <span className="text-indigo-300 font-medium">{service?.title}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Scheduled Time</span>
              <span className="text-white">{dateStr} at {timeStr}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Cancellation Timestamp</span>
              <span className="text-slate-300 font-mono">
                {appointment.cancelled_at ? new Date(appointment.cancelled_at).toLocaleTimeString() : 'Just now'}
              </span>
            </div>
          </div>

          {/* Recovery Notification Pill */}
          <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/40 text-left space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
              <Icon name="auto_awesome" className="text-base text-emerald-400" />
              <span>Slot Transferred to Recovery Queue</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Thanks to your early cancellation, SlotSathi&apos;s matching engine is now offering this time slot to students waiting on {provider?.name}&apos;s priority waitlist!
            </p>
          </div>

          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-indigo-600/25 cursor-pointer"
            >
              ← Return to SlotSathi Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 flex flex-col selection:bg-rose-500 selection:text-white">
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
          <span className="text-xs text-rose-400 font-mono flex items-center gap-1.5">
            <Icon name="warning" className="text-sm" />
            Cancellation Portal
          </span>
        </div>
      </header>

      <main className="max-w-2xl w-full mx-auto px-4 py-8 space-y-6 flex-1">
        <div className="p-6 sm:p-8 rounded-3xl glass-panel bg-slate-900/85 border border-slate-800 shadow-2xl space-y-6">
          <div className="space-y-1">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
              CONFIRM CANCELLATION
            </span>
            <h1 className="text-2xl font-extrabold text-white mt-2">
              Cancel Tutoring Session
            </h1>
            <p className="text-xs text-slate-300">
              Review your appointment details below before releasing your slot.
            </p>
          </div>

          {/* Appointment Summary Box */}
          <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
              <span className="text-xs text-slate-400">Tutor</span>
              <span className="text-xs font-bold text-white">{provider?.name} ({provider?.title})</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
              <span className="text-xs text-slate-400">Subject</span>
              <span className="text-xs font-bold text-indigo-300">{service?.title}</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
              <span className="text-xs text-slate-400">Date &amp; Time</span>
              <span className="text-xs font-semibold text-white">{dateStr} at {timeStr}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Booked by</span>
              <span className="text-xs text-slate-200">{appointment.customer_name}</span>
            </div>
          </div>

          {/* Friendly Note */}
          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60 text-xs text-slate-300 leading-relaxed flex items-start gap-3">
            <Icon name="info" className="text-lg text-indigo-400 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="text-white">Why cancel early?</strong> By confirming now, this slot will be offered to an eager student on Dr. Sharma&apos;s priority waitlist who needs urgent exam preparation.
            </div>
          </div>

          {/* Cancellation Form */}
          <form onSubmit={handleConfirmCancel} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Reason for Cancellation
              </label>
              <select
                value={reasonCategory}
                onChange={(e) => setReasonCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-rose-500 transition"
              >
                <option value="Academic schedule clash">Academic schedule clash / Exam conflict</option>
                <option value="Illness or medical reason">Illness or unwell</option>
                <option value="Travel / family emergency">Travel / Family emergency</option>
                <option value="Topic already covered">Topic already covered</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Additional Note for Tutor (Optional)
              </label>
              <textarea
                rows={2}
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Let your tutor know any rescheduling preference..."
                className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-rose-500 transition resize-none"
              />
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
              <Link
                href="/"
                className="w-full sm:w-1/2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium text-center border border-slate-700 transition cursor-pointer"
              >
                Keep My Appointment
              </Link>
              <button
                type="submit"
                disabled={isCancelling}
                className="w-full sm:w-1/2 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white text-xs font-bold transition shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isCancelling ? 'Processing...' : 'Confirm & Cancel Slot'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

export default function CancellationPage(props: {
  params: Promise<{ token: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#090D16] flex items-center justify-center text-slate-300 text-xs">
          Loading cancellation portal...
        </div>
      }
    >
      <CancellationContent {...props} />
    </Suspense>
  );
}
