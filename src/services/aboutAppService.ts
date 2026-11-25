import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import {
  AboutAppConfig,
  AboutSocialLink,
  AboutTeamMember,
  SocialPlatformId,
} from '../types/notes';
import { ADMIN_EMAIL, FirestoreSyncState } from './adminConfigService';
import { auth, db, diagnoseFirestoreTimeout, isFirebaseConfigured } from './googleAuthDrive';

const ABOUT_CONFIG_CACHE_KEY = 'notes_about_app_config_cache_v2';
const LEGACY_CACHE_KEY = 'notes_about_app_config_cache_v1';

export const SOCIAL_PLATFORM_OPTIONS: Array<{
  id: SocialPlatformId;
  label: string;
  placeholder: string;
}> = [
  { id: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/...' },
  { id: 'whatsapp', label: 'WhatsApp', placeholder: 'https://wa.me/...' },
  { id: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/...' },
  { id: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/...' },
  { id: 'x', label: 'X (Twitter)', placeholder: 'https://x.com/...' },
  { id: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/...' },
  { id: 'website', label: 'Website', placeholder: 'https://...' },
];

export const EMPTY_ABOUT_CONFIG: AboutAppConfig = {
  ceo: null,
  team: [],
  socials: [],
  updatedAt: '',
};

const PLATFORM_LABEL_MAP = new Map<SocialPlatformId, string>(
  SOCIAL_PLATFORM_OPTIONS.map((opt) => [opt.id, opt.label])
);

function normalizeWebUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('tel:') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('/')
  ) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function normalizeMember(
  raw: Partial<AboutTeamMember> | null | undefined,
  fallbackId: string
): AboutTeamMember | null {
  if (!raw || typeof raw !== 'object') return null;
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  const role = typeof raw.role === 'string' ? raw.role.trim() : '';
  const image = typeof raw.image === 'string' ? normalizeWebUrl(raw.image) : '';
  if (!name && !role && !image) return null;
  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : fallbackId,
    name,
    role,
    image,
  };
}

export function normalizeAboutConfig(
  raw: Partial<AboutAppConfig> | null | undefined
): AboutAppConfig {
  if (!raw || typeof raw !== 'object') {
    return EMPTY_ABOUT_CONFIG;
  }

  const ceo = normalizeMember(raw.ceo, 'ceo');

  const team: AboutTeamMember[] = Array.isArray(raw.team)
    ? raw.team
        .map((item, idx) => normalizeMember(item, `member_${idx + 1}`))
        .filter((m): m is AboutTeamMember => m !== null)
    : [];

  const socials: AboutSocialLink[] = [];
  const seenSocials = new Set<SocialPlatformId>();
  if (Array.isArray(raw.socials)) {
    raw.socials.forEach((item) => {
      if (!item || typeof item !== 'object') return;
      const id = item.id as SocialPlatformId;
      if (!PLATFORM_LABEL_MAP.has(id) || seenSocials.has(id)) return;
      const href = typeof item.href === 'string' ? normalizeWebUrl(item.href) : '';
      const enabled = typeof item.enabled === 'boolean' ? item.enabled : Boolean(href);
      seenSocials.add(id);
      socials.push({
        id,
        label:
          typeof item.label === 'string' && item.label.trim()
            ? item.label.trim()
            : PLATFORM_LABEL_MAP.get(id) || id,
        href,
        enabled,
      });
    });
  }

  return {
    ceo,
    team,
    socials,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : '',
    updatedBy: typeof raw.updatedBy === 'string' ? raw.updatedBy : undefined,
  };
}

export function loadCachedAboutConfig(): AboutAppConfig {
  try {
    localStorage.removeItem(LEGACY_CACHE_KEY);
    const raw = localStorage.getItem(ABOUT_CONFIG_CACHE_KEY);
    if (!raw) return EMPTY_ABOUT_CONFIG;
    return normalizeAboutConfig(JSON.parse(raw) as Partial<AboutAppConfig>);
  } catch {
    return EMPTY_ABOUT_CONFIG;
  }
}

function cacheAboutConfig(config: AboutAppConfig): void {
  try {
    localStorage.setItem(ABOUT_CONFIG_CACHE_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage quota errors
  }
}

async function cacheRemoteImageAsDataUrl(src: string): Promise<string> {
  const trimmed = src.trim();
  if (!trimmed || trimmed.startsWith('data:') || typeof window === 'undefined') {
    return trimmed;
  }
  try {
    const res = await fetch(trimmed, { mode: 'cors' });
    if (!res.ok) return trimmed;
    const blob = await res.blob();
    if (!blob.type.startsWith('image/')) return trimmed;

    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onerror = () => resolve(trimmed);
      reader.onload = () => {
        const dataUrl = String(reader.result || '');
        const img = new Image();
        img.onerror = () => resolve(trimmed);
        img.onload = () => {
          const maxSide = 360;
          const scale = Math.min(maxSide / img.width, maxSide / img.height, 1);
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(trimmed);
            return;
          }
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.78));
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(blob);
    });
  } catch {
    return trimmed;
  }
}

