import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { getApps, initializeApp } from 'firebase/app';
import {
  Auth,
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  User,
} from 'firebase/auth';
import {
  Firestore,
  getFirestore,
  initializeFirestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Folder, Note } from '../types/notes';

export const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const BACKUP_FILE_NAME = 'notes-app-backup.json';

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId
);

export const firestoreDatabaseId =
  (firebaseConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId?.trim() ||
  undefined;

export const firebaseApp = isFirebaseConfigured
  ? getApps().length > 0
    ? getApps()[0]
    : initializeApp(firebaseConfig)
  : null;
export const auth: Auth | null = firebaseApp ? getAuth(firebaseApp) : null;
export const db: Firestore | null = firebaseApp
  ? (() => {
      try {
        return initializeFirestore(
          firebaseApp,
          { experimentalAutoDetectLongPolling: true },
          firestoreDatabaseId
        );
      } catch {
        return firestoreDatabaseId
          ? getFirestore(firebaseApp, firestoreDatabaseId)
          : getFirestore(firebaseApp);
      }
    })()
  : null;

export async function diagnoseFirestoreTimeout(docPath: string): Promise<string> {
  const dbName = firestoreDatabaseId || '(default)';
  try {
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
        firebaseConfig.projectId
      )}/databases/${encodeURIComponent(dbName)}/documents/${docPath}`
    );
    const json = (await res.json()) as { error?: { status?: string; message?: string } };
    if (json?.error?.status === 'NOT_FOUND' && json.error.message?.includes('does not exist')) {
      return `Firestore database "${dbName}" does not exist in project "${firebaseConfig.projectId}". Create it in Firebase Console or configure its Database ID.`;
    }
    if (json?.error?.status === 'PERMISSION_DENIED') {
      return 'Permission denied by Firestore Rules. Publish the updated rules in Firebase Console.';
    }
    if (json?.error?.message) {
      return json.error.message;
    }
  } catch {
    // Ignore network diagnostic error
  }
  return 'Save timed out. Check your internet connection and Firebase Firestore Rules.';
}

function createGoogleProvider(includeDriveScope: boolean, forceConsent = false): GoogleAuthProvider {
  const p = new GoogleAuthProvider();
  if (includeDriveScope) {
    SCOPES.forEach((scope) => p.addScope(scope));
  }
  p.setCustomParameters({
    prompt: forceConsent ? 'consent select_account' : 'select_account',
  });
  return p;
}

let isSigningIn = false;
let nativeInitialized = false;
// Keep OAuth access token strictly in memory (never in localStorage/sessionStorage)
let cachedAccessToken: string | null = null;

function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

async function ensureNativeSocialLoginInitialized(): Promise<void> {
  if (nativeInitialized) return;
  if (!firebaseConfig.oAuthClientId) {
    throw new Error('Google OAuth Client ID is not configured yet');
  }
  await SocialLogin.initialize({
    google: {
      webClientId: firebaseConfig.oAuthClientId,
      mode: 'online',
    },
  });
  nativeInitialized = true;
}

export interface DriveBackupPayload {
  version: number;
  exportedAt: string;
  accountEmail?: string;
  notes: Note[];
  folders: Folder[];
}

export function initFirebaseAuth(
  onUserChange: (user: User | null, hasDriveToken: boolean) => void
) {
  if (!auth) {
    onUserChange(null, false);
    return () => {};
  }

  if (!isNativeApp()) {
    void getRedirectResult(auth)
      .then((result) => {
        if (result) {
          const credential = GoogleAuthProvider.credentialFromResult(result);
          if (credential?.accessToken) {
            cachedAccessToken = credential.accessToken;
          }
          onUserChange(result.user, Boolean(cachedAccessToken));
        }
      })
      .catch(() => {
        // Ignore stale redirect errors; interactive sign-in surfaces active errors
      });
  }

  return onAuthStateChanged(auth, (user) => {
    if (user) {
      onUserChange(user, Boolean(cachedAccessToken));
    } else {
      cachedAccessToken = null;
      if (!isSigningIn) {
        onUserChange(null, false);
      }
    }
  });
}

function formatBrowserAuthError(err: unknown): Error {
  const errObj = err as { code?: string; message?: string };
  const code = errObj?.code || '';
  const host = typeof window !== 'undefined' ? window.location.hostname : '';

  if (code === 'auth/unauthorized-domain') {
    return new Error(
      `Domain "${host}" is not authorized for sign-in. Add it in Firebase Console → Authentication → Settings → Authorized domains.`
    );
  }
  if (code === 'auth/popup-blocked') {
    return new Error(
      'Sign-in popup was blocked by your browser. Allow popups for this site or open in a new tab.'
    );
  }
  if (code === 'auth/operation-not-allowed') {
    return new Error(
      'Google Sign-In is disabled in Firebase Console → Authentication → Sign-in method.'
    );
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    const cancelled = new Error('Sign-in cancelled');
    (cancelled as Error & { code?: string }).code = 'USER_CANCELLED';
    return cancelled;
  }
  return err instanceof Error ? err : new Error(errObj?.message || 'Google sign-in failed');
}

export async function signInWithGoogle(
  forceRefreshToken = false,
  requireDriveScope = false
): Promise<{ user: User; accessToken: string | null }> {
  if (!auth) {
    throw new Error('Firebase is not configured yet');
  }
  try {
    isSigningIn = true;

    if (isNativeApp()) {
      await ensureNativeSocialLoginInitialized();
      const loginRes = await SocialLogin.login({
        provider: 'google',
        options: {
          scopes: SCOPES,
          style: 'standard',
          forceRefreshToken,
        },
      });

      if (loginRes.result.responseType !== 'online') {
        throw new Error('Unexpected offline login response');
      }

      const idToken = loginRes.result.idToken;
      const accessToken = loginRes.result.accessToken?.token;

      if (!idToken) {
        throw new Error('Could not obtain Google ID token');
      }

      const credential = GoogleAuthProvider.credential(idToken);
      const userCred = await signInWithCredential(auth, credential);

      if (accessToken) {
        cachedAccessToken = accessToken;
      } else if (requireDriveScope) {
        throw new Error('Could not obtain Google Drive access token');
      }

      return { user: userCred.user, accessToken: cachedAccessToken };
    }

    const webProvider = createGoogleProvider(requireDriveScope, forceRefreshToken);
    try {
      const result = await signInWithPopup(auth, webProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        cachedAccessToken = credential.accessToken;
      } else if (requireDriveScope) {
        throw new Error('Could not obtain Google Drive access token');
      }
      return { user: result.user, accessToken: cachedAccessToken };
    } catch (err) {
      const code = (err as { code?: string })?.code;
      const isTopLevelWindow =
        typeof window !== 'undefined' && window.self === window.top;
      if (code === 'auth/popup-blocked' && isTopLevelWindow) {
        await signInWithRedirect(auth, webProvider);
        return new Promise(() => {});
      }
      throw formatBrowserAuthError(err);
    }
  } finally {
    isSigningIn = false;
  }
}

export async function signOutGoogle(): Promise<void> {
  cachedAccessToken = null;
  if (isNativeApp()) {
    try {
      await ensureNativeSocialLoginInitialized();
      await SocialLogin.logout({ provider: 'google' });
    } catch {
      // Ignore native logout cleanup errors
    }
  }
  if (auth) {
    await signOut(auth);
  }
}

export async function ensureDriveAccessToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedAccessToken) return cachedAccessToken;
  const { accessToken } = await signInWithGoogle(forceRefresh, true);
  if (!accessToken) {
    throw new Error('Could not obtain Google Drive access token');
  }
  return accessToken;
}

interface DriveFileSummary {
  id: string;
  name: string;
  modifiedTime?: string;
}

async function findDriveBackupFile(accessToken: string): Promise<DriveFileSummary | null> {
  const query = encodeURIComponent(`name='${BACKUP_FILE_NAME}' and trashed=false`);
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc&pageSize=1`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  if (res.status === 401) {
    cachedAccessToken = null;
    throw new Error('AUTH_EXPIRED');
  }
  if (!res.ok) {
    throw new Error('Failed to check Google Drive backup');
  }
  const data = (await res.json()) as { files?: DriveFileSummary[] };
  return data.files && data.files.length > 0 ? data.files[0] : null;
}

