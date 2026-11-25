import React from 'react';
import {
  Archive,
  Crown,
  FileText,
  Layers,
  Pin,
  Plus,
  Search,
  Settings,
  Star,
  Trash2,
} from 'lucide-react';
import { useNotes } from '../context/NotesContext';
import { CV_GENERATION_FOLDER_ID } from '../data/initialData';
import { ScreenName } from '../types/notes';

interface NavigationShellProps {
  children: React.ReactNode;
  showMobileTabs?: boolean;
  showFab?: boolean;
  fabFolderId?: string;
  onFabClick?: () => void;
  fabOpen?: boolean;
  noPaddingBottom?: boolean;
}

export function NavigationShell({
  children,
  showMobileTabs = true,
  showFab = false,
  fabFolderId,
  onFabClick,
  fabOpen = false,
  noPaddingBottom = false,
}: NavigationShellProps) {
  const {
    screen,
    navigate,
    activeNotes,
    pinnedNotes,
    favoriteNotes,
    archivedNotes,
    trashedNotes,
    createNote,
    isPremium,
    canViewSubscriptionPage,
    appControlsConfig,
  } = useNotes();

  const isCvTarget = fabFolderId === CV_GENERATION_FOLDER_ID;

  const handleNewNote = () => {
    if (onFabClick) {
      onFabClick();
      return;
    }
    if (isCvTarget) {
      navigate('cv-generator');
      return;
    }
    const note = createNote(fabFolderId ? { folderId: fabFolderId } : undefined);
    if (note) {
      navigate('create-note', { noteId: note.id });
    }
  };

  const primaryDesktopNav: {
    id: ScreenName;
    label: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    count?: number;
  }[] = [
    { id: 'home', label: 'Notes', icon: FileText, count: activeNotes.length },
    { id: 'all-notes', label: 'All Notes', icon: Layers, count: activeNotes.length },
    { id: 'pinned-notes', label: 'Pinned', icon: Pin, count: pinnedNotes.length },
    { id: 'favorites', label: 'Favorites', icon: Star, count: favoriteNotes.length },
    { id: 'archive', label: 'Archived', icon: Archive, count: archivedNotes.length },
    { id: 'trash', label: 'Trash', icon: Trash2, count: trashedNotes.length },
  ];

  const mobileTabs: {
    id: ScreenName;
    label: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  }[] = [
    { id: 'home', label: 'Notes', icon: FileText },
    { id: 'favorites', label: 'Favorites', icon: Star },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const isTabActive = (tabId: ScreenName) => {
    if (tabId === 'home') {
      return (
        screen === 'home' ||
        screen === 'all-notes' ||
        screen === 'pinned-notes' ||
        screen === 'cv-generator'
      );
    }
    if (tabId === 'settings') {
      return (
        screen === 'settings' ||
        screen === 'appearance' ||
        screen === 'account' ||
        screen === 'premium' ||
        screen === 'help' ||
        screen === 'about'
      );
    }
    return screen === tabId;
  };

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-[var(--divider)] bg-[var(--bg-canvas)] px-4 py-6">
        <div className="flex items-center justify-between px-2 mb-5">
          <button
            type="button"
            onClick={() => navigate('home')}
            className="flex items-center gap-2.5 text-left cursor-pointer"
          >
            <img
              src="/assets/aistudio/Applogo.png"
              alt="Notes"
              referrerPolicy="no-referrer"
              className="h-8 w-8 object-contain shrink-0"
            />
            <span className="text-lg font-bold tracking-tight text-[var(--text-primary)]">
              Notes
            </span>
          </button>

          <button
            type="button"
            onClick={() => navigate('search')}
            aria-label="Search notes"
            className={`min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl transition-colors cursor-pointer ${
              screen === 'search'
                ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]'
            }`}
          >
            <Search className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <button
          type="button"
          onClick={handleNewNote}
          className="mb-6 flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--text-primary)] dark:bg-[var(--accent-primary)] px-4 text-sm font-semibold text-[var(--bg-card)] dark:text-[#171717] transition-opacity hover:opacity-90 cursor-pointer"
        >
          <Plus className="h-4 w-4" strokeWidth={2.2} />
          <span>{isCvTarget ? 'Create CV' : 'New Note'}</span>
        </button>

        <nav className="flex-1 space-y-1 overflow-y-auto no-scrollbar" aria-label="Primary navigation">
          {primaryDesktopNav.map((item) => {
            const Icon = item.icon;
            const active = screen === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.id)}
                className={`flex w-full min-h-[40px] items-center justify-between rounded-xl px-3 text-sm font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-[var(--accent-soft)] text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <Icon
                    className={`h-4 w-4 shrink-0 ${active ? 'text-[var(--accent-primary)]' : ''}`}
                    strokeWidth={active ? 2.1 : 1.75}
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                {typeof item.count === 'number' && item.count > 0 && (
                  <span className="text-xs text-[var(--text-secondary)] tabular-nums">
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="pt-4 mt-4 border-t border-[var(--divider)] space-y-1">
          {canViewSubscriptionPage && (
            <button
              type="button"
              onClick={() => navigate('premium')}
              className={`flex w-full min-h-[40px] items-center justify-between rounded-xl px-3 text-sm font-medium transition-colors cursor-pointer ${
                screen === 'premium'
                  ? 'bg-[var(--accent-soft)] text-[var(--text-primary)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Crown className="h-4 w-4 text-[var(--accent-primary)]" strokeWidth={1.9} />
                <span>{isPremium ? 'Premium Active' : 'Upgrade'}</span>
              </span>
              {!isPremium && (
                <span className="text-[11px] text-[var(--text-secondary)] tabular-nums">
                  {activeNotes.length}/{appControlsConfig.freeLimits.maxActiveNotes}
                </span>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => navigate('settings')}
            className={`flex w-full min-h-[40px] items-center gap-2.5 rounded-xl px-3 text-sm font-medium transition-colors cursor-pointer ${
              isTabActive('settings') && screen !== 'premium'
                ? 'bg-[var(--accent-soft)] text-[var(--text-primary)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Settings
              className={`h-4 w-4 ${
                isTabActive('settings') && screen !== 'premium' ? 'text-[var(--accent-primary)]' : ''
              }`}
              strokeWidth={1.8}
            />
            <span>Settings</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 lg:pl-64 min-w-0">
        <div
          className={`mx-auto w-full max-w-4xl ${
            noPaddingBottom ? 'pb-0' : showMobileTabs ? 'pb-24 lg:pb-12' : 'pb-8'
          }`}
        >
          {children}
        </div>
      </main>

      {/* Floating + Action Button */}
      {showFab && (
        <button
          type="button"
          onClick={handleNewNote}
          aria-label={onFabClick ? (fabOpen ? 'Close create menu' : 'Open create menu') : isCvTarget ? 'Create CV' : 'Create new note'}
          aria-expanded={onFabClick ? fabOpen : undefined}
          className={`fixed right-5 z-30 flex h-13 w-13 items-center justify-center rounded-full bg-[var(--text-primary)] dark:bg-[var(--accent-primary)] text-[var(--bg-card)] dark:text-[#171717] transition-transform active:scale-95 cursor-pointer lg:hidden ${
            showMobileTabs ? 'bottom-20' : 'bottom-6'
          }`}
        >
          <Plus
            className={`h-6 w-6 transition-transform duration-200 ${fabOpen ? 'rotate-45' : ''}`}
            strokeWidth={2.2}
          />
        </button>
      )}

      {/* Mobile Bottom Tab Navigation */}
      {showMobileTabs && (
        <nav
          aria-label="Bottom navigation"
          className="fixed bottom-0 left-0 right-0 z-30 border-t border-[var(--divider)] bg-[var(--bg-card)]/95 backdrop-blur-md lg:hidden"
        >
          <div className="mx-auto grid max-w-lg grid-cols-3 h-16 items-center">
            {mobileTabs.map((tab) => {
              const Icon = tab.icon;
              const active = isTabActive(tab.id);
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => navigate(tab.id)}
                  className="flex min-h-[44px] flex-col items-center justify-center gap-1 cursor-pointer"
                >
                  <Icon
                    className={`h-5 w-5 transition-colors ${
                      active ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'
                    }`}
                    strokeWidth={active ? 2.2 : 1.75}
                  />
                  <span
                    className={`text-[11px] font-medium whitespace-nowrap ${
                      active ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
