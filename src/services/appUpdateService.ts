import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import {
  clearAppUpdateStatusBarNotification,
  notifyAppUpdateStatusBar,
} from '../utils/notificationHelper';

const DISMISSED_VERSION_KEY = 'notes_dismissed_apk_version_v1';
const LEGACY_DOWNLOADED_VERSION_KEY = 'notes_downloaded_apk_version_v1';
const NOTIFIED_VERSION_KEY = 'notes_notified_apk_version_v1';
const LATEST_RELEASE_KEY = 'notes_latest_apk_release_v1';
const LAST_CHECK_AT_KEY = 'notes_apk_update_last_check_v1';
const CHECK_THROTTLE_MS = 15 * 1000;
export const APP_UPDATE_STATE_EVENT = 'notes-app-update-state-changed';

export interface AppUpdateInfo {
  latestVersion: string;
  currentVersion: string;
  downloadUrl: string;
  releasePageUrl: string;
  releaseNotes: string;
}

export interface AboutAppUpdateState {
  latestVersion: string;
  downloadUrl: string;
}

export interface UpdateCheckOptions {
  ignoreThrottle?: boolean;
  respectDismissed?: boolean;
}

function emitUpdateStateChange(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(APP_UPDATE_STATE_EVENT));
  }
}

function normalizeVersion(raw: string): string {
  return raw.trim().replace(/^v/i, '');
}

export function compareVersions(latestRaw: string, currentRaw: string): number {
  const parse = (v: string) =>
    normalizeVersion(v)
      .split(/[.+-]/)
      .map((part) => {
        const num = Number.parseInt(part, 10);
        return Number.isFinite(num) ? num : 0;
      });

  const a = parse(latestRaw);
  const b = parse(currentRaw);
  const len = Math.max(a.length, b.length);

  for (let i = 0; i < len; i += 1) {
    const va = a[i] ?? 0;
    const vb = b[i] ?? 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

export async function getInstalledAppVersion(): Promise<string> {
  const fallback = normalizeVersion(import.meta.env.VITE_APP_VERSION || '1.0.0') || '1.0.0';
  try {
    if (Capacitor.isNativePlatform()) {
      const info = await App.getInfo();
      if (info?.version) {
        return normalizeVersion(info.version);
      }
    }
  } catch {
    // Fallback to build-time version
  }
  return fallback;
}

export function dismissAppUpdateVersion(version: string): void {
  try {
    localStorage.setItem(DISMISSED_VERSION_KEY, normalizeVersion(version));
    emitUpdateStateChange();
    void clearAppUpdateStatusBarNotification();
  } catch {
    // Ignore storage errors
  }
}

function saveLatestReleaseCache(info: AppUpdateInfo): void {
  try {
    localStorage.setItem(LATEST_RELEASE_KEY, JSON.stringify(info));
    emitUpdateStateChange();
  } catch {
    // Ignore storage errors
  }
}

function clearLatestReleaseCache(): void {
  try {
    localStorage.removeItem(LATEST_RELEASE_KEY);
    localStorage.removeItem(LEGACY_DOWNLOADED_VERSION_KEY);
    emitUpdateStateChange();
  } catch {
    // Ignore storage errors
  }
}

export function getAboutAppUpdateState(currentVersion: string): AboutAppUpdateState | null {
  try {
    const raw = localStorage.getItem(LATEST_RELEASE_KEY);
    if (!raw) return null;

    const cached = JSON.parse(raw) as Partial<AppUpdateInfo>;
    const latestVersion = normalizeVersion(cached.latestVersion || '');
    const downloadUrl = (cached.downloadUrl || '').trim();
    if (!latestVersion || !downloadUrl) return null;

    if (compareVersions(latestVersion, currentVersion) <= 0) {
      return null;
    }

    return {
      latestVersion,
      downloadUrl,
    };
  } catch {
    return null;
  }
}

export function getCachedUpdateInfo(): AppUpdateInfo | null {
  try {
    const raw = localStorage.getItem(LATEST_RELEASE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AppUpdateInfo>;
    if (!parsed.latestVersion || !parsed.downloadUrl) return null;
    return {
      latestVersion: normalizeVersion(parsed.latestVersion),
      currentVersion: normalizeVersion(parsed.currentVersion || '1.0.0'),
      downloadUrl: parsed.downloadUrl,
      releasePageUrl: parsed.releasePageUrl || parsed.downloadUrl,
      releaseNotes: parsed.releaseNotes || '',
    };
  } catch {
    return null;
  }
}

export async function checkForGitHubApkUpdate(
  options: boolean | UpdateCheckOptions = false
): Promise<AppUpdateInfo | null> {
  const ignoreThrottle =
    typeof options === 'boolean' ? options : Boolean(options.ignoreThrottle);
  const respectDismissed =
    typeof options === 'boolean' ? !options : options.respectDismissed ?? true;

  try {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      return null;
    }

    const repo = (import.meta.env.VITE_GITHUB_REPO || '').trim();
    if (!repo || !repo.includes('/')) {
      return null;
    }

    if (!ignoreThrottle) {
      const lastCheckRaw = localStorage.getItem(LAST_CHECK_AT_KEY);
      const lastCheck = lastCheckRaw ? Number(lastCheckRaw) : 0;
      if (Number.isFinite(lastCheck) && Date.now() - lastCheck < CHECK_THROTTLE_MS) {
        return null;
      }
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return null;
    }

    const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: {
        Accept: 'application/vnd.github+json',
      },
      cache: 'no-store',
    });

    if (!res.ok) return null;

    localStorage.setItem(LAST_CHECK_AT_KEY, String(Date.now()));

    const release = (await res.json()) as {
      tag_name?: string;
      name?: string;
      body?: string;
      html_url?: string;
      draft?: boolean;
      prerelease?: boolean;
      assets?: Array<{ name?: string; browser_download_url?: string }>;
    };

    if (release.draft || release.prerelease || !release.tag_name) {
      return null;
    }

    const latestVersion = normalizeVersion(release.tag_name);
    const currentVersion = await getInstalledAppVersion();

    if (compareVersions(latestVersion, currentVersion) <= 0) {
      clearLatestReleaseCache();
      void clearAppUpdateStatusBarNotification();
      return null;
    }

    const apkAsset = release.assets?.find(
      (a) =>
        typeof a.name === 'string' &&
        a.name.toLowerCase().endsWith('.apk') &&
        typeof a.browser_download_url === 'string'
    );

    const releasePageUrl =
      release.html_url || `https://github.com/${repo}/releases/latest`;
    const downloadUrl = apkAsset?.browser_download_url || releasePageUrl;

    const updateInfo: AppUpdateInfo = {
      latestVersion,
      currentVersion,
      downloadUrl,
      releasePageUrl,
      releaseNotes: (release.body || '').trim(),
    };

    saveLatestReleaseCache(updateInfo);

    const dismissed = normalizeVersion(localStorage.getItem(DISMISSED_VERSION_KEY) || '');
    const notified = normalizeVersion(localStorage.getItem(NOTIFIED_VERSION_KEY) || '');

    if (dismissed !== latestVersion && notified !== latestVersion) {
      void notifyAppUpdateStatusBar(latestVersion, downloadUrl).then((sent) => {
        if (sent) {
          try {
            localStorage.setItem(NOTIFIED_VERSION_KEY, latestVersion);
          } catch {
            // Ignore storage errors
          }
        }
      });
    }

    if (respectDismissed && dismissed && dismissed === latestVersion) {
      return null;
    }

    return updateInfo;
  } catch {
    return null;
  }
}