export async function uploadDriveBackup(payload: DriveBackupPayload): Promise<{
  fileId: string;
  modifiedTime: string;
}> {
  let token = await ensureDriveAccessToken();
  let existing: DriveFileSummary | null = null;

  try {
    existing = await findDriveBackupFile(token);
  } catch (err) {
    if (err instanceof Error && err.message === 'AUTH_EXPIRED') {
      token = await ensureDriveAccessToken(true);
      existing = await findDriveBackupFile(token);
    } else {
      throw err;
    }
  }

  const boundary = 'notes_drive_backup_boundary_2026';
  const metadata = {
    name: BACKUP_FILE_NAME,
    mimeType: 'application/json',
  };

  const multipartBody =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(payload)}\r\n` +
    `--${boundary}--`;

  const uploadUrl = existing
    ? `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=multipart&fields=id,modifiedTime`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime`;

  const res = await fetch(uploadUrl, {
    method: existing ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  if (res.status === 401) {
    cachedAccessToken = null;
    throw new Error('Google Drive session expired. Please sign in again.');
  }

  if (!res.ok) {
    throw new Error('Could not upload backup to Google Drive');
  }

  const result = (await res.json()) as { id: string; modifiedTime?: string };
  return {
    fileId: result.id,
    modifiedTime: result.modifiedTime || new Date().toISOString(),
  };
}

export async function restoreDriveBackup(): Promise<DriveBackupPayload> {
  let token = await ensureDriveAccessToken();
  let file: DriveFileSummary | null = null;

  try {
    file = await findDriveBackupFile(token);
  } catch (err) {
    if (err instanceof Error && err.message === 'AUTH_EXPIRED') {
      token = await ensureDriveAccessToken(true);
      file = await findDriveBackupFile(token);
    } else {
      throw err;
    }
  }

  if (!file) {
    throw new Error('No backup found on Google Drive');
  }

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (res.status === 401) {
    cachedAccessToken = null;
    throw new Error('Google Drive session expired. Please sign in again.');
  }

  if (!res.ok) {
    throw new Error('Could not download backup from Google Drive');
  }

  const parsed = (await res.json()) as Partial<DriveBackupPayload>;
  if (!Array.isArray(parsed.notes) || !Array.isArray(parsed.folders)) {
    throw new Error('Backup file is invalid');
  }

  return {
    version: parsed.version || 1,
    exportedAt: parsed.exportedAt || file.modifiedTime || new Date().toISOString(),
    accountEmail: parsed.accountEmail,
    notes: parsed.notes,
    folders: parsed.folders,
  };
}
