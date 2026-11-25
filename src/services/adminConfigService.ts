import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { PreviewModeConfig, UserAccount } from '../types/notes';
import { auth, db, diagnoseFirestoreTimeout, isFirebaseConfigured } from './googleAuthDrive';

export const ADMIN_EMAIL = 'riyadislambdd@gmail.com';
const PREVIEW_CONFIG_CACHE_KEY = 'notes_preview_config_cache_v1';

export const DEFAULT_PREVIEW_CONFIG: PreviewModeConfig = {
  enabled: true,
  days: 7,
  hours: 0,
  minutes: 0,
  seconds: 0,
  expiresAt: '',
  updatedAt: '',
};

export type FirestoreSyncState = 'synced' | 'loading' | 'error' | 'unconfigured';

export function isAdminAccount(account: Pick<UserAccount, 'email' | 'isGuest' | 'emailVerified'>): boolean {
  return (
    account.isGuest === false &&
    account.emailVerified === true &&
    account.email.trim().toLowerCase() === ADMIN_EMAIL
  );
}

export function normalizePreviewConfig(raw: Partial<PreviewModeConfig> | null | undefined): PreviewModeConfig {
  const clampInt = (val: unknown, fallback: number, max: number) => {
    const num = typeof val === 'number' ? val : Number(val);
    if (!Number.isFinite(num) || num < 0) return fallback;
    return Math.min(max, Math.floor(num));
  };

  return {
    enabled: typeof raw?.enabled === 'boolean' ? raw.enabled : DEFAULT_PREVIEW_CONFIG.enabled,
    days: clampInt(raw?.days, DEFAULT_PREVIEW_CONFIG.days, 3650),
    hours: 0,
    minutes: 0,
    seconds: 0,
    expiresAt: '',
    updatedAt: typeof raw?.updatedAt === 'string' ? raw.updatedAt : '',
    updatedBy: typeof raw?.updatedBy === 'string' ? raw.updatedBy : undefined,
  };
}

export function getPreviewDurationMs(config: PreviewModeConfig): number {
  const d = Math.max(0, Math.floor(config.days || 0));
  return d * 86400 * 1000;
}

export function getPreviewExpiresAtMs(
  config: PreviewModeConfig,
  startedAtMs: number
): number {
  const durationMs = getPreviewDurationMs(config);
  if (durationMs <= 0) return 0;
  return startedAtMs + durationMs;
}

export function loadCachedPreviewConfig(): PreviewModeConfig {
  try {
    const raw = localStorage.getItem(PREVIEW_CONFIG_CACHE_KEY);
    if (!raw) return DEFAULT_PREVIEW_CONFIG;
    return normalizePreviewConfig(JSON.parse(raw) as Partial<PreviewModeConfig>);
  } catch {
    return DEFAULT_PREVIEW_CONFIG;
  }
}

function cachePreviewConfig(config: PreviewModeConfig): void {
  try {
    localStorage.setItem(PREVIEW_CONFIG_CACHE_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage errors
  }
}

export function subscribePreviewModeConfig(
  onConfig: (config: PreviewModeConfig, syncState: FirestoreSyncState, errorMessage?: string) => void
): () => void {
  if (!isFirebaseConfigured || !db) {
    onConfig(loadCachedPreviewConfig(), 'unconfigured');
    return () => {};
  }

  try {
    const configRef = doc(db, 'app_config', 'preview_mode');

    return onSnapshot(
      configRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const normalized = normalizePreviewConfig(snapshot.data() as Partial<PreviewModeConfig>);
          cachePreviewConfig(normalized);
          onConfig(normalized, 'synced');
        } else {
          onConfig(loadCachedPreviewConfig(), 'synced');
        }
      },
      (err) => {
        onConfig(loadCachedPreviewConfig(), 'error', err?.message || 'Firestore unavailable');
      }
    );
  } catch (err) {
    onConfig(
      loadCachedPreviewConfig(),
      'error',
      err instanceof Error ? err.message : 'Firestore initialization failed'
    );
    return () => {};
  }
}

export async function savePreviewModeConfig(
  next: Pick<
    PreviewModeConfig,
    'enabled' | 'days' | 'hours' | 'minutes' | 'seconds' | 'expiresAt'
  >
): Promise<PreviewModeConfig> {
  if (!isFirebaseConfigured || !db || !auth?.currentUser) {
    throw new Error('Sign in with your admin Google account first.');
  }
  const currentEmail = (auth.currentUser.email || '').trim().toLowerCase();
  if (currentEmail !== ADMIN_EMAIL || !auth.currentUser.emailVerified) {
    throw new Error('Only the verified admin account can update settings.');
  }

  const normalized = normalizePreviewConfig({
    ...next,
    updatedAt: new Date().toISOString(),
    updatedBy: currentEmail,
  });

  const configRef = doc(db, 'app_config', 'preview_mode');
  await Promise.race([
    setDoc(configRef, normalized, { merge: true }),
    new Promise<never>((_, reject) =>
      setTimeout(() => {
        void diagnoseFirestoreTimeout('app_config/preview_mode').then((reason) =>
          reject(new Error(reason))
        );
      }, 12000)
    ),
  ]);
  cachePreviewConfig(normalized);
  return normalized;
}
