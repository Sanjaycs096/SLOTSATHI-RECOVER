'use client';

import React from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/icon';
import { Provider } from '@/types';

interface NavbarProps {
  provider: Provider | null;
  onResetDemo: () => void;
  isResetting?: boolean;
}

export function Navbar({ provider, onResetDemo, isResetting }: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-400 p-[1.5px] shadow-lg shadow-indigo-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Icon name="auto_awesome" className="text-xl text-emerald-400 group-hover:rotate-12 transition duration-300" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base tracking-tight text-white">
                  SlotSathi
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  RECOVER
                </span>
              </div>
              <p className="text-[10px] text-slate-400 hidden sm:block">
                Tutor Appointment Recovery Platform
              </p>
            </div>
          </Link>

          {/* Engine Status */}
          <div className="hidden lg:flex items-center gap-2 pl-4 border-l border-slate-800 text-xs text-slate-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Deterministic Matching Engine Active</span>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2.5">
          {/* Tutor Info Pill */}
          {provider && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
              <div className="w-6 h-6 rounded-full bg-indigo-600/30 text-indigo-300 flex items-center justify-center font-bold text-[10px] border border-indigo-500/40">
                AS
              </div>
              <div>
                <span className="text-slate-200 font-medium">{provider.name}</span>
                <span className="text-slate-400 text-[10px] block leading-none">Senior STEM Tutor</span>
              </div>
            </div>
          )}

          {/* Public Booking Link */}
          <Link
            href="/book/aditi-sharma"
            target="_blank"
            className="px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition"
          >
            <Icon name="calendar_today" className="text-sm text-indigo-400" />
            <span className="hidden sm:inline">Public Booking Page</span>
            <span className="sm:hidden">Book</span>
            <Icon name="open_in_new" className="text-xs text-slate-400" />
          </Link>

          {/* Reset Demo Button */}
          <button
            onClick={onResetDemo}
            disabled={isResetting}
            title="Reset database to clean initial seeded demo state"
            className="px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition active:scale-95"
          >
            <Icon name="restart_alt" className={`text-sm text-amber-400 ${isResetting ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Reset Seed</span>
          </button>
        </div>
      </div>
    </header>
  );
}
