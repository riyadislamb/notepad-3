import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import {
  AnnouncementActionTarget,
  AppControlsConfig,
  FREE_LIMITS,
} from '../types/notes';
import { ADMIN_EMAIL, FirestoreSyncState } from './adminConfigService';
import { auth, db, diagnoseFirestoreTimeout, isFirebaseConfigured } from './googleAuthDrive';

const APP_CONTROLS_CACHE_KEY = 'notes_app_controls_cache_v1';

export const DEFAULT_APP_CONTROLS_CONFIG: AppControlsConfig = {
  freeLimits: {
    maxActiveNotes: FREE_LIMITS.maxActiveNotes,
    maxFolders: FREE_LIMITS.maxFolders,
    maxImagesPerNote: FREE_LIMITS.maxImagesPerNote,
  },
  announcement: {
    enabled: false,
    title: '',
    message: '',
    actionLabel: '',
    actionTarget: 'none',
    updatedAt: '',
  },
  premiumControls: {
    features: {
      themePalettes: true,
      noteLock: true,
      driveBackup: false,
    },
    pricing: {
      monthlyBdt: 590,
      monthlyUsdt: 4.99,
      yearlyBdt: 4790,
      yearlyUsdt: 39.99,
    },
  },
  updatedAt: '',
};

function clampInt(val: unknown, min: number, max: number, fallback: number): number {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(num)));
}

function clampAmount(val: unknown, min: number, max: number, fallback: number, decimals: number): number {
  const num = Number(val);
  if (!Number.isFinite(num) || num < min) return fallback;
  const clamped = Math.min(max, num);
  const factor = Math.pow(10, decimals);
  return Math.round(clamped * factor) / factor;
}

function normalizeActionTarget(val: unknown): AnnouncementActionTarget {
  if (val === 'premium' || val === 'about' || val === 'help') {
    return val;
  }
  return 'none';
}

export function normalizeAppControlsConfig(
  raw: Partial<AppControlsConfig> | null | undefined
): AppControlsConfig {
  const def = DEFAULT_APP_CONTROLS_CONFIG;
  const rawLimits = raw?.freeLimits;
  const rawAnn = raw?.announcement;
  const rawPrem = raw?.premiumControls;

  return {
    freeLimits: {
      maxActiveNotes: clampInt(
        rawLimits?.maxActiveNotes,
        1,
        10000,
        def.freeLimits.maxActiveNotes
      ),
      maxFolders: clampInt(
        rawLimits?.maxFolders,
        1,
        500,
        def.freeLimits.maxFolders
      ),
      maxImagesPerNote: clampInt(
        rawLimits?.maxImagesPerNote,
        0,
        100,
        def.freeLimits.maxImagesPerNote
      ),
    },
    announcement: {
      enabled: Boolean(rawAnn?.enabled),
      title: typeof rawAnn?.title === 'string' ? rawAnn.title.trim().slice(0, 120) : '',
      message: typeof rawAnn?.message === 'string' ? rawAnn.message.trim().slice(0, 400) : '',
      actionLabel:
        typeof rawAnn?.actionLabel === 'string'
          ? rawAnn.actionLabel.trim().slice(0, 32)
          : '',
      actionTarget: normalizeActionTarget(rawAnn?.actionTarget),
      updatedAt: typeof rawAnn?.updatedAt === 'string' ? rawAnn.updatedAt : '',
    },
    premiumControls: {
      features: {
        themePalettes:
          typeof rawPrem?.features?.themePalettes === 'boolean'
            ? rawPrem.features.themePalettes
            : def.premiumControls.features.themePalettes,
        noteLock:
          typeof rawPrem?.features?.noteLock === 'boolean'
            ? rawPrem.features.noteLock
            : def.premiumControls.features.noteLock,
        driveBackup:
          typeof rawPrem?.features?.driveBackup === 'boolean'
            ? rawPrem.features.driveBackup
            : def.premiumControls.features.driveBackup,
      },
      pricing: {
        monthlyBdt: clampAmount(
          rawPrem?.pricing?.monthlyBdt,
          1,
          1000000,
          def.premiumControls.pricing.monthlyBdt,
          0
        ),
        monthlyUsdt: clampAmount(
          rawPrem?.pricing?.monthlyUsdt,
          0.1,
          100000,
          def.premiumControls.pricing.monthlyUsdt,
          2
        ),
        yearlyBdt: clampAmount(
          rawPrem?.pricing?.yearlyBdt,
          1,
          10000000,
          def.premiumControls.pricing.yearlyBdt,
          0
        ),
        yearlyUsdt: clampAmount(
          rawPrem?.pricing?.yearlyUsdt,
          0.1,
          1000000,
          def.premiumControls.pricing.yearlyUsdt,
          2
        ),
      },
    },
    updatedAt: typeof raw?.updatedAt === 'string' ? raw.updatedAt : '',
    updatedBy: typeof raw?.updatedBy === 'string' ? raw.updatedBy : undefined,
  };
}

