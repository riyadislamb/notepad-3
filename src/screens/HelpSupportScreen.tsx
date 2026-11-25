import React, { useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  FileText,
  HelpCircle,
  Loader2,
  Send,
  Shield,
} from 'lucide-react';
import { NavigationShell } from '../components/NavigationShell';
import { useNotes } from '../context/NotesContext';
import { submitSupportMessage } from '../services/supportService';

type SupportTab = 'help' | 'privacy' | 'terms';

const FAQS = [
  {
    q: 'How does auto-save work while writing?',
    a: 'Every edit to your note title, content, or images is saved automatically to your device within a fraction of a second.',
  },
  {
    q: 'What is included in the Free plan vs Premium?',
    a: 'Free includes up to 25 active notes, 4 folders, basic formatting, 1 image per note, and Light/Dark modes. Premium unlocks unlimited notes, unlimited folders, advanced formatting, curated themes, and PIN note lock.',
  },
  {
    q: 'How do I protect a sensitive note with a PIN?',
    a: 'With Notes Premium active, open any note menu and tap Lock Note to set a 4-digit PIN. Locked notes hide their preview until unlocked.',
  },
  {
    q: 'Can I switch between Light, Dark, and custom themes?',
    a: 'Light and Dark modes follow your device settings automatically. Go to Settings → Appearance to choose curated theme styles under Theme Mode.',
  },
];

export function HelpSupportScreen() {
  const { account, goBack, showToast } = useNotes();
  const [activeTab, setActiveTab] = useState<SupportTab>('help');
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [email, setEmail] = useState(
    account.isGuest === false && account.email ? account.email : ''
  );
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (account.isGuest === false && account.email && !email) {
      setEmail(account.email);
    }
  }, [account.email, account.isGuest, email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    try {
      await submitSupportMessage({
        userEmail: email,
        userName: account.isGuest === false ? account.name : 'Notes User',
        userUid: account.uid,
        subject,
        message,
      });
      setSubject('');
      setMessage('');
      showToast('Message sent to support');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Could not send message right now',
        'danger'
      );
    } finally {
      setSending(false);
    }
  };

  const tabs: {
    id: SupportTab;
    label: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  }[] = [
    { id: 'help', label: 'Help & FAQ', icon: HelpCircle },
    { id: 'privacy', label: 'Privacy Policy', icon: Shield },
    { id: 'terms', label: 'Terms', icon: FileText },
  ];

  return (
    <NavigationShell showMobileTabs={false}>
      <header className="sticky top-0 z-20 bg-[var(--bg-canvas)]/95 backdrop-blur-md px-4 sm:px-8 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goBack}
            aria-label="Back"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2} />
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            Help & Support
          </h1>
        </div>

        {/* Consolidated Support Section Switcher */}
        <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] p-1.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                  selected
                    ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]/60 hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      <section className="px-5 sm:px-8 pt-3 pb-12 space-y-6">
        {activeTab === 'help' && (
          <>
            <div>
              <h2 className="px-1 mb-2.5 text-xs font-semibold text-[var(--text-secondary)]">
                Frequently Asked Questions
              </h2>
              <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] divide-y divide-[var(--divider)]">
                {FAQS.map((item, idx) => {
                  const expanded = openIndex === idx;
                  return (
                    <div key={item.q}>
                      <button
                        type="button"
                        onClick={() => setOpenIndex(expanded ? null : idx)}
                        aria-expanded={expanded}
                        className="flex w-full min-h-[54px] items-center justify-between gap-3 px-4 py-3 text-left cursor-pointer"
                      >
                        <span className="text-sm font-medium text-[var(--text-primary)]">
                          {item.q}
                        </span>
                        <ChevronDown
                          className={`h-4 w-4 shrink-0 text-[var(--text-secondary)] transition-transform ${
                            expanded ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                      {expanded && (
                        <p className="px-4 pb-4 text-sm text-[var(--text-secondary)] leading-relaxed">
                          {item.a}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h2 className="px-1 mb-2.5 text-xs font-semibold text-[var(--text-secondary)]">
                Send Feedback
              </h2>
              <form
                onSubmit={handleSubmit}
                className="rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] p-4 space-y-3"
              >
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your email"
                  aria-label="Your email"
                  className="w-full min-h-[46px] rounded-xl bg-[var(--bg-canvas)] border border-[var(--divider)] px-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-primary)]"
                />

                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject"
                  aria-label="Subject"
                  className="w-full min-h-[46px] rounded-xl bg-[var(--bg-canvas)] border border-[var(--divider)] px-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-primary)]"
                />

                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your question or feedback..."
                  aria-label="Message"
                  rows={4}
                  className="w-full rounded-xl bg-[var(--bg-canvas)] border border-[var(--divider)] p-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-primary)] resize-none"
                />

                <button
                  type="submit"
                  disabled={sending || !email.trim() || !subject.trim() || !message.trim()}
                  className="flex w-full min-h-[46px] items-center justify-center gap-2 rounded-xl bg-[var(--text-primary)] dark:bg-[var(--accent-primary)] text-sm font-semibold text-[var(--bg-card)] dark:text-[#171717] disabled:opacity-40 cursor-pointer"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" strokeWidth={2} />
                  )}
                  {sending ? 'Sending...' : 'Send Message'}
                </button>
              </form>
            </div>
          </>
        )}

        {activeTab === 'privacy' && (
          <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
                <Shield className="h-4 w-4" strokeWidth={2} />
              </span>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                Privacy Policy
              </h2>
            </div>

            <div className="space-y-3 text-sm leading-relaxed text-[var(--text-secondary)]">
              <p>
                Notes stores your notes, folders, and preferences locally on your device. If you
                continue in Guest mode, nothing leaves your device unless you choose to translate a
                selected text snippet.
              </p>
              <p>
                If you sign in with Google, your display name, verified email, and profile photo are
                used only for your account profile, and Google Drive backups are saved exclusively to
                your own Drive file (
                <span className="font-medium text-[var(--text-primary)]">
                  notes-app-backup.json
                </span>
                ) only when you confirm a backup or restore action.
              </p>
              <p>
                Voice typing uses your device or browser speech recognition engine. You can sign out,
                export, or clear your local workspace data anytime from Settings or Account.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'terms' && (
          <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
                <FileText className="h-4 w-4" strokeWidth={2} />
              </span>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                Terms & Conditions
              </h2>
            </div>

            <div className="space-y-3 text-sm leading-relaxed text-[var(--text-secondary)]">
              <p>
                Notes is a personal writing and organization workspace. You retain full ownership and
                control of all notes, sketches, images, and folders you create inside the app.
              </p>
              <p>
                Google Sign-In and Google Drive backup are optional features for personal cloud
                backup. Translation relies on third-party translation endpoints only for the text you
                explicitly select to translate.
              </p>
              <p>
                Subscription billing and purchase restoration will connect to the configured payment
                provider once enabled.
              </p>
            </div>
          </div>
        )}
      </section>
    </NavigationShell>
  );
}
