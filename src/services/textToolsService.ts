import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { TextToolId, TextToolRule, TextToolsConfig } from '../types/notes';
import { ADMIN_EMAIL, FirestoreSyncState } from './adminConfigService';
import { auth, db, diagnoseFirestoreTimeout, isFirebaseConfigured } from './googleAuthDrive';

const TEXT_TOOLS_CACHE_KEY = 'notes_text_tools_config_cache_v1';

export interface TextToolMeta {
  id: TextToolId;
  label: string;
  upgradeTitle: string;
  defaultEnabled: boolean;
  defaultPremium: boolean;
}

export const TEXT_TOOLS_CATALOG: TextToolMeta[] = [
  { id: 'bold', label: 'Bold', upgradeTitle: 'Bold formatting', defaultEnabled: true, defaultPremium: false },
  { id: 'italic', label: 'Italic', upgradeTitle: 'Italic formatting', defaultEnabled: true, defaultPremium: false },
  { id: 'underline', label: 'Underline', upgradeTitle: 'Underline formatting', defaultEnabled: true, defaultPremium: false },
  { id: 'strikethrough', label: 'Strikethrough', upgradeTitle: 'Strikethrough formatting', defaultEnabled: true, defaultPremium: false },
  { id: 'highlight', label: 'Highlight', upgradeTitle: 'Text highlight', defaultEnabled: true, defaultPremium: false },
  { id: 'text_color', label: 'Text Color', upgradeTitle: 'Text color', defaultEnabled: true, defaultPremium: false },
  { id: 'bullet_list', label: 'Bullet List', upgradeTitle: 'Bullet lists', defaultEnabled: true, defaultPremium: false },
  { id: 'text_size', label: 'Text Size', upgradeTitle: 'Text resizing', defaultEnabled: true, defaultPremium: false },
  { id: 'simple_table', label: 'Simple Table', upgradeTitle: 'Simple tables', defaultEnabled: true, defaultPremium: false },
  { id: 'insert_link', label: 'Insert Link', upgradeTitle: 'Link insertion', defaultEnabled: true, defaultPremium: false },
  { id: 'divider', label: 'Divider Line', upgradeTitle: 'Divider lines', defaultEnabled: true, defaultPremium: false },
  { id: 'quick_sketch', label: 'Quick Sketch', upgradeTitle: 'Quick Sketch', defaultEnabled: true, defaultPremium: false },
  { id: 'add_image', label: 'Add Image', upgradeTitle: 'Gallery images', defaultEnabled: true, defaultPremium: false },
  { id: 'take_photo', label: 'Take Photo', upgradeTitle: 'Camera photos', defaultEnabled: true, defaultPremium: false },
  { id: 'voice_typing', label: 'Voice Typing', upgradeTitle: 'Voice typing', defaultEnabled: true, defaultPremium: false },
  { id: 'translate', label: 'Translate', upgradeTitle: 'Text translation', defaultEnabled: true, defaultPremium: false },
  { id: 'quote', label: 'Quote', upgradeTitle: 'Quote blocks', defaultEnabled: true, defaultPremium: true },
  { id: 'numbered_list', label: 'Numbered List', upgradeTitle: 'Numbered lists', defaultEnabled: true, defaultPremium: true },
  { id: 'checklist', label: 'Checklist', upgradeTitle: 'Interactive checklists', defaultEnabled: true, defaultPremium: true },
  { id: 'code_block', label: 'Code Block', upgradeTitle: 'Code blocks', defaultEnabled: true, defaultPremium: true },
  { id: 'ocr_scan', label: 'Scan Text (OCR)', upgradeTitle: 'Image to Text (OCR)', defaultEnabled: true, defaultPremium: true },
];

export function buildDefaultToolsMap(): Record<TextToolId, TextToolRule> {
  const map = {} as Record<TextToolId, TextToolRule>;
  for (const item of TEXT_TOOLS_CATALOG) {
    map[item.id] = {
      enabled: item.defaultEnabled,
      premium: item.defaultPremium,
    };
  }
  return map;
}

