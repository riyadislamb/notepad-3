export type ScreenName =
  | 'splash'
  | 'onboarding'
  | 'home'
  | 'create-note'
  | 'edit-note'
  | 'note-details'
  | 'all-notes'
  | 'pinned-notes'
  | 'favorites'
  | 'folders'
  | 'folder-details'
  | 'search'
  | 'archive'
  | 'trash'
  | 'settings'
  | 'appearance'
  | 'account'
  | 'premium'
  | 'help'
  | 'about'
  | 'admin'
  | 'cv-generator';

export type EditorCursorTarget =
  | { type: 'title'; offset: number; preferredViewportY?: number }
  | { type: 'body-offset'; offset: number; preferredViewportY?: number }
  | { type: 'body-end' };

export type ThemePreference = 'light' | 'dark' | 'system';

export type ThemePalette = 'default' | 'sepia' | 'sage' | 'slate';

export const NOTE_FONT_SIZE_MIN = 12;
export const NOTE_FONT_SIZE_MAX = 24;
export const NOTE_FONT_SIZE_DEFAULT = 16;

export type NoteFontSize = number;

export function normalizeNoteFontSize(value: unknown): NoteFontSize {
  if (value === 'small') return 14;
  if (value === 'medium') return 16;
  if (value === 'large') return 19;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return NOTE_FONT_SIZE_DEFAULT;
  return Math.min(NOTE_FONT_SIZE_MAX, Math.max(NOTE_FONT_SIZE_MIN, Math.round(parsed)));
}

export type NoteSortOption = 'updated' | 'title' | 'pinned';

export type NoteLockMethod = 'pin' | 'fingerprint' | null;

export const FREE_LIMITS = {
  maxActiveNotes: 25,
  maxFolders: 4,
  maxImagesPerNote: 1,
} as const;

export interface Note {
  id: string;
  title: string;
  content: string;
  images?: string[];
  folderId: string;
  isPinned: boolean;
  isFavorite: boolean;
  isLocked?: boolean;
  isArchived: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface Folder {
  id: string;
  name: string;
  isDefault?: boolean;
  isSystem?: boolean;
  createdAt: string;
}

export interface CvEducationEntry {
  id: string;
  qualification: string;
  institution: string;
  board: string;
  year: string;
  result: string;
}

export interface CvExperienceEntry {
  id: string;
  jobTitle: string;
  company: string;
  duration: string;
  responsibility: string;
  achievements: string;
}

export type CvEnglishLevel = 'Basic' | 'Intermediate' | 'Fluent';

export interface CvData {
  fullName: string;
  phone: string;
  email: string;
  address: string;
  portfolioLink: string;
  careerObjective: string;
  fathersName: string;
  mothersName: string;
  dateOfBirth: string;
  nationality: string;
  gender: string;
  maritalStatus: string;
  educations: CvEducationEntry[];
  skills: string[];
  isFresher: boolean;
  experiences: CvExperienceEntry[];
  projects: string[];
  certificates: string;
  englishLevel: CvEnglishLevel;
  otherLanguage: string;
  interests: string[];
  signatureText: string;
  declarationDate: string;
}

export interface NotificationSettings {
  dailyReminder: boolean;
  weeklyDigest: boolean;
  subtleSounds: boolean;
}

export interface UserAccount {
  uid?: string;
  name: string;
  email: string;
  photoUrl?: string;
  emailVerified?: boolean;
  isGuest?: boolean;
  lastDriveBackupAt?: string;
  lastTransactionId?: string;
  premiumExpiresAt?: string;
}

export interface ToastMessage {
  id: string;
  text: string;
  variant?: 'default' | 'danger';
  undoAction?: () => void;
}

export interface PreviewModeConfig {
  enabled: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expiresAt?: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface AutoBackupSchedule {
  enabled: boolean;
  months: number;
  days: number;
  lastBackupAt?: string;
  nextBackupAt?: string;
}

export interface TrashRetentionConfig {
  enabled: boolean;
  months: number;
  days: number;
}

export interface SupportMessage {
  id: string;
  userEmail: string;
  userName: string;
  userUid?: string;
  subject: string;
  message: string;
  status: 'open' | 'replied';
  adminReply?: string;
  repliedAt?: string;
  repliedBy?: string;
  emailDeliveryStatus?: 'sent' | 'mailto_fallback' | 'not_configured';
  createdAt: string;
  updatedAt: string;
}

export type SocialPlatformId =
  | 'facebook'
  | 'whatsapp'
  | 'instagram'
  | 'youtube'
  | 'x'
  | 'linkedin'
  | 'website';

export interface AboutSocialLink {
  id: SocialPlatformId;
  label: string;
  href: string;
  enabled: boolean;
}

export interface AboutTeamMember {
  id: string;
  name: string;
  role: string;
  image: string;
}

export interface AboutAppConfig {
  ceo: AboutTeamMember | null;
  team: AboutTeamMember[];
  socials: AboutSocialLink[];
  updatedAt: string;
  updatedBy?: string;
}

export type TextToolId =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikethrough'
  | 'highlight'
  | 'text_color'
  | 'bullet_list'
  | 'text_size'
  | 'simple_table'
  | 'insert_link'
  | 'divider'
  | 'quick_sketch'
  | 'add_image'
  | 'take_photo'
  | 'voice_typing'
  | 'translate'
  | 'quote'
  | 'numbered_list'
  | 'checklist'
  | 'code_block'
  | 'ocr_scan';

export interface TextToolRule {
  enabled: boolean;
  premium: boolean;
}

export interface TextToolsConfig {
  tools: Record<TextToolId, TextToolRule>;
  updatedAt: string;
  updatedBy?: string;
}

export interface FreeLimitsConfig {
  maxActiveNotes: number;
  maxFolders: number;
  maxImagesPerNote: number;
}

export type AnnouncementActionTarget = 'none' | 'premium' | 'about' | 'help';

export interface AnnouncementBannerConfig {
  enabled: boolean;
  title: string;
  message: string;
  actionLabel: string;
  actionTarget: AnnouncementActionTarget;
  updatedAt: string;
}

export interface PremiumFeatureFlags {
  themePalettes: boolean;
  noteLock: boolean;
  driveBackup: boolean;
}

export interface PremiumPricingConfig {
  monthlyBdt: number;
  monthlyUsdt: number;
  yearlyBdt: number;
  yearlyUsdt: number;
}

export interface PremiumControlsConfig {
  features: PremiumFeatureFlags;
  pricing: PremiumPricingConfig;
}

export interface AppControlsConfig {
  freeLimits: FreeLimitsConfig;
  announcement: AnnouncementBannerConfig;
  premiumControls: PremiumControlsConfig;
  updatedAt: string;
  updatedBy?: string;
}

