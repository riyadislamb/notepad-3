import React from 'react';
import { Download } from 'lucide-react';
import { useBackHandler } from '../context/NotesContext';
import { AppUpdateInfo } from '../services/appUpdateService';

interface AppUpdateDialogProps {
  updateInfo: AppUpdateInfo | null;
  onDismiss: () => void;
  onDownload: () => void;
}

export function AppUpdateDialog({ updateInfo, onDismiss, onDownload }: AppUpdateDialogProps) {
  useBackHandler(Boolean(updateInfo), onDismiss);

  if (!updateInfo) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-update-title"
      onClick={onDismiss}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl bg-[var(--bg-card)] border border-[var(--divider)] p-6"
      >
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
          <Download className="h-5 w-5" strokeWidth={2} />
        </div>

        <h3 id="app-update-title" className="text-lg font-bold text-[var(--text-primary)]">
          Update Available
        </h3>

        <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
          A new version <span className="font-semibold text-[var(--text-primary)]">v{updateInfo.latestVersion}</span> is available on GitHub (Installed: v{updateInfo.currentVersion}).
        </p>

        {updateInfo.releaseNotes && (
          <p className="mt-2.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--divider)] px-3 py-2 text-xs text-[var(--text-secondary)] line-clamp-3">
            {updateInfo.releaseNotes}
          </p>
        )}

        <div className="mt-6 flex gap-2.5">
          <button
            type="button"
            onClick={onDismiss}
            className="flex-1 min-h-[44px] rounded-full bg-[var(--bg-subtle)] text-sm font-semibold text-[var(--text-primary)] hover:opacity-90 cursor-pointer"
          >
            Later
          </button>
          <a
            href={updateInfo.downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onDownload}
            className="flex-1 min-h-[44px] flex items-center justify-center rounded-full bg-[var(--text-primary)] dark:bg-[var(--accent-primary)] text-sm font-semibold text-[var(--bg-card)] dark:text-[#171717] hover:opacity-90 cursor-pointer"
          >
            Update Now
          </a>
        </div>
      </div>
    </div>
  );
}