export const DEFAULT_TEXT_TOOLS_CONFIG: TextToolsConfig = {
  tools: buildDefaultToolsMap(),
  updatedAt: '',
};

export function normalizeTextToolsConfig(
  raw: Partial<TextToolsConfig> | null | undefined
): TextToolsConfig {
  const defaults = buildDefaultToolsMap();
  const rawTools = raw?.tools && typeof raw.tools === 'object' ? raw.tools : undefined;

  const tools = {} as Record<TextToolId, TextToolRule>;
  for (const item of TEXT_TOOLS_CATALOG) {
    const candidate = rawTools?.[item.id];
    tools[item.id] = {
      enabled:
        typeof candidate?.enabled === 'boolean'
          ? candidate.enabled
          : defaults[item.id].enabled,
      premium:
        typeof candidate?.premium === 'boolean'
          ? candidate.premium
          : defaults[item.id].premium,
    };
  }

  return {
    tools,
    updatedAt: typeof raw?.updatedAt === 'string' ? raw.updatedAt : '',
    updatedBy: typeof raw?.updatedBy === 'string' ? raw.updatedBy : undefined,
  };
}

export function loadCachedTextToolsConfig(): TextToolsConfig {
  try {
    const raw = localStorage.getItem(TEXT_TOOLS_CACHE_KEY);
    if (!raw) return DEFAULT_TEXT_TOOLS_CONFIG;
    return normalizeTextToolsConfig(JSON.parse(raw) as Partial<TextToolsConfig>);
  } catch {
    return DEFAULT_TEXT_TOOLS_CONFIG;
  }
}

function cacheTextToolsConfig(config: TextToolsConfig): void {
  try {
    localStorage.setItem(TEXT_TOOLS_CACHE_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage quota errors
  }
}

export function subscribeTextToolsConfig(
  onConfig: (
    config: TextToolsConfig,
    syncState: FirestoreSyncState,
    errorMessage?: string
  ) => void
): () => void {
  if (!isFirebaseConfigured || !db) {
    onConfig(loadCachedTextToolsConfig(), 'unconfigured');
    return () => {};
  }

  try {
    const configRef = doc(db, 'app_config', 'text_tools');

    return onSnapshot(
      configRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const normalized = normalizeTextToolsConfig(snapshot.data() as Partial<TextToolsConfig>);
          cacheTextToolsConfig(normalized);
          onConfig(normalized, 'synced');
        } else {
          onConfig(loadCachedTextToolsConfig(), 'synced');
        }
      },
      (err) => {
        onConfig(
          loadCachedTextToolsConfig(),
          'error',
          err?.message || 'Could not load Text Tools settings from Firestore'
        );
      }
    );
  } catch (err) {
    onConfig(
      loadCachedTextToolsConfig(),
      'error',
      err instanceof Error ? err.message : 'Firestore initialization failed'
    );
    return () => {};
  }
}

export async function saveTextToolsConfig(
  nextTools: Record<TextToolId, TextToolRule>
): Promise<TextToolsConfig> {
  if (!isFirebaseConfigured || !db || !auth?.currentUser) {
    throw new Error('Sign in with your admin Google account first.');
  }
  const currentEmail = (auth.currentUser.email || '').trim().toLowerCase();
  if (currentEmail !== ADMIN_EMAIL || !auth.currentUser.emailVerified) {
    throw new Error('Only the verified admin account can update Text Tools settings.');
  }

  const normalized = normalizeTextToolsConfig({
    tools: nextTools,
    updatedAt: new Date().toISOString(),
    updatedBy: currentEmail,
  });

  const payload = {
    tools: normalized.tools,
    updatedAt: normalized.updatedAt,
    updatedBy: currentEmail,
  };

  const configRef = doc(db, 'app_config', 'text_tools');
  await Promise.race([
    setDoc(configRef, payload),
    new Promise<never>((_, reject) =>
      setTimeout(() => {
        void diagnoseFirestoreTimeout('app_config/text_tools').then((reason) =>
          reject(new Error(reason))
        );
      }, 12000)
    ),
  ]);
  cacheTextToolsConfig(normalized);
  return normalized;
}
