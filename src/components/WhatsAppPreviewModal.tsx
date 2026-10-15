'use client';

import React, { useState } from 'react';
import { Icon } from '@/components/ui/icon';
import { RecoveryOffer } from '@/types';

interface WhatsAppPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  offer: RecoveryOffer | null;
  rawMessage: string;
  whatsappUrl: string;
  onOfferAcceptedLocally?: () => void;
}

export function WhatsAppPreviewModal({
  isOpen,
  onClose,
  offer,
  rawMessage,
  whatsappUrl,
  onOfferAcceptedLocally,
}: WhatsAppPreviewModalProps) {
  const [copied, setCopied] = useState(false);
  const [isSimulatingAccept, setIsSimulatingAccept] = useState(false);

  if (!isOpen || !offer) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(rawMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSimulateStudentAccept = async () => {
    try {
      setIsSimulatingAccept(true);
      const res = await fetch(`/api/offers/${offer.token}/accept`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        if (onOfferAcceptedLocally) {
          onOfferAcceptedLocally();
        }
        onClose();
      } else {
        alert(data.error || 'Failed to accept offer');
      }
    } catch (err) {
      console.error(err);
      alert('Error accepting offer');
    } finally {
      setIsSimulatingAccept(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Icon name="chat" className="text-xl" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                WhatsApp Offer Dispatch
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-normal">
                  Match Score: {offer.match_score}/100
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Candidate: <strong className="text-slate-200">{offer.customer_name}</strong> ({offer.customer_phone})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <Icon name="close" className="text-xl" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Transparent Match Reasons */}
          {offer.match_reasons && offer.match_reasons.length > 0 && (
            <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-800/40">
              <h4 className="text-xs font-semibold text-indigo-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Icon name="auto_awesome" className="text-sm text-indigo-400" />
                Matching Engine Justification
              </h4>
              <ul className="space-y-1">
                {offer.match_reasons.map((reason, idx) => (
                  <li key={idx} className="text-xs text-slate-300 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* WhatsApp Chat Preview Bubble */}
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="font-medium">Live Message Simulation</span>
              <span className="text-emerald-400 font-mono text-[11px] flex items-center gap-1">
                <Icon name="verified_user" className="text-sm" />
                Direct Tutor-Initiated WhatsApp Link
              </span>
            </div>

            <div className="rounded-xl p-4 bg-[#0B141A] border border-[#202C33] shadow-inner font-sans">
              <div className="max-w-[88%] ml-auto bg-[#005C4B] text-white p-3.5 rounded-2xl rounded-tr-none shadow-md text-sm whitespace-pre-line leading-relaxed">
                {rawMessage}
                <div className="flex items-center justify-end gap-1 mt-2 text-[10px] text-emerald-200/80">
                  <span>Just now</span>
                  <span>✓✓</span>
                </div>
              </div>
            </div>
          </div>

          {/* Architecture Note on WhatsApp Deep Links */}
          <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/60 text-[11px] text-slate-400 leading-relaxed">
            <strong className="text-slate-300 font-medium">Why wa.me deep links?</strong> SlotSathi uses provider-initiated deep links so tutors retain complete control without requiring paid WhatsApp Business API credentials or recurring template approval fees.
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/90 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-2 transition cursor-pointer"
            >
              {copied ? <Icon name="check" className="text-sm text-emerald-400" /> : <Icon name="content_copy" className="text-sm" />}
              {copied ? 'Copied to Clipboard' : 'Copy Text'}
            </button>

            {/* Quick test simulation for judges */}
            <button
              onClick={handleSimulateStudentAccept}
              disabled={isSimulatingAccept}
              title="Simulates the student tapping their link and accepting instantly for quick demo evaluation"
              className="px-3.5 py-2 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 text-xs font-medium border border-indigo-500/40 flex items-center gap-2 transition cursor-pointer"
            >
              <Icon name="auto_awesome" className="text-sm text-indigo-400" />
              {isSimulatingAccept ? 'Accepting...' : '1-Click Student Accept (Demo)'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-medium transition cursor-pointer"
            >
              Close
            </button>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition transform active:scale-95"
            >
              <Icon name="chat" className="text-base text-slate-950" />
              Open in WhatsApp
              <Icon name="open_in_new" className="text-xs ml-0.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