export function loadCachedAppControlsConfig(): AppControlsConfig {
  try {
    const raw = localStorage.getItem(APP_CONTROLS_CACHE_KEY);
    if (!raw) return DEFAULT_APP_CONTROLS_CONFIG;
    return normalizeAppControlsConfig(JSON.parse(raw) as Partial<AppControlsConfig>);
  } catch {
    return DEFAULT_APP_CONTROLS_CONFIG;
  }
}

function cacheAppControlsConfig(config: AppControlsConfig): void {
  try {
    localStorage.setItem(APP_CONTROLS_CACHE_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage quota errors
  }
}

export function subscribeAppControlsConfig(
  onConfig: (
    config: AppControlsConfig,
    syncState: FirestoreSyncState,
    errorMessage?: string
  ) => void
): () => void {
  if (!isFirebaseConfigured || !db) {
    onConfig(loadCachedAppControlsConfig(), 'unconfigured');
    return () => {};
  }

  try {
    const configRef = doc(db, 'app_config', 'app_controls');

    return onSnapshot(
      configRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const normalized = normalizeAppControlsConfig(
            snapshot.data() as Partial<AppControlsConfig>
          );
          cacheAppControlsConfig(normalized);
          onConfig(normalized, 'synced');
        } else {
          onConfig(loadCachedAppControlsConfig(), 'synced');
        }
      },
      (err) => {
        onConfig(
          loadCachedAppControlsConfig(),
          'error',
          err?.message || 'Could not load App Controls settings from Firestore'
        );
      }
    );
  } catch (err) {
    onConfig(
      loadCachedAppControlsConfig(),
      'error',
      err instanceof Error ? err.message : 'Firestore initialization failed'
    );
    return () => {};
  }
}

export async function saveAppControlsConfig(
  next: Pick<AppControlsConfig, 'freeLimits' | 'announcement' | 'premiumControls'>
): Promise<AppControlsConfig> {
  if (!isFirebaseConfigured || !db || !auth?.currentUser) {
    throw new Error('Sign in with your admin Google account first.');
  }
  const currentEmail = (auth.currentUser.email || '').trim().toLowerCase();
  if (currentEmail !== ADMIN_EMAIL || !auth.currentUser.emailVerified) {
    throw new Error('Only the verified admin account can update App Controls.');
  }

  const nowIso = new Date().toISOString();
  const normalized = normalizeAppControlsConfig({
    freeLimits: next.freeLimits,
    announcement: {
      ...next.announcement,
      updatedAt: next.announcement.updatedAt || nowIso,
    },
    premiumControls: next.premiumControls,
    updatedAt: nowIso,
    updatedBy: currentEmail,
  });

  const payload = {
    freeLimits: normalized.freeLimits,
    announcement: normalized.announcement,
    premiumControls: normalized.premiumControls,
    updatedAt: normalized.updatedAt,
    updatedBy: currentEmail,
  };

  const configRef = doc(db, 'app_config', 'app_controls');
  await Promise.race([
    setDoc(configRef, payload),
    new Promise<never>((_, reject) =>
      setTimeout(() => {
        void diagnoseFirestoreTimeout('app_config/app_controls').then((reason) =>
          reject(new Error(reason))
        );
      }, 12000)
    ),
  ]);
  cacheAppControlsConfig(normalized);
  return normalized;
}
