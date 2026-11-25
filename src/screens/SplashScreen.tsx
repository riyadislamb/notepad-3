import React from 'react';
import { useNotes } from '../context/NotesContext';

const APP_LOGO_SRC = '/assets/aistudio/Applogo.png';

export function SplashScreen() {
  const { navigate, completeOnboarding } = useNotes();

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col items-center justify-between px-6 py-12">
      <div />

      <div className="flex flex-col items-center text-center max-w-sm">
        <div className="h-22 w-22 flex items-center justify-center">
          <img
            src={APP_LOGO_SRC}
            alt="Notes logo"
            referrerPolicy="no-referrer"
            className="h-full w-full object-contain"
          />
        </div>

        <h1 className="mt-7 text-3xl sm:text-4xl font-bold tracking-tight text-[var(--text-primary)]">
          Notes
        </h1>
        <p className="mt-2.5 text-[15px] text-[var(--text-secondary)]">
          Capture your thoughts
        </p>
      </div>

      <div className="w-full max-w-xs space-y-3">
        <button
          type="button"
          onClick={() => navigate('onboarding')}
          className="w-full min-h-[48px] rounded-full bg-[var(--text-primary)] dark:bg-[var(--accent-primary)] px-6 text-sm font-semibold text-[var(--bg-card)] dark:text-[#171717] transition-opacity hover:opacity-90 active:opacity-80 cursor-pointer"
        >
          Get Started
        </button>

        <button
          type="button"
          onClick={completeOnboarding}
          className="w-full min-h-[44px] rounded-full px-6 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
        >
          Skip to Notes
        </button>
      </div>
    </div>
  );
}
