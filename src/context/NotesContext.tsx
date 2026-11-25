import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import {
  CV_GENERATION_FOLDER_ID,
  DEFAULT_FOLDERS,
  DEFAULT_MY_NOTES_FOLDER_ID,
  FEATURED_STORY_NOTE_ID,
  INITIAL_ACCOUNT,
  INITIAL_NOTES,
  INITIAL_RECENT_SEARCHES,
  createFeaturedStoryNote,
} from '../data/initialData';
import {
  AboutAppConfig,
  AppControlsConfig,
  AutoBackupSchedule,
  EditorCursorTarget,
  Folder,
  Note,
  NOTE_FONT_SIZE_DEFAULT,
  NoteFontSize,
  normalizeNoteFontSize,
  NoteLockMethod,
  NotificationSettings,
  PreviewModeConfig,
  ScreenName,
  TextToolId,
  TextToolRule,
  TextToolsConfig,
  ThemePalette,
  ThemePreference,
  ToastMessage,
  TrashRetentionConfig,
  UserAccount,
} from '../types/notes';
import { exportNotesAsPdfZip } from '../utils/exportNotesZip';
import {
  DEFAULT_TRASH_RETENTION,
  formatTrashRetentionDuration,
  generateId,
  isTrashExpired,
  normalizeTrashRetention,
} from '../utils/noteHelpers';
import {
  initFirebaseAuth,
  restoreDriveBackup,
  signInWithGoogle,
  signOutGoogle,
  uploadDriveBackup,
} from '../services/googleAuthDrive';
import { syncLocalNotifications } from '../utils/notificationHelper';
import {
  checkBiometricAvailability,
  subscribeBiometryChange,
} from '../utils/biometricHelper';
import {
  restorePurchaseOnServer,
  verifyPurchaseTransaction,
} from '../services/billingService';
import {
  DEFAULT_PREVIEW_CONFIG,
  FirestoreSyncState,
  getPreviewExpiresAtMs,
  isAdminAccount,
  loadCachedPreviewConfig,
  savePreviewModeConfig,
  subscribePreviewModeConfig,
} from '../services/adminConfigService';
import {
  loadCachedAboutConfig,
  saveAboutAppConfig,
  subscribeAboutAppConfig,
} from '../services/aboutAppService';
import {
  DEFAULT_TEXT_TOOLS_CONFIG,
  loadCachedTextToolsConfig,
  saveTextToolsConfig,
  subscribeTextToolsConfig,
} from '../services/textToolsService';
import {
  DEFAULT_APP_CONTROLS_CONFIG,
  loadCachedAppControlsConfig,
  saveAppControlsConfig,
  subscribeAppControlsConfig,
} from '../services/appControlsService';

const STORAGE_KEY = 'notes_app_state_v2';

interface PersistedState {
  notes: Note[];
  folders: Folder[];
  theme: ThemePreference;
  palette: ThemePalette;
  noteFontSize: NoteFontSize;
  isPremium: boolean;
  notePin: string | null;
  noteLockMethod: NoteLockMethod;
  defaultFolderId: string;
  notifications: NotificationSettings;
  account: UserAccount;
  recentSearches: string[];
  hasOnboarded: boolean;
  previewStartedAt: number;
  autoBackup: AutoBackupSchedule;
  trashRetention: TrashRetentionConfig;
  seededDefaultStoryV1: boolean;
}

function ensureSystemFolders(folders: Folder[]): Folder[] {
  const cvTemplate = DEFAULT_FOLDERS.find((f) => f.id === CV_GENERATION_FOLDER_ID);
  if (!cvTemplate) return folders;
  let found = false;
  const normalized = folders.map((f) => {
    if (f.id === CV_GENERATION_FOLDER_ID || f.name.trim().toLowerCase() === 'cv generation') {
      found = true;
      return {
        ...f,
        id: f.id === CV_GENERATION_FOLDER_ID ? f.id : f.id,
        name: 'Cv Generation',
        isDefault: true,
        isSystem: true,
      };
    }
    return f;
  });
  return found ? normalized : [...normalized, cvTemplate];
}

function computeNextAutoBackupIso(from: Date, months: number, days: number): string {
  const next = new Date(from.getTime());
  if (months > 0) {
    next.setMonth(next.getMonth() + months);
  }
  if (days > 0) {
    next.setDate(next.getDate() + days);
  }
  return next.toISOString();
}

interface NavigateOptions {
  noteId?: string | null;
  folderId?: string | null;
  replace?: boolean;
  cursorTarget?: EditorCursorTarget | null;
}

interface NotesContextValue {
  screen: ScreenName;
  navigate: (next: ScreenName, options?: NavigateOptions) => void;
  goBack: () => void;
  canGoBack: boolean;
  registerBackHandler: (handler: () => boolean) => () => void;
  activeNoteId: string | null;
  activeFolderId: string | null;
  activeCursorTarget: EditorCursorTarget | null;
  setActiveFolderId: (id: string | null) => void;
  notes: Note[];
  activeNotes: Note[];
  pinnedNotes: Note[];
  favoriteNotes: Note[];
  archivedNotes: Note[];
  trashedNotes: Note[];
  folders: Folder[];
  theme: ThemePreference;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: ThemePreference) => void;
  palette: ThemePalette;
  setPalette: (palette: ThemePalette) => void;
  noteFontSize: NoteFontSize;
  setNoteFontSize: (size: NoteFontSize) => void;
  isPremium: boolean;
  setIsPremium: (value: boolean) => void;
  hasPaidSubscription: boolean;
  isPreviewAvailable: boolean;
  canViewSubscriptionPage: boolean;
  previewConfig: PreviewModeConfig;
  previewSyncState: FirestoreSyncState;
  previewSyncError: string | null;
  previewStartedAt: number;
  isAdmin: boolean;
  adminSaving: boolean;
  updateAdminPreviewConfig: (
    next: Pick<
      PreviewModeConfig,
      'enabled' | 'days' | 'hours' | 'minutes' | 'seconds' | 'expiresAt'
    >
  ) => Promise<boolean>;
  aboutConfig: AboutAppConfig;
  aboutSyncState: FirestoreSyncState;
  aboutSyncError: string | null;
  aboutSaving: boolean;
  updateAdminAboutConfig: (
    next: Pick<AboutAppConfig, 'ceo' | 'team' | 'socials'>
  ) => Promise<boolean>;
  textToolsConfig: TextToolsConfig;
  textToolsSyncState: FirestoreSyncState;
  textToolsSyncError: string | null;
  textToolsSaving: boolean;
  updateAdminTextToolsConfig: (
    nextTools: Record<TextToolId, TextToolRule>
  ) => Promise<boolean>;
  appControlsConfig: AppControlsConfig;
  appControlsSyncState: FirestoreSyncState;
  appControlsSyncError: string | null;
  appControlsSaving: boolean;
  updateAdminAppControlsConfig: (
    next: Pick<AppControlsConfig, 'freeLimits' | 'announcement' | 'premiumControls'>
  ) => Promise<boolean>;
  canUsePremiumPalettes: boolean;
  canUseNoteLock: boolean;
  canUseDriveBackup: boolean;
  canCreateNote: boolean;
  canCreateFolder: boolean;
  maxImagesAllowed: number;
  upgradePromptReason: string | null;
  requestUpgrade: (reason: string) => void;
  dismissUpgradePrompt: () => void;
  notePin: string | null;
  setNotePin: (pin: string | null) => void;
  noteLockMethod: NoteLockMethod;
  enableFingerprintLock: () => void;
  disableNoteLock: () => void;
  biometricSupported: boolean;
  biometryLabel: string;
  unlockedNoteIds: string[];
  unlockNoteSession: (noteId: string) => void;
  lockNoteSession: (noteId: string) => void;
  toggleLockNote: (noteId: string) => void;
  defaultFolderId: string;
  setDefaultFolderId: (folderId: string) => void;
  notifications: NotificationSettings;
  updateNotifications: (patch: Partial<NotificationSettings>) => void;
  account: UserAccount;
  updateAccount: (patch: Partial<UserAccount>) => void;
  authLoading: boolean;
  authError: string | null;
  driveBusy: boolean;
  billingBusy: boolean;
  hasDriveAccess: boolean;
  signInGoogleAccount: () => Promise<void>;
  signOutGoogleAccount: () => Promise<void>;
  backupToGoogleDrive: () => Promise<boolean>;
  restoreFromGoogleDrive: () => Promise<boolean>;
  autoBackup: AutoBackupSchedule;
  updateAutoBackupSchedule: (months: number, days: number) => void;
  disableAutoBackupSchedule: () => void;
  trashRetention: TrashRetentionConfig;
  updateTrashRetention: (months: number, days: number) => void;
  disableTrashRetention: () => void;
  restorePurchase: (transactionId?: string) => Promise<{ restored: boolean; message: string }>;
  recentSearches: string[];
  addRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;
  hasOnboarded: boolean;
  completeOnboarding: () => void;
  createNote: (partial?: Partial<Note>) => Note | null;
  updateNote: (id: string, patch: Partial<Note>) => void;
  togglePinNote: (id: string) => void;
  toggleFavoriteNote: (id: string) => void;
  moveNoteToFolder: (id: string, folderId: string) => void;
  archiveNote: (id: string) => void;
  restoreArchivedNote: (id: string) => void;
  deleteNote: (id: string) => void;
  bulkMoveNotes: (ids: string[], folderId: string) => void;
  bulkArchiveNotes: (ids: string[]) => void;
  bulkRestoreArchivedNotes: (ids: string[]) => void;
  bulkDeleteNotes: (ids: string[]) => void;
  restoreDeletedNote: (id: string) => void;
  permanentlyDeleteNote: (id: string) => void;
  emptyTrash: () => void;
  createFolder: (name: string) => Folder | null;
  renameFolder: (id: string, name: string) => void;
  deleteFolder: (id: string) => void;
  getFolderById: (id: string) => Folder | undefined;
  getNoteById: (id: string) => Note | undefined;
  getFolderNoteCount: (folderId: string) => number;
  resetLocalData: () => void;
  toast: ToastMessage | null;
  showToast: (text: string, variant?: 'default' | 'danger', undoAction?: () => void) => void;
  dismissToast: () => void;
}

