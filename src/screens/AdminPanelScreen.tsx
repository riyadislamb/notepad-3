import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Crown,
  Gauge,
  ImagePlus,
  LayoutDashboard,
  Loader2,
  Mail,
  Megaphone,
  Menu,
  MessageSquare,
  Plus,
  RotateCcw,
  Send,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react';
import { useBackHandler, useNotes } from '../context/NotesContext';
import {
  compressTeamPhotoFile,
  SOCIAL_PLATFORM_OPTIONS,
} from '../services/aboutAppService';
import { DEFAULT_APP_CONTROLS_CONFIG } from '../services/appControlsService';
import {
  buildSupportReplyMailto,
  replyToSupportMessage,
  subscribeSupportMessages,
} from '../services/supportService';
import {
  buildDefaultToolsMap,
  TEXT_TOOLS_CATALOG,
} from '../services/textToolsService';
import {
  AboutSocialLink,
  AboutTeamMember,
  AnnouncementActionTarget,
  PremiumFeatureFlags,
  SocialPlatformId,
  SupportMessage,
  TextToolId,
  TextToolRule,
} from '../types/notes';
import { formatFullDate, generateId } from '../utils/noteHelpers';

type AdminModule =
  | 'overview'
  | 'preview-timer'
  | 'text-tools'
  | 'free-limits'
  | 'announcement'
  | 'premium-controls'
  | 'support'
  | 'about';
type SupportFilter = 'all' | 'open' | 'replied';

