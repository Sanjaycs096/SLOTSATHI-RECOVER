'use client';

import React, { Suspense, use, useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/icon';
import { Provider, Service, Appointment } from '@/types';
import { formatDateTime } from '@/lib/whatsapp';

function BookingContent({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const unwrappedParams = use(params);
  const slug = unwrappedParams.slug;

  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  // Booking form state
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [selectedDateIndex, setSelectedDateIndex] = useState<number>(0);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [studentPhone, setStudentPhone] = useState('');
  const [notes, setNotes] = useState('');

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmedBooking, setConfirmedBooking] = useState<Appointment | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Waitlist drawer state
  const [showWaitlistForm, setShowWaitlistForm] = useState(false);
  const [waitlistSuccess, setWaitlistSuccess] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/bookings', { cache: 'no-store' });
        const data = await res.json();
        if (data.success) {
          setProvider(data.provider);
          setServices(data.services);
          setAppointments(data.appointments);
          if (data.services.length > 0) {
            setSelectedServiceId(data.services[0].id);
          }
        }
      } catch (err) {
        console.error('Error loading booking data', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [slug]);

  // Generate 4 upcoming business days for slot selection
  const availableDates = [1, 2, 3, 4].map((offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return {
      dateObj: d,
      dateStr: d.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' }),
      isoDate: d.toISOString().split('T')[0],
    };
  });

  const selectedDate = availableDates[selectedDateIndex];
  const selectedService = services.find((s) => s.id === selectedServiceId) || services[0];

  // Daily standard tutor slot schedule (10:00 AM, 11:30 AM, 2:00 PM, 4:00 PM, 5:30 PM)
  const slotTemplates = [
    { hour: 10, minute: 0, label: '10:00 AM' },
    { hour: 11, minute: 30, label: '11:30 AM' },
    { hour: 14, minute: 0, label: '02:00 PM' },
    { hour: 16, minute: 0, label: '04:00 PM' },
    { hour: 17, minute: 30, label: '05:30 PM' },
  ];

  // Check which slot templates conflict with active confirmed appointments
  const evaluatedSlots = slotTemplates.map((tmpl) => {
    const start = new Date(selectedDate.dateObj);
    start.setHours(tmpl.hour, tmpl.minute, 0, 0);

    const durationMin = selectedService?.duration_minutes || 60;
    const end = new Date(start.getTime() + durationMin * 60 * 1000);

    // Conflict check
    const isBooked = appointments.some((appt) => {
      if (appt.status !== 'confirmed') return false;
      const apptStart = new Date(appt.start_time).getTime();
      const apptEnd = new Date(appt.end_time).getTime();
      return start.getTime() < apptEnd && end.getTime() > apptStart;
    });

    return {
      label: tmpl.label,
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      isBooked,
    };
  });

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedTimeSlot) {
      setError('Please choose an available appointment time slot.');
      return;
    }
    if (!studentName || !studentEmail || !studentPhone) {
      setError('Please fill in student name, email, and phone number.');
      return;
    }

    const slotInfo = evaluatedSlots.find((s) => s.startIso === selectedTimeSlot);
    if (!slotInfo) {
      setError('Selected time slot is invalid.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider_id: provider?.id,
          service_id: selectedService.id,
          customer_name: studentName,
          customer_email: studentEmail,
          customer_phone: studentPhone,
          start_time: slotInfo.startIso,
          end_time: slotInfo.endIso,
        }),
      });

      const data = await res.json();
      if (data.success && data.appointment) {
        setConfirmedBooking(data.appointment);
      } else {
        setError(data.error || 'Failed to complete booking. Slot may have been taken.');
      }
    } catch (err) {
      console.error(err);
      setError('Network error processing booking.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName || !studentEmail || !studentPhone) {
      setError('Please fill in your details to join the waitlist.');
      return;
    }
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: studentName,
          customer_email: studentEmail,
          customer_phone: studentPhone,
          service_id: selectedService.id,
          duration_minutes: selectedService.duration_minutes,
          urgency: 'high',
          preferred_time_windows: ['afternoon', 'evening'],
          notes: notes || 'Preferred slots were full on public booking page.',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setWaitlistSuccess(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <Icon name="auto_awesome" className="text-3xl text-indigo-400 animate-spin mb-3" />
        <h2 className="text-sm font-semibold text-white">Loading Tutor Schedule...</h2>
      </div>
    );
  }

  // Booking Confirmation Screen
  if (confirmedBooking) {
    const cancelUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/cancel/${confirmedBooking.cancellation_token}`;
    const { dateStr, timeStr } = formatDateTime(confirmedBooking.start_time);

    return (
      <div className="min-h-screen bg-[#090D16] text-white flex flex-col items-center justify-center p-4 selection:bg-emerald-500 selection:text-white">
        <div className="max-w-lg w-full p-8 rounded-3xl glass-panel bg-slate-900/90 border border-emerald-500/40 shadow-2xl space-y-6 text-center animate-in zoom-in-95 duration-300">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
            <Icon name="check_circle" className="text-4xl" />
          </div>

          <div className="space-y-1">
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              BOOKING CONFIRMED
            </span>
            <h1 className="text-2xl font-extrabold text-white mt-2">
              You&apos;re Scheduled with {provider?.name}!
            </h1>
            <p className="text-xs text-slate-300">
              A confirmation email &amp; WhatsApp invite have been sent to {confirmedBooking.customer_phone}.
            </p>
          </div>

          {/* Session Details Card */}
          <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 text-left space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <span className="text-xs text-slate-400">Subject / Session</span>
              <span className="text-xs font-bold text-indigo-300">{selectedService?.title}</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <span className="text-xs text-slate-400">Date &amp; Time</span>
              <span className="text-xs font-semibold text-white">
                {dateStr} at {timeStr}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <span className="text-xs text-slate-400">Duration &amp; Fee</span>
              <span className="text-xs font-mono font-bold text-emerald-400">
                {selectedService?.duration_minutes}m • ₹{confirmedBooking.price_inr}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Student Name</span>
              <span className="text-xs text-white">{confirmedBooking.customer_name}</span>
            </div>
          </div>

          {/* Cancellation Link Notice (Critical for Recovery Workflow Demo!) */}
          <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-800/40 text-left space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-300">
              <Icon name="verified_user" className="text-base text-indigo-400" />
              <span>Your Secure Cancellation Link</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              If an emergency occurs, using this link cancels your booking early so another student on Dr. Sharma&apos;s waitlist can recover the slot:
            </p>
            <div className="flex items-center gap-2 pt-1">
              <input
                readOnly
                value={cancelUrl}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300 font-mono select-all focus:outline-none"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(cancelUrl);
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2000);
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex-shrink-0 flex items-center gap-1 border border-slate-700 cursor-pointer"
              >
                {copiedLink ? <Icon name="check" className="text-xs text-emerald-400" /> : <Icon name="content_copy" className="text-xs" />}
                {copiedLink ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/"
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium border border-slate-700 transition cursor-pointer"
            >
              ← Return to Tutor Dashboard
            </Link>
            <Link
              href={`/cancel/${confirmedBooking.cancellation_token}`}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-medium border border-rose-500/30 transition cursor-pointer"
            >
              Test Cancel Flow →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition cursor-pointer"
          >
            <Icon name="arrow_back" className="text-sm" />
            <span>SlotSathi Recover Dashboard</span>
          </Link>
          <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Verified Tutor Profile
          </div>
        </div>
      </header>

      <main className="max-w-4xl w-full mx-auto px-4 py-8 space-y-8 flex-1">
        {/* Tutor Profile Header Card */}
        {provider && (
          <div className="p-6 sm:p-8 rounded-3xl glass-panel bg-slate-900/80 border border-slate-800 shadow-xl flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-indigo-500 to-emerald-400 p-[2px] shadow-lg shadow-indigo-500/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={provider.avatar_url}
                  alt={provider.name}
                  className="w-full h-full object-cover rounded-[14px]"
                />
              </div>
              <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-emerald-500 text-slate-950">
                <Icon name="verified_user" className="text-xs" />
              </div>
            </div>

            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-extrabold text-white">
                  {provider.name}
                </h1>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {provider.title}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{provider.bio}</p>
              <div className="flex items-center gap-4 text-xs text-slate-400 pt-1 flex-wrap">
                <span>📍 {provider.location}</span>
                <span>⏱️ {provider.timezone}</span>
                <span>⭐ 4.95 (140+ sessions completed)</span>
              </div>
            </div>
          </div>
        )}

        {/* Booking Form Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Step 1: Select Service (Left column) */}
          <div className="md:col-span-1 space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <span>1. Choose Subject / Service</span>
            </h2>

            <div className="space-y-2.5">
              {services.map((srv) => {
                const isSelected = srv.id === selectedServiceId;
                return (
                  <button
                    key={srv.id}
                    type="button"
                    onClick={() => {
                      setSelectedServiceId(srv.id);
                      setSelectedTimeSlot('');
                    }}
                    className={`w-full p-4 rounded-2xl border text-left transition flex flex-col justify-between ${
                      isSelected
                        ? 'bg-indigo-950/40 border-indigo-500 shadow-lg shadow-indigo-500/10'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs px-2 py-0.5 rounded-md font-semibold bg-slate-800 text-indigo-300">
                          {srv.subject}
                        </span>
                        <span className="text-xs font-mono font-bold text-emerald-400">
                          ₹{srv.price_inr}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-white mt-1">{srv.title}</h3>
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                        {srv.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-3 border-t border-slate-800/80 mt-3">
                      <span>{srv.duration_minutes} Mins</span>
                      <span className="text-indigo-400 font-medium">1-on-1 Interactive</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Date & Available Slots (Right 2 columns) */}
          <div className="md:col-span-2 space-y-6">
            {/* Date Selection Carousel */}
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                2. Select Date
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {availableDates.map((item, idx) => {
                  const isSelected = selectedDateIndex === idx;
                  return (
                    <button
                      key={item.isoDate}
                      type="button"
                      onClick={() => {
                        setSelectedDateIndex(idx);
                        setSelectedTimeSlot('');
                      }}
                      className={`p-3 rounded-xl border text-center transition ${
                        isSelected
                          ? 'bg-indigo-600 border-indigo-500 text-white font-bold shadow-md shadow-indigo-600/30'
                          : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs">{item.dateStr}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time Slots Grid with Overlap / Conflict Validation */}
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
                <span>3. Available Time Slots</span>
                <span className="text-[11px] text-slate-400 font-normal">
                  Checked live against tutor calendar
                </span>
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {evaluatedSlots.map((slot) => {
                  const isSelected = selectedTimeSlot === slot.startIso;
                  if (slot.isBooked) {
                    return (
                      <div
                        key={slot.startIso}
                        className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center opacity-50 cursor-not-allowed"
                      >
                        <div className="text-xs line-through text-slate-500">{slot.label}</div>
                        <span className="text-[10px] text-rose-400 font-mono block mt-0.5">
                          RESERVED
                        </span>
                      </div>
                    );
                  }

                  return (
                    <button
                      key={slot.startIso}
                      type="button"
                      onClick={() => setSelectedTimeSlot(slot.startIso)}
                      className={`p-3 rounded-xl border text-center transition flex flex-col items-center justify-center ${
                        isSelected
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold ring-2 ring-emerald-500/40 shadow-lg shadow-emerald-500/10'
                          : 'bg-slate-900/60 border-slate-800 text-slate-200 hover:border-indigo-500/50 hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="text-xs font-semibold">{slot.label}</div>
                      <span className="text-[10px] text-emerald-400 font-mono block mt-0.5">
                        AVAILABLE
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Student Details Form */}
            <form onSubmit={handleBookingSubmit} className="p-6 rounded-2xl glass-panel bg-slate-900/70 border border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Icon name="person" className="text-sm text-indigo-400" />
                4. Student Information
              </h3>

              {error && (
                <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800/60 text-xs text-rose-300 flex items-center gap-2">
                  <Icon name="warning" className="text-sm flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="e.g. Priyanshu Roy"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={studentEmail}
                    onChange={(e) => setStudentEmail(e.target.value)}
                    placeholder="priyanshu@example.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">WhatsApp Phone *</label>
                  <input
                    type="tel"
                    required
                    value={studentPhone}
                    onChange={(e) => setStudentPhone(e.target.value)}
                    placeholder="+91 98765 00112"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Learning Goal / Current Topics (Optional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Preparing for JEE Mains Math, need help with Definite Integrals."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500 transition resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !selectedTimeSlot}
                className={`w-full py-3 px-4 rounded-xl font-bold text-sm transition shadow-lg flex items-center justify-center gap-2 cursor-pointer ${
                  selectedTimeSlot
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                {isSubmitting ? (
                  'Reserving Slot...'
                ) : selectedTimeSlot ? (
                  `Confirm Booking (${selectedService?.title} • ₹${selectedService?.price_inr})`
                ) : (
                  'Select an available time slot above'
                )}
              </button>
            </form>

            {/* Waitlist Callout if preferred times are booked */}
            <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-800/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-indigo-300">
                  Can&apos;t find your preferred time slot?
                </h4>
                <p className="text-[11px] text-slate-400">
                  Join Dr. Aditi Sharma&apos;s priority recovery waitlist. If any student cancels, you&apos;ll get first access via WhatsApp!
                </p>
              </div>
              <button
                onClick={() => setShowWaitlistForm(!showWaitlistForm)}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 text-xs font-medium border border-indigo-500/40 transition flex-shrink-0 cursor-pointer"
              >
                {showWaitlistForm ? 'Hide Waitlist Form' : 'Join Priority Waitlist'}
              </button>
            </div>

            {/* Quick Waitlist Join Inline Form */}
            {showWaitlistForm && (
              <div className="p-5 rounded-2xl glass-panel bg-slate-900 border border-indigo-500/40 space-y-3 animate-in fade-in duration-200">
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Icon name="auto_awesome" className="text-xs text-indigo-400" />
                  Join Priority Recovery Waitlist
                </h4>
                {waitlistSuccess ? (
                  <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/50 text-xs text-emerald-300">
                    ✓ You are now on the priority waitlist! If a slot opens up, you will receive a WhatsApp offer instantly.
                  </div>
                ) : (
                  <form onSubmit={handleWaitlistSubmit} className="space-y-3">
                    <p className="text-[11px] text-slate-400">
                      We will prioritize your submission by subject and timing compatibility.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        required
                        placeholder="Student Name"
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white"
                      />
                      <input
                        type="email"
                        required
                        placeholder="Email"
                        value={studentEmail}
                        onChange={(e) => setStudentEmail(e.target.value)}
                        className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white"
                      />
                      <input
                        type="tel"
                        required
                        placeholder="WhatsApp Phone"
                        value={studentPhone}
                        onChange={(e) => setStudentPhone(e.target.value)}
                        className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-bold transition shadow-md"
                    >
                      Submit Waitlist Preference
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function PublicBookingPage(props: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#090D16] flex items-center justify-center text-slate-300 text-xs">
          Loading booking schedule...
        </div>
      }
    >
      <BookingContent {...props} />
    </Suspense>
  );
}
