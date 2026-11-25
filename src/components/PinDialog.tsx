import React, { useEffect, useState } from 'react';
import { Crown, Delete, Lock, X } from 'lucide-react';
import { useBackHandler } from '../context/NotesContext';

interface PinDialogProps {
  open: boolean;
  mode: 'verify' | 'create';
  expectedPin?: string | null;
  title?: string;
  subtitle?: string;
  onSuccess: (pin: string) => void;
  onClose: () => void;
}

export function PinDialog({
  open,
  mode,
  expectedPin,
  title,
  subtitle,
  onSuccess,
  onClose,
}: PinDialogProps) {
  const [digits, setDigits] = useState<string>('');
  const [firstPin, setFirstPin] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (open) {
      setDigits('');
      setFirstPin(null);
      setErrorMsg('');
    }
  }, [open, mode]);

  useBackHandler(open, onClose);
  if (!open) return null;

  const handleDigit = (d: string) => {
    if (digits.length >= 4) return;
    const next = digits + d;
    setDigits(next);
    setErrorMsg('');

    if (next.length === 4) {
      window.setTimeout(() => {
        if (mode === 'verify') {
          if (next === expectedPin) {
            onSuccess(next);
            onClose();
          } else {
            setErrorMsg('Incorrect PIN. Try again.');
            setDigits('');
          }
        } else {
          if (!firstPin) {
            setFirstPin(next);
            setDigits('');
          } else if (next === firstPin) {
            onSuccess(next);
            onClose();
          } else {
            setErrorMsg('PINs did not match. Start again.');
            setFirstPin(null);
            setDigits('');
          }
        }
      }, 120);
    }
  };

  const handleBackspace = () => {
    setDigits((prev) => prev.slice(0, -1));
    setErrorMsg('');
  };

  const displayTitle =
    title ||
    (mode === 'verify'
      ? 'Locked Note'
      : firstPin
      ? 'Confirm PIN'
      : 'Set 4-Digit PIN');

  const displaySubtitle =
    subtitle ||
    (mode === 'verify'
      ? 'Enter your 4-digit PIN to view this note'
      : firstPin
      ? 'Re-enter your 4-digit PIN to confirm'
      : 'Choose a 4-digit PIN to protect locked notes');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xs rounded-3xl bg-[var(--bg-card)] border border-[var(--divider)] p-6 text-center"
      >
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-primary)]">
          <Lock className="h-5 w-5" strokeWidth={1.9} />
        </div>

        <h2 className="mt-3 text-lg font-semibold text-[var(--text-primary)]">{displayTitle}</h2>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">{displaySubtitle}</p>

        {/* 4 PIN dots */}
        <div className="mt-5 flex items-center justify-center gap-3.5" aria-label="PIN entry">
          {[0, 1, 2, 3].map((idx) => {
            const filled = idx < digits.length;
            return (
              <span
                key={idx}
                className={`h-3.5 w-3.5 rounded-full transition-colors ${
                  filled
                    ? 'bg-[var(--accent-primary)]'
                    : 'border border-[var(--text-secondary)]/50 bg-transparent'
                }`}
              />
            );
          })}
        </div>

        {errorMsg ? (
          <p className="mt-2.5 text-xs font-medium text-[#E45B5B]">{errorMsg}</p>
        ) : (
          <div className="mt-2.5 h-4" />
        )}

        {/* Keypad */}
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleDigit(num)}
              className="min-h-[50px] rounded-2xl bg-[var(--bg-canvas)] text-base font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] active:scale-95 transition-all tabular-nums cursor-pointer"
            >
              {num}
            </button>
          ))}
          <div />
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="min-h-[50px] rounded-2xl bg-[var(--bg-canvas)] text-base font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] active:scale-95 transition-all tabular-nums cursor-pointer"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            aria-label="Backspace"
            className="min-h-[50px] flex items-center justify-center rounded-2xl bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] active:scale-95 transition-all cursor-pointer"
          >
            <Delete className="h-5 w-5" strokeWidth={1.8} />
          </button>
        </div>
      </div>
    </div>
  );
}

interface UpgradePromptDialogProps {
  reason: string | null;
  onUpgrade: () => void;
  onClose: () => void;
}

export function UpgradePromptDialog({ reason, onUpgrade, onClose }: UpgradePromptDialogProps) {
  useBackHandler(Boolean(reason), onClose);
  if (!reason) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl bg-[var(--bg-card)] border border-[var(--divider)] p-6 text-center"
      >
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
          <Crown className="h-6 w-6" strokeWidth={1.85} />
        </div>

        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          Unlock with Notes Premium
        </h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">{reason}</p>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => {
              onClose();
              onUpgrade();
            }}
            className="min-h-[46px] w-full rounded-xl bg-[var(--text-primary)] dark:bg-[var(--accent-primary)] px-4 text-sm font-semibold text-[var(--bg-card)] dark:text-[#171717] transition-opacity hover:opacity-90 cursor-pointer"
          >
            View Premium Plans
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] w-full rounded-xl bg-[var(--bg-canvas)] px-4 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
          >
            Not Now
          </button>
        </div>
      </div>
    </div>
  );
}
