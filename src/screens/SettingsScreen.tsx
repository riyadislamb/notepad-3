import React, { useState } from 'react';
import {
  AlarmClock,
  Bell,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Cloud,
  CloudDownload,
  CloudUpload,
  Crown,
  FileText,
  Fingerprint,
  HelpCircle,
  Info,
  KeyRound,
  Loader2,
  Lock,
  Moon,
  RotateCcw,
  ShieldCheck,
  Trash2,
  User,
  Vibrate,
} from 'lucide-react';
import { ConfirmDialog, InfoSheetDialog } from '../components/ConfirmDialog';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { NavigationShell } from '../components/NavigationShell';
import { PinDialog } from '../components/PinDialog';
import { TrashRetentionDialog } from '../components/TrashRetentionDialog';
import { useNotes } from '../context/NotesContext';
import { verifyBiometricIdentity } from '../utils/biometricHelper';
import { exportNotesAsPdfZip, exportNotesAsTextZip } from '../utils/exportNotesZip';
import { formatFullDate, formatTrashRetentionDuration } from '../utils/noteHelpers';

export function SettingsScreen() {
  const {
    account,
    resolvedTheme,
    palette,
    isPremium,
    canViewSubscriptionPage,
    canUsePremiumPalettes,
    canUseNoteLock,
    canUseDriveBackup,
    isAdmin,
    notePin,
    setNotePin,
    noteLockMethod,
    enableFingerprintLock,
    disableNoteLock,
    biometricSupported,
    biometryLabel,
    requestUpgrade,
    folders,
    notes,
    notifications,
    updateNotifications,
    authLoading,
    authError,
    driveBusy,
    billingBusy,
    signInGoogleAccount,
    backupToGoogleDrive,
    restoreFromGoogleDrive,
    autoBackup,
    updateAutoBackupSchedule,
    disableAutoBackupSchedule,
    trashRetention,
    restorePurchase,
    navigate,
    showToast,
  } = useNotes();

  const [notifOpen, setNotifOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [autoBackupOpen, setAutoBackupOpen] = useState(false);
  const [trashRetentionOpen, setTrashRetentionOpen] = useState(false);
  const [autoMonthsInput, setAutoMonthsInput] = useState('');
  const [autoDaysInput, setAutoDaysInput] = useState('');
  const [driveBackupConfirmOpen, setDriveBackupConfirmOpen] = useState(false);
  const [driveRestoreConfirmOpen, setDriveRestoreConfirmOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreTxId, setRestoreTxId] = useState('');
  const [restoreStatusMsg, setRestoreStatusMsg] = useState<string | null>(null);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [pinSheetOpen, setPinSheetOpen] = useState(false);
  const [biometricBusy, setBiometricBusy] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<'txt' | 'pdf' | null>(null);

  const isGuest = account.isGuest !== false;

  const themeLabel = resolvedTheme === 'dark' ? 'Dark' : 'Light';
  const paletteSuffix =
    canUsePremiumPalettes && palette !== 'default'
      ? ` · ${palette.charAt(0).toUpperCase() + palette.slice(1)}`
      : '';

  const initials = (account.name || '')
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleExportZip = async (format: 'txt' | 'pdf') => {
    if (exportingFormat) return;
    setExportingFormat(format);
    try {
      const result =
        format === 'txt'
          ? await exportNotesAsTextZip(notes, folders)
          : await exportNotesAsPdfZip(notes, folders);
      showToast(
        result.mode === 'shared'
          ? `Prepared ${result.count} ${format.toUpperCase()} notes in ZIP`
          : `Downloaded ${result.count} ${format.toUpperCase()} notes as ZIP`
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Export unavailable',
        'danger'
      );
    } finally {
      setExportingFormat(null);
    }
  };

  const handleBackUpNowAndDownloadPdf = async () => {
    await backupToGoogleDrive();
    await handleExportZip('pdf');
  };

  const autoBackupStatusLabel = (() => {
    if (!autoBackup.enabled || (autoBackup.months <= 0 && autoBackup.days <= 0)) {
      return 'Off';
    }
    const parts: string[] = [];
    if (autoBackup.months > 0) parts.push(`${autoBackup.months}m`);
    if (autoBackup.days > 0) parts.push(`${autoBackup.days}d`);
    return `Every ${parts.join(' ')}`;
  })();

  const handleOpenAutoBackupDialog = () => {
    const hasConfigured = autoBackup.months > 0 || autoBackup.days > 0;
    setAutoMonthsInput(
      hasConfigured ? (autoBackup.months > 0 ? String(autoBackup.months) : '') : '1'
    );
    setAutoDaysInput(
      hasConfigured ? (autoBackup.days > 0 ? String(autoBackup.days) : '') : '1'
    );
    setAutoBackupOpen(true);
  };

  const handleSaveAutoBackup = (e: React.FormEvent) => {
    e.preventDefault();
    const months = Math.max(0, Math.floor(Number(autoMonthsInput || '0')));
    const days = Math.max(0, Math.floor(Number(autoDaysInput || '0')));
    if (months === 0 && days === 0) {
      showToast('Enter at least 1 month or 1 day', 'danger');
      return;
    }
    updateAutoBackupSchedule(months, days);
    setAutoBackupOpen(false);
  };

  const handleNotePinClick = () => {
    if (!canUseNoteLock) {
      requestUpgrade('Secure Note Lock is a Notes Premium feature.');
      return;
    }
    setPinSheetOpen(true);
  };

  const handleSelectFingerprintOption = async () => {
    if (noteLockMethod === 'fingerprint' || biometricBusy) return;
    if (!biometricSupported) {
      showToast(`${biometryLabel} is not available on this device`, 'danger');
      return;
    }
    setBiometricBusy(true);
    try {
      const res = await verifyBiometricIdentity({
        title: `Enable ${biometryLabel} Unlock`,
        subtitle: 'Confirm your identity',
        reason: `Verify ${biometryLabel.toLowerCase()} to use it as your note lock`,
      });
      if (res.verified) {
        enableFingerprintLock();
      } else if (!res.cancelled && res.errorMessage) {
        showToast(res.errorMessage, 'danger');
      }
    } finally {
      setBiometricBusy(false);
    }
  };

  return (
    <NavigationShell showMobileTabs>
      <header className="sticky top-0 z-20 bg-[var(--bg-canvas)]/95 backdrop-blur-md px-5 sm:px-8 pt-5 pb-3">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          Settings
        </h1>
      </header>

      <section className="px-5 sm:px-8 pt-2 space-y-6">
        {/* Account Card */}
        <div>
          <h2 className="px-1 mb-2 text-xs font-semibold text-[var(--text-secondary)]">
            Account
          </h2>
          <button
            type="button"
            onClick={() => navigate('account')}
            className="flex w-full items-center justify-between gap-3 rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] p-4 text-left hover:border-[var(--accent-primary)]/60 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-3.5 min-w-0">
              {!isGuest && account.photoUrl && !avatarError ? (
                <img
                  src={account.photoUrl}
                  alt={account.name}
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarError(true)}
                  className="h-12 w-12 shrink-0 rounded-full object-cover border border-[var(--divider)]"
                />
              ) : (
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-sm font-bold text-[var(--accent-primary)]">
                  {isGuest ? <User className="h-5 w-5" /> : initials || <User className="h-5 w-5" />}
                </span>
              )}
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[15px] font-semibold text-[var(--text-primary)] truncate">
                    {isGuest ? 'Guest Account' : account.name}
                  </span>
                  {!isGuest && account.emailVerified && (
                    <CheckCircle2
                      className="h-3.5 w-3.5 shrink-0 text-[#2E7D32] dark:text-[#81C995]"
                      strokeWidth={2.25}
                    />
                  )}
                </span>
                <span className="block text-xs text-[var(--text-secondary)] truncate">
                  {isGuest ? 'Sign in with Google to back up' : account.email}
                </span>
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" strokeWidth={1.75} />
          </button>
        </div>

        {/* Preferences */}
        <div>
          <h2 className="px-1 mb-2 text-xs font-semibold text-[var(--text-secondary)]">
            Preferences
          </h2>
          <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] divide-y divide-[var(--divider)]">
            <button
              type="button"
              onClick={() => navigate('appearance')}
              className="flex w-full min-h-[54px] items-center justify-between px-4 text-left hover:bg-[var(--bg-subtle)]/50 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-3 text-sm font-medium">
                <Moon className="h-4 w-4 text-[var(--text-secondary)]" strokeWidth={1.85} />
                Appearance
              </span>
              <span className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                <span>
                  {themeLabel}
                  {paletteSuffix}
                </span>
                <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
              </span>
            </button>

            <button
              type="button"
              onClick={handleNotePinClick}
              className="flex w-full min-h-[54px] items-center justify-between px-4 text-left hover:bg-[var(--bg-subtle)]/50 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-3 text-sm font-medium">
                <Lock className="h-4 w-4 text-[var(--text-secondary)]" strokeWidth={1.85} />
                Note Lock
              </span>
              <span className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                <span>
                  {!canUseNoteLock
                    ? 'Premium'
                    : noteLockMethod === 'fingerprint'
                    ? biometryLabel
                    : noteLockMethod === 'pin' && notePin
                    ? '4-Digit PIN'
                    : 'Off'}
                </span>
                <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
              </span>
            </button>

            <button
              type="button"
              onClick={() => setNotifOpen(true)}
              className="flex w-full min-h-[54px] items-center justify-between px-4 text-left hover:bg-[var(--bg-subtle)]/50 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-3 text-sm font-medium">
                <Bell className="h-4 w-4 text-[var(--text-secondary)]" strokeWidth={1.85} />
                Notification Preferences
              </span>
              <ChevronRight className="h-4 w-4 text-[var(--text-secondary)]" strokeWidth={1.75} />
            </button>
          </div>
        </div>

        {/* Storage */}
        <div>
          <h2 className="px-1 mb-2 text-xs font-semibold text-[var(--text-secondary)]">
            Storage
          </h2>
          <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] divide-y divide-[var(--divider)] overflow-hidden">
            <button
              type="button"
              onClick={() => setBackupOpen(true)}
              className="flex w-full min-h-[54px] items-center justify-between px-4 text-left hover:bg-[var(--bg-subtle)]/50 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-3 text-sm font-medium">
                <Cloud className="h-4 w-4 text-[var(--text-secondary)]" strokeWidth={1.85} />
                Backup & Sync
              </span>
              <span className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                <span>
                  {!canUseDriveBackup ? 'Premium' : !isGuest ? 'Google Drive' : 'Local'}
                </span>
                <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
              </span>
            </button>

            <button
              type="button"
              onClick={handleOpenAutoBackupDialog}
              className="flex w-full min-h-[54px] items-center justify-between px-4 text-left hover:bg-[var(--bg-subtle)]/50 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-3 text-sm font-medium">
                <CalendarClock className="h-4 w-4 text-[var(--text-secondary)]" strokeWidth={1.85} />
                Auto Backup Date
              </span>
              <span className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                <span>{autoBackupStatusLabel}</span>
                <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
              </span>
            </button>

            <button
              type="button"
              onClick={() => setTrashRetentionOpen(true)}
              className="flex w-full min-h-[54px] items-center justify-between px-4 text-left hover:bg-[var(--bg-subtle)]/50 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-3 text-sm font-medium">
                <Trash2 className="h-4 w-4 text-[var(--text-secondary)]" strokeWidth={1.85} />
                Trash Auto-Delete
              </span>
              <span className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                <span>{formatTrashRetentionDuration(trashRetention, true)}</span>
                <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
              </span>
            </button>
          </div>
        </div>

        {/* Premium (Hidden for active subscribers and Try Mode users) */}
        {canViewSubscriptionPage && (
          <div>
            <h2 className="px-1 mb-2 text-xs font-semibold text-[var(--text-secondary)]">
              Premium
            </h2>
            <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] divide-y divide-[var(--divider)]">
              <button
                type="button"
                onClick={() => navigate('premium')}
                className="flex w-full min-h-[54px] items-center justify-between px-4 text-left hover:bg-[var(--bg-subtle)]/50 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-3 text-sm font-medium">
                  <Crown className="h-4 w-4 text-[var(--accent-primary)]" strokeWidth={1.9} />
                  Subscription
                </span>
                <span className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                  <span>{isPremium ? 'Premium' : 'Free'}</span>
                  <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
                </span>
              </button>

              <button
                type="button"
                onClick={() => setRestoreOpen(true)}
                className="flex w-full min-h-[54px] items-center justify-between px-4 text-left hover:bg-[var(--bg-subtle)]/50 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-3 text-sm font-medium">
                  <RotateCcw className="h-4 w-4 text-[var(--text-secondary)]" strokeWidth={1.85} />
                  Restore Purchase
                </span>
                <ChevronRight className="h-4 w-4 text-[var(--text-secondary)]" strokeWidth={1.75} />
              </button>
            </div>
          </div>
        )}

        {/* Support */}
        <div>
          <h2 className="px-1 mb-2 text-xs font-semibold text-[var(--text-secondary)]">
            Support
          </h2>
          <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] divide-y divide-[var(--divider)]">
            <button
              type="button"
              onClick={() => navigate('help')}
              className="flex w-full min-h-[54px] items-center justify-between px-4 text-left hover:bg-[var(--bg-subtle)]/50 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-3 text-sm font-medium">
                <HelpCircle className="h-4 w-4 text-[var(--text-secondary)]" strokeWidth={1.85} />
                Help & Support
              </span>
              <span className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                <span>FAQ, Privacy & Terms</span>
                <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
              </span>
            </button>

            <button
              type="button"
              onClick={() => navigate('about')}
              className="flex w-full min-h-[54px] items-center justify-between px-4 text-left hover:bg-[var(--bg-subtle)]/50 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-3 text-sm font-medium">
                <Info className="h-4 w-4 text-[var(--text-secondary)]" strokeWidth={1.85} />
                About App
              </span>
              <ChevronRight className="h-4 w-4 text-[var(--text-secondary)]" strokeWidth={1.75} />
            </button>
          </div>
        </div>

        {isAdmin && (
          <div>
            <h2 className="px-1 mb-2 text-xs font-semibold text-[var(--text-secondary)]">
              Admin
            </h2>
            <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)]">
              <button
                type="button"
                onClick={() => navigate('admin')}
                className="flex w-full min-h-[54px] items-center justify-between px-4 text-left hover:bg-[var(--bg-subtle)]/50 transition-colors cursor-pointer rounded-2xl"
              >
                <span className="flex items-center gap-3 text-sm font-medium">
                  <ShieldCheck className="h-4 w-4 text-[var(--accent-primary)]" strokeWidth={1.9} />
                  Admin Panel
                </span>
                <ChevronRight className="h-4 w-4 text-[var(--text-secondary)]" strokeWidth={1.75} />
              </button>
            </div>
          </div>
        )}
      </section>

      <InfoSheetDialog
        open={pinSheetOpen}
        title="Note Lock"
        onClose={() => setPinSheetOpen(false)}
      >
        <div className="space-y-3">
          <p className="text-sm text-[var(--text-secondary)]">
            Choose either {biometryLabel} Unlock or a 4-Digit PIN for your locked notes. You can switch anytime.
          </p>

          <button
            type="button"
            disabled={!biometricSupported || biometricBusy}
            onClick={() => {
              void handleSelectFingerprintOption();
            }}
            className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left transition-colors cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed ${
              noteLockMethod === 'fingerprint'
                ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)]/50'
                : 'border-[var(--divider)] bg-[var(--bg-canvas)] hover:border-[var(--accent-primary)]/60'
            }`}
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
                    ? 'Unlock notes using your phone sensor'
                    : 'Available on mobile devices with fingerprint'}
                </span>
              </span>
            </span>
            {noteLockMethod === 'fingerprint' && (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-primary)] text-white dark:text-[#171717]">
                <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
              </span>
            )}
          </button>

          <button
            type="button"
            disabled={biometricBusy}
            onClick={() => {
              setPinSheetOpen(false);
              setPinDialogOpen(true);
            }}
            className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left transition-colors cursor-pointer disabled:opacity-60 ${
              noteLockMethod === 'pin' && notePin
                ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)]/50'
                : 'border-[var(--divider)] bg-[var(--bg-canvas)] hover:border-[var(--accent-primary)]/60'
            }`}
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
                  {noteLockMethod === 'pin' && notePin
                    ? 'Active · Tap to change PIN'
                    : 'Unlock notes with a 4-digit passcode'}
                </span>
              </span>
            </span>
            {noteLockMethod === 'pin' && notePin && (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-primary)] text-white dark:text-[#171717]">
                <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
              </span>
            )}
          </button>

          {noteLockMethod && (
            <button
              type="button"
              onClick={() => {
                disableNoteLock();
                setPinSheetOpen(false);
              }}
              className="w-full min-h-[44px] rounded-xl bg-[#E45B5B]/10 text-sm font-semibold text-[#E45B5B] cursor-pointer"
            >
              Turn Off Lock & Unlock All Notes
            </button>
          )}
        </div>
      </InfoSheetDialog>

      <PinDialog
        open={pinDialogOpen}
        mode="create"
        onSuccess={(newPin) => setNotePin(newPin)}
        onClose={() => setPinDialogOpen(false)}
      />

      <InfoSheetDialog
        open={notifOpen}
        title="Notification Preferences"
        onClose={() => setNotifOpen(false)}
      >
        <div className="divide-y divide-[var(--divider)]">
          {[
            {
              key: 'dailyReminder' as const,
              title: 'Daily Writing Reminder',
              desc: 'Gentle evening prompt to capture daily notes',
              icon: AlarmClock,
            },
            {
              key: 'weeklyDigest' as const,
              title: 'Weekly Archive Summary',
              desc: 'Recap of newly created and pinned notes',
              icon: CalendarDays,
            },
            {
              key: 'subtleSounds' as const,
              title: 'Subtle Haptic Feedback',
              desc: 'Soft tactile response on checklist completion',
              icon: Vibrate,
            },
          ].map((item) => {
            const Icon = item.icon;
            const enabled = notifications[item.key];
            return (
              <div key={item.key} className="flex items-center justify-between gap-3.5 py-3.5">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
                      enabled
                        ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                        : 'bg-[var(--bg-canvas)] text-[var(--text-secondary)]'
                    }`}
                  >
                    <Icon className="h-4.5 w-4.5" strokeWidth={1.9} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)]">{item.title}</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">{item.desc}</p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  onClick={() => updateNotifications({ [item.key]: !enabled })}
                  className={`relative h-7 w-12 shrink-0 rounded-full transition-colors cursor-pointer ${
                    enabled ? 'bg-[var(--accent-primary)]' : 'bg-[var(--divider)]'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white transition-transform ${
                      enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </InfoSheetDialog>

      <InfoSheetDialog
        open={backupOpen}
        title="Backup & Sync"
        onClose={() => setBackupOpen(false)}
      >
        <div className="space-y-4">
          <div className="rounded-2xl bg-[var(--bg-canvas)] border border-[var(--divider)] p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold">Google Drive Backup</p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                {isGuest
                  ? 'Sign in with Google to save and restore your notes via Google Drive.'
                  : account.lastDriveBackupAt
                  ? `Signed in as ${account.email} · Last backup ${formatFullDate(account.lastDriveBackupAt)}`
                  : `Signed in as ${account.email} · Ready to back up`}
              </p>
            </div>

            {isGuest ? (
              <div className="space-y-2.5">
                <GoogleSignInButton onClick={signInGoogleAccount} loading={authLoading} />
                {authError && (
                  <p className="rounded-xl bg-[#E45B5B]/10 border border-[#E45B5B]/25 px-3 py-2 text-xs text-[#C62828] dark:text-[#FCA5A5] select-text">
                    {authError}
                  </p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={driveBusy || exportingFormat === 'pdf'}
                  onClick={() => {
                    if (!canUseDriveBackup) {
                      setBackupOpen(false);
                      requestUpgrade('Google Drive cloud backup & restore is a Notes Premium feature.');
                      return;
                    }
                    setDriveBackupConfirmOpen(true);
                  }}
                  className="flex w-full min-h-[42px] items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] px-3 text-xs font-semibold text-white dark:text-[#171717] disabled:opacity-60 cursor-pointer"
                >
                  {driveBusy || exportingFormat === 'pdf' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : !canUseDriveBackup ? (
                    <Lock className="h-3.5 w-3.5" strokeWidth={2} />
                  ) : (
                    <CloudUpload className="h-3.5 w-3.5" strokeWidth={2} />
                  )}
                  Back Up Now
                </button>
                <button
                  type="button"
                  disabled={driveBusy}
                  onClick={() => {
                    if (!canUseDriveBackup) {
                      setBackupOpen(false);
                      requestUpgrade('Google Drive cloud backup & restore is a Notes Premium feature.');
                      return;
                    }
                    setDriveRestoreConfirmOpen(true);
                  }}
                  className="flex w-full min-h-[42px] items-center justify-center gap-2 rounded-xl border border-[var(--divider)] bg-[var(--bg-card)] px-3 text-xs font-semibold text-[var(--text-primary)] disabled:opacity-60 cursor-pointer"
                >
                  {driveBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : !canUseDriveBackup ? (
                    <Lock className="h-3.5 w-3.5 text-[var(--accent-primary)]" strokeWidth={2} />
                  ) : (
                    <CloudDownload className="h-3.5 w-3.5" strokeWidth={2} />
                  )}
                  Restore
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={Boolean(exportingFormat)}
            onClick={() => {
              void handleExportZip('txt');
            }}
            className="flex w-full min-h-[46px] items-center justify-center gap-2 rounded-xl border border-[var(--divider)] bg-[var(--bg-canvas)] px-4 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] disabled:opacity-60 transition-colors cursor-pointer"
          >
            {exportingFormat === 'txt' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" strokeWidth={2} />
            )}
            Download Text (.zip)
          </button>
        </div>
      </InfoSheetDialog>

      <InfoSheetDialog
        open={autoBackupOpen}
        title="Auto Backup Date"
        onClose={() => setAutoBackupOpen(false)}
      >
        <form onSubmit={handleSaveAutoBackup} className="space-y-4">
          {autoBackup.enabled && autoBackup.nextBackupAt && (
            <div className="rounded-xl bg-[var(--bg-canvas)] border border-[var(--divider)] px-3.5 py-2.5 text-xs text-[var(--text-secondary)]">
              Next auto PDF backup: <span className="font-medium text-[var(--text-primary)]">{formatFullDate(autoBackup.nextBackupAt)}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <input
              type="number"
              min={0}
              max={120}
              inputMode="numeric"
              value={autoMonthsInput}
              onChange={(e) => setAutoMonthsInput(e.target.value)}
              placeholder="Months"
              aria-label="Months"
              className="w-full min-h-[44px] rounded-xl bg-[var(--bg-canvas)] border border-[var(--divider)] px-3.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-primary)]"
            />
            <input
              type="number"
              min={0}
              max={365}
              inputMode="numeric"
              value={autoDaysInput}
              onChange={(e) => setAutoDaysInput(e.target.value)}
              placeholder="Days"
              aria-label="Days"
              className="w-full min-h-[44px] rounded-xl bg-[var(--bg-canvas)] border border-[var(--divider)] px-3.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-primary)]"
            />
          </div>

          <div className="flex gap-2.5">
            {autoBackup.enabled && (
              <button
                type="button"
                onClick={() => {
                  disableAutoBackupSchedule();
                  setAutoBackupOpen(false);
                }}
                className="flex-1 min-h-[44px] rounded-xl bg-[#E45B5B]/10 text-sm font-semibold text-[#E45B5B] cursor-pointer"
              >
                Turn Off
              </button>
            )}
            <button
              type="submit"
              className="flex-1 min-h-[44px] rounded-xl bg-[var(--text-primary)] dark:bg-[var(--accent-primary)] text-sm font-semibold text-[var(--bg-card)] dark:text-[#171717] cursor-pointer"
            >
              Save Schedule
            </button>
          </div>
        </form>
      </InfoSheetDialog>

      <TrashRetentionDialog
        open={trashRetentionOpen}
        onClose={() => setTrashRetentionOpen(false)}
      />

      <ConfirmDialog
        open={driveBackupConfirmOpen}
        title="Back up & download PDF ZIP?"
        description={`This will save your ${notes.length} notes and ${folders.length} folders to Google Drive (${account.email}) and download a PDF ZIP of your notes.`}
        confirmLabel="Back Up Now"
        danger={false}
        onConfirm={() => {
          void handleBackUpNowAndDownloadPdf();
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

      <InfoSheetDialog
        open={restoreOpen}
        title="Restore Purchase"
        onClose={() => {
          setRestoreOpen(false);
          setRestoreStatusMsg(null);
        }}
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            {account.email
              ? `Verify purchases linked to ${account.email} or enter a verified SSLCommerz / Binance Pay transaction ID.`
              : 'Enter your payment Transaction ID or sign in with Google to restore an active subscription.'}
          </p>

          <input
            type="text"
            value={restoreTxId}
            onChange={(e) => setRestoreTxId(e.target.value)}
            placeholder="Transaction ID (optional)"
            aria-label="Transaction ID"
            className="w-full min-h-[44px] rounded-xl bg-[var(--bg-canvas)] border border-[var(--divider)] px-3.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-primary)]"
          />

          {restoreStatusMsg && (
            <p className="text-xs text-[var(--text-secondary)]">{restoreStatusMsg}</p>
          )}

          <button
            type="button"
            disabled={billingBusy}
            onClick={() => {
              void restorePurchase(restoreTxId).then((res) => {
                setRestoreStatusMsg(res.message);
                if (res.restored) {
                  setRestoreOpen(false);
                }
              });
            }}
            className="flex w-full min-h-[46px] items-center justify-center gap-2 rounded-xl bg-[var(--text-primary)] dark:bg-[var(--accent-primary)] text-sm font-semibold text-[var(--bg-card)] dark:text-[#171717] disabled:opacity-60 cursor-pointer"
          >
            {billingBusy && <Loader2 className="h-4 w-4 animate-spin" />}
            Verify & Restore Purchase
          </button>
        </div>
      </InfoSheetDialog>

    </NavigationShell>
  );
}
