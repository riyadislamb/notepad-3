import React from 'react';
import { Fingerprint, KeyRound, Lock, X } from 'lucide-react';
import { useBackHandler, useNotes } from '../context/NotesContext';

interface LockMethodDialogProps {
  open: boolean;
  busy?: boolean;
  onSelectFingerprint: () => void;
  onSelectPin: () => void;
  onClose: () => void;
}

export function LockMethodDialog({
  open,
  busy = false,
  onSelectFingerprint,
  onSelectPin,
  onClose,
}: LockMethodDialogProps) {
  const { biometricSupported, biometryLabel } = useNotes();

  useBackHandler(open, onClose);
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl bg-[var(--bg-card)] border border-[var(--divider)] p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
            <Lock className="h-5 w-5" strokeWidth={1.9} />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <h2 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">
          Choose Lock Method
        </h2>
        <p className="mt-1 text-xs text-[var(--text-secondary)] leading-relaxed">
          Select either {biometryLabel} Unlock or a 4-Digit PIN. You can switch anytime from Settings.
        </p>

        <div className="mt-5 space-y-2.5">
          <button
            type="button"
            disabled={!biometricSupported || busy}
            onClick={onSelectFingerprint}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[var(--divider)] bg-[var(--bg-canvas)] px-4 py-3.5 text-left transition-colors hover:border-[var(--accent-primary)]/60 disabled:opacity-55 disabled:cursor-not-allowed cursor-pointer"
          >
            <span className="flex items-center gap-3 min-w-0">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
                <Fingerprint className="h-5 w-5" strokeWidth={1.9} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[var(--text-primary)]">
                  {biometryLabel} Unlock
                </span>
                <span className="block text-xs text-[var(--text-secondary)] truncate">
                  {biometricSupported
                    ? 'Unlock with your device sensor'
                    : 'Available on mobile devices with fingerprint'}
                </span>
              </span>
            </span>
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={onSelectPin}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[var(--divider)] bg-[var(--bg-canvas)] px-4 py-3.5 text-left transition-colors hover:border-[var(--accent-primary)]/60 disabled:opacity-60 cursor-pointer"
          >
            <span className="flex items-center gap-3 min-w-0">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
                <KeyRound className="h-5 w-5" strokeWidth={1.9} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[var(--text-primary)]">
                  4-Digit PIN
                </span>
                <span className="block text-xs text-[var(--text-secondary)] truncate">
                  Create a 4-digit passcode
                </span>
              </span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