const defaultPersistedState: PersistedState = {
  notes: INITIAL_NOTES,
  folders: DEFAULT_FOLDERS,
  theme: 'system',
  palette: 'default',
  noteFontSize: NOTE_FONT_SIZE_DEFAULT,
  isPremium: false,
  notePin: null,
  noteLockMethod: null,
  defaultFolderId: '',
  notifications: {
    dailyReminder: false,
    weeklyDigest: true,
    subtleSounds: true,
  },
  account: INITIAL_ACCOUNT,
  recentSearches: INITIAL_RECENT_SEARCHES,
  hasOnboarded: false,
  previewStartedAt: Date.now(),
  autoBackup: {
    enabled: true,
    months: 1,
    days: 1,
  },
  trashRetention: { ...DEFAULT_TRASH_RETENTION },
  seededDefaultStoryV1: true,
};

function loadInitialState(): PersistedState {
  const fallbackNow = Date.now();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        ...defaultPersistedState,
        previewStartedAt: fallbackNow,
        autoBackup: {
          enabled: true,
          months: 1,
          days: 1,
          nextBackupAt: computeNextAutoBackupIso(new Date(fallbackNow), 1, 1),
        },
      };
    }
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    const previewStartedAt =
      typeof parsed.previewStartedAt === 'number' &&
      Number.isFinite(parsed.previewStartedAt) &&
      parsed.previewStartedAt > 0
        ? parsed.previewStartedAt
        : fallbackNow;

    const rawLoadedFolders: Folder[] = Array.isArray(parsed.folders)
      ? [...parsed.folders]
      : [...defaultPersistedState.folders];
    const loadedFolders: Folder[] = ensureSystemFolders(rawLoadedFolders);
    const loadedNotes: Note[] = Array.isArray(parsed.notes)
      ? [...parsed.notes]
      : [...defaultPersistedState.notes];

    if (!parsed.seededDefaultStoryV1) {
      const existingMyNotesFolder = loadedFolders.find(
        (f) =>
          f.id === DEFAULT_MY_NOTES_FOLDER_ID ||
          f.name.trim().toLowerCase() === 'my notes'
      );
      const targetFolderId = existingMyNotesFolder
        ? existingMyNotesFolder.id
        : DEFAULT_MY_NOTES_FOLDER_ID;
      if (!existingMyNotesFolder) {
        loadedFolders.unshift(DEFAULT_FOLDERS[0]);
      }
      if (!loadedNotes.some((n) => n.id === FEATURED_STORY_NOTE_ID)) {
        loadedNotes.unshift(createFeaturedStoryNote(targetFolderId));
      }
    }

    const loadedTrashRetention = normalizeTrashRetention(parsed.trashRetention);
    const fallbackIso = new Date(fallbackNow).toISOString();
    const cleanedNotes: Note[] = loadedNotes
      .map((n) =>
        n.isDeleted && !n.deletedAt
          ? { ...n, deletedAt: n.updatedAt || fallbackIso }
          : n
      )
      .filter((n) => !(n.isDeleted && isTrashExpired(n.deletedAt, fallbackNow, loadedTrashRetention)));

    return {
      notes: cleanedNotes,
      folders: loadedFolders,
      theme: 'system',
      palette: parsed.palette || 'default',
      noteFontSize: normalizeNoteFontSize(parsed.noteFontSize),
      isPremium: Boolean(parsed.isPremium),
      notePin: typeof parsed.notePin === 'string' ? parsed.notePin : null,
      noteLockMethod:
        parsed.noteLockMethod === 'pin' || parsed.noteLockMethod === 'fingerprint'
          ? parsed.noteLockMethod
          : parsed.noteLockMethod === null
          ? null
          : typeof parsed.notePin === 'string' && parsed.notePin
          ? 'pin'
          : null,
      defaultFolderId: typeof parsed.defaultFolderId === 'string' ? parsed.defaultFolderId : '',
      notifications: {
        ...defaultPersistedState.notifications,
        ...(parsed.notifications || {}),
      },
      account: (() => {
        const saved = parsed.account;
        if (
          !saved ||
          (!saved.uid &&
            saved.name === 'Riyad Islam' &&
            saved.email === 'riyadislambdd@gmail.com')
        ) {
          return defaultPersistedState.account;
        }
        return {
          ...defaultPersistedState.account,
          ...saved,
          isGuest: saved.uid ? false : saved.isGuest !== false,
        };
      })(),
      recentSearches: Array.isArray(parsed.recentSearches)
        ? parsed.recentSearches
        : defaultPersistedState.recentSearches,
      hasOnboarded: Boolean(parsed.hasOnboarded),
      previewStartedAt,
      autoBackup: (() => {
        const rawAuto = parsed.autoBackup;
        const rawMonths = Math.max(0, Math.floor(Number(rawAuto?.months) || 0));
        const rawDays = Math.max(0, Math.floor(Number(rawAuto?.days) || 0));
        const isUntouchedLegacy =
          !rawAuto ||
          (!rawAuto.enabled &&
            rawMonths === 0 &&
            rawDays === 0 &&
            !rawAuto.lastBackupAt &&
            !rawAuto.nextBackupAt);
        if (isUntouchedLegacy) {
          return {
            enabled: true,
            months: 1,
            days: 1,
            nextBackupAt: computeNextAutoBackupIso(new Date(fallbackNow), 1, 1),
          };
        }
        return {
          enabled: Boolean(rawAuto?.enabled),
          months: rawMonths,
          days: rawDays,
          lastBackupAt:
            typeof rawAuto?.lastBackupAt === 'string'
              ? rawAuto.lastBackupAt
              : undefined,
          nextBackupAt:
            typeof rawAuto?.nextBackupAt === 'string'
              ? rawAuto.nextBackupAt
              : undefined,
        };
      })(),
      trashRetention: loadedTrashRetention,
      seededDefaultStoryV1: true,
    };
  } catch {
    return {
      ...defaultPersistedState,
      previewStartedAt: fallbackNow,
      autoBackup: {
        enabled: true,
        months: 1,
        days: 1,
        nextBackupAt: computeNextAutoBackupIso(new Date(fallbackNow), 1, 1),
      },
    };
  }
}

interface HistoryEntry {
  screen: ScreenName;
  noteId: string | null;
  folderId: string | null;
  cursorTarget?: EditorCursorTarget | null;
}

const NotesContext = createContext<NotesContextValue | undefined>(undefined);

