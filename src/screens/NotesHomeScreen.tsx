import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  Archive,
  CheckSquare,
  ChevronRight,
  FileText,
  FolderPlus,
  Layers,
  Megaphone,
  MoreHorizontal,
  Pin,
  Plus,
  Search,
  SquarePen,
  Trash2,
  X,
} from 'lucide-react';
import { useBulkSelection } from '../components/BulkActionBar';
import { FolderNameDialog } from '../components/ConfirmDialog';
import { NavigationShell } from '../components/NavigationShell';
import { NoteCard } from '../components/NoteCard';
import { useBackHandler, useNotes } from '../context/NotesContext';
import { CV_GENERATION_FOLDER_ID } from '../data/initialData';

const DISMISSED_BANNER_KEY = 'notes_dismissed_announcement_at';

export function NotesHomeScreen() {
  const {
    activeNotes,
    folders,
    navigate,
    getFolderById,
    createNote,
    createFolder,
    deleteFolder,
    canCreateFolder,
    requestUpgrade,
    bulkDeleteNotes,
    canViewSubscriptionPage,
    appControlsConfig,
  } = useNotes();
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [menuOpen, setMenuOpen] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [folderActionTargetId, setFolderActionTargetId] = useState<string | null>(null);
  const [dismissedAt, setDismissedAt] = useState<string>(() => {
    try {
      return localStorage.getItem(DISMISSED_BANNER_KEY) || '';
    } catch {
      return '';
    }
  });
  const menuRef = useRef<HTMLDivElement>(null);
  const folderActionBarRef = useRef<HTMLDivElement>(null);
  const folderLongPressTimerRef = useRef<number | null>(null);
  const folderLongPressTriggeredRef = useRef(false);
  const folderPressStartRef = useRef<{ x: number; y: number } | null>(null);

  const announcement = appControlsConfig.announcement;
  const hasBannerText = Boolean(announcement.title || announcement.message);
  const showAnnouncement =
    announcement.enabled &&
    hasBannerText &&
    (!announcement.updatedAt || dismissedAt !== announcement.updatedAt);

  const handleDismissAnnouncement = () => {
    const stamp = announcement.updatedAt || 'dismissed';
    setDismissedAt(stamp);
    try {
      localStorage.setItem(DISMISSED_BANNER_KEY, stamp);
    } catch {
      // Ignore storage errors
    }
  };

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [menuOpen]);

  const filterTabs = useMemo(() => {
    const preferredOrder = ['Personal', 'Work', 'Ideas'];
    const ordered = folders
      .filter((f) => !f.isSystem && f.id !== CV_GENERATION_FOLDER_ID)
      .sort((a, b) => {
        const ia = preferredOrder.indexOf(a.name);
        const ib = preferredOrder.indexOf(b.name);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        return a.name.localeCompare(b.name);
      });
    return [{ id: 'all', name: 'All' }, ...ordered];
  }, [folders]);

  useEffect(() => {
    if (selectedFilter !== 'all' && !filterTabs.some((t) => t.id === selectedFilter)) {
      setSelectedFilter('all');
    }
  }, [filterTabs, selectedFilter]);

  const filteredNotes = useMemo(() => {
    if (selectedFilter === 'all') return activeNotes;
    return activeNotes.filter((n) => n.folderId === selectedFilter);
  }, [activeNotes, selectedFilter]);

  const visibleNoteIds = useMemo(() => filteredNotes.map((n) => n.id), [filteredNotes]);
  const bulk = useBulkSelection(visibleNoteIds);

  useEffect(() => {
    if (bulk.selectionMode) {
      setCreateMenuOpen(false);
      setFolderActionTargetId(null);
    }
  }, [bulk.selectionMode]);

  useBackHandler(Boolean(folderActionTargetId), () => setFolderActionTargetId(null));

  const folderActionTarget = useMemo(
    () =>
      folderActionTargetId
        ? folders.find(
            (f) =>
              f.id === folderActionTargetId &&
              !f.isSystem &&
              f.id !== CV_GENERATION_FOLDER_ID
          ) ?? null
        : null,
    [folderActionTargetId, folders]
  );

  useEffect(() => {
    if (folderActionTargetId && !folderActionTarget) {
      setFolderActionTargetId(null);
    }
  }, [folderActionTarget, folderActionTargetId]);

  useEffect(() => {
    if (!folderActionTargetId) return;
    const onOutside = (e: MouseEvent) => {
      if (
        folderActionBarRef.current &&
        !folderActionBarRef.current.contains(e.target as Node)
      ) {
        setFolderActionTargetId(null);
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [folderActionTargetId]);

  useEffect(() => {
    return () => {
      if (folderLongPressTimerRef.current !== null) {
        window.clearTimeout(folderLongPressTimerRef.current);
      }
    };
  }, []);

  const clearFolderLongPress = () => {
    if (folderLongPressTimerRef.current !== null) {
      window.clearTimeout(folderLongPressTimerRef.current);
      folderLongPressTimerRef.current = null;
    }
    folderPressStartRef.current = null;
  };

  const handleQuickCreate = () => {
    const folderId = selectedFilter !== 'all' ? selectedFilter : undefined;
    const note = createNote(folderId ? { folderId } : undefined);
    if (note) {
      navigate('create-note', { noteId: note.id });
    }
  };

  const handleOpenNewFolder = () => {
    setCreateMenuOpen(false);
    if (!canCreateFolder) {
      requestUpgrade(
        `Free plan supports up to ${appControlsConfig.freeLimits.maxFolders} folders. Upgrade to Notes Premium for unlimited folders.`
      );
      return;
    }
    setNewFolderOpen(true);
  };

  return (
    <NavigationShell
      showMobileTabs
      showFab={!bulk.selectionMode}
      fabFolderId={selectedFilter !== 'all' ? selectedFilter : undefined}
      fabOpen={createMenuOpen}
      onFabClick={() => setCreateMenuOpen((v) => !v)}
    >
      <header className="sticky top-0 z-20 bg-[var(--bg-canvas)]/95 backdrop-blur-md px-5 sm:px-8 pt-5 pb-3">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            Notes
          </h1>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => navigate('search')}
              aria-label="Search notes"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
            >
              <Search className="h-5 w-5" strokeWidth={1.85} />
            </button>

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="More options"
                aria-expanded={menuOpen}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
              >
                <MoreHorizontal className="h-5 w-5" strokeWidth={1.85} />
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-1.5 w-52 rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] py-1.5 z-40">
                  {filteredNotes.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        bulk.enterSelectionMode();
                      }}
                      className="flex w-full min-h-[42px] items-center gap-2.5 px-4 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
                    >
                      <CheckSquare className="h-4 w-4 text-[var(--accent-primary)]" strokeWidth={1.8} />
                      Select Notes
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      navigate('all-notes');
                    }}
                    className="flex w-full min-h-[42px] items-center gap-2.5 px-4 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
                  >
                    <Layers className="h-4 w-4 text-[var(--text-secondary)]" strokeWidth={1.8} />
                    All Notes
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      navigate('pinned-notes');
                    }}
                    className="flex w-full min-h-[42px] items-center gap-2.5 px-4 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
                  >
                    <Pin className="h-4 w-4 text-[var(--accent-primary)]" strokeWidth={1.8} />
                    Pinned Notes
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      navigate('archive');
                    }}
                    className="flex w-full min-h-[42px] items-center gap-2.5 px-4 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
                  >
                    <Archive className="h-4 w-4 text-[var(--text-secondary)]" strokeWidth={1.8} />
                    Archived Notes
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      navigate('trash');
                    }}
                    className="flex w-full min-h-[42px] items-center gap-2.5 px-4 text-sm text-[#E45B5B] hover:bg-[var(--bg-subtle)] cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                    Trash
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {bulk.selectionMode ? (
          <div
            role="region"
            aria-label="Selection actions"
            className="mt-3 flex items-center justify-between gap-2 pb-1"
          >
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={bulk.clearSelection}
                aria-label="Exit selection"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--bg-card)] border border-[var(--divider)] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
              >
                <X className="h-4 w-4" strokeWidth={2.2} />
              </button>
              <span className="text-sm font-semibold text-[var(--text-primary)] tabular-nums truncate">
                {bulk.selectedCount} selected
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={bulk.toggleSelectAll}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-[var(--bg-card)] border border-[var(--divider)] px-3.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--accent-soft)] cursor-pointer"
              >
                <CheckSquare className="h-3.5 w-3.5 text-[var(--accent-primary)]" strokeWidth={2} />
                <span>{bulk.allSelected ? 'Clear All' : 'Select All'}</span>
              </button>

              <button
                type="button"
                disabled={bulk.selectedIds.length === 0}
                onClick={() => {
                  bulkDeleteNotes(bulk.selectedIds);
                  bulk.clearSelection();
                }}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-[#E45B5B]/12 px-3.5 text-xs font-semibold text-[#E45B5B] hover:bg-[#E45B5B]/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                <span>Delete</span>
              </button>
            </div>
          </div>
        ) : (
          <div ref={folderActionBarRef}>
            <div
              className="mt-3 flex items-center gap-2 overflow-x-auto no-scrollbar pb-1"
              role="tablist"
              aria-label="Filter notes by folder"
            >
              {filterTabs.map((tab) => {
                const active = selectedFilter === tab.id;
                const isFolder = tab.id !== 'all';
                const isDeleteTarget = isFolder && folderActionTarget?.id === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onPointerDown={(e) => {
                      if (!isFolder || (e.pointerType === 'mouse' && e.button !== 0)) return;
                      clearFolderLongPress();
                      folderLongPressTriggeredRef.current = false;
                      folderPressStartRef.current = { x: e.clientX, y: e.clientY };
                      folderLongPressTimerRef.current = window.setTimeout(() => {
                        folderLongPressTimerRef.current = null;
                        folderLongPressTriggeredRef.current = true;
                        setFolderActionTargetId(tab.id);
                      }, 450);
                    }}
                    onPointerMove={(e) => {
                      if (!folderPressStartRef.current || folderLongPressTimerRef.current === null) {
                        return;
                      }
                      const dist = Math.hypot(
                        e.clientX - folderPressStartRef.current.x,
                        e.clientY - folderPressStartRef.current.y
                      );
                      if (dist > 10) {
                        clearFolderLongPress();
                      }
                    }}
                    onPointerUp={clearFolderLongPress}
                    onPointerCancel={clearFolderLongPress}
                    onContextMenu={(e) => {
                      if (!isFolder) return;
                      e.preventDefault();
                      clearFolderLongPress();
                      setFolderActionTargetId(tab.id);
                    }}
                    onClick={() => {
                      if (folderLongPressTriggeredRef.current) {
                        folderLongPressTriggeredRef.current = false;
                        return;
                      }
                      setFolderActionTargetId(null);
                      setSelectedFilter(tab.id);
                    }}
                    className={`min-h-[36px] px-4 rounded-full text-[13px] font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer select-none ${
                      isDeleteTarget
                        ? 'bg-[#E45B5B]/15 text-[#E45B5B] border-2 border-[#E45B5B]'
                        : active
                          ? 'bg-[var(--text-primary)] text-[var(--bg-card)] dark:bg-[var(--accent-primary)] dark:text-[#171717]'
                          : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--divider)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {tab.name}
                  </button>
                );
              })}
            </div>

            {folderActionTarget && (
              <div
                role="region"
                aria-label="Folder actions"
                className="mt-2 flex items-center justify-between gap-2 rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={() => setFolderActionTargetId(null)}
                    aria-label="Cancel folder delete"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
                  >
                    <X className="h-4 w-4" strokeWidth={2.2} />
                  </button>
                  <span className="text-xs sm:text-sm font-medium text-[var(--text-primary)] truncate">
                    {folderActionTarget.name}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    deleteFolder(folderActionTarget.id);
                    setFolderActionTargetId(null);
                  }}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-[#E45B5B] px-3.5 text-xs font-semibold text-white hover:opacity-90 cursor-pointer shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      <section className="px-4 sm:px-8 pt-2 space-y-2.5">
        {showAnnouncement && (
          <div className="rounded-2xl bg-[var(--accent-soft)]/70 border border-[var(--accent-primary)]/30 p-4 flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-primary)] text-white dark:text-[#171717]">
              <Megaphone className="h-4 w-4" strokeWidth={2.1} />
            </div>

            <div className="min-w-0 flex-1">
              {announcement.title && (
                <p className="text-sm font-semibold text-[var(--text-primary)] leading-snug">
                  {announcement.title}
                </p>
              )}
              {announcement.message && (
                <p className="mt-0.5 text-xs text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
                  {announcement.message}
                </p>
              )}
              {announcement.actionTarget !== 'none' &&
                announcement.actionLabel &&
                !(announcement.actionTarget === 'premium' && !canViewSubscriptionPage) && (() => {
                const targetScreen = announcement.actionTarget;
                return (
                  <button
                    type="button"
                    onClick={() => navigate(targetScreen)}
                    className="mt-2.5 inline-flex min-h-[32px] items-center gap-1 rounded-xl bg-[var(--text-primary)] dark:bg-[var(--accent-primary)] px-3 text-xs font-semibold text-[var(--bg-card)] dark:text-[#171717] cursor-pointer hover:opacity-90 transition-opacity"
                  >
                    <span>{announcement.actionLabel}</span>
                    <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.2} />
                  </button>
                );
              })()}
            </div>

            <button
              type="button"
              onClick={handleDismissAnnouncement}
              aria-label="Dismiss announcement"
              className="min-h-[32px] min-w-[32px] -mr-1 -mt-1 flex items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-card)]/60 hover:text-[var(--text-primary)] transition-colors cursor-pointer shrink-0"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        )}

        {filteredNotes.length === 0 ? (
          <div className="mt-16 flex flex-col items-center justify-center text-center px-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] text-[var(--text-secondary)]">
              <FileText className="h-6 w-6" strokeWidth={1.6} />
            </div>
            <h2 className="mt-4 text-base font-semibold text-[var(--text-primary)]">
              No notes here yet
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)] max-w-xs">
              Tap the button below to capture a new note in this view.
            </p>
            <button
              type="button"
              onClick={handleQuickCreate}
              className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[var(--text-primary)] dark:bg-[var(--accent-primary)] px-5 text-sm font-semibold text-[var(--bg-card)] dark:text-[#171717] cursor-pointer"
            >
              <Plus className="h-4 w-4" strokeWidth={2.2} />
              New Note
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {filteredNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                folder={getFolderById(note.folderId)}
                previewLines={1}
                highlightedBorder
                selectionMode={bulk.selectionMode}
                selected={bulk.isSelected(note.id)}
                onLongPress={() => bulk.startSelection(note.id)}
                onClick={() =>
                  bulk.selectionMode
                    ? bulk.toggleSelect(note.id)
                    : navigate('note-details', { noteId: note.id })
                }
              />
            ))}
          </div>
        )}
      </section>

      {createMenuOpen && !bulk.selectionMode && (
        <>
          <div
            className="fixed inset-0 z-[25] bg-black/20 backdrop-blur-[1px]"
            onClick={() => setCreateMenuOpen(false)}
            aria-hidden="true"
          />
          <div
            role="menu"
            aria-label="Create options"
            className="fixed right-5 bottom-36 lg:right-auto lg:bottom-auto lg:left-6 lg:top-28 z-[35] w-52 rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] p-1.5 shadow-lg"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setCreateMenuOpen(false);
                navigate('cv-generator');
              }}
              className="flex w-full min-h-[44px] items-center gap-3 rounded-xl px-3.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
            >
              <FileText className="h-4 w-4 text-[var(--accent-primary)] shrink-0" strokeWidth={1.9} />
              <span>Cv Generation</span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={handleOpenNewFolder}
              className="flex w-full min-h-[44px] items-center gap-3 rounded-xl px-3.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
            >
              <FolderPlus className="h-4 w-4 text-[var(--accent-primary)] shrink-0" strokeWidth={1.9} />
              <span>New Folder</span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setCreateMenuOpen(false);
                handleQuickCreate();
              }}
              className="flex w-full min-h-[44px] items-center gap-3 rounded-xl px-3.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
            >
              <SquarePen className="h-4 w-4 text-[var(--accent-primary)] shrink-0" strokeWidth={1.9} />
              <span>Create Notes</span>
            </button>
          </div>
        </>
      )}

      <FolderNameDialog
        open={newFolderOpen}
        title="New Folder"
        confirmLabel="Create"
        onSubmit={(name) => {
          const created = createFolder(name);
          if (created) {
            setSelectedFilter(created.id);
          }
        }}
        onClose={() => setNewFolderOpen(false)}
      />
    </NavigationShell>
  );
}
