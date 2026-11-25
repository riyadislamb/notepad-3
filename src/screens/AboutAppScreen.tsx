import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Globe, User } from 'lucide-react';
import { NavigationShell } from '../components/NavigationShell';
import { useNotes } from '../context/NotesContext';
import {
  APP_UPDATE_STATE_EVENT,
  AboutAppUpdateState,
  checkForGitHubApkUpdate,
  getAboutAppUpdateState,
  getInstalledAppVersion,
} from '../services/appUpdateService';
import { SocialPlatformId } from '../types/notes';

function getSocialIcon(id: SocialPlatformId): React.ReactNode {
  switch (id) {
    case 'facebook':
      return (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
          <path d="M13.5 22v-8.2h2.8l.4-3.2h-3.2V8.5c0-.9.3-1.6 1.6-1.6h1.7V4.1c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.3H7.4v3.2h2.7V22h3.4z" />
        </svg>
      );
    case 'whatsapp':
      return (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
          <path d="M12.04 2a9.9 9.9 0 0 0-8.5 15l-1.1 4.1 4.2-1.1A9.9 9.9 0 1 0 12.04 2zm0 18a8.1 8.1 0 0 1-4.1-1.1l-.3-.2-2.5.6.7-2.4-.2-.3a8.1 8.1 0 1 1 6.4 3.4zm4.4-6c-.2-.1-1.4-.7-1.6-.8s-.4-.1-.5.1-.6.8-.8 1-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.3 0-.5.1-.6.1-.1.2-.3.4-.4.1-.2.2-.3.2-.4.1-.2 0-.3 0-.4s-.5-1.3-.7-1.8c-.2-.4-.4-.4-.5-.4h-.5c-.2 0-.4.1-.6.3a2.7 2.7 0 0 0-.8 2c0 1.2.9 2.4 1 2.5.1.2 1.7 2.6 4.1 3.6.6.2 1 .4 1.4.5.6.2 1.1.2 1.5.1.5-.1 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1 0-.1-.2-.2-.4-.3z" />
        </svg>
      );
    case 'instagram':
      return (
        <svg
          viewBox="0 0 24 24"
          className="h-3.5 w-3.5 stroke-current fill-none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'youtube':
      return (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
          <path d="M21.6 7.2a2.7 2.7 0 0 0-1.9-1.9C18 4.8 12 4.8 12 4.8s-6 0-7.7.5a2.7 2.7 0 0 0-1.9 1.9C2 8.9 2 12 2 12s0 3.1.4 4.8a2.7 2.7 0 0 0 1.9 1.9c1.7.5 7.7.5 7.7.5s6 0 7.7-.5a2.7 2.7 0 0 0 1.9-1.9c.4-1.7.4-4.8.4-4.8s0-3.1-.4-4.8zM10 15.1V8.9l5.2 3.1-5.2 3.1z" />
        </svg>
      );
    case 'x':
      return (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
          <path d="M18.2 3H21l-6.1 7 7.2 11h-5.6l-4.4-6.4L6.6 21H3.8l6.5-7.5L3.4 3h5.7l4 5.9L18.2 3zm-1 16.2h1.5L8.3 4.7H6.6l10.6 14.5z" />
        </svg>
      );
    case 'linkedin':
      return (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
          <path d="M6.5 8.5a1.8 1.8 0 1 1 0-3.6 1.8 1.8 0 0 1 0 3.6zM5 10h3v9.5H5V10zm5 0h2.9v1.3h.1c.4-.8 1.4-1.6 2.9-1.6 3.1 0 3.7 2 3.7 4.7v5.1h-3V15c0-1.1 0-2.5-1.5-2.5s-1.8 1.2-1.8 2.4v4.6H10V10z" />
        </svg>
      );
    default:
      return <Globe className="h-3.5 w-3.5" strokeWidth={2} />;
  }
}

export function AboutAppScreen() {
  const { aboutConfig, canViewSubscriptionPage, navigate, goBack } = useNotes();
  const [installedVersion, setInstalledVersion] = useState<string>(
    (import.meta.env.VITE_APP_VERSION || '1.0.0').replace(/^v/i, '')
  );
  const [aboutUpdateState, setAboutUpdateState] = useState<AboutAppUpdateState | null>(null);

  useEffect(() => {
    let active = true;
    let resolvedVersion = installedVersion;

    const syncUpdateState = () => {
      if (!active) return;
      setAboutUpdateState(getAboutAppUpdateState(resolvedVersion));
    };

    void getInstalledAppVersion().then((ver) => {
      if (!active) return;
      resolvedVersion = ver;
      setInstalledVersion(ver);
      setAboutUpdateState(getAboutAppUpdateState(ver));
      void checkForGitHubApkUpdate({ ignoreThrottle: false, respectDismissed: true });
    });

    syncUpdateState();

    window.addEventListener(APP_UPDATE_STATE_EVENT, syncUpdateState);
    window.addEventListener('storage', syncUpdateState);

    return () => {
      active = false;
      window.removeEventListener(APP_UPDATE_STATE_EVENT, syncUpdateState);
      window.removeEventListener('storage', syncUpdateState);
    };
  }, []);

  const visibleSocials = aboutConfig.socials.filter(
    (s) => s.enabled && s.href.trim().length > 0
  );

  const ceo = aboutConfig.ceo;
  const hasCeo = Boolean(ceo && (ceo.name || ceo.role || ceo.image));
  const hasLeadership = hasCeo || aboutConfig.team.length > 0;

  const teamGridClass =
    aboutConfig.team.length === 1
      ? 'grid-cols-1 max-w-[160px] mx-auto'
      : aboutConfig.team.length === 2
      ? 'grid-cols-2 max-w-xs mx-auto'
      : aboutConfig.team.length === 3
      ? 'grid-cols-3 max-w-md mx-auto'
      : 'grid-cols-2 sm:grid-cols-4';

  return (
    <NavigationShell showMobileTabs={false}>
      <header className="sticky top-0 z-20 bg-[var(--bg-canvas)]/95 backdrop-blur-md px-4 sm:px-8 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goBack}
            aria-label="Back"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2} />
          </button>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            About App
          </h1>
        </div>
      </header>

      <section className="px-4 sm:px-8 pt-2 pb-6 space-y-3.5 max-w-2xl mx-auto">
        {/* Natural Centered Brand Card */}
        <div className="rounded-3xl bg-[var(--bg-card)] border border-[var(--divider)] py-4 px-5 flex flex-col items-center text-center">
          <img
            src="/assets/aistudio/Applogo.png"
            alt="Notes logo"
            referrerPolicy="no-referrer"
            className="h-14 w-14 object-contain"
          />
          <h2 className="mt-2.5 text-xl font-bold text-[var(--text-primary)]">Notes</h2>
          <p className="mt-0.5 text-sm text-[var(--text-secondary)]">Capture your thoughts</p>
          <p className="mt-1.5 text-xs text-[var(--text-secondary)] tabular-nums">
            Version {installedVersion}
          </p>

          {visibleSocials.length > 0 && (
            <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
              {visibleSocials.map((item) => (
                <a
                  key={item.id}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={item.label}
                  title={item.label}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-primary)] transition-colors"
                >
                  {getSocialIcon(item.id)}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Update Available (stays visible on About App until installed version updates) */}
        {aboutUpdateState && (
          <a
            href={aboutUpdateState.downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[46px] w-full items-center justify-between gap-3 rounded-xl bg-[var(--accent-soft)] border border-[var(--accent-primary)]/30 px-3.5 text-sm font-semibold text-[var(--accent-primary)] hover:opacity-90 transition-opacity"
          >
            <span className="flex items-center gap-2.5 min-w-0">
              <Download className="h-4 w-4 shrink-0" strokeWidth={2} />
              <span className="truncate">Update Available</span>
            </span>
            <span className="text-xs font-medium opacity-85 shrink-0 tabular-nums">
              v{aboutUpdateState.latestVersion}
            </span>
          </a>
        )}

        {/* Compact Quick Links */}
        <div
          className={`grid gap-2 ${
            canViewSubscriptionPage ? 'grid-cols-3' : 'grid-cols-2'
          }`}
        >
          <button
            type="button"
            onClick={() => navigate('splash')}
            className="flex min-h-[44px] items-center justify-center gap-1 rounded-xl bg-[var(--bg-card)] border border-[var(--divider)] px-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]/60 transition-colors cursor-pointer"
          >
            <span className="truncate">Welcome</span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--text-secondary)]" strokeWidth={1.8} />
          </button>

          <button
            type="button"
            onClick={() => navigate('onboarding')}
            className="flex min-h-[44px] items-center justify-center gap-1 rounded-xl bg-[var(--bg-card)] border border-[var(--divider)] px-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]/60 transition-colors cursor-pointer"
          >
            <span className="truncate">Onboarding</span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--text-secondary)]" strokeWidth={1.8} />
          </button>

          {canViewSubscriptionPage && (
            <button
              type="button"
              onClick={() => navigate('premium')}
              className="flex min-h-[44px] items-center justify-center gap-1 rounded-xl bg-[var(--bg-card)] border border-[var(--divider)] px-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]/60 transition-colors cursor-pointer"
            >
              <span className="truncate">Premium</span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--text-secondary)]" strokeWidth={1.8} />
            </button>
          )}
        </div>

        {/* Dynamic Leadership & Team Profiles (Admin-controlled, cached for offline) */}
        {hasLeadership && (
          <div className="pt-1 space-y-3">
            <h2 className="px-0.5 text-xs font-semibold text-[var(--text-secondary)]">
              Leadership & Team
            </h2>

            {/* Tier 1: CEO Card (Separate on top) */}
            {hasCeo && ceo && (
              <div className="flex justify-center">
                <div className="w-36 sm:w-40 rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] p-2 text-center">
                  <div className="aspect-[3/4] w-full overflow-hidden rounded-xl bg-[var(--bg-subtle)] flex items-center justify-center">
                    {ceo.image ? (
                      <img
                        src={ceo.image}
                        alt={ceo.name || ceo.role || 'CEO'}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover object-top"
                      />
                    ) : (
                      <User className="h-10 w-10 text-[var(--text-secondary)] opacity-50" strokeWidth={1.6} />
                    )}
                  </div>
                  {ceo.name && (
                    <p className="mt-2 text-[13px] font-semibold text-[var(--text-primary)] leading-tight">
                      {ceo.name}
                    </p>
                  )}
                  {ceo.role && (
                    <p className="mt-0.5 text-[11px] font-medium text-[var(--accent-primary)] leading-tight">
                      {ceo.role}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Tier 2: Sequential Team Members */}
            {aboutConfig.team.length > 0 && (
              <div className={`grid gap-2 sm:gap-3 ${teamGridClass}`}>
                {aboutConfig.team.map((member) => (
                  <div
                    key={member.id}
                    className="rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] p-1.5 sm:p-2 text-center"
                  >
                    <div className="aspect-[3/4] w-full overflow-hidden rounded-xl bg-[var(--bg-subtle)] flex items-center justify-center">
                      {member.image ? (
                        <img
                          src={member.image}
                          alt={member.name || member.role || 'Team Member'}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover object-top"
                        />
                      ) : (
                        <User className="h-8 w-8 text-[var(--text-secondary)] opacity-50" strokeWidth={1.6} />
                      )}
                    </div>
                    {member.name && (
                      <p className="mt-1.5 text-[11px] sm:text-xs font-semibold text-[var(--text-primary)] leading-tight">
                        {member.name}
                      </p>
                    )}
                    {member.role && (
                      <p className="mt-0.5 text-[10px] sm:text-[11px] text-[var(--text-secondary)] leading-tight">
                        {member.role}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </NavigationShell>
  );
}