export function NotesProvider({ children }: { children: React.ReactNode }) {
  const [initial] = useState<PersistedState>(() => loadInitialState());

  const [notes, setNotes] = useState<Note[]>(initial.notes);
  const [folders, setFolders] = useState<Folder[]>(initial.folders);
  const [theme, setThemeState] = useState<ThemePreference>(initial.theme);
  const [palette, setPaletteState] = useState<ThemePalette>(initial.palette);
  const [noteFontSize, setNoteFontSizeState] = useState<NoteFontSize>(initial.noteFontSize);
  const [isPremiumState, setIsPremiumState] = useState<boolean>(initial.isPremium);
  const [notePin, setNotePinState] = useState<string | null>(initial.notePin);
  const [noteLockMethod, setNoteLockMethodState] = useState<NoteLockMethod>(
    initial.noteLockMethod
  );
  const [biometricSupported, setBiometricSupported] = useState<boolean>(false);
  const [biometryLabel, setBiometryLabel] = useState<string>('Fingerprint');
  const [unlockedNoteIds, setUnlockedNoteIds] = useState<string[]>([]);
  const [upgradePromptReason, setUpgradePromptReason] = useState<string | null>(null);

  const [systemDark, setSystemDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [defaultFolderId, setDefaultFolderIdState] = useState<string>(initial.defaultFolderId);
  const [notifications, setNotifications] = useState<NotificationSettings>(initial.notifications);
  const [account, setAccount] = useState<UserAccount>(initial.account);
  const [recentSearches, setRecentSearches] = useState<string[]>(initial.recentSearches);
  const [hasOnboarded, setHasOnboarded] = useState<boolean>(initial.hasOnboarded);
  const [previewStartedAt] = useState<number>(initial.previewStartedAt);
  const [autoBackup, setAutoBackup] = useState<AutoBackupSchedule>(initial.autoBackup);
  const [trashRetention, setTrashRetention] = useState<TrashRetentionConfig>(
    initial.trashRetention
  );
  const [previewConfig, setPreviewConfig] = useState<PreviewModeConfig>(() =>
    loadCachedPreviewConfig()
  );
  const [previewSyncState, setPreviewSyncState] = useState<FirestoreSyncState>('loading');
  const [previewSyncError, setPreviewSyncError] = useState<string | null>(null);
  const [aboutConfig, setAboutConfig] = useState<AboutAppConfig>(() => loadCachedAboutConfig());
  const [aboutSyncState, setAboutSyncState] = useState<FirestoreSyncState>('loading');
  const [aboutSyncError, setAboutSyncError] = useState<string | null>(null);
  const [aboutSaving, setAboutSaving] = useState(false);
  const [textToolsConfig, setTextToolsConfig] = useState<TextToolsConfig>(() =>
    loadCachedTextToolsConfig()
  );
  const [textToolsSyncState, setTextToolsSyncState] = useState<FirestoreSyncState>('loading');
  const [textToolsSyncError, setTextToolsSyncError] = useState<string | null>(null);
  const [textToolsSaving, setTextToolsSaving] = useState(false);
  const [appControlsConfig, setAppControlsConfig] = useState<AppControlsConfig>(() =>
    loadCachedAppControlsConfig()
  );
  const [appControlsSyncState, setAppControlsSyncState] = useState<FirestoreSyncState>('loading');
  const [appControlsSyncError, setAppControlsSyncError] = useState<string | null>(null);
  const [appControlsSaving, setAppControlsSaving] = useState(false);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [adminSaving, setAdminSaving] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [driveBusy, setDriveBusy] = useState(false);
  const [billingBusy, setBillingBusy] = useState(false);
  const [hasDriveAccess, setHasDriveAccess] = useState(false);

  const [history, setHistory] = useState<HistoryEntry[]>([
    {
      screen: initial.hasOnboarded ? 'home' : 'splash',
      noteId: null,
      folderId: null,
    },
  ]);

  const [toast, setToast] = useState<ToastMessage | null>(null);

  const historyRef = useRef<HistoryEntry[]>(history);
  historyRef.current = history;
  const backHandlersRef = useRef<Array<{ id: number; fn: () => boolean }>>([]);
  const backHandlerSeqRef = useRef(0);
  const ignoreNextPopRef = useRef(false);
  const lastExitPressRef = useRef(0);

  const currentEntry = history[history.length - 1];
  const screen = currentEntry.screen;
  const activeNoteId = currentEntry.noteId;
  const activeFolderId = currentEntry.folderId;
  const activeCursorTarget = currentEntry.cursorTarget ?? null;

  useEffect(() => {
    try {
      const payload: PersistedState = {
        notes,
        folders,
        theme,
        palette,
        noteFontSize,
        isPremium: isPremiumState,
        notePin,
        noteLockMethod,
        defaultFolderId,
        notifications,
        account,
        recentSearches,
        hasOnboarded,
        previewStartedAt,
        autoBackup,
        trashRetention,
        seededDefaultStoryV1: true,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors
    }
  }, [
    notes,
    folders,
    theme,
    palette,
    noteFontSize,
    isPremiumState,
    notePin,
    noteLockMethod,
    defaultFolderId,
    notifications,
    account,
    recentSearches,
    hasOnboarded,
    previewStartedAt,
    autoBackup,
    trashRetention,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const syncSystemTheme = () => {
      setSystemDark(mq.matches);
    };
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncSystemTheme();
      }
    };

    syncSystemTheme();
    mq.addEventListener('change', onChange);
    window.addEventListener('focus', syncSystemTheme);
    document.addEventListener('visibilitychange', onVisibility);

    let appStateHandle: { remove: () => Promise<void> } | null = null;
    if (Capacitor.isNativePlatform()) {
      void CapApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          syncSystemTheme();
        }
      }).then((handle) => {
        appStateHandle = handle;
      });
    }

    return () => {
      mq.removeEventListener('change', onChange);
      window.removeEventListener('focus', syncSystemTheme);
      document.removeEventListener('visibilitychange', onVisibility);
      void appStateHandle?.remove().catch(() => {});
    };
  }, []);

  const resolvedTheme: 'light' | 'dark' = systemDark ? 'dark' : 'light';

  useEffect(() => {
    const root = document.documentElement;
    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [resolvedTheme]);

  const hasPaidSubscription = useMemo(() => {
    if (!account.lastTransactionId) return false;
    if (!account.premiumExpiresAt) return true;
    const expiry = new Date(account.premiumExpiresAt).getTime();
    return Number.isFinite(expiry) && expiry > nowMs;
  }, [account.lastTransactionId, account.premiumExpiresAt, nowMs]);

  const previewExpiresAtMs = useMemo(
    () => getPreviewExpiresAtMs(previewConfig, previewStartedAt),
    [previewConfig, previewStartedAt]
  );

  const isPreviewAvailable = useMemo(() => {
    if (!previewConfig.enabled || previewExpiresAtMs <= 0) return false;
    return nowMs < previewExpiresAtMs;
  }, [nowMs, previewConfig.enabled, previewExpiresAtMs]);

  const isInTryMode = isPreviewAvailable || (isPremiumState && !hasPaidSubscription);
  const canViewSubscriptionPage = !hasPaidSubscription && !isInTryMode;
  const isPremium = hasPaidSubscription || isInTryMode;

  const canUsePremiumPalettes =
    isPremium || !appControlsConfig.premiumControls.features.themePalettes;
  const canUseNoteLock =
    isPremium || !appControlsConfig.premiumControls.features.noteLock;
  const canUseDriveBackup =
    isPremium || !appControlsConfig.premiumControls.features.driveBackup;

  // Sync active palette to <html>; if user downgrades to Free and themes require Premium, revert visual palette to default cleanly
  useEffect(() => {
    const root = document.documentElement;
    const activePalette = canUsePremiumPalettes ? palette : 'default';
    if (activePalette === 'default') {
      root.removeAttribute('data-palette');
    } else {
      root.setAttribute('data-palette', activePalette);
    }
  }, [canUsePremiumPalettes, palette]);

  useEffect(() => {
    const normalized = normalizeNoteFontSize(noteFontSize);
    document.documentElement.style.setProperty('--note-font-size', `${normalized}px`);
  }, [noteFontSize]);

  useEffect(() => {
    const unsubscribe = initFirebaseAuth((user, hasToken) => {
      setHasDriveAccess(hasToken);
      if (user) {
        setAuthError(null);
        setAccount((prev) => ({
          ...prev,
          uid: user.uid,
          name: user.displayName || user.email?.split('@')[0] || 'Google User',
          email: user.email || '',
          photoUrl: user.photoURL || '',
          emailVerified: Boolean(user.emailVerified),
          isGuest: false,
        }));
      } else {
        setAccount((prev) => (prev.uid ? INITIAL_ACCOUNT : { ...prev, isGuest: true }));
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeAboutAppConfig((config, syncState, errMsg) => {
      setAboutConfig(config);
      setAboutSyncState(syncState);
      setAboutSyncError(errMsg || null);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeTextToolsConfig((config, syncState, errMsg) => {
      setTextToolsConfig(config || DEFAULT_TEXT_TOOLS_CONFIG);
      setTextToolsSyncState(syncState);
      setTextToolsSyncError(errMsg || null);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeAppControlsConfig((config, syncState, errMsg) => {
      setAppControlsConfig(config || DEFAULT_APP_CONTROLS_CONFIG);
      setAppControlsSyncState(syncState);
      setAppControlsSyncError(errMsg || null);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    void syncLocalNotifications(initial.notifications, false);
  }, [initial.notifications]);

  useEffect(() => {
    let active = true;
    let cleanupListener: (() => void) | null = null;

    void checkBiometricAvailability().then((status) => {
      if (!active) return;
      setBiometricSupported(status.available);
      setBiometryLabel(status.label);
    });

    void subscribeBiometryChange((status) => {
      if (!active) return;
      setBiometricSupported(status.available);
      setBiometryLabel(status.label);
    }).then((unsub) => {
      if (!active) {
        unsub?.();
      } else {
        cleanupListener = unsub;
      }
    });

    return () => {
      active = false;
      cleanupListener?.();
    };
  }, []);

  useEffect(() => {
    const unsubscribe = subscribePreviewModeConfig((config, syncState, errMsg) => {
      setPreviewConfig(config || DEFAULT_PREVIEW_CONFIG);
      setPreviewSyncState(syncState);
      setPreviewSyncError(errMsg || null);
      setNowMs(Date.now());
    });
    return () => unsubscribe();
  }, []);

  const isAdmin = useMemo(() => isAdminAccount(account), [account]);

  useEffect(() => {
    if (!previewConfig.enabled || previewExpiresAtMs <= 0) return;
    const now = Date.now();
    const remaining = previewExpiresAtMs - now;
    if (remaining <= 0) {
      setNowMs((prev) => (prev < previewExpiresAtMs ? now : prev));
      return;
    }
    const timer = window.setTimeout(() => {
      setNowMs(Date.now());
    }, Math.min(remaining + 25, 2147483647));

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        setNowMs(Date.now());
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [previewConfig.enabled, previewExpiresAtMs]);

  useEffect(() => {
    if (isPremiumState && !isPreviewAvailable && !hasPaidSubscription) {
      setIsPremiumState(false);
    }
  }, [hasPaidSubscription, isPremiumState, isPreviewAvailable]);

  useEffect(() => {
    if (!canViewSubscriptionPage) {
      setUpgradePromptReason((prev) => (prev === null ? prev : null));
      if (screen === 'premium') {
        setHistory((prev) => {
          const filtered = prev.filter((item) => item.screen !== 'premium');
          return filtered.length > 0
            ? filtered
            : [{ screen: 'home', noteId: null, folderId: null }];
        });
      }
    }
  }, [canViewSubscriptionPage, screen]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const refreshNow = () => {
      if (document.visibilityState === 'visible') {
        setNowMs(Date.now());
      }
    };
    document.addEventListener('visibilitychange', refreshNow);
    const hourlyTimer = window.setInterval(() => setNowMs(Date.now()), 60 * 60 * 1000);
    return () => {
      document.removeEventListener('visibilitychange', refreshNow);
      window.clearInterval(hourlyTimer);
    };
  }, []);

  useEffect(() => {
    setNotes((prev) => {
      const hasExpired = prev.some(
        (n) => n.isDeleted && isTrashExpired(n.deletedAt, nowMs, trashRetention)
      );
      if (!hasExpired) return prev;
      return prev.filter(
        (n) => !(n.isDeleted && isTrashExpired(n.deletedAt, nowMs, trashRetention))
      );
    });
  }, [nowMs, trashRetention]);

  useEffect(() => {
    if (!toast) return;
    const duration = toast.undoAction ? 4000 : 2600;
    const timer = window.setTimeout(() => setToast(null), duration);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const showToast = useCallback(
    (text: string, variant: 'default' | 'danger' = 'default', undoAction?: () => void) => {
      setToast({ id: generateId('toast'), text, variant, undoAction });
    },
    []
  );

  const dismissToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const status = params.get('billing_status');
    const tranId = params.get('tran_id');
    if (!status) return;

    const cleanUrl = () => {
      try {
        window.history.replaceState({}, '', window.location.pathname);
      } catch {
        // Ignore history errors
      }
    };

    if ((status === 'success' || status === 'verify_binance') && tranId) {
      setBillingBusy(true);
      void verifyPurchaseTransaction(tranId)
        .then((res) => {
          if (res.verified && res.purchase) {
            setIsPremiumState(true);
            setAccount((prev) => ({
              ...prev,
              lastTransactionId: res.purchase?.tranId,
              premiumExpiresAt: res.purchase?.expiresAt,
            }));
            showToast('Notes Premium activated!');
          } else {
            showToast(res.error || 'Payment could not be verified yet', 'danger');
          }
        })
        .catch(() => {
          showToast('Could not verify payment right now', 'danger');
        })
        .finally(() => {
          setBillingBusy(false);
          cleanUrl();
        });
      return;
    }

    if (status === 'cancelled') {
      showToast('Payment cancelled');
    } else if (status === 'failed') {
      showToast('Payment failed', 'danger');
    }
    cleanUrl();
  }, [showToast]);

  const signInGoogleAccount = useCallback(async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const { user, accessToken } = await signInWithGoogle();
      setHasDriveAccess(Boolean(accessToken));
      setAccount((prev) => ({
        ...prev,
        uid: user.uid,
        name: user.displayName || user.email?.split('@')[0] || 'Google User',
        email: user.email || '',
        photoUrl: user.photoURL || '',
        emailVerified: Boolean(user.emailVerified),
        isGuest: false,
      }));
      showToast(`Signed in as ${user.displayName || user.email || 'Google User'}`);
    } catch (err) {
      const errObj = err as { code?: string; message?: string };
      const rawMsg = (errObj?.message || '').toLowerCase();
      const isCancelled =
        errObj?.code === 'USER_CANCELLED' ||
        rawMsg.includes('popup-closed') ||
        rawMsg.includes('cancel');
      const detail = errObj?.message || errObj?.code || '';
      if (isCancelled) {
        setAuthError(null);
        showToast('Sign-in cancelled', 'danger');
      } else {
        const message = detail || 'Could not sign in with Google';
        setAuthError(message);
        const shortDetail = message.length > 72 ? `${message.slice(0, 72)}...` : message;
        showToast(`Sign-in failed: ${shortDetail}`, 'danger');
      }
    } finally {
      setAuthLoading(false);
    }
  }, [showToast]);

  const signOutGoogleAccount = useCallback(async () => {
    try {
      setAuthError(null);
      await signOutGoogle();
      setHasDriveAccess(false);
      setAccount(INITIAL_ACCOUNT);
      showToast('Signed out · Switched to Guest Account');
    } catch {
      showToast('Could not sign out', 'danger');
    }
  }, [showToast]);

  const requestUpgrade = useCallback(
    (reason: string) => {
      if (!canViewSubscriptionPage) return;
      setUpgradePromptReason(reason);
    },
    [canViewSubscriptionPage]
  );

  const dismissUpgradePrompt = useCallback(() => {
    setUpgradePromptReason(null);
  }, []);

  const backupToGoogleDrive = useCallback(async (): Promise<boolean> => {
    if (!canUseDriveBackup) {
      requestUpgrade('Google Drive cloud backup & restore is a Notes Premium feature.');
      return false;
    }
    setDriveBusy(true);
    try {
      const result = await uploadDriveBackup({
        version: 1,
        exportedAt: new Date().toISOString(),
        accountEmail: account.email || undefined,
        notes,
        folders,
      });
      setHasDriveAccess(true);
      setAccount((prev) => ({ ...prev, lastDriveBackupAt: result.modifiedTime }));
      showToast('Backed up to Google Drive');
      return true;
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Google Drive backup failed',
        'danger'
      );
      return false;
    } finally {
      setDriveBusy(false);
    }
  }, [account.email, canUseDriveBackup, folders, notes, requestUpgrade, showToast]);

  const restoreFromGoogleDrive = useCallback(async (): Promise<boolean> => {
    if (!canUseDriveBackup) {
      requestUpgrade('Google Drive cloud backup & restore is a Notes Premium feature.');
      return false;
    }
    setDriveBusy(true);
    try {
      const payload = await restoreDriveBackup();
      setHasDriveAccess(true);
      setNotes(payload.notes);
      setFolders(ensureSystemFolders(payload.folders));
      setAccount((prev) => ({ ...prev, lastDriveBackupAt: payload.exportedAt }));
      showToast(`Restored ${payload.notes.length} notes from Google Drive`);
      return true;
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Google Drive restore failed',
        'danger'
      );
      return false;
    } finally {
      setDriveBusy(false);
    }
  }, [canUseDriveBackup, requestUpgrade, showToast]);

  const notesRef = useRef<Note[]>(notes);
  notesRef.current = notes;
  const foldersRef = useRef<Folder[]>(folders);
  foldersRef.current = folders;
  const autoBackupRunningRef = useRef(false);

  const updateAutoBackupSchedule = useCallback(
    (rawMonths: number, rawDays: number) => {
      const months = Math.max(0, Math.floor(Number.isFinite(rawMonths) ? rawMonths : 0));
      const days = Math.max(0, Math.floor(Number.isFinite(rawDays) ? rawDays : 0));
      if (months === 0 && days === 0) {
        showToast('Enter at least 1 month or 1 day', 'danger');
        return;
      }
      const nextBackupAt = computeNextAutoBackupIso(new Date(), months, days);
      setAutoBackup((prev) => ({
        ...prev,
        enabled: true,
        months,
        days,
        nextBackupAt,
      }));
      const parts: string[] = [];
      if (months > 0) parts.push(`${months} ${months === 1 ? 'month' : 'months'}`);
      if (days > 0) parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);
      showToast(`Auto PDF backup set for every ${parts.join(' ')}`);
    },
    [showToast]
  );

  const disableAutoBackupSchedule = useCallback(() => {
    setAutoBackup((prev) => ({
      ...prev,
      enabled: false,
      months: prev.months > 0 || prev.days > 0 ? prev.months : 1,
      days: prev.months > 0 || prev.days > 0 ? prev.days : 1,
      nextBackupAt: undefined,
    }));
    showToast('Auto backup turned off');
  }, [showToast]);

  const updateTrashRetention = useCallback(
    (rawMonths: number, rawDays: number) => {
      const months = Math.max(0, Math.min(120, Math.floor(Number.isFinite(rawMonths) ? rawMonths : 0)));
      const days = Math.max(0, Math.min(365, Math.floor(Number.isFinite(rawDays) ? rawDays : 0)));
      if (months === 0 && days === 0) {
        showToast('Enter at least 1 month or 1 day', 'danger');
        return;
      }
      const nextRetention: TrashRetentionConfig = { enabled: true, months, days };
      setTrashRetention(nextRetention);
      showToast(`Trash auto-delete set to ${formatTrashRetentionDuration(nextRetention)}`);
    },
    [showToast]
  );

  const disableTrashRetention = useCallback(() => {
    setTrashRetention((prev) => ({
      ...prev,
      enabled: false,
    }));
    showToast('Trash auto-delete turned off');
  }, [showToast]);

  useEffect(() => {
    if (!autoBackup.enabled || (autoBackup.months <= 0 && autoBackup.days <= 0)) {
      return;
    }

    const nextIso =
      autoBackup.nextBackupAt ||
      computeNextAutoBackupIso(new Date(), autoBackup.months, autoBackup.days);
    const targetMs = new Date(nextIso).getTime();

    if (!Number.isFinite(targetMs)) {
      setAutoBackup((prev) => ({
        ...prev,
        nextBackupAt: computeNextAutoBackupIso(new Date(), prev.months, prev.days),
      }));
      return;
    }

    const triggerIfDue = () => {
      if (Date.now() < targetMs || autoBackupRunningRef.current) return;
      autoBackupRunningRef.current = true;
      const exportable = notesRef.current.filter((n) => !n.isDeleted);
      const nextSchedule = computeNextAutoBackupIso(
        new Date(),
        autoBackup.months,
        autoBackup.days
      );

      if (exportable.length === 0) {
        setAutoBackup((prev) => ({
          ...prev,
          nextBackupAt: nextSchedule,
        }));
        autoBackupRunningRef.current = false;
        return;
      }

      void exportNotesAsPdfZip(notesRef.current, foldersRef.current, {
        preferSilentDocuments: true,
      })
        .then((res) => {
          const completedAt = new Date().toISOString();
          setAutoBackup((prev) => ({
            ...prev,
            lastBackupAt: completedAt,
            nextBackupAt: computeNextAutoBackupIso(
              new Date(),
              prev.months,
              prev.days
            ),
          }));
          showToast(
            res.mode === 'saved'
              ? `Auto PDF backup saved (${res.count} notes)`
              : `Auto PDF backup ready (${res.count} notes)`
          );
        })
        .catch(() => {
          // Retry on next app open if interrupted
        })
        .finally(() => {
          autoBackupRunningRef.current = false;
        });
    };

    const remaining = targetMs - Date.now();
    if (remaining <= 0) {
      triggerIfDue();
      return;
    }

    const timer = window.setTimeout(
      triggerIfDue,
      Math.min(remaining + 100, 2147483647)
    );
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        triggerIfDue();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [
    autoBackup.days,
    autoBackup.enabled,
    autoBackup.months,
    autoBackup.nextBackupAt,
    showToast,
  ]);

  const restorePurchase = useCallback(
    async (transactionId?: string): Promise<{ restored: boolean; message: string }> => {
      setBillingBusy(true);
      try {
        const result = await restorePurchaseOnServer({
          email: account.email || undefined,
          transactionId: transactionId?.trim() || account.lastTransactionId || undefined,
        });
        if (result.restored && result.purchase) {
          setIsPremiumState(true);
          setAccount((prev) => ({
            ...prev,
            lastTransactionId: result.purchase?.tranId,
            premiumExpiresAt: result.purchase?.expiresAt,
          }));
          const msg = 'Premium subscription restored';
          showToast(msg);
          return { restored: true, message: msg };
        }
        const msg = result.message || 'No active verified purchase found.';
        showToast(msg);
        return { restored: false, message: msg };
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Unable to reach billing verification server';
        showToast(msg, 'danger');
        return { restored: false, message: msg };
      } finally {
        setBillingBusy(false);
      }
    },
    [account.email, account.lastTransactionId, showToast]
  );

  const activeNotes = useMemo(
    () =>
      notes
        .filter((n) => !n.isArchived && !n.isDeleted)
        .sort((a, b) => {
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        }),
    [notes]
  );

  const canCreateNote =
    isPremium || activeNotes.length < appControlsConfig.freeLimits.maxActiveNotes;
  const userCreatedFolderCount = folders.filter((f) => !f.isSystem).length;
  const canCreateFolder =
    isPremium || userCreatedFolderCount < appControlsConfig.freeLimits.maxFolders;
  const maxImagesAllowed = isPremium
    ? Number.POSITIVE_INFINITY
    : appControlsConfig.freeLimits.maxImagesPerNote;

  const registerBackHandler = useCallback((fn: () => boolean) => {
    const id = ++backHandlerSeqRef.current;
    backHandlersRef.current.push({ id, fn });
    return () => {
      backHandlersRef.current = backHandlersRef.current.filter((item) => item.id !== id);
    };
  }, []);

  const navigate = useCallback(
    (next: ScreenName, options?: NavigateOptions) => {
      if (next === 'premium' && !canViewSubscriptionPage) {
        return;
      }
      const prev = historyRef.current;
      const current = prev[prev.length - 1];
      const nextEntry: HistoryEntry = {
        screen: next,
        noteId: options?.noteId !== undefined ? options.noteId : current.noteId,
        folderId: options?.folderId !== undefined ? options.folderId : current.folderId,
        cursorTarget: options?.cursorTarget ?? null,
      };

      const topTabs: ScreenName[] = ['home', 'favorites', 'settings'];
      if (topTabs.includes(next) && !options?.replace) {
        if (typeof window !== 'undefined') {
          window.history.replaceState({ notesDepth: 0 }, '');
        }
        setHistory([{ screen: next, noteId: null, folderId: null }]);
      } else if (options?.replace) {
        setHistory((curr) => [...curr.slice(0, -1), nextEntry]);
      } else if (
        current.screen !== nextEntry.screen ||
        current.noteId !== nextEntry.noteId ||
        current.folderId !== nextEntry.folderId
      ) {
        if (typeof window !== 'undefined') {
          window.history.pushState({ notesDepth: prev.length }, '');
        }
        setHistory((curr) => [...curr, nextEntry]);
      }
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    },
    [canViewSubscriptionPage]
  );

  const goBack = useCallback(() => {
    const prevLen = historyRef.current.length;
    if (prevLen > 1 && typeof window !== 'undefined' && (window.history.state?.notesDepth ?? 0) > 0) {
      ignoreNextPopRef.current = true;
      window.history.back();
    }
    setHistory((prev) => {
      if (prev.length <= 1) {
        return [{ screen: 'home', noteId: null, folderId: null }];
      }
      return prev.slice(0, -1);
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.history.state || typeof window.history.state.notesDepth !== 'number') {
      window.history.replaceState({ notesDepth: 0 }, '');
    }

    const handlePopState = () => {
      if (ignoreNextPopRef.current) {
        ignoreNextPopRef.current = false;
        return;
      }

      const handlers = backHandlersRef.current;
      for (let i = handlers.length - 1; i >= 0; i--) {
        if (handlers[i].fn()) {
          window.history.pushState({ notesDepth: historyRef.current.length - 1 }, '');
          return;
        }
      }

      const currentHist = historyRef.current;
      if (currentHist.length > 1) {
        setHistory((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
        return;
      }

      const activeScreen = currentHist[0]?.screen;
      if (activeScreen && activeScreen !== 'home' && activeScreen !== 'splash') {
        setHistory([{ screen: 'home', noteId: null, folderId: null }]);
        window.history.pushState({ notesDepth: 0 }, '');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    let isNative = false;
    try {
      isNative = Capacitor.isNativePlatform();
    } catch {
      isNative = false;
    }
    if (!isNative) return;

    const listenerPromise = CapApp.addListener('backButton', () => {
      const handlers = backHandlersRef.current;
      for (let i = handlers.length - 1; i >= 0; i--) {
        if (handlers[i].fn()) {
          return;
        }
      }

      const currentHist = historyRef.current;
      if (currentHist.length > 1) {
        goBack();
        return;
      }

      const activeScreen = currentHist[0]?.screen;
      if (activeScreen && activeScreen !== 'home' && activeScreen !== 'splash') {
        setHistory([{ screen: 'home', noteId: null, folderId: null }]);
        return;
      }

      const now = Date.now();
      if (now - lastExitPressRef.current < 2000) {
        CapApp.exitApp();
      } else {
        lastExitPressRef.current = now;
        showToast('Press back again to exit');
      }
    });

    return () => {
      listenerPromise.then((handle) => handle.remove()).catch(() => {});
    };
  }, [goBack, showToast]);

  const setActiveFolderId = useCallback((id: string | null) => {
    setHistory((prev) => {
      const last = prev[prev.length - 1];
      return [...prev.slice(0, -1), { ...last, folderId: id }];
    });
  }, []);

  const completeOnboarding = useCallback(() => {
    setHasOnboarded(true);
    setHistory([{ screen: 'home', noteId: null, folderId: null }]);
  }, []);

  const setTheme = useCallback((_nextTheme: ThemePreference) => {
    setThemeState('system');
  }, []);

  const setNoteFontSize = useCallback((size: NoteFontSize) => {
    setNoteFontSizeState(normalizeNoteFontSize(size));
  }, []);

  const setPalette = useCallback(
    (nextPalette: ThemePalette) => {
      if (nextPalette !== 'default' && !canUsePremiumPalettes) {
        requestUpgrade('Premium themes require a Notes Premium subscription.');
        return;
      }
      setPaletteState(nextPalette);
    },
    [canUsePremiumPalettes, requestUpgrade]
  );

  const setIsPremium = useCallback(
    (value: boolean) => {
      if (value && !isPreviewAvailable && !hasPaidSubscription) {
        return;
      }
      setIsPremiumState(value);
      showToast(value ? 'Previewing Premium plan' : 'Previewing Free plan');
    },
    [hasPaidSubscription, isPreviewAvailable, showToast]
  );

  const updateAdminPreviewConfig = useCallback(
    async (
      next: Pick<
        PreviewModeConfig,
        'enabled' | 'days' | 'hours' | 'minutes' | 'seconds' | 'expiresAt'
      >
    ): Promise<boolean> => {
      if (!isAdmin) {
        showToast('Admin access required', 'danger');
        return false;
      }
      setAdminSaving(true);
      try {
        const saved = await savePreviewModeConfig(next);
        setPreviewConfig(saved);
        setPreviewSyncState('synced');
        setPreviewSyncError(null);
        setNowMs(Date.now());
        showToast('Preview timer saved');
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Could not save admin settings';
        setPreviewSyncState('error');
        setPreviewSyncError(msg);
        showToast(msg, 'danger');
        return false;
      } finally {
        setAdminSaving(false);
      }
    },
    [isAdmin, showToast]
  );

  const updateAdminAboutConfig = useCallback(
    async (
      next: Pick<AboutAppConfig, 'ceo' | 'team' | 'socials'>
    ): Promise<boolean> => {
      if (!isAdmin) {
        showToast('Admin access required', 'danger');
        return false;
      }
      setAboutSaving(true);
      try {
        const saved = await saveAboutAppConfig(next);
        setAboutConfig(saved);
        setAboutSyncState('synced');
        setAboutSyncError(null);
        showToast('About App updated');
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Could not save About App settings';
        setAboutSyncError(msg);
        showToast(msg, 'danger');
        return false;
      } finally {
        setAboutSaving(false);
      }
    },
    [isAdmin, showToast]
  );

  const updateAdminTextToolsConfig = useCallback(
    async (nextTools: Record<TextToolId, TextToolRule>): Promise<boolean> => {
      if (!isAdmin) {
        showToast('Admin access required', 'danger');
        return false;
      }
      setTextToolsSaving(true);
      try {
        const saved = await saveTextToolsConfig(nextTools);
        setTextToolsConfig(saved);
        setTextToolsSyncState('synced');
        setTextToolsSyncError(null);
        showToast('Text Tools updated');
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Could not save Text Tools settings';
        setTextToolsSyncError(msg);
        showToast(msg, 'danger');
        return false;
      } finally {
        setTextToolsSaving(false);
      }
    },
    [isAdmin, showToast]
  );

  const updateAdminAppControlsConfig = useCallback(
    async (
      next: Pick<AppControlsConfig, 'freeLimits' | 'announcement' | 'premiumControls'>
    ): Promise<boolean> => {
      if (!isAdmin) {
        showToast('Admin access required', 'danger');
        return false;
      }
      setAppControlsSaving(true);
      try {
        const saved = await saveAppControlsConfig(next);
        setAppControlsConfig(saved);
        setAppControlsSyncState('synced');
        setAppControlsSyncError(null);
        showToast('App controls updated');
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Could not save App Controls settings';
        setAppControlsSyncError(msg);
        showToast(msg, 'danger');
        return false;
      } finally {
        setAppControlsSaving(false);
      }
    },
    [isAdmin, showToast]
  );

  const setNotePin = useCallback(
    (pin: string | null) => {
      setNotePinState(pin);
      if (pin) {
        setNoteLockMethodState('pin');
        showToast('4-Digit PIN lock saved');
      } else {
        setNoteLockMethodState(null);
        setNotes((prev) => prev.map((n) => ({ ...n, isLocked: false })));
        setUnlockedNoteIds([]);
        showToast('Note lock turned off');
      }
    },
    [showToast]
  );

  const enableFingerprintLock = useCallback(() => {
    setNotePinState(null);
    setNoteLockMethodState('fingerprint');
    showToast(`${biometryLabel} lock enabled`);
  }, [biometryLabel, showToast]);

  const disableNoteLock = useCallback(() => {
    setNoteLockMethodState(null);
    setNotePinState(null);
    setNotes((prev) => prev.map((n) => ({ ...n, isLocked: false })));
    setUnlockedNoteIds([]);
    showToast('Note lock turned off');
  }, [showToast]);

  const unlockNoteSession = useCallback((noteId: string) => {
    setUnlockedNoteIds((prev) => (prev.includes(noteId) ? prev : [...prev, noteId]));
  }, []);

  const lockNoteSession = useCallback((noteId: string) => {
    setUnlockedNoteIds((prev) => prev.filter((id) => id !== noteId));
  }, []);

  const toggleLockNote = useCallback(
    (noteId: string) => {
      if (!canUseNoteLock) {
        requestUpgrade('Secure Note Lock is a Notes Premium feature.');
        return;
      }
      setNotes((prev) =>
        prev.map((n) => {
          if (n.id !== noteId) return n;
          const nextLocked = !n.isLocked;
          if (!nextLocked) {
            setUnlockedNoteIds((u) => u.filter((id) => id !== noteId));
          } else {
            setUnlockedNoteIds((u) => (u.includes(noteId) ? u : [...u, noteId]));
          }
          showToast(
            nextLocked
              ? noteLockMethod === 'fingerprint'
                ? `Note locked with ${biometryLabel}`
                : 'Note locked with PIN'
              : 'Note lock removed'
          );
          return { ...n, isLocked: nextLocked };
        })
      );
    },
    [biometryLabel, canUseNoteLock, noteLockMethod, requestUpgrade, showToast]
  );

  const setDefaultFolderId = useCallback(
    (folderId: string) => {
      setDefaultFolderIdState(folderId);
      showToast('Default folder updated');
    },
    [showToast]
  );

  const updateNotifications = useCallback(
    (patch: Partial<NotificationSettings>) => {
      const next = { ...notifications, ...patch };
      setNotifications(next);

      const turningOnSchedule = patch.dailyReminder === true || patch.weeklyDigest === true;
      void syncLocalNotifications(next, turningOnSchedule).then(({ permissionGranted }) => {
        if (turningOnSchedule && !permissionGranted) {
          setNotifications((prev) => ({
            ...prev,
            ...(patch.dailyReminder === true ? { dailyReminder: false } : {}),
            ...(patch.weeklyDigest === true ? { weeklyDigest: false } : {}),
          }));
          showToast('Notification permission is required', 'danger');
          return;
        }

        if (patch.dailyReminder === true) {
          showToast('Daily reminder scheduled for 8:00 PM');
        } else if (patch.dailyReminder === false) {
          showToast('Daily reminder turned off');
        } else if (patch.weeklyDigest === true) {
          showToast('Weekly recap reminder enabled');
        } else if (patch.weeklyDigest === false) {
          showToast('Weekly recap reminder turned off');
        } else if (patch.subtleSounds === true) {
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try {
              navigator.vibrate(12);
            } catch {
              // Ignore vibration errors
            }
          }
          showToast('Subtle haptic feedback enabled');
        }
      });
    },
    [notifications, showToast]
  );

  const updateAccount = useCallback(
    (patch: Partial<UserAccount>) => {
      setAccount((prev) => ({ ...prev, ...patch }));
      showToast('Profile updated');
    },
    [showToast]
  );

  const addRecentSearch = useCallback((query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setRecentSearches((prev) => {
      const filtered = prev.filter((q) => q.toLowerCase() !== trimmed.toLowerCase());
      return [trimmed, ...filtered].slice(0, 6);
    });
  }, []);

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
  }, []);

  const createNote = useCallback(
    (partial?: Partial<Note>): Note | null => {
      const maxNotesLimit = appControlsConfig.freeLimits.maxActiveNotes;
      if (!isPremium && activeNotes.length >= maxNotesLimit) {
        requestUpgrade(
          `You have reached the Free plan limit of ${maxNotesLimit} active notes. Upgrade to Notes Premium for unlimited notes.`
        );
        return null;
      }

      const nowIso = new Date().toISOString();
      const fallbackFolderId =
        folders.find((f) => !f.isSystem && f.id !== CV_GENERATION_FOLDER_ID)?.id ||
        folders[0]?.id ||
        '';
      const targetFolder =
        partial?.folderId && folders.some((f) => f.id === partial.folderId)
          ? partial.folderId
          : folders.some(
              (f) => f.id === defaultFolderId && !f.isSystem && f.id !== CV_GENERATION_FOLDER_ID
            )
          ? defaultFolderId
          : fallbackFolderId;

      const newNote: Note = {
        id: generateId('note'),
        title: partial?.title ?? '',
        content: partial?.content ?? '',
        images: partial?.images ?? [],
        folderId: targetFolder,
        isPinned: partial?.isPinned ?? false,
        isFavorite: partial?.isFavorite ?? false,
        isLocked: false,
        isArchived: false,
        isDeleted: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      setNotes((prev) => [newNote, ...prev]);
      return newNote;
    },
    [
      activeNotes.length,
      appControlsConfig.freeLimits.maxActiveNotes,
      defaultFolderId,
      folders,
      isPremium,
      requestUpgrade,
    ]
  );

  const updateNote = useCallback((id: string, patch: Partial<Note>) => {
    setNotes((prev) =>
      prev.map((note) =>
        note.id === id
          ? {
              ...note,
              ...patch,
              updatedAt: patch.updatedAt ?? new Date().toISOString(),
            }
          : note
      )
    );
  }, []);

  const togglePinNote = useCallback(
    (id: string) => {
      setNotes((prev) =>
        prev.map((n) => {
          if (n.id !== id) return n;
          const nextPinned = !n.isPinned;
          showToast(nextPinned ? 'Note pinned' : 'Note unpinned');
          return { ...n, isPinned: nextPinned };
        })
      );
    },
    [showToast]
  );

  const toggleFavoriteNote = useCallback(
    (id: string) => {
      setNotes((prev) =>
        prev.map((n) => {
          if (n.id !== id) return n;
          const nextFav = !n.isFavorite;
          showToast(nextFav ? 'Added to Favorites' : 'Removed from Favorites');
          return { ...n, isFavorite: nextFav };
        })
      );
    },
    [showToast]
  );

  const moveNoteToFolder = useCallback(
    (id: string, folderId: string) => {
      const target = folders.find((f) => f.id === folderId);
      setNotes((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, folderId, updatedAt: new Date().toISOString() } : n
        )
      );
      if (target) showToast(`Moved to ${target.name}`);
    },
    [folders, showToast]
  );

  const archiveNote = useCallback(
    (id: string) => {
      const existing = notes.find((n) => n.id === id);
      const wasPinned = Boolean(existing?.isPinned);
      setNotes((prev) =>
        prev.map((n) =>
          n.id === id
            ? {
                ...n,
                isArchived: true,
                isPinned: false,
                updatedAt: new Date().toISOString(),
              }
            : n
        )
      );
      showToast('Note archived', 'default', () => {
        setNotes((prev) =>
          prev.map((n) =>
            n.id === id
              ? { ...n, isArchived: false, isPinned: wasPinned }
              : n
          )
        );
      });
    },
    [notes, showToast]
  );

  const restoreArchivedNote = useCallback(
    (id: string) => {
      setNotes((prev) =>
        prev.map((n) =>
          n.id === id
            ? { ...n, isArchived: false, updatedAt: new Date().toISOString() }
            : n
        )
      );
      showToast('Note restored');
    },
    [showToast]
  );

  const deleteNote = useCallback(
    (id: string) => {
      const existing = notes.find((n) => n.id === id);
      const wasPinned = Boolean(existing?.isPinned);
      const wasArchived = Boolean(existing?.isArchived);
      setNotes((prev) =>
        prev.map((n) =>
          n.id === id
            ? {
                ...n,
                isDeleted: true,
                isPinned: false,
                isArchived: false,
                deletedAt: new Date().toISOString(),
              }
            : n
        )
      );
      showToast('Note moved to Trash', 'default', () => {
        setNotes((prev) =>
          prev.map((n) =>
            n.id === id
              ? {
                  ...n,
                  isDeleted: false,
                  isPinned: wasPinned,
                  isArchived: wasArchived,
                  deletedAt: undefined,
                }
              : n
          )
        );
      });
    },
    [notes, showToast]
  );

  const bulkMoveNotes = useCallback(
    (ids: string[], folderId: string) => {
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      const target = folders.find((f) => f.id === folderId);
      const nowIso = new Date().toISOString();
      setNotes((prev) =>
        prev.map((n) => (idSet.has(n.id) ? { ...n, folderId, updatedAt: nowIso } : n))
      );
      if (target) {
        showToast(
          ids.length === 1
            ? `Moved 1 note to ${target.name}`
            : `Moved ${ids.length} notes to ${target.name}`
        );
      }
    },
    [folders, showToast]
  );

  const bulkArchiveNotes = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      const snapshot = new Map(
        notes
          .filter((n) => idSet.has(n.id))
          .map((n) => [
            n.id,
            { isArchived: n.isArchived, isPinned: n.isPinned, updatedAt: n.updatedAt },
          ])
      );
      if (snapshot.size === 0) return;
      const nowIso = new Date().toISOString();
      setNotes((prev) =>
        prev.map((n) =>
          snapshot.has(n.id)
            ? { ...n, isArchived: true, isPinned: false, updatedAt: nowIso }
            : n
        )
      );
      const count = snapshot.size;
      showToast(
        count === 1 ? '1 note archived' : `${count} notes archived`,
        'default',
        () => {
          setNotes((prev) =>
            prev.map((n) => {
              const prevState = snapshot.get(n.id);
              return prevState ? { ...n, ...prevState } : n;
            })
          );
        }
      );
    },
    [notes, showToast]
  );

  const bulkRestoreArchivedNotes = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      const nowIso = new Date().toISOString();
      setNotes((prev) =>
        prev.map((n) =>
          idSet.has(n.id) ? { ...n, isArchived: false, updatedAt: nowIso } : n
        )
      );
      showToast(ids.length === 1 ? '1 note restored' : `${ids.length} notes restored`);
    },
    [showToast]
  );

  const bulkDeleteNotes = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      const snapshot = new Map(
        notes
          .filter((n) => idSet.has(n.id))
          .map((n) => [
            n.id,
            {
              isDeleted: n.isDeleted,
              isPinned: n.isPinned,
              isArchived: n.isArchived,
              deletedAt: n.deletedAt,
            },
          ])
      );
      if (snapshot.size === 0) return;
      const nowIso = new Date().toISOString();
      setNotes((prev) =>
        prev.map((n) =>
          snapshot.has(n.id)
            ? {
                ...n,
                isDeleted: true,
                isPinned: false,
                isArchived: false,
                deletedAt: nowIso,
              }
            : n
        )
      );
      const count = snapshot.size;
      showToast(
        count === 1 ? '1 note moved to Trash' : `${count} notes moved to Trash`,
        'default',
        () => {
          setNotes((prev) =>
            prev.map((n) => {
              const prevState = snapshot.get(n.id);
              return prevState ? { ...n, ...prevState } : n;
            })
          );
        }
      );
    },
    [notes, showToast]
  );

  const restoreDeletedNote = useCallback(
    (id: string) => {
      setNotes((prev) =>
        prev.map((n) =>
          n.id === id
            ? {
                ...n,
                isDeleted: false,
                deletedAt: undefined,
                updatedAt: new Date().toISOString(),
              }
            : n
        )
      );
      showToast('Note restored');
    },
    [showToast]
  );

  const permanentlyDeleteNote = useCallback(
    (id: string) => {
      setNotes((prev) => prev.filter((n) => n.id !== id));
      showToast('Note permanently deleted', 'danger');
    },
    [showToast]
  );

  const emptyTrash = useCallback(() => {
    setNotes((prev) => prev.filter((n) => !n.isDeleted));
    showToast('Trash emptied', 'danger');
  }, [showToast]);

  const createFolder = useCallback(
    (name: string): Folder | null => {
      const maxFoldersLimit = appControlsConfig.freeLimits.maxFolders;
      const userFoldersCount = folders.filter((f) => !f.isSystem).length;
      if (!isPremium && userFoldersCount >= maxFoldersLimit) {
        requestUpgrade(
          `Free plan supports up to ${maxFoldersLimit} folders. Upgrade to Notes Premium for unlimited folders.`
        );
        return null;
      }
      const trimmed = name.trim() || 'Untitled Folder';
      const newFolder: Folder = {
        id: generateId('folder'),
        name: trimmed,
        createdAt: new Date().toISOString(),
      };
      setFolders((prev) => [...prev, newFolder]);
      showToast(`Folder "${trimmed}" created`);
      return newFolder;
    },
    [
      appControlsConfig.freeLimits.maxFolders,
      folders,
      isPremium,
      requestUpgrade,
      showToast,
    ]
  );

  const renameFolder = useCallback(
    (id: string, name: string) => {
      const target = folders.find((f) => f.id === id);
      if (target?.isSystem || id === CV_GENERATION_FOLDER_ID) {
        showToast('Cv Generation folder cannot be renamed', 'danger');
        return;
      }
      const trimmed = name.trim();
      if (!trimmed) return;
      setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name: trimmed } : f)));
      showToast('Folder renamed');
    },
    [folders, showToast]
  );

  const deleteFolder = useCallback(
    (id: string) => {
      const target = folders.find((f) => f.id === id);
      if (target?.isSystem || id === CV_GENERATION_FOLDER_ID) {
        showToast('Cv Generation folder cannot be deleted', 'danger');
        return;
      }
      const remaining = folders.filter((f) => f.id !== id);
      const fallbackId =
        remaining.find((f) => !f.isSystem && f.id !== CV_GENERATION_FOLDER_ID)?.id || '';
      setFolders(remaining);
      setNotes((prev) =>
        prev.map((n) => (n.folderId === id ? { ...n, folderId: fallbackId } : n))
      );
      if (defaultFolderId === id) {
        setDefaultFolderIdState(fallbackId);
      }
      showToast('Folder deleted');
    },
    [defaultFolderId, folders, showToast]
  );

  const resetLocalData = useCallback(() => {
    setNotes(INITIAL_NOTES);
    setFolders(DEFAULT_FOLDERS);
    setAccount(INITIAL_ACCOUNT);
    setRecentSearches(INITIAL_RECENT_SEARCHES);
    setDefaultFolderIdState('');
    setPaletteState('default');
    setNotePinState(null);
    setNoteLockMethodState(null);
    setUnlockedNoteIds([]);
    showToast('Workspace cleared');
  }, [showToast]);

  const pinnedNotes = useMemo(() => activeNotes.filter((n) => n.isPinned), [activeNotes]);
  const favoriteNotes = useMemo(() => activeNotes.filter((n) => n.isFavorite), [activeNotes]);

  const archivedNotes = useMemo(
    () =>
      notes
        .filter((n) => n.isArchived && !n.isDeleted)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [notes]
  );

  const trashedNotes = useMemo(
    () =>
      notes
        .filter((n) => n.isDeleted)
        .sort(
          (a, b) =>
            new Date(b.deletedAt || b.updatedAt).getTime() -
            new Date(a.deletedAt || a.updatedAt).getTime()
        ),
    [notes]
  );

  const getFolderById = useCallback(
    (id: string) => folders.find((f) => f.id === id),
    [folders]
  );

  const getNoteById = useCallback((id: string) => notes.find((n) => n.id === id), [notes]);

  const getFolderNoteCount = useCallback(
    (folderId: string) =>
      notes.filter((n) => !n.isArchived && !n.isDeleted && n.folderId === folderId).length,
    [notes]
  );

  const value: NotesContextValue = {
    screen,
    navigate,
    goBack,
    canGoBack: history.length > 1,
    registerBackHandler,
    activeNoteId,
    activeFolderId,
    activeCursorTarget,
    setActiveFolderId,
    notes,
    activeNotes,
    pinnedNotes,
    favoriteNotes,
    archivedNotes,
    trashedNotes,
    folders,
    theme,
    resolvedTheme,
    setTheme,
    palette,
    setPalette,
    noteFontSize,
    setNoteFontSize,
    isPremium,
    setIsPremium,
    hasPaidSubscription,
    isPreviewAvailable,
    canViewSubscriptionPage,
    previewConfig,
    previewSyncState,
    previewSyncError,
    previewStartedAt,
    isAdmin,
    adminSaving,
    updateAdminPreviewConfig,
    aboutConfig,
    aboutSyncState,
    aboutSyncError,
    aboutSaving,
    updateAdminAboutConfig,
    textToolsConfig,
    textToolsSyncState,
    textToolsSyncError,
    textToolsSaving,
    updateAdminTextToolsConfig,
    appControlsConfig,
    appControlsSyncState,
    appControlsSyncError,
    appControlsSaving,
    updateAdminAppControlsConfig,
    canUsePremiumPalettes,
    canUseNoteLock,
    canUseDriveBackup,
    canCreateNote,
    canCreateFolder,
    maxImagesAllowed,
    upgradePromptReason,
    requestUpgrade,
    dismissUpgradePrompt,
    notePin,
    setNotePin,
    noteLockMethod,
    enableFingerprintLock,
    disableNoteLock,
    biometricSupported,
    biometryLabel,
    unlockedNoteIds,
    unlockNoteSession,
    lockNoteSession,
    toggleLockNote,
    defaultFolderId,
    setDefaultFolderId,
    notifications,
    updateNotifications,
    account,
    updateAccount,
    authLoading,
    authError,
    driveBusy,
    billingBusy,
    hasDriveAccess,
    signInGoogleAccount,
    signOutGoogleAccount,
    backupToGoogleDrive,
    restoreFromGoogleDrive,
    autoBackup,
    updateAutoBackupSchedule,
    disableAutoBackupSchedule,
    trashRetention,
    updateTrashRetention,
    disableTrashRetention,
    restorePurchase,
    recentSearches,
    addRecentSearch,
    clearRecentSearches,
    hasOnboarded,
    completeOnboarding,
    createNote,
    updateNote,
    togglePinNote,
    toggleFavoriteNote,
    moveNoteToFolder,
    archiveNote,
    restoreArchivedNote,
    deleteNote,
    bulkMoveNotes,
    bulkArchiveNotes,
    bulkRestoreArchivedNotes,
    bulkDeleteNotes,
    restoreDeletedNote,
    permanentlyDeleteNote,
    emptyTrash,
    createFolder,
    renameFolder,
    deleteFolder,
    getFolderById,
    getNoteById,
    getFolderNoteCount,
    resetLocalData,
    toast,
    showToast,
    dismissToast,
  };

  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>;
}

export function useNotes() {
  const ctx = useContext(NotesContext);
  if (!ctx) throw new Error('useNotes must be used within NotesProvider');
  return ctx;
}

export function useBackHandler(active: boolean, onBack: () => void) {
  const { registerBackHandler } = useNotes();
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!active) return;
    return registerBackHandler(() => {
      onBackRef.current();
      return true;
    });
  }, [active, registerBackHandler]);
}