export function AdminPanelScreen() {
  const {
    account,
    isAdmin,
    previewConfig,
    previewSyncState,
    previewSyncError,
    adminSaving,
    updateAdminPreviewConfig,
    aboutConfig,
    aboutSyncError,
    aboutSaving,
    updateAdminAboutConfig,
    textToolsConfig,
    textToolsSyncError,
    textToolsSaving,
    updateAdminTextToolsConfig,
    appControlsConfig,
    appControlsSyncError,
    appControlsSaving,
    updateAdminAppControlsConfig,
    goBack,
    showToast,
  } = useNotes();

  const [activeModule, setActiveModule] = useState<AdminModule>('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [enabled, setEnabled] = useState<boolean>(previewConfig.enabled);
  const [trialDaysDraft, setTrialDaysDraft] = useState<string>(String(previewConfig.days));

  const [ceoDraft, setCeoDraft] = useState<AboutTeamMember | null>(aboutConfig.ceo);
  const [teamDraft, setTeamDraft] = useState<AboutTeamMember[]>(aboutConfig.team);
  const [socialsDraft, setSocialsDraft] = useState<AboutSocialLink[]>(aboutConfig.socials);
  const [selectedSocialToAdd, setSelectedSocialToAdd] = useState<SocialPlatformId>('facebook');

  const [supportTickets, setSupportTickets] = useState<SupportMessage[]>([]);
  const [supportSyncError, setSupportSyncError] = useState<string | null>(null);
  const [supportFilter, setSupportFilter] = useState<SupportFilter>('all');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [aboutJustSaved, setAboutJustSaved] = useState(false);
  const [previewJustSaved, setPreviewJustSaved] = useState(false);
  const [toolsDraft, setToolsDraft] = useState<Record<TextToolId, TextToolRule>>(
    textToolsConfig.tools
  );
  const [toolsJustSaved, setToolsJustSaved] = useState(false);

  // Free Limits drafts
  const [maxNotesDraft, setMaxNotesDraft] = useState<string>(
    String(appControlsConfig.freeLimits.maxActiveNotes)
  );
  const [maxFoldersDraft, setMaxFoldersDraft] = useState<string>(
    String(appControlsConfig.freeLimits.maxFolders)
  );
  const [maxImagesDraft, setMaxImagesDraft] = useState<string>(
    String(appControlsConfig.freeLimits.maxImagesPerNote)
  );
  const [limitsJustSaved, setLimitsJustSaved] = useState(false);

  // Announcement Banner drafts
  const [annEnabled, setAnnEnabled] = useState<boolean>(
    appControlsConfig.announcement.enabled
  );
  const [annTitle, setAnnTitle] = useState<string>(
    appControlsConfig.announcement.title
  );
  const [annMessage, setAnnMessage] = useState<string>(
    appControlsConfig.announcement.message
  );
  const [annActionLabel, setAnnActionLabel] = useState<string>(
    appControlsConfig.announcement.actionLabel
  );
  const [annActionTarget, setAnnActionTarget] = useState<AnnouncementActionTarget>(
    appControlsConfig.announcement.actionTarget
  );
  const [annJustSaved, setAnnJustSaved] = useState(false);

  // Premium Feature & Pricing drafts
  const [premFeaturesDraft, setPremFeaturesDraft] = useState<PremiumFeatureFlags>(
    appControlsConfig.premiumControls.features
  );
  const [monthlyBdtDraft, setMonthlyBdtDraft] = useState<string>(
    String(appControlsConfig.premiumControls.pricing.monthlyBdt)
  );
  const [monthlyUsdtDraft, setMonthlyUsdtDraft] = useState<string>(
    String(appControlsConfig.premiumControls.pricing.monthlyUsdt)
  );
  const [yearlyBdtDraft, setYearlyBdtDraft] = useState<string>(
    String(appControlsConfig.premiumControls.pricing.yearlyBdt)
  );
  const [yearlyUsdtDraft, setYearlyUsdtDraft] = useState<string>(
    String(appControlsConfig.premiumControls.pricing.yearlyUsdt)
  );
  const [premJustSaved, setPremJustSaved] = useState(false);

  useBackHandler(mobileNavOpen, () => setMobileNavOpen(false));

  useEffect(() => {
    setEnabled(previewConfig.enabled);
    setTrialDaysDraft(String(previewConfig.days));
  }, [previewConfig]);

  useEffect(() => {
    setCeoDraft(aboutConfig.ceo);
    setTeamDraft(aboutConfig.team);
    setSocialsDraft(aboutConfig.socials);
  }, [aboutConfig]);

  useEffect(() => {
    setToolsDraft(textToolsConfig.tools);
  }, [textToolsConfig]);

  useEffect(() => {
    setMaxNotesDraft(String(appControlsConfig.freeLimits.maxActiveNotes));
    setMaxFoldersDraft(String(appControlsConfig.freeLimits.maxFolders));
    setMaxImagesDraft(String(appControlsConfig.freeLimits.maxImagesPerNote));
    setAnnEnabled(appControlsConfig.announcement.enabled);
    setAnnTitle(appControlsConfig.announcement.title);
    setAnnMessage(appControlsConfig.announcement.message);
    setAnnActionLabel(appControlsConfig.announcement.actionLabel);
    setAnnActionTarget(appControlsConfig.announcement.actionTarget);
    setPremFeaturesDraft(appControlsConfig.premiumControls.features);
    setMonthlyBdtDraft(String(appControlsConfig.premiumControls.pricing.monthlyBdt));
    setMonthlyUsdtDraft(String(appControlsConfig.premiumControls.pricing.monthlyUsdt));
    setYearlyBdtDraft(String(appControlsConfig.premiumControls.pricing.yearlyBdt));
    setYearlyUsdtDraft(String(appControlsConfig.premiumControls.pricing.yearlyUsdt));
  }, [appControlsConfig]);

  useEffect(() => {
    if (!isAdmin) return;
    setSupportSyncError(null);
    const unsubscribe = subscribeSupportMessages(
      (items) => {
        setSupportTickets(items);
        setSupportSyncError(null);
      },
      (errMsg) => {
        setSupportSyncError(errMsg);
      }
    );
    return () => unsubscribe();
  }, [isAdmin]);

  const openTicketCount = useMemo(
    () => supportTickets.filter((t) => t.status === 'open').length,
    [supportTickets]
  );

  const repliedTicketCount = useMemo(
    () => supportTickets.filter((t) => t.status === 'replied').length,
    [supportTickets]
  );

  const filteredTickets = useMemo(() => {
    if (supportFilter === 'all') return supportTickets;
    return supportTickets.filter((t) => t.status === supportFilter);
  }, [supportFilter, supportTickets]);

  const toolCounts = useMemo(() => {
    let free = 0;
    let premium = 0;
    let hidden = 0;
    for (const item of TEXT_TOOLS_CATALOG) {
      const rule = toolsDraft[item.id];
      if (!rule?.enabled) {
        hidden += 1;
      } else if (rule.premium) {
        premium += 1;
      } else {
        free += 1;
      }
    }
    return { free, premium, hidden };
  }, [toolsDraft]);

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col items-center justify-center px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E45B5B]/10 text-[#E45B5B] mb-4">
          <ShieldAlert className="h-7 w-7" strokeWidth={1.85} />
        </div>
        <h1 className="text-xl font-bold tracking-tight">Admin Access Required</h1>
        <p className="mt-1.5 max-w-xs text-sm text-[var(--text-secondary)]">
          Sign in with the authorized administrator account to open this dashboard.
        </p>
        <button
          type="button"
          onClick={goBack}
          className="mt-6 min-h-[44px] rounded-full bg-[var(--text-primary)] dark:bg-[var(--accent-primary)] px-6 text-sm font-semibold text-[var(--bg-card)] dark:text-[#171717] cursor-pointer"
        >
          Back
        </button>
      </div>
    );
  }

  const navGroups: Array<{
    groupLabel: string;
    items: Array<{
      id: AdminModule;
      label: string;
      icon: typeof LayoutDashboard;
      badge?: number;
    }>;
  }> = [
    {
      groupLabel: 'Dashboard',
      items: [{ id: 'overview', label: 'Overview', icon: LayoutDashboard }],
    },
    {
      groupLabel: 'App Controls',
      items: [
        { id: 'preview-timer', label: 'Preview Timer', icon: Clock },
        { id: 'free-limits', label: 'Free Limits', icon: Gauge },
        { id: 'premium-controls', label: 'Plans & Pricing', icon: Crown },
        { id: 'text-tools', label: 'Text Tools', icon: SlidersHorizontal },
      ],
    },
    {
      groupLabel: 'Content & Support',
      items: [
        { id: 'announcement', label: 'Notice Banner', icon: Megaphone },
        {
          id: 'support',
          label: 'Support Messages',
          icon: MessageSquare,
          badge: openTicketCount > 0 ? openTicketCount : undefined,
        },
        { id: 'about', label: 'About App', icon: Users },
      ],
    },
  ];

  const savedTrialDays = Math.max(0, Math.floor(previewConfig.days || 0));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setPreviewJustSaved(false);
    const parsedDays = Math.max(0, Math.min(3650, Math.floor(Number(trialDaysDraft || '0'))));
    if (enabled && (!Number.isFinite(parsedDays) || parsedDays < 1)) {
      showToast('Enter at least 1 day for Trial Duration', 'danger');
      return;
    }
    const ok = await updateAdminPreviewConfig({
      enabled,
      days: Number.isFinite(parsedDays) ? parsedDays : 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      expiresAt: '',
    });
    if (ok) {
      setPreviewJustSaved(true);
      setTimeout(() => setPreviewJustSaved(false), 4000);
    }
  };

  const handleSendReply = async (ticket: SupportMessage) => {
    const draft = (replyDrafts[ticket.id] || '').trim();
    if (!draft || replyingId) return;
    setReplyingId(ticket.id);
    try {
      const res = await replyToSupportMessage(ticket, draft);
      setReplyDrafts((prev) => ({ ...prev, [ticket.id]: '' }));
      showToast(res.statusMessage);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Could not send reply',
        'danger'
      );
    } finally {
      setReplyingId(null);
    }
  };

  const handlePhotoUpload = async (
    file: File | undefined,
    onDone: (compressedDataUrl: string) => void
  ) => {
    if (!file) return;
    try {
      const dataUrl = await compressTeamPhotoFile(file);
      onDone(dataUrl);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Invalid photo', 'danger');
    }
  };

  const availableSocialOptions = SOCIAL_PLATFORM_OPTIONS.filter(
    (opt) => !socialsDraft.some((s) => s.id === opt.id)
  );

  const handleAddSocialLink = () => {
    const targetId = availableSocialOptions.some((o) => o.id === selectedSocialToAdd)
      ? selectedSocialToAdd
      : availableSocialOptions[0]?.id;
    const opt = SOCIAL_PLATFORM_OPTIONS.find((o) => o.id === targetId);
    if (!opt) return;
    setSocialsDraft((prev) => [
      ...prev,
      {
        id: opt.id,
        label: opt.label,
        href: '',
        enabled: true,
      },
    ]);
    const remaining = availableSocialOptions.filter((o) => o.id !== opt.id);
    if (remaining[0]) {
      setSelectedSocialToAdd(remaining[0].id);
    }
  };

  const handleAddCeo = () => {
    setCeoDraft({
      id: 'ceo',
      name: '',
      role: 'Founder & CEO',
      image: '',
    });
  };

  const handleAddTeamMember = () => {
    setTeamDraft((prev) => [
      ...prev,
      {
        id: generateId('member'),
        name: '',
        role: '',
        image: '',
      },
    ]);
  };

  const handleMoveTeamMember = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= teamDraft.length) return;
    setTeamDraft((prev) => {
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });
  };

  const handleSaveAboutApp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAboutJustSaved(false);
    const ok = await updateAdminAboutConfig({
      ceo: ceoDraft,
      team: teamDraft,
      socials: socialsDraft,
    });
    if (ok) {
      setAboutJustSaved(true);
      setTimeout(() => setAboutJustSaved(false), 4000);
    }
  };

  const handleSaveTextTools = async (e: React.FormEvent) => {
    e.preventDefault();
    setToolsJustSaved(false);
    const ok = await updateAdminTextToolsConfig(toolsDraft);
    if (ok) {
      setToolsJustSaved(true);
      setTimeout(() => setToolsJustSaved(false), 4000);
    }
  };

  const handleSaveFreeLimits = async (e: React.FormEvent) => {
    e.preventDefault();
    setLimitsJustSaved(false);
    const parseIntBounded = (raw: string, min: number, max: number, fallback: number) => {
      const n = Number(raw);
      if (!Number.isFinite(n)) return fallback;
      return Math.min(max, Math.max(min, Math.floor(n)));
    };
    const ok = await updateAdminAppControlsConfig({
      freeLimits: {
        maxActiveNotes: parseIntBounded(
          maxNotesDraft,
          1,
          10000,
          DEFAULT_APP_CONTROLS_CONFIG.freeLimits.maxActiveNotes
        ),
        maxFolders: parseIntBounded(
          maxFoldersDraft,
          1,
          500,
          DEFAULT_APP_CONTROLS_CONFIG.freeLimits.maxFolders
        ),
        maxImagesPerNote: parseIntBounded(
          maxImagesDraft,
          0,
          100,
          DEFAULT_APP_CONTROLS_CONFIG.freeLimits.maxImagesPerNote
        ),
      },
      announcement: appControlsConfig.announcement,
      premiumControls: appControlsConfig.premiumControls,
    });
    if (ok) {
      setLimitsJustSaved(true);
      setTimeout(() => setLimitsJustSaved(false), 4000);
    }
  };

  const handleSaveAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setAnnJustSaved(false);
    const ok = await updateAdminAppControlsConfig({
      freeLimits: appControlsConfig.freeLimits,
      announcement: {
        enabled: annEnabled,
        title: annTitle.trim(),
        message: annMessage.trim(),
        actionLabel: annActionLabel.trim(),
        actionTarget: annActionTarget,
        updatedAt: new Date().toISOString(),
      },
      premiumControls: appControlsConfig.premiumControls,
    });
    if (ok) {
      setAnnJustSaved(true);
      setTimeout(() => setAnnJustSaved(false), 4000);
    }
  };

  const handleSavePremiumControls = async (e: React.FormEvent) => {
    e.preventDefault();
    setPremJustSaved(false);
    const parsePrice = (raw: string, min: number, max: number, fallback: number, decimals: number) => {
      const n = Number(raw);
      if (!Number.isFinite(n) || n < min) return fallback;
      const clamped = Math.min(max, n);
      const factor = Math.pow(10, decimals);
      return Math.round(clamped * factor) / factor;
    };
    const ok = await updateAdminAppControlsConfig({
      freeLimits: appControlsConfig.freeLimits,
      announcement: appControlsConfig.announcement,
      premiumControls: {
        features: premFeaturesDraft,
        pricing: {
          monthlyBdt: parsePrice(
            monthlyBdtDraft,
            1,
            1000000,
            DEFAULT_APP_CONTROLS_CONFIG.premiumControls.pricing.monthlyBdt,
            0
          ),
          monthlyUsdt: parsePrice(
            monthlyUsdtDraft,
            0.1,
            100000,
            DEFAULT_APP_CONTROLS_CONFIG.premiumControls.pricing.monthlyUsdt,
            2
          ),
          yearlyBdt: parsePrice(
            yearlyBdtDraft,
            1,
            10000000,
            DEFAULT_APP_CONTROLS_CONFIG.premiumControls.pricing.yearlyBdt,
            0
          ),
          yearlyUsdt: parsePrice(
            yearlyUsdtDraft,
            0.1,
            1000000,
            DEFAULT_APP_CONTROLS_CONFIG.premiumControls.pricing.yearlyUsdt,
            2
          ),
        },
      },
    });
    if (ok) {
      setPremJustSaved(true);
      setTimeout(() => setPremJustSaved(false), 4000);
    }
  };

  const headerTitle =
    activeModule === 'overview'
      ? 'Overview'
      : activeModule === 'text-tools'
      ? 'Text Tools'
      : activeModule === 'free-limits'
      ? 'Free Limits'
      : activeModule === 'announcement'
      ? 'Notice Banner'
      : activeModule === 'premium-controls'
      ? 'Plans & Pricing'
      : activeModule === 'support'
      ? 'Support Messages'
      : activeModule === 'about'
      ? 'About App'
      : 'Preview Timer';

  const selectModule = (id: AdminModule) => {
    setActiveModule(id);
    setMobileNavOpen(false);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  const renderSidebarNav = () => (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
      {navGroups.map((group) => (
        <div key={group.groupLabel} className="space-y-1">
          <p className="px-3 pb-1 text-[11px] font-semibold text-[var(--text-secondary)] tracking-wide">
            {group.groupLabel}
          </p>
          {group.items.map((item) => {
            const Icon = item.icon;
            const active = activeModule === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectModule(item.id)}
                className={`flex w-full min-h-[42px] items-center justify-between gap-2 rounded-xl px-3 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)] font-semibold'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={1.9} />
                  <span className="truncate">{item.label}</span>
                </span>
                {typeof item.badge === 'number' && (
                  <span className="text-xs font-bold text-[var(--accent-primary)] tabular-nums shrink-0">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );

  const premiumFeatureSummary = [
    appControlsConfig.premiumControls.features.themePalettes ? 'Themes: Premium' : 'Themes: Free',
    appControlsConfig.premiumControls.features.noteLock ? 'Lock: Premium' : 'Lock: Free',
    appControlsConfig.premiumControls.features.driveBackup ? 'Drive: Premium' : 'Drive: Free',
  ].join(' · ');

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex">
      {/* Desktop Sticky Left Sidebar */}
      <aside className="hidden md:flex md:sticky md:top-0 md:h-screen md:w-64 md:flex-col md:border-r md:border-[var(--divider)] bg-[var(--bg-card)] shrink-0">
        <div className="flex items-center gap-3 px-4 py-4 border-b border-[var(--divider)]">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
            <ShieldCheck className="h-5 w-5" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold tracking-tight truncate">Notes Admin</p>
            <p className="text-xs text-[var(--text-secondary)] truncate">{account.email}</p>
          </div>
        </div>

        {renderSidebarNav()}

        <div className="p-3 border-t border-[var(--divider)]">
          <button
            type="button"
            onClick={goBack}
            className="flex w-full min-h-[42px] items-center gap-2.5 rounded-xl px-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] transition-colors cursor-pointer whitespace-nowrap"
          >
            <ChevronLeft className="h-4 w-4 shrink-0" strokeWidth={2} />
            <span>Back to Settings</span>
          </button>
        </div>
      </aside>

      {/* Mobile Slide-Over Drawer */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 flex md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Admin navigation"
        >
          <div
            className="fixed inset-0 bg-black/45"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative z-10 flex w-72 max-w-[82vw] flex-col bg-[var(--bg-card)] border-r border-[var(--divider)] h-full">
            <div className="flex items-center justify-between gap-3 px-4 py-4 border-b border-[var(--divider)]">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
                  <ShieldCheck className="h-5 w-5" strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold tracking-tight truncate">Notes Admin</p>
                  <p className="text-xs text-[var(--text-secondary)] truncate">{account.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close menu"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {renderSidebarNav()}

            <div className="p-3 border-t border-[var(--divider)]">
              <button
                type="button"
                onClick={() => {
                  setMobileNavOpen(false);
                  goBack();
                }}
                className="flex w-full min-h-[44px] items-center gap-2.5 rounded-xl px-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4 shrink-0" strokeWidth={2} />
                <span>Back to Settings</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 h-[61px] bg-[var(--bg-canvas)]/95 backdrop-blur-md border-b border-[var(--divider)] px-4 sm:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={goBack}
              aria-label="Back"
              className="md:hidden min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={2} />
            </button>

            <div className="flex items-center gap-2 min-w-0 text-sm">
              <button
                type="button"
                onClick={() => selectModule('overview')}
                className="hidden sm:inline text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Admin
              </button>
              <ChevronRight className="hidden sm:inline h-3.5 w-3.5 text-[var(--text-secondary)] shrink-0" />
              <h1 className="text-base sm:text-lg font-bold tracking-tight truncate">
                {headerTitle}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {activeModule !== 'overview' && (
              <button
                type="button"
                onClick={() => selectModule('overview')}
                className="hidden sm:inline-flex min-h-[38px] items-center rounded-xl border border-[var(--divider)] bg-[var(--bg-card)] px-3.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Overview
              </button>
            )}
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open admin menu"
              className="md:hidden min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl bg-[var(--bg-card)] border border-[var(--divider)] text-[var(--text-primary)] cursor-pointer"
            >
              <Menu className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 w-full max-w-5xl mx-auto p-5 sm:p-8">
          {activeModule === 'overview' ? (
            <div className="space-y-6">
              {/* Top 2x2 Summary Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <section className="rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] p-5 flex flex-col justify-between gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-[var(--text-secondary)]">
                        Preview Timer
                      </p>
                      <p className="mt-1 text-xl font-bold tracking-tight tabular-nums">
                        {!previewConfig.enabled || savedTrialDays <= 0
                          ? 'Off'
                          : `${savedTrialDays} ${savedTrialDays === 1 ? 'Day' : 'Days'}`}
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        {previewConfig.enabled && savedTrialDays > 0 ? (
                          `New installs get ${savedTrialDays} ${
                            savedTrialDays === 1 ? 'day' : 'days'
                          } free`
                        ) : (
                          <>
                            Sync:{' '}
                            <span className="capitalize font-medium text-[var(--text-primary)]">
                              {previewSyncState}
                            </span>
                            {previewConfig.updatedAt && ` · ${formatFullDate(previewConfig.updatedAt)}`}
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
                      <Clock className="h-5 w-5" strokeWidth={1.85} />
                    </div>
                  </div>
                  {previewSyncError && (
                    <p className="text-xs text-[#E45B5B]">{previewSyncError}</p>
                  )}
                  <div className="pt-3 border-t border-[var(--divider)] flex items-center justify-between gap-3">
                    <span className="text-xs text-[var(--text-secondary)]">New install free trial</span>
                    <button
                      type="button"
                      onClick={() => selectModule('preview-timer')}
                      className="min-h-[36px] rounded-xl bg-[var(--bg-subtle)] px-3.5 text-xs font-semibold text-[var(--text-primary)] hover:opacity-85 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Configure
                    </button>
                  </div>
                </section>

                <section className="rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] p-5 flex flex-col justify-between gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-[var(--text-secondary)]">
                        Support Inbox
                      </p>
                      <p className="mt-1 text-xl font-bold tracking-tight tabular-nums">
                        {openTicketCount} open · {supportTickets.length} total
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-secondary)] tabular-nums">
                        {repliedTicketCount} replied messages
                      </p>
                    </div>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
                      <MessageSquare className="h-5 w-5" strokeWidth={1.85} />
                    </div>
                  </div>
                  <div className="pt-3 border-t border-[var(--divider)] flex items-center justify-between gap-3">
                    <span className="text-xs text-[var(--text-secondary)]">User tickets & replies</span>
                    <button
                      type="button"
                      onClick={() => selectModule('support')}
                      className="min-h-[36px] rounded-xl bg-[var(--bg-subtle)] px-3.5 text-xs font-semibold text-[var(--text-primary)] hover:opacity-85 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Open Inbox
                    </button>
                  </div>
                </section>

                <section className="rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] p-5 flex flex-col justify-between gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-[var(--text-secondary)]">
                        Free Plan Limits
                      </p>
                      <p className="mt-1 text-xl font-bold tracking-tight tabular-nums">
                        {appControlsConfig.freeLimits.maxActiveNotes} notes ·{' '}
                        {appControlsConfig.freeLimits.maxFolders} folders ·{' '}
                        {appControlsConfig.freeLimits.maxImagesPerNote} img
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        Active quota for Free users
                      </p>
                    </div>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
                      <Gauge className="h-5 w-5" strokeWidth={1.85} />
                    </div>
                  </div>
                  <div className="pt-3 border-t border-[var(--divider)] flex items-center justify-between gap-3">
                    <span className="text-xs text-[var(--text-secondary)]">Notes, folders & image cap</span>
                    <button
                      type="button"
                      onClick={() => selectModule('free-limits')}
                      className="min-h-[36px] rounded-xl bg-[var(--bg-subtle)] px-3.5 text-xs font-semibold text-[var(--text-primary)] hover:opacity-85 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Edit Limits
                    </button>
                  </div>
                </section>

                <section className="rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] p-5 flex flex-col justify-between gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[var(--text-secondary)]">
                        Plans & Pricing
                      </p>
                      <p className="mt-1 text-xl font-bold tracking-tight tabular-nums">
                        ৳{appControlsConfig.premiumControls.pricing.monthlyBdt}/mo · ৳
                        {appControlsConfig.premiumControls.pricing.yearlyBdt}/yr
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-secondary)] truncate">
                        {premiumFeatureSummary}
                      </p>
                    </div>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
                      <Crown className="h-5 w-5" strokeWidth={1.85} />
                    </div>
                  </div>
                  <div className="pt-3 border-t border-[var(--divider)] flex items-center justify-between gap-3">
                    <span className="text-xs text-[var(--text-secondary)]">Feature access & prices</span>
                    <button
                      type="button"
                      onClick={() => selectModule('premium-controls')}
                      className="min-h-[36px] rounded-xl bg-[var(--bg-subtle)] px-3.5 text-xs font-semibold text-[var(--text-primary)] hover:opacity-85 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Manage
                    </button>
                  </div>
                </section>
              </div>

              {/* Secondary Modules List */}
              <section className="rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] divide-y divide-[var(--divider)]">
                <div className="p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-canvas)] border border-[var(--divider)] text-[var(--text-primary)]">
                      <SlidersHorizontal className="h-4.5 w-4.5" strokeWidth={1.85} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        Editor Text Tools
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--text-secondary)] tabular-nums truncate">
                        {toolCounts.free} free · {toolCounts.premium} premium · {toolCounts.hidden} off
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => selectModule('text-tools')}
                    className="min-h-[38px] rounded-xl bg-[var(--bg-subtle)] px-4 text-xs font-semibold text-[var(--text-primary)] hover:opacity-85 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Manage
                  </button>
                </div>

                <div className="p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-canvas)] border border-[var(--divider)] text-[var(--text-primary)]">
                      <Megaphone className="h-4.5 w-4.5" strokeWidth={1.85} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        Notice Banner
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--text-secondary)] truncate">
                        {appControlsConfig.announcement.enabled
                          ? appControlsConfig.announcement.title || 'Active on Home Screen'
                          : 'Hidden'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => selectModule('announcement')}
                    className="min-h-[38px] rounded-xl bg-[var(--bg-subtle)] px-4 text-xs font-semibold text-[var(--text-primary)] hover:opacity-85 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Configure
                  </button>
                </div>

                <div className="p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-canvas)] border border-[var(--divider)] text-[var(--text-primary)]">
                      <Users className="h-4.5 w-4.5" strokeWidth={1.85} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        About App
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--text-secondary)] tabular-nums truncate">
                        {aboutConfig.ceo ? 'CEO configured' : 'No CEO'} · {aboutConfig.team.length} team · {aboutConfig.socials.filter((s) => s.enabled).length} socials
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => selectModule('about')}
                    className="min-h-[38px] rounded-xl bg-[var(--bg-subtle)] px-4 text-xs font-semibold text-[var(--text-primary)] hover:opacity-85 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Edit Info
                  </button>
                </div>
              </section>
            </div>
          ) : activeModule === 'free-limits' ? (
            <form onSubmit={handleSaveFreeLimits} className="max-w-2xl space-y-5">
              <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold">Free Plan Limits</h2>
                    <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                      Control maximum notes, folders, and images per note for Free users.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMaxNotesDraft(String(DEFAULT_APP_CONTROLS_CONFIG.freeLimits.maxActiveNotes));
                      setMaxFoldersDraft(String(DEFAULT_APP_CONTROLS_CONFIG.freeLimits.maxFolders));
                      setMaxImagesDraft(String(DEFAULT_APP_CONTROLS_CONFIG.freeLimits.maxImagesPerNote));
                    }}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-[var(--bg-subtle)] px-3 text-xs font-semibold text-[var(--text-primary)] hover:opacity-85 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
                    Reset Defaults
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    inputMode="numeric"
                    value={maxNotesDraft}
                    onChange={(e) => setMaxNotesDraft(e.target.value)}
                    placeholder="Max notes (25)"
                    aria-label="Max active notes for Free users"
                    className="w-full min-h-[46px] rounded-xl bg-[var(--bg-canvas)] border border-[var(--divider)] px-3.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-primary)] tabular-nums"
                  />
                  <input
                    type="number"
                    min={1}
                    max={500}
                    inputMode="numeric"
                    value={maxFoldersDraft}
                    onChange={(e) => setMaxFoldersDraft(e.target.value)}
                    placeholder="Max folders (4)"
                    aria-label="Max folders for Free users"
                    className="w-full min-h-[46px] rounded-xl bg-[var(--bg-canvas)] border border-[var(--divider)] px-3.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-primary)] tabular-nums"
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    inputMode="numeric"
                    value={maxImagesDraft}
                    onChange={(e) => setMaxImagesDraft(e.target.value)}
                    placeholder="Max images (1)"
                    aria-label="Max images per note for Free users"
                    className="w-full min-h-[46px] rounded-xl bg-[var(--bg-canvas)] border border-[var(--divider)] px-3.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-primary)] tabular-nums"
                  />
                </div>
              </div>

              {appControlsSyncError && (
                <div className="rounded-2xl bg-[#E45B5B]/10 border border-[#E45B5B]/30 p-4 text-xs text-[#E45B5B]">
                  {appControlsSyncError}
                </div>
              )}

              {limitsJustSaved && !appControlsSyncError && (
                <div className="flex items-center gap-2 rounded-2xl bg-[#2E7D32]/12 border border-[#2E7D32]/30 p-3.5 text-xs font-semibold text-[#2E7D32] dark:text-[#81C995]">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Saved — Free plan limits updated in real time
                </div>
              )}

              <button
                type="submit"
                disabled={appControlsSaving}
                className="flex w-full sm:w-auto sm:min-w-[200px] min-h-[46px] items-center justify-center gap-2 rounded-xl bg-[var(--text-primary)] dark:bg-[var(--accent-primary)] px-6 text-sm font-semibold text-[var(--bg-card)] dark:text-[#171717] disabled:opacity-60 transition-opacity hover:opacity-90 cursor-pointer"
              >
                {appControlsSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : limitsJustSaved ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Saved
                  </>
                ) : (
                  'Save Free Limits'
                )}
              </button>
            </form>
          ) : activeModule === 'announcement' ? (
            <form onSubmit={handleSaveAnnouncement} className="max-w-2xl space-y-5">
              <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] p-5 sm:p-6 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold">Show Home Notice Banner</h2>
                  <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                    Display an urgent notice or offer banner on every user&apos;s home screen.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={annEnabled}
                  aria-label="Toggle home announcement banner"
                  onClick={() => setAnnEnabled((prev) => !prev)}
                  className={`relative h-7 w-12 shrink-0 rounded-full transition-colors cursor-pointer ${
                    annEnabled ? 'bg-[var(--accent-primary)]' : 'bg-[var(--divider)]'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white transition-transform ${
                      annEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] p-5 sm:p-6 space-y-3">
                <p className="text-sm font-semibold">Banner Content</p>

                <input
                  type="text"
                  maxLength={120}
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  placeholder="Notice title"
                  aria-label="Notice title"
                  className="w-full min-h-[46px] rounded-xl bg-[var(--bg-canvas)] border border-[var(--divider)] px-3.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-primary)]"
                />

                <textarea
                  rows={3}
                  maxLength={400}
                  value={annMessage}
                  onChange={(e) => setAnnMessage(e.target.value)}
                  placeholder="Write announcement or offer message..."
                  aria-label="Notice message"
                  className="w-full rounded-xl bg-[var(--bg-canvas)] border border-[var(--divider)] p-3.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-primary)] resize-none"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    maxLength={32}
                    value={annActionLabel}
                    onChange={(e) => setAnnActionLabel(e.target.value)}
                    placeholder="Button text (optional)"
                    aria-label="Action button text"
                    className="w-full min-h-[44px] rounded-xl bg-[var(--bg-canvas)] border border-[var(--divider)] px-3.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-primary)]"
                  />

                  <select
                    value={annActionTarget}
                    onChange={(e) =>
                      setAnnActionTarget(e.target.value as AnnouncementActionTarget)
                    }
                    aria-label="Button action target"
                    className="w-full min-h-[44px] rounded-xl bg-[var(--bg-canvas)] border border-[var(--divider)] px-3.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                  >
                    <option value="none">No action button</option>
                    <option value="premium">Open Premium</option>
                    <option value="about">Open About App</option>
                    <option value="help">Open Help &amp; Support</option>
                  </select>
                </div>
              </div>

              {appControlsSyncError && (
                <div className="rounded-2xl bg-[#E45B5B]/10 border border-[#E45B5B]/30 p-4 text-xs text-[#E45B5B]">
                  {appControlsSyncError}
                </div>
              )}

              {annJustSaved && !appControlsSyncError && (
                <div className="flex items-center gap-2 rounded-2xl bg-[#2E7D32]/12 border border-[#2E7D32]/30 p-3.5 text-xs font-semibold text-[#2E7D32] dark:text-[#81C995]">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Saved — Notice banner synced to all users
                </div>
              )}

              <button
                type="submit"
                disabled={appControlsSaving}
                className="flex w-full sm:w-auto sm:min-w-[200px] min-h-[46px] items-center justify-center gap-2 rounded-xl bg-[var(--text-primary)] dark:bg-[var(--accent-primary)] px-6 text-sm font-semibold text-[var(--bg-card)] dark:text-[#171717] disabled:opacity-60 transition-opacity hover:opacity-90 cursor-pointer"
              >
                {appControlsSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : annJustSaved ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Saved
                  </>
                ) : (
                  'Save Notice Banner'
                )}
              </button>
            </form>
          ) : activeModule === 'premium-controls' ? (
            <form onSubmit={handleSavePremiumControls} className="space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
                <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] p-5 sm:p-6 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold">Feature Access</h2>
                      <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                        Choose which capabilities are Free or require Premium.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPremFeaturesDraft(
                          DEFAULT_APP_CONTROLS_CONFIG.premiumControls.features
                        );
                        setMonthlyBdtDraft(
                          String(DEFAULT_APP_CONTROLS_CONFIG.premiumControls.pricing.monthlyBdt)
                        );
                        setMonthlyUsdtDraft(
                          String(DEFAULT_APP_CONTROLS_CONFIG.premiumControls.pricing.monthlyUsdt)
                        );
                        setYearlyBdtDraft(
                          String(DEFAULT_APP_CONTROLS_CONFIG.premiumControls.pricing.yearlyBdt)
                        );
                        setYearlyUsdtDraft(
                          String(DEFAULT_APP_CONTROLS_CONFIG.premiumControls.pricing.yearlyUsdt)
                        );
                      }}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-[var(--bg-subtle)] px-3 text-xs font-semibold text-[var(--text-primary)] hover:opacity-85 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
                      Reset Defaults
                    </button>
                  </div>

                  <div className="divide-y divide-[var(--divider)]">
                    {(
                      [
                        { key: 'themePalettes', title: 'Theme Palettes', desc: 'Sepia, Sage & Slate' },
                        { key: 'noteLock', title: 'Note Lock', desc: 'Fingerprint & 4-digit PIN lock' },
                        { key: 'driveBackup', title: 'Google Drive Backup', desc: 'Cloud backup & restore' },
                      ] as const
                    ).map((feat) => {
                      const isPrem = premFeaturesDraft[feat.key];
                      return (
                        <div
                          key={feat.key}
                          className="py-3.5 first:pt-1 last:pb-1 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[var(--text-primary)]">
                              {feat.title}
                            </p>
                            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                              {feat.desc}
                            </p>
                          </div>

                          <div className="flex items-center rounded-xl bg-[var(--bg-canvas)] border border-[var(--divider)] p-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                setPremFeaturesDraft((prev) => ({ ...prev, [feat.key]: false }))
                              }
                              className={`min-h-[32px] rounded-lg px-3 text-xs font-semibold transition-colors cursor-pointer ${
                                !isPrem
                                  ? 'bg-[var(--text-primary)] dark:bg-[var(--accent-primary)] text-[var(--bg-card)] dark:text-[#171717]'
                                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                              }`}
                            >
                              Free
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setPremFeaturesDraft((prev) => ({ ...prev, [feat.key]: true }))
                              }
                              className={`min-h-[32px] rounded-lg px-3 text-xs font-semibold transition-colors cursor-pointer ${
                                isPrem
                                  ? 'bg-[var(--accent-primary)] text-white dark:text-[#171717]'
                                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                              }`}
                            >
                              Premium
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] p-5 sm:p-6 space-y-4">
                  <div>
                    <h2 className="text-base font-semibold">Subscription Pricing</h2>
                    <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                      Monthly and yearly pricing displayed in BDT and USDT.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      value={monthlyBdtDraft}
                      onChange={(e) => setMonthlyBdtDraft(e.target.value)}
                      placeholder="Monthly BDT (590)"
                      aria-label="Monthly BDT price"
                      className="w-full min-h-[46px] rounded-xl bg-[var(--bg-canvas)] border border-[var(--divider)] px-3.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-primary)] tabular-nums"
                    />
                    <input
                      type="number"
                      min={0.1}
                      step="0.01"
                      inputMode="decimal"
                      value={monthlyUsdtDraft}
                      onChange={(e) => setMonthlyUsdtDraft(e.target.value)}
                      placeholder="Monthly USDT (4.99)"
                      aria-label="Monthly USDT price"
                      className="w-full min-h-[46px] rounded-xl bg-[var(--bg-canvas)] border border-[var(--divider)] px-3.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-primary)] tabular-nums"
                    />
                    <input
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      value={yearlyBdtDraft}
                      onChange={(e) => setYearlyBdtDraft(e.target.value)}
                      placeholder="Yearly BDT (4790)"
                      aria-label="Yearly BDT price"
                      className="w-full min-h-[46px] rounded-xl bg-[var(--bg-canvas)] border border-[var(--divider)] px-3.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-primary)] tabular-nums"
                    />
                    <input
                      type="number"
                      min={0.1}
                      step="0.01"
                      inputMode="decimal"
                      value={yearlyUsdtDraft}
                      onChange={(e) => setYearlyUsdtDraft(e.target.value)}
                      placeholder="Yearly USDT (39.99)"
                      aria-label="Yearly USDT price"
                      className="w-full min-h-[46px] rounded-xl bg-[var(--bg-canvas)] border border-[var(--divider)] px-3.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-primary)] tabular-nums"
                    />
                  </div>
                </div>
              </div>

              {appControlsSyncError && (
                <div className="rounded-2xl bg-[#E45B5B]/10 border border-[#E45B5B]/30 p-4 text-xs text-[#E45B5B]">
                  {appControlsSyncError}
                </div>
              )}

              {premJustSaved && !appControlsSyncError && (
                <div className="flex items-center gap-2 rounded-2xl bg-[#2E7D32]/12 border border-[#2E7D32]/30 p-3.5 text-xs font-semibold text-[#2E7D32] dark:text-[#81C995]">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Saved — Plans &amp; pricing updated in real time
                </div>
              )}

              <button
                type="submit"
                disabled={appControlsSaving}
                className="flex w-full sm:w-auto sm:min-w-[220px] min-h-[46px] items-center justify-center gap-2 rounded-xl bg-[var(--text-primary)] dark:bg-[var(--accent-primary)] px-6 text-sm font-semibold text-[var(--bg-card)] dark:text-[#171717] disabled:opacity-60 transition-opacity hover:opacity-90 cursor-pointer"
              >
                {appControlsSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : premJustSaved ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Saved
                  </>
                ) : (
                  'Save Plans & Pricing'
                )}
              </button>
            </form>
          ) : activeModule === 'text-tools' ? (
            <form onSubmit={handleSaveTextTools} className="space-y-5">
              <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] p-5 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--divider)]">
                  <div>
                    <h2 className="text-base font-semibold">Editor Text Tools</h2>
                    <p className="mt-0.5 text-xs text-[var(--text-secondary)] tabular-nums">
                      {toolCounts.free} Free (Toolbar) · {toolCounts.premium} Premium (+ Menu) · {toolCounts.hidden} Off
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setToolsDraft(buildDefaultToolsMap())}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-[var(--bg-subtle)] px-3 text-xs font-semibold text-[var(--text-primary)] hover:opacity-85 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
                    Reset Defaults
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8">
                  {TEXT_TOOLS_CATALOG.map((tool) => {
                    const rule = toolsDraft[tool.id] || {
                      enabled: tool.defaultEnabled,
                      premium: tool.defaultPremium,
                    };
                    return (
                      <div
                        key={tool.id}
                        className="py-3.5 border-b border-[var(--divider)] flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p
                            className={`text-sm font-medium truncate ${
                              rule.enabled
                                ? 'text-[var(--text-primary)]'
                                : 'text-[var(--text-secondary)] line-through opacity-65'
                            }`}
                          >
                            {tool.label}
                          </p>
                          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                            {!rule.enabled
                              ? 'Disabled'
                              : rule.premium
                              ? 'Premium (+ Menu)'
                              : 'Free (Toolbar)'}
                          </p>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <div className="flex items-center rounded-xl bg-[var(--bg-canvas)] border border-[var(--divider)] p-0.5">
                            <button
                              type="button"
                              disabled={!rule.enabled}
                              onClick={() =>
                                setToolsDraft((prev) => ({
                                  ...prev,
                                  [tool.id]: { ...rule, premium: false },
                                }))
                              }
                              className={`min-h-[30px] rounded-lg px-2.5 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                                !rule.premium && rule.enabled
                                  ? 'bg-[var(--text-primary)] dark:bg-[var(--accent-primary)] text-[var(--bg-card)] dark:text-[#171717]'
                                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                              }`}
                            >
                              Free
                            </button>
                            <button
                              type="button"
                              disabled={!rule.enabled}
                              onClick={() =>
                                setToolsDraft((prev) => ({
                                  ...prev,
                                  [tool.id]: { ...rule, premium: true },
                                }))
                              }
                              className={`min-h-[30px] rounded-lg px-2.5 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                                rule.premium && rule.enabled
                                  ? 'bg-[var(--accent-primary)] text-white dark:text-[#171717]'
                                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                              }`}
                            >
                              Premium
                            </button>
                          </div>

                          <button
                            type="button"
                            role="switch"
                            aria-checked={rule.enabled}
                            aria-label={`Toggle ${tool.label}`}
                            onClick={() =>
                              setToolsDraft((prev) => ({
                                ...prev,
                                [tool.id]: { ...rule, enabled: !rule.enabled },
                              }))
                            }
                            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors cursor-pointer ${
                              rule.enabled ? 'bg-[var(--accent-primary)]' : 'bg-[var(--divider)]'
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                                rule.enabled ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {textToolsSyncError && (
                <div className="rounded-2xl bg-[#E45B5B]/10 border border-[#E45B5B]/30 p-4 text-xs text-[#E45B5B]">
                  {textToolsSyncError}
                </div>
              )}

              {toolsJustSaved && !textToolsSyncError && (
                <div className="flex items-center gap-2 rounded-2xl bg-[#2E7D32]/12 border border-[#2E7D32]/30 p-3.5 text-xs font-semibold text-[#2E7D32] dark:text-[#81C995]">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Saved — Text Tools updated in real time
                </div>
              )}

              <button
                type="submit"
                disabled={textToolsSaving}
                className="flex w-full sm:w-auto sm:min-w-[200px] min-h-[46px] items-center justify-center gap-2 rounded-xl bg-[var(--text-primary)] dark:bg-[var(--accent-primary)] px-6 text-sm font-semibold text-[var(--bg-card)] dark:text-[#171717] disabled:opacity-60 transition-opacity hover:opacity-90 cursor-pointer"
              >
                {textToolsSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : toolsJustSaved ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Saved
                  </>
                ) : (
                  'Save Text Tools'
                )}
              </button>
            </form>
          ) : activeModule === 'support' ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex items-center gap-1 rounded-xl bg-[var(--bg-card)] border border-[var(--divider)] p-1">
                  {(
                    [
                      { id: 'all', label: 'All', count: supportTickets.length },
                      { id: 'open', label: 'Open', count: openTicketCount },
                      { id: 'replied', label: 'Replied', count: repliedTicketCount },
                    ] as const
                  ).map((filter) => {
                    const active = supportFilter === filter.id;
                    return (
                      <button
                        key={filter.id}
                        type="button"
                        onClick={() => setSupportFilter(filter.id)}
                        className={`min-h-[34px] rounded-lg px-3.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                          active
                            ? 'bg-[var(--text-primary)] dark:bg-[var(--accent-primary)] text-[var(--bg-card)] dark:text-[#171717]'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        {filter.label} ({filter.count})
                      </button>
                    );
                  })}
                </div>
              </div>

              {supportSyncError && (
                <div className="rounded-2xl bg-[#E45B5B]/10 border border-[#E45B5B]/30 p-4 text-xs text-[#E45B5B]">
                  {supportSyncError}
                </div>
              )}

              {filteredTickets.length === 0 ? (
                <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] p-10 text-center">
                  <MessageSquare className="h-7 w-7 mx-auto text-[var(--text-secondary)] opacity-60" strokeWidth={1.75} />
                  <p className="mt-3 text-sm font-semibold text-[var(--text-primary)]">
                    No support messages yet
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                  {filteredTickets.map((ticket) => {
                    const draft = replyDrafts[ticket.id] ?? '';
                    const isSending = replyingId === ticket.id;
                    const mailtoHref = buildSupportReplyMailto(
                      ticket,
                      draft.trim() || ticket.adminReply || ''
                    );

                    return (
                      <article
                        key={ticket.id}
                        className="rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] p-5 space-y-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="text-base font-bold text-[var(--text-primary)] break-words">
                              {ticket.subject}
                            </h3>
                            <p className="mt-0.5 text-xs text-[var(--text-secondary)] break-all">
                              {ticket.userName} · {ticket.userEmail}
                              {ticket.createdAt && ` · ${formatFullDate(ticket.createdAt)}`}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 text-xs font-semibold ${
                              ticket.status === 'replied'
                                ? 'text-[#2E7D32] dark:text-[#81C995]'
                                : 'text-[var(--accent-primary)]'
                            }`}
                          >
                            {ticket.status === 'replied' ? 'Replied' : 'Open'}
                          </span>
                        </div>

                        <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed pt-3 border-t border-[var(--divider)]">
                          {ticket.message}
                        </p>

                        {ticket.adminReply && (
                          <div className="rounded-xl bg-[var(--accent-soft)]/45 p-3.5 space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent-primary)]">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Admin Reply
                              </span>
                              <span className="text-xs text-[var(--text-secondary)]">
                                {ticket.emailDeliveryStatus === 'sent'
                                  ? 'Emailed'
                                  : ticket.repliedAt
                                  ? formatFullDate(ticket.repliedAt)
                                  : 'Saved'}
                              </span>
                            </div>
                            <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap">
                              {ticket.adminReply}
                            </p>
                          </div>
                        )}

                        <div className="space-y-2.5 pt-2 border-t border-[var(--divider)]">
                          <textarea
                            value={draft}
                            onChange={(e) =>
                              setReplyDrafts((prev) => ({
                                ...prev,
                                [ticket.id]: e.target.value,
                              }))
                            }
                            placeholder="Write your reply..."
                            aria-label="Reply message"
                            rows={3}
                            className="w-full rounded-xl bg-[var(--bg-canvas)] border border-[var(--divider)] p-3.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-primary)] resize-none"
                          />

                          <div className="flex flex-col sm:flex-row gap-2">
                            <button
                              type="button"
                              disabled={!draft.trim() || isSending}
                              onClick={() => void handleSendReply(ticket)}
                              className="flex-1 min-h-[42px] flex items-center justify-center gap-2 rounded-xl bg-[var(--text-primary)] dark:bg-[var(--accent-primary)] px-4 text-xs font-semibold text-[var(--bg-card)] dark:text-[#171717] disabled:opacity-40 cursor-pointer"
                            >
                              {isSending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Send className="h-3.5 w-3.5" strokeWidth={2} />
                              )}
                              {isSending ? 'Sending...' : 'Send Reply'}
                            </button>

                            <a
                              href={mailtoHref}
                              className="min-h-[42px] flex items-center justify-center gap-2 rounded-xl border border-[var(--divider)] bg-[var(--bg-canvas)] px-4 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors whitespace-nowrap"
                            >
                              <Mail className="h-3.5 w-3.5" strokeWidth={2} />
                              Send via Email App
                            </a>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          ) : activeModule === 'about' ? (
            <form onSubmit={handleSaveAboutApp} className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
                {/* Leadership: CEO (Top Card) */}
                <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] p-5 sm:p-6 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-base font-semibold">CEO (Top Profile)</h2>
                    {!ceoDraft && (
                      <button
                        type="button"
                        onClick={handleAddCeo}
                        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-[var(--accent-soft)] px-3 text-xs font-semibold text-[var(--accent-primary)] whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" strokeWidth={2.2} />
                        Add CEO
                      </button>
                    )}
                  </div>

                  {!ceoDraft ? (
                    <div className="py-6 text-center text-xs text-[var(--text-secondary)] border-t border-[var(--divider)]">
                      No CEO profile added yet
                    </div>
                  ) : (
                    <div className="pt-4 border-t border-[var(--divider)] space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3.5">
                          <div className="h-16 w-14 shrink-0 overflow-hidden rounded-xl border border-[var(--divider)] bg-[var(--bg-canvas)] flex items-center justify-center">
                            {ceoDraft.image ? (
                              <img
                                src={ceoDraft.image}
                                alt={ceoDraft.name || 'CEO'}
                                referrerPolicy="no-referrer"
                                className="h-full w-full object-cover object-top"
                              />
                            ) : (
                              <User className="h-6 w-6 text-[var(--text-secondary)] opacity-60" strokeWidth={1.75} />
                            )}
                          </div>
                          <label className="inline-flex min-h-[38px] items-center gap-2 rounded-xl border border-[var(--divider)] bg-[var(--bg-canvas)] px-3.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer">
                            <ImagePlus className="h-3.5 w-3.5" />
                            <span>{ceoDraft.image ? 'Change Photo' : 'Upload Photo'}</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                e.target.value = '';
                                void handlePhotoUpload(file, (url) =>
                                  setCeoDraft((prev) => (prev ? { ...prev, image: url } : prev))
                                );
                              }}
                            />
                          </label>
                        </div>

                        <button
                          type="button"
                          onClick={() => setCeoDraft(null)}
                          aria-label="Remove CEO"
                          className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl bg-[#E45B5B]/10 text-[#E45B5B] cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={2} />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <input
                          type="text"
                          value={ceoDraft.name}
                          onChange={(e) =>
                            setCeoDraft((prev) =>
                              prev ? { ...prev, name: e.target.value } : prev
                            )
                          }
                          placeholder="CEO name"
                          aria-label="CEO Name"
                          className="w-full min-h-[42px] rounded-xl bg-[var(--bg-canvas)] border border-[var(--divider)] px-3.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-primary)]"
                        />
                        <input
                          type="text"
                          value={ceoDraft.role}
                          onChange={(e) =>
                            setCeoDraft((prev) =>
                              prev ? { ...prev, role: e.target.value } : prev
                            )
                          }
                          placeholder="Role / Title"
                          aria-label="CEO Role"
                          className="w-full min-h-[42px] rounded-xl bg-[var(--bg-canvas)] border border-[var(--divider)] px-3.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-primary)]"
                        />
                      </div>

                      <input
                        type="text"
                        inputMode="url"
                        value={ceoDraft.image.startsWith('data:') ? '' : ceoDraft.image}
                        onChange={(e) =>
                          setCeoDraft((prev) =>
                            prev ? { ...prev, image: e.target.value } : prev
                          )
                        }
                        placeholder="Photo URL (optional)"
                        aria-label="CEO Photo URL"
                        className="w-full min-h-[42px] rounded-xl bg-[var(--bg-canvas)] border border-[var(--divider)] px-3.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-primary)]"
                      />
                    </div>
                  )}
                </div>

                {/* Social Media Controls */}
                <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] p-5 sm:p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <h2 className="text-base font-semibold">Social Media Links</h2>
                    {availableSocialOptions.length > 0 && (
                      <div className="flex items-center gap-2">
                        <select
                          value={
                            availableSocialOptions.some((o) => o.id === selectedSocialToAdd)
                              ? selectedSocialToAdd
                              : availableSocialOptions[0].id
                          }
                          onChange={(e) =>
                            setSelectedSocialToAdd(e.target.value as SocialPlatformId)
                          }
                          aria-label="Select social platform"
                          className="min-h-[36px] rounded-xl bg-[var(--bg-canvas)] border border-[var(--divider)] px-3 text-xs font-medium text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                        >
                          {availableSocialOptions.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={handleAddSocialLink}
                          className="inline-flex min-h-[36px] items-center gap-1 rounded-xl bg-[var(--accent-soft)] px-3 text-xs font-semibold text-[var(--accent-primary)] whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Plus className="h-3.5 w-3.5" strokeWidth={2.2} />
                          Add
                        </button>
                      </div>
                    )}
                  </div>

                  {socialsDraft.length === 0 ? (
                    <div className="py-6 text-center text-xs text-[var(--text-secondary)] border-t border-[var(--divider)]">
                      No social media links added yet
                    </div>
                  ) : (
                    <div className="divide-y divide-[var(--divider)] border-t border-[var(--divider)]">
                      {socialsDraft.map((item, idx) => {
                        const optMeta = SOCIAL_PLATFORM_OPTIONS.find((o) => o.id === item.id);
                        return (
                          <div key={item.id} className="py-3.5 last:pb-0 space-y-2">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-xs font-semibold text-[var(--text-primary)]">
                                {item.label}
                              </span>
                              <div className="flex items-center gap-2.5">
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={item.enabled}
                                  onClick={() =>
                                    setSocialsDraft((prev) =>
                                      prev.map((s, i) =>
                                        i === idx ? { ...s, enabled: !s.enabled } : s
                                      )
                                    )
                                  }
                                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors cursor-pointer ${
                                    item.enabled ? 'bg-[var(--accent-primary)]' : 'bg-[var(--divider)]'
                                  }`}
                                >
                                  <span
                                    className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                                      item.enabled ? 'translate-x-5' : 'translate-x-0'
                                    }`}
                                  />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSocialsDraft((prev) => prev.filter((_, i) => i !== idx))
                                  }
                                  aria-label={`Remove ${item.label}`}
                                  className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg bg-[#E45B5B]/10 text-[#E45B5B] cursor-pointer"
                                >
                                  <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                                </button>
                              </div>
                            </div>
                            <input
                              type="text"
                              inputMode="url"
                              value={item.href}
                              onChange={(e) => {
                                const val = e.target.value;
                                setSocialsDraft((prev) =>
                                  prev.map((s, i) => (i === idx ? { ...s, href: val } : s))
                                );
                              }}
                              placeholder={optMeta?.placeholder || `${item.label} URL`}
                              aria-label={`${item.label} URL`}
                              className="w-full min-h-[42px] rounded-xl bg-[var(--bg-canvas)] border border-[var(--divider)] px-3.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-primary)]"
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Team Members Controls */}
              <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold">Team Members</h2>
                  <button
                    type="button"
                    onClick={handleAddTeamMember}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-[var(--accent-soft)] px-3 text-xs font-semibold text-[var(--accent-primary)] whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={2.2} />
                    Add Member
                  </button>
                </div>

                {teamDraft.length === 0 ? (
                  <div className="py-6 text-center text-xs text-[var(--text-secondary)] border-t border-[var(--divider)]">
                    No team members added yet
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[var(--divider)]">
                    {teamDraft.map((member, idx) => (
                      <div
                        key={member.id}
                        className="pb-5 border-b border-[var(--divider)] space-y-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="h-14 w-12 shrink-0 overflow-hidden rounded-xl border border-[var(--divider)] bg-[var(--bg-canvas)] flex items-center justify-center">
                              {member.image ? (
                                <img
                                  src={member.image}
                                  alt={member.name || 'Member'}
                                  referrerPolicy="no-referrer"
                                  className="h-full w-full object-cover object-top"
                                />
                              ) : (
                                <User className="h-5 w-5 text-[var(--text-secondary)] opacity-60" strokeWidth={1.75} />
                              )}
                            </div>
                            <label className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[var(--divider)] bg-[var(--bg-canvas)] px-3 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer">
                              <ImagePlus className="h-3.5 w-3.5" />
                              <span>{member.image ? 'Change Photo' : 'Upload Photo'}</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  e.target.value = '';
                                  void handlePhotoUpload(file, (url) =>
                                    setTeamDraft((prev) =>
                                      prev.map((m, i) =>
                                        i === idx ? { ...m, image: url } : m
                                      )
                                    )
                                  );
                                }}
                              />
                            </label>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMoveTeamMember(idx, -1)}
                              aria-label="Move up"
                              className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-xl border border-[var(--divider)] bg-[var(--bg-canvas)] text-[var(--text-secondary)] disabled:opacity-35 cursor-pointer"
                            >
                              <ArrowUp className="h-3.5 w-3.5" strokeWidth={2} />
                            </button>
                            <button
                              type="button"
                              disabled={idx === teamDraft.length - 1}
                              onClick={() => handleMoveTeamMember(idx, 1)}
                              aria-label="Move down"
                              className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-xl border border-[var(--divider)] bg-[var(--bg-canvas)] text-[var(--text-secondary)] disabled:opacity-35 cursor-pointer"
                            >
                              <ArrowDown className="h-3.5 w-3.5" strokeWidth={2} />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setTeamDraft((prev) => prev.filter((_, i) => i !== idx))
                              }
                              aria-label="Remove team member"
                              className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-xl bg-[#E45B5B]/10 text-[#E45B5B] cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" strokeWidth={2} />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <input
                            type="text"
                            value={member.name}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTeamDraft((prev) =>
                                prev.map((m, i) => (i === idx ? { ...m, name: val } : m))
                              );
                            }}
                            placeholder="Member name"
                            aria-label="Member name"
                            className="w-full min-h-[42px] rounded-xl bg-[var(--bg-canvas)] border border-[var(--divider)] px-3.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-primary)]"
                          />
                          <input
                            type="text"
                            value={member.role}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTeamDraft((prev) =>
                                prev.map((m, i) => (i === idx ? { ...m, role: val } : m))
                              );
                            }}
                            placeholder="Role / Title"
                            aria-label="Member role"
                            className="w-full min-h-[42px] rounded-xl bg-[var(--bg-canvas)] border border-[var(--divider)] px-3.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-primary)]"
                          />
                        </div>

                        <input
                          type="text"
                          inputMode="url"
                          value={member.image.startsWith('data:') ? '' : member.image}
                          onChange={(e) => {
                            const val = e.target.value;
                            setTeamDraft((prev) =>
                              prev.map((m, i) => (i === idx ? { ...m, image: val } : m))
                            );
                          }}
                          placeholder="Photo URL (optional)"
                          aria-label="Member photo URL"
                          className="w-full min-h-[42px] rounded-xl bg-[var(--bg-canvas)] border border-[var(--divider)] px-3.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-primary)]"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {aboutSyncError && (
                <div className="rounded-2xl bg-[#E45B5B]/10 border border-[#E45B5B]/30 p-4 text-xs text-[#E45B5B]">
                  {aboutSyncError}
                </div>
              )}

              {aboutJustSaved && !aboutSyncError && (
                <div className="flex items-center gap-2 rounded-2xl bg-[#2E7D32]/12 border border-[#2E7D32]/30 p-3.5 text-xs font-semibold text-[#2E7D32] dark:text-[#81C995]">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Saved — About App updated in real time
                </div>
              )}

              <button
                type="submit"
                disabled={aboutSaving}
                className="flex w-full sm:w-auto sm:min-w-[200px] min-h-[46px] items-center justify-center gap-2 rounded-xl bg-[var(--text-primary)] dark:bg-[var(--accent-primary)] px-6 text-sm font-semibold text-[var(--bg-card)] dark:text-[#171717] disabled:opacity-60 transition-opacity hover:opacity-90 cursor-pointer"
              >
                {aboutSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : aboutJustSaved ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Saved
                  </>
                ) : (
                  'Save About App'
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSave} className="max-w-2xl space-y-5">
              <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] p-5 sm:p-6 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold">Enable Preview Mode</h2>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    Guest and Free accounts can use Preview Mode until their timer expires.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  onClick={() => setEnabled((prev) => !prev)}
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

              <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] p-5 sm:p-6 space-y-4">
                <div>
                  <p className="text-sm font-semibold">Trial Duration</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    Set how many days a newly installed user can use the app for free.
                  </p>
                </div>

                <input
                  type="number"
                  min={1}
                  max={3650}
                  inputMode="numeric"
                  value={trialDaysDraft}
                  onChange={(e) => setTrialDaysDraft(e.target.value)}
                  placeholder="Free trial days (e.g. 7)"
                  aria-label="Free trial days after install"
                  className="w-full min-h-[48px] rounded-xl bg-[var(--bg-canvas)] border border-[var(--divider)] px-4 text-sm font-medium text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-primary)] tabular-nums"
                />
              </div>

              {previewSyncError && (
                <div className="rounded-2xl bg-[#E45B5B]/10 border border-[#E45B5B]/30 p-4 text-xs text-[#E45B5B]">
                  {previewSyncError}
                </div>
              )}

              {previewJustSaved && !previewSyncError && (
                <div className="flex items-center gap-2 rounded-2xl bg-[#2E7D32]/12 border border-[#2E7D32]/30 p-3.5 text-xs font-semibold text-[#2E7D32] dark:text-[#81C995]">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Saved — Preview Timer updated
                </div>
              )}

              <button
                type="submit"
                disabled={adminSaving}
                className="flex w-full sm:w-auto sm:min-w-[200px] min-h-[46px] items-center justify-center gap-2 rounded-xl bg-[var(--text-primary)] dark:bg-[var(--accent-primary)] px-6 text-sm font-semibold text-[var(--bg-card)] dark:text-[#171717] disabled:opacity-60 transition-opacity hover:opacity-90 cursor-pointer"
              >
                {adminSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : previewJustSaved ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Saved
                  </>
                ) : (
                  'Save Preview Timer'
                )}
              </button>
            </form>
          )}
        </main>
      </div>
    </div>
  );
}