async function buildOfflineCachedConfig(config: AboutAppConfig): Promise<AboutAppConfig> {
  const cachedCeo = config.ceo
    ? {
        ...config.ceo,
        image: await cacheRemoteImageAsDataUrl(config.ceo.image),
      }
    : null;

  const cachedTeam = await Promise.all(
    config.team.map(async (member) => ({
      ...member,
      image: await cacheRemoteImageAsDataUrl(member.image),
    }))
  );

  return {
    ...config,
    ceo: cachedCeo,
    team: cachedTeam,
  };
}

export function subscribeAboutAppConfig(
  onConfig: (
    config: AboutAppConfig,
    syncState: FirestoreSyncState,
    errorMessage?: string
  ) => void
): () => void {
  if (!isFirebaseConfigured || !db) {
    onConfig(loadCachedAboutConfig(), 'unconfigured');
    return () => {};
  }

  let active = true;

  try {
    const configRef = doc(db, 'app_config', 'about_app');

    return onSnapshot(
      configRef,
      (snapshot) => {
        if (!active) return;
        if (snapshot.exists()) {
          const normalized = normalizeAboutConfig(snapshot.data() as Partial<AboutAppConfig>);
          cacheAboutConfig(normalized);
          onConfig(normalized, 'synced');

          // Convert any external photo URLs into offline data URLs in localStorage cache
          void buildOfflineCachedConfig(normalized).then((offlineReady) => {
            if (!active) return;
            cacheAboutConfig(offlineReady);
          });
        } else {
          cacheAboutConfig(EMPTY_ABOUT_CONFIG);
          onConfig(EMPTY_ABOUT_CONFIG, 'synced');
        }
      },
      (err) => {
        if (!active) return;
        onConfig(
          loadCachedAboutConfig(),
          'error',
          err?.message || 'Could not load About App settings from Firestore'
        );
      }
    );
  } catch (err) {
    onConfig(
      loadCachedAboutConfig(),
      'error',
      err instanceof Error ? err.message : 'Firestore initialization failed'
    );
    return () => {};
  }
}

export async function saveAboutAppConfig(
  next: Pick<AboutAppConfig, 'ceo' | 'team' | 'socials'>
): Promise<AboutAppConfig> {
  if (!isFirebaseConfigured || !db || !auth?.currentUser) {
    throw new Error('Sign in with your admin Google account first.');
  }
  const currentEmail = (auth.currentUser.email || '').trim().toLowerCase();
  if (currentEmail !== ADMIN_EMAIL || !auth.currentUser.emailVerified) {
    throw new Error('Only the verified admin account can update About App settings.');
  }

  const normalized = normalizeAboutConfig({
    ...next,
    updatedAt: new Date().toISOString(),
    updatedBy: currentEmail,
  });

  const payload = {
    ceo: normalized.ceo
      ? {
          id: normalized.ceo.id,
          name: normalized.ceo.name,
          role: normalized.ceo.role,
          image: normalized.ceo.image,
        }
      : null,
    team: normalized.team.map((m) => ({
      id: m.id,
      name: m.name,
      role: m.role,
      image: m.image,
    })),
    socials: normalized.socials.map((s) => ({
      id: s.id,
      label: s.label,
      href: s.href,
      enabled: s.enabled,
    })),
    updatedAt: normalized.updatedAt,
    updatedBy: currentEmail,
  };

  const approxBytes = new Blob([JSON.stringify(payload)]).size;
  if (approxBytes > 900_000) {
    throw new Error('Total profile photo data is too large. Use smaller images or photo URLs.');
  }

  const configRef = doc(db, 'app_config', 'about_app');
  await Promise.race([
    setDoc(configRef, payload),
    new Promise<never>((_, reject) =>
      setTimeout(() => {
        void diagnoseFirestoreTimeout('app_config/about_app').then((reason) =>
          reject(new Error(reason))
        );
      }, 12000)
    ),
  ]);
  cacheAboutConfig(normalized);
  return normalized;
}

export function compressTeamPhotoFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read image file'));
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image format'));
      img.onload = () => {
        const maxSide = 280;
        const scale = Math.min(maxSide / img.width, maxSide / img.height, 1);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.74));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}
