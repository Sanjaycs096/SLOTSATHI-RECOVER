'use client';

import React, { useState } from 'react';
import { Icon } from '@/components/ui/icon';
import { Service, TimeWindow, UrgencyLevel } from '@/types';

interface AddWaitlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  services: Service[];
  onAdded: () => void;
}

export function AddWaitlistModal({
  isOpen,
  onClose,
  services,
  onAdded,
}: AddWaitlistModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [serviceId, setServiceId] = useState(services[0]?.id || '');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [urgency, setUrgency] = useState<UrgencyLevel>('normal');
  const [selectedWindows, setSelectedWindows] = useState<TimeWindow[]>(['afternoon']);
  const [selectedDays, setSelectedDays] = useState<string[]>([
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
  ]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const toggleWindow = (win: TimeWindow) => {
    if (selectedWindows.includes(win)) {
      if (selectedWindows.length > 1) {
        setSelectedWindows(selectedWindows.filter((w) => w !== win));
      }
    } else {
      setSelectedWindows([...selectedWindows, win]);
    }
  };

  const toggleDay = (day: string) => {
    if (selectedDays.includes(day)) {
      if (selectedDays.length > 1) {
        setSelectedDays(selectedDays.filter((d) => d !== day));
      }
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name || !email || !phone) {
      setError('Please fill in student name, email, and phone number.');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: name,
          customer_email: email,
          customer_phone: phone,
          service_id: serviceId || services[0]?.id,
          duration_minutes: durationMinutes,
          urgency,
          preferred_time_windows: selectedWindows,
          preferred_days: selectedDays,
          notes,
        }),
      });

      const data = await res.json();
      if (data.success) {
        onAdded();
        onClose();
        setName('');
        setEmail('');
        setPhone('');
        setNotes('');
      } else {
        setError(data.error || 'Failed to add student to waitlist');
      }
    } catch (err) {
      console.error(err);
      setError('Network error submitting waitlist entry');
    } finally {
      setLoading(false);
    }
  };

  const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <Icon name="person_add" className="text-xl" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Add Student to Waitlist</h3>
              <p className="text-xs text-slate-400">Enters candidate into deterministic recovery matching pool</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <Icon name="close" className="text-xl" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800/60 text-xs text-rose-300">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Student Full Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Diya Sen"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Email Address *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="diya@example.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">WhatsApp Phone *</label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 12345"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Requested Subject / Service</label>
            <select
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
            >
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} ({s.subject} • ₹{s.price_inr})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Duration</label>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
              >
                <option value={60}>60 Minutes</option>
                <option value={90}>90 Minutes</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Urgency Priority</label>
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value as UrgencyLevel)}
                className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
              >
                <option value="normal">Normal Priority</option>
                <option value="high">High (Exam/Deadline Soon)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Preferred Time Windows</label>
            <div className="flex gap-2">
              {(['morning', 'afternoon', 'evening'] as TimeWindow[]).map((win) => {
                const active = selectedWindows.includes(win);
                return (
                  <button
                    key={win}
                    type="button"
                    onClick={() => toggleWindow(win)}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium border capitalize transition ${
                      active
                        ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {win}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Preferred Days</label>
            <div className="flex flex-wrap gap-1.5">
              {allDays.map((d) => {
                const active = selectedDays.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    className={`py-1 px-2.5 rounded-lg text-xs font-medium border transition ${
                      active
                        ? 'bg-emerald-600/30 border-emerald-500 text-emerald-200'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {d.substring(0, 3)}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Notes / Target Goals</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. CBSE 12th Board exam prep, needs doubt solving on integrals"
              className="w-full px-3.5 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500 transition resize-none"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2"
            >
              {loading ? 'Adding Candidate...' : 'Add Student to Priority Waitlist'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
