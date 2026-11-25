import React, { useCallback, useRef } from 'react';
import {
  BookOpen,
  ChevronLeft,
  Droplets,
  Leaf,
  Lock,
  Sparkles,
} from 'lucide-react';
import { NavigationShell } from '../components/NavigationShell';
import { useNotes } from '../context/NotesContext';
import {
  NOTE_FONT_SIZE_MAX,
  NOTE_FONT_SIZE_MIN,
  ThemePalette,
} from '../types/notes';

const FONT_SIZE_STEPS = Array.from(
  { length: NOTE_FONT_SIZE_MAX - NOTE_FONT_SIZE_MIN + 1 },
  (_, index) => NOTE_FONT_SIZE_MIN + index
);

export function AppearanceScreen() {
  const {
    palette,
    setPalette,
    noteFontSize,
    setNoteFontSize,
    canUsePremiumPalettes,
    goBack,
  } = useNotes();

  const trackRef = useRef<HTMLDivElement | null>(null);

  const paletteOptions: {
    id: ThemePalette;
    name: string;
    iconColor: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    premiumOnly: boolean;
  }[] = [
    {
      id: 'default',
      name: 'Classic Warm',
      iconColor: '#D9A928',
      icon: Sparkles,
      premiumOnly: false,
    },
    {
      id: 'sepia',
      name: 'Warm Sepia',
      iconColor: '#B88022',
      icon: BookOpen,
      premiumOnly: true,
    },
    {
      id: 'sage',
      name: 'Botanical Sage',
      iconColor: '#4A7856',
      icon: Leaf,
      premiumOnly: true,
    },
    {
      id: 'slate',
      name: 'Crisp Slate',
      iconColor: '#436496',
      icon: Droplets,
      premiumOnly: true,
    },
  ];

  const activePalette = canUsePremiumPalettes ? palette : 'default';

  const clampedSize = Math.min(
    NOTE_FONT_SIZE_MAX,
    Math.max(NOTE_FONT_SIZE_MIN, Math.round(noteFontSize))
  );
  const progressRatio =
    (clampedSize - NOTE_FONT_SIZE_MIN) / (NOTE_FONT_SIZE_MAX - NOTE_FONT_SIZE_MIN);
  const progressPercent = progressRatio * 100;

  const updateFontSizeFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      if (rect.width <= 0) return;
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const nextValue = Math.round(
        NOTE_FONT_SIZE_MIN + ratio * (NOTE_FONT_SIZE_MAX - NOTE_FONT_SIZE_MIN)
      );
      setNoteFontSize(nextValue);
    },
    [setNoteFontSize]
  );

  const handleTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFontSizeFromClientX(e.clientX);
  };

  const handleTrackPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    updateFontSizeFromClientX(e.clientX);
  };

  const handleTrackKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      setNoteFontSize(Math.min(NOTE_FONT_SIZE_MAX, clampedSize + 1));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      setNoteFontSize(Math.max(NOTE_FONT_SIZE_MIN, clampedSize - 1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setNoteFontSize(NOTE_FONT_SIZE_MIN);
    } else if (e.key === 'End') {
      e.preventDefault();
      setNoteFontSize(NOTE_FONT_SIZE_MAX);
    }
  };

  return (
    <NavigationShell showMobileTabs={false}>
      <header className="sticky top-0 z-20 bg-[var(--bg-canvas)]/95 backdrop-blur-md px-4 sm:px-8 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goBack}
            aria-label="Back"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2} />
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            Appearance
          </h1>
        </div>
      </header>

      <section className="px-5 sm:px-8 pt-3 pb-12 space-y-6">
        {/* 3-Column Theme Mode Grid (Modes + Existing Color Themes) */}
        <div>
          <h2 className="px-1 mb-2.5 text-xs font-semibold text-[var(--text-secondary)]">
            Theme Mode
          </h2>

          <div className="grid grid-cols-3 gap-2.5">
            {paletteOptions.map((item) => {
              const Icon = item.icon;
              const selected = activePalette === item.id;
              const locked = item.premiumOnly && !canUsePremiumPalettes;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setPalette(item.id)}
                  className={`relative flex min-h-[78px] flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-3 text-center transition-colors cursor-pointer ${
                    selected
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)]'
                      : 'border-[var(--divider)] bg-[var(--bg-card)] hover:bg-[var(--bg-subtle)]/50'
                  }`}
                >
                  {locked && (
                    <Lock
                      className="absolute top-2 right-2 h-3 w-3 text-[var(--accent-primary)]"
                      strokeWidth={2}
                    />
                  )}
                  <span style={{ color: selected ? 'var(--accent-primary)' : item.iconColor }}>
                    <Icon className="h-6 w-6" strokeWidth={selected ? 2.1 : 1.85} />
                  </span>
                  <span
                    className={`w-full truncate text-[11px] sm:text-xs leading-tight tracking-tight ${
                      selected
                        ? 'font-semibold text-[var(--accent-primary)]'
                        : 'font-medium text-[var(--text-primary)]'
                    }`}
                  >
                    {item.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dotted Draggable Note Text Size Progress Slider */}
        <div>
          <div className="flex items-center justify-between px-1 mb-2">
            <h2 className="text-xs font-semibold text-[var(--text-secondary)]">
              Note Text Size
            </h2>
            <span className="text-xs font-semibold tabular-nums text-[var(--accent-primary)]">
              {clampedSize}px
            </span>
          </div>

          <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] px-4 py-4">
            <div className="flex items-center gap-3.5">
              <button
                type="button"
                aria-label="Decrease note text size"
                onClick={() =>
                  setNoteFontSize(Math.max(NOTE_FONT_SIZE_MIN, clampedSize - 1))
                }
                disabled={clampedSize <= NOTE_FONT_SIZE_MIN}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] disabled:opacity-35 cursor-pointer"
              >
                A
              </button>

              <div
                ref={trackRef}
                role="slider"
                tabIndex={0}
                aria-label="Note Text Size"
                aria-valuemin={NOTE_FONT_SIZE_MIN}
                aria-valuemax={NOTE_FONT_SIZE_MAX}
                aria-valuenow={clampedSize}
                onPointerDown={handleTrackPointerDown}
                onPointerMove={handleTrackPointerMove}
                onKeyDown={handleTrackKeyDown}
                className="relative mx-2.5 flex-1 h-10 flex items-center select-none touch-none cursor-pointer focus:outline-none"
              >
                {/* Background track */}
                <div className="relative h-2 w-full rounded-full bg-[var(--bg-subtle)] overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-[var(--accent-primary)] transition-[width] duration-75"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                {/* Stepped dots along the progress bar */}
                {FONT_SIZE_STEPS.map((step) => {
                  const stepPercent =
                    ((step - NOTE_FONT_SIZE_MIN) /
                      (NOTE_FONT_SIZE_MAX - NOTE_FONT_SIZE_MIN)) *
                    100;
                  const isFilled = step <= clampedSize;
                  const isCurrent = step === clampedSize;
                  return (
                    <span
                      key={step}
                      style={{ left: `${stepPercent}%` }}
                      className={`pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 block h-1.5 w-1.5 rounded-full transition-colors ${
                        isCurrent
                          ? 'opacity-0'
                          : isFilled
                            ? 'bg-white/85 dark:bg-[#171717]/80'
                            : 'bg-[var(--text-secondary)]/35'
                      }`}
                    />
                  );
                })}

                {/* Draggable thumb */}
                <div
                  className="pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-5 w-5 rounded-full bg-[var(--bg-card)] border-[2.5px] border-[var(--accent-primary)] shadow-md transition-[left] duration-75"
                  style={{ left: `${progressPercent}%` }}
                />
              </div>

              <button
                type="button"
                aria-label="Increase note text size"
                onClick={() =>
                  setNoteFontSize(Math.min(NOTE_FONT_SIZE_MAX, clampedSize + 1))
                }
                disabled={clampedSize >= NOTE_FONT_SIZE_MAX}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] disabled:opacity-35 cursor-pointer"
              >
                A
              </button>
            </div>
          </div>

          {/* Live Note Text Size & Theme Preview Directly Below */}
          <div className="mt-3 rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] p-5">
            <p className="text-xs font-medium text-[var(--text-secondary)]">Preview</p>
            <h3 className="mt-2 text-base font-semibold text-[var(--text-primary)]">
              Morning reading notes
            </h3>
            <p
              className="mt-1.5 leading-relaxed text-[var(--text-secondary)]"
              style={{ fontSize: `${clampedSize}px` }}
            >
              Warm surfaces and high-contrast typography adapt seamlessly across every screen.
            </p>
          </div>
        </div>
      </section>
    </NavigationShell>
  );
}
