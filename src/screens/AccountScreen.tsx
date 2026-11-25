import React, { useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  Cloud,
  CloudDownload,
  CloudUpload,
  Loader2,
  Lock,
  LogOut,
  RotateCcw,
  User,
} from 'lucide-react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { NavigationShell } from '../components/NavigationShell';
import { useNotes } from '../context/NotesContext';
import { formatFullDate } from '../utils/noteHelpers';

export function AccountScreen() {
  const {
    account,
    activeNotes,
    folders,
    isPremium,
    canUseDriveBackup,
    requestUpgrade,
    authLoading,
    authError,
    driveBusy,
    signInGoogleAccount,
    signOutGoogleAccount,
    backupToGoogleDrive,
    restoreFromGoogleDrive,
    resetLocalData,
    goBack,
  } = useNotes();

  const [resetOpen, setResetOpen] = useState(false);
  const [driveBackupConfirmOpen, setDriveBackupConfirmOpen] = useState(false);
  const [driveRestoreConfirmOpen, setDriveRestoreConfirmOpen] = useState(false);
  const [imgError, setImgError] = useState(false);

  const isGuest = account.isGuest !== false;

  const initials = (account.name || '')
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

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
            Account
          </h1>
        </div>
      </header>

      <section className="px-5 sm:px-8 pt-4 space-y-6">
        <div className="flex items-center gap-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] p-5">
          {!isGuest && account.photoUrl && !imgError ? (
            <img
              src={account.photoUrl}
              alt={account.name}
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="h-16 w-16 shrink-0 rounded-full object-cover border border-[var(--divider)]"
            />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-lg font-bold text-[var(--accent-primary)]">
              {isGuest ? <User className="h-6 w-6" /> : initials || <User className="h-6 w-6" />}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <p className="text-base font-semibold truncate">
                {isGuest ? 'Guest Account' : account.name}
              </p>
              {!isGuest && account.emailVerified && (
                <span
                  title="Verified Email"
                  className="inline-flex items-center gap-1 rounded-full bg-[#34A853]/12 px-2 py-0.5 text-[11px] font-medium text-[#2E7D32] dark:text-[#81C995] shrink-0"
                >
                  <CheckCircle2 className="h-3 w-3" strokeWidth={2.25} />
                  Verified
                </span>
              )}
            </div>
            <p className="text-sm text-[var(--text-secondary)] truncate">
              {isGuest ? 'Guest mode · Saved on this device' : account.email}
            </p>
            <p className="mt-1 text-xs text-[var(--text-secondary)] tabular-nums">
              {isPremium ? 'Premium' : 'Free'} · {activeNotes.length} notes · {folders.length}{' '}
              folders
            </p>
          </div>
        </div>

        {isGuest ? (
          <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
                <Cloud className="h-5 w-5" strokeWidth={1.85} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  Connect Google Account
                </p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed">
                  Sync your name, verified email, profile photo, and back up your notes to Google
                  Drive.
                </p>
              </div>
            </div>

            <GoogleSignInButton onClick={signInGoogleAccount} loading={authLoading} />
            {authError && (
              <p className="rounded-xl bg-[#E45B5B]/10 border border-[#E45B5B]/25 px-3 py-2 text-xs text-[#C62828] dark:text-[#FCA5A5] select-text">
                {authError}
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
                  <Cloud className="h-5 w-5" strokeWidth={1.85} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    Google Drive Backup
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] truncate">
                    {account.lastDriveBackupAt
                      ? `Last backup: ${formatFullDate(account.lastDriveBackupAt)}`
                      : 'No Google Drive backup yet'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                disabled={driveBusy}
                onClick={() => {
                  if (!canUseDriveBackup) {
                    requestUpgrade('Google Drive cloud backup & restore is a Notes Premium feature.');
                    return;
                  }
                  setDriveBackupConfirmOpen(true);
                }}
                className="flex w-full min-h-[46px] items-center justify-center gap-2 rounded-xl bg-[var(--text-primary)] dark:bg-[var(--accent-primary)] px-4 text-sm font-semibold text-[var(--bg-card)] dark:text-[#171717] disabled:opacity-60 transition-opacity hover:opacity-90 cursor-pointer"
              >
                {driveBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : !canUseDriveBackup ? (
                  <Lock className="h-4 w-4" strokeWidth={2} />
                ) : (
                  <CloudUpload className="h-4 w-4" strokeWidth={2} />
                )}
                Back up to Google Drive
              </button>

              <button
                type="button"
                disabled={driveBusy}
                onClick={() => {
                  if (!canUseDriveBackup) {
                    requestUpgrade('Google Drive cloud backup & restore is a Notes Premium feature.');
                    return;
                  }
                  setDriveRestoreConfirmOpen(true);
                }}
                className="flex w-full min-h-[46px] items-center justify-center gap-2 rounded-xl border border-[var(--divider)] bg-[var(--bg-canvas)] px-4 text-sm font-semibold text-[var(--text-primary)] disabled:opacity-60 transition-colors hover:bg-[var(--bg-subtle)] cursor-pointer"
              >
                {driveBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : !canUseDriveBackup ? (
                  <Lock className="h-4 w-4 text-[var(--accent-primary)]" strokeWidth={2} />
                ) : (
                  <CloudDownload className="h-4 w-4" strokeWidth={2} />
                )}
                Restore from Google Drive
              </button>
            </div>

            <button
              type="button"
              disabled={driveBusy}
              onClick={signOutGoogleAccount}
              className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[var(--divider)] text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]/50 transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.85} />
              Sign Out
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => setResetOpen(true)}
          className="flex w-full min-h-[50px] items-center justify-center gap-2 rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] text-sm font-medium text-[#E45B5B] hover:bg-[#E45B5B]/5 transition-colors cursor-pointer"
        >
          <RotateCcw className="h-4 w-4" strokeWidth={1.85} />
          Reset Local Workspace
        </button>
      </section>

      <ConfirmDialog
        open={driveBackupConfirmOpen}
        title="Back up to Google Drive?"
        description={`This will save your ${activeNotes.length} notes and ${folders.length} folders to notes-app-backup.json in your Google Drive (${account.email}).`}
        confirmLabel="Back Up Now"
        danger={false}
        onConfirm={() => {
          void backupToGoogleDrive();
        }}
        onClose={() => setDriveBackupConfirmOpen(false)}
      />

      <ConfirmDialog
        open={driveRestoreConfirmOpen}
        title="Restore from Google Drive?"
        description="This will replace your current local notes and folders with the backup stored in your Google Drive."
        confirmLabel="Restore Backup"
        onConfirm={() => {
          void restoreFromGoogleDrive();
        }}
        onClose={() => setDriveRestoreConfirmOpen(false)}
      />

      <ConfirmDialog
        open={resetOpen}
        title="Reset Workspace?"
        description="This will clear all locally stored notes and folders on this device."
        confirmLabel="Reset Data"
        onConfirm={resetLocalData}
        onClose={() => setResetOpen(false)}
      />
    </NavigationShell>
  );
}

