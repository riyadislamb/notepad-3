import React, { useEffect, useRef, useState } from 'react';
import {
  Archive,
  ChevronRight,
  Edit2,
  FileText,
  Folder as FolderIcon,
  FolderPlus,
  Lock,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { ConfirmDialog, FolderNameDialog } from '../components/ConfirmDialog';
import { NavigationShell } from '../components/NavigationShell';
import { useNotes } from '../context/NotesContext';
import { CV_GENERATION_FOLDER_ID } from '../data/initialData';
import { Folder } from '../types/notes';

export function FoldersScreen() {
  const {
    folders,
    archivedNotes,
    trashedNotes,
    getFolderNoteCount,
    createFolder,
    renameFolder,
    deleteFolder,
    canCreateFolder,
    isPremium,
    appControlsConfig,
    requestUpgrade,
    navigate,
  } = useNotes();

  const maxFoldersLimit = appControlsConfig.freeLimits.maxFolders;
  const customFoldersCount = folders.filter(
    (f) => !f.isSystem && f.id !== CV_GENERATION_FOLDER_ID
  ).length;
  const [createOpen, setCreateOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Folder | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Folder | null>(null);
  const [menuFolderId, setMenuFolderId] = useState<string | null>(null);
  const [heldFolderId, setHeldFolderId] = useState<string | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const pressStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current !== null) {
        window.clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  const clearLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    pressStartRef.current = null;
  };

  const handleOpenCreateFolder = () => {
    if (!canCreateFolder) {
      requestUpgrade(
        `Free plan supports up to ${maxFoldersLimit} folders. Upgrade to Notes Premium for unlimited folders.`
      );
      return;
    }
    setCreateOpen(true);
  };

  return (
    <NavigationShell showMobileTabs showFab={false}>
      <header className="sticky top-0 z-20 bg-[var(--bg-canvas)]/95 backdrop-blur-md px-5 sm:px-8 pt-5 pb-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            Folders
          </h1>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => navigate('search')}
              aria-label="Search folders"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
            >
              <Search className="h-5 w-5" strokeWidth={1.85} />
            </button>
            <button
              type="button"
              onClick={handleOpenCreateFolder}
              aria-label="New folder"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
            >
              <FolderPlus className="h-5 w-5" strokeWidth={1.85} />
            </button>
          </div>
        </div>

        {!isPremium && (
          <p className="mt-1 text-xs text-[var(--text-secondary)] tabular-nums">
            {customFoldersCount} of {maxFoldersLimit} folders used on Free plan
          </p>
        )}
      </header>

      <section className="px-5 sm:px-8 pt-2 space-y-6">
        {folders.length === 0 ? (
          <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] p-7 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
              <FolderIcon className="h-6 w-6" strokeWidth={1.75} />
            </div>
            <h2 className="mt-3.5 text-base font-semibold text-[var(--text-primary)]">
              No folders yet
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Create your first folder to organize notes by topic.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] divide-y divide-[var(--divider)]">
            {folders.map((folder) => {
              const count = getFolderNoteCount(folder.id);
              const isMenuOpen = menuFolderId === folder.id;
              const isSystemFolder = Boolean(
                folder.isSystem || folder.id === CV_GENERATION_FOLDER_ID
              );

              const isHeld = !isSystemFolder && heldFolderId === folder.id;

              return (
                <div
                  key={folder.id}
                  className={`relative flex items-center transition-colors ${
                    isHeld ? 'bg-[#E45B5B]/8' : ''
                  }`}
                >
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      if (isSystemFolder || (e.pointerType === 'mouse' && e.button !== 0)) return;
                      clearLongPress();
                      longPressTriggeredRef.current = false;
                      pressStartRef.current = { x: e.clientX, y: e.clientY };
                      longPressTimerRef.current = window.setTimeout(() => {
                        longPressTimerRef.current = null;
                        longPressTriggeredRef.current = true;
                        setMenuFolderId(null);
                        setHeldFolderId(folder.id);
                      }, 450);
                    }}
                    onPointerMove={(e) => {
                      if (!pressStartRef.current || longPressTimerRef.current === null) return;
                      if (
                        Math.hypot(
                          e.clientX - pressStartRef.current.x,
                          e.clientY - pressStartRef.current.y
                        ) > 10
                      ) {
                        clearLongPress();
                      }
                    }}
                    onPointerUp={clearLongPress}
                    onPointerCancel={clearLongPress}
                    onContextMenu={(e) => {
                      if (isSystemFolder) return;
                      e.preventDefault();
                      clearLongPress();
                      setMenuFolderId(null);
                      setHeldFolderId(folder.id);
                    }}
                    onClick={() => {
                      if (longPressTriggeredRef.current) {
                        longPressTriggeredRef.current = false;
                        return;
                      }
                      if (heldFolderId) {
                        setHeldFolderId(null);
                        return;
                      }
                      navigate('folder-details', { folderId: folder.id });
                    }}
                    className="flex flex-1 min-h-[58px] items-center justify-between px-4 py-3 text-left hover:bg-[var(--bg-subtle)]/60 transition-colors cursor-pointer rounded-2xl select-none"
                  >
                    <span className="flex items-center gap-3.5 min-w-0">
                      {isSystemFolder ? (
                        <FileText
                          className="h-5 w-5 shrink-0 text-[var(--accent-primary)]"
                          strokeWidth={1.85}
                        />
                      ) : (
                        <FolderIcon
                          className={`h-5 w-5 shrink-0 ${
                            isHeld ? 'text-[#E45B5B]' : 'text-[var(--accent-primary)]'
                          }`}
                          strokeWidth={1.85}
                        />
                      )}
                      <span className="text-[15px] font-medium text-[var(--text-primary)] truncate">
                        {folder.name}
                      </span>
                    </span>

                    <span className="flex items-center gap-2 shrink-0 text-sm text-[var(--text-secondary)] tabular-nums">
                      <span>{count}</span>
                      {!isHeld && <ChevronRight className="h-4 w-4" strokeWidth={1.75} />}
                    </span>
                  </button>

                  {isHeld ? (
                    <div className="pr-3 flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          deleteFolder(folder.id);
                          setHeldFolderId(null);
                        }}
                        className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full bg-[#E45B5B] px-3 text-xs font-semibold text-white hover:opacity-90 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                        <span>Delete</span>
                      </button>
                    </div>
                  ) : (
                    !isSystemFolder && (
                      <div className="pr-2 relative">
                        <button
                          type="button"
                          onClick={() => setMenuFolderId(isMenuOpen ? null : folder.id)}
                          aria-label={`Options for ${folder.name}`}
                          className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>

                      {isMenuOpen && (
                        <div
                          onMouseLeave={() => setMenuFolderId(null)}
                          className="absolute right-2 top-11 w-40 rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] py-1.5 z-40"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setMenuFolderId(null);
                              setRenameTarget(folder);
                            }}
                            className="flex w-full min-h-[40px] items-center gap-2.5 px-3.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
                          >
                            <Edit2 className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                            Rename
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setMenuFolderId(null);
                              setDeleteTarget(folder);
                            }}
                            className="flex w-full min-h-[40px] items-center gap-2.5 px-3.5 text-sm text-[#E45B5B] hover:bg-[var(--bg-subtle)] cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                    )
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] divide-y divide-[var(--divider)]">
          <button
            type="button"
            onClick={() => navigate('archive')}
            className="flex w-full min-h-[56px] items-center justify-between px-4 py-3 text-left hover:bg-[var(--bg-subtle)]/60 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-3.5">
              <Archive className="h-5 w-5 text-[var(--text-secondary)]" strokeWidth={1.8} />
              <span className="text-[15px] font-medium text-[var(--text-primary)]">Archived</span>
            </span>
            <span className="flex items-center gap-2 text-sm text-[var(--text-secondary)] tabular-nums">
              <span>{archivedNotes.length}</span>
              <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
            </span>
          </button>

          <button
            type="button"
            onClick={() => navigate('trash')}
            className="flex w-full min-h-[56px] items-center justify-between px-4 py-3 text-left hover:bg-[var(--bg-subtle)]/60 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-3.5">
              <Trash2 className="h-5 w-5 text-[#E45B5B]" strokeWidth={1.8} />
              <span className="text-[15px] font-medium text-[var(--text-primary)]">Trash</span>
            </span>
            <span className="flex items-center gap-2 text-sm text-[var(--text-secondary)] tabular-nums">
              <span>{trashedNotes.length}</span>
              <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={handleOpenCreateFolder}
          className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--accent-primary)]/60 bg-[var(--accent-soft)]/60 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--accent-soft)] transition-colors cursor-pointer"
        >
          {!canCreateFolder ? (
            <Lock className="h-4 w-4 text-[var(--accent-primary)]" strokeWidth={2} />
          ) : (
            <Plus className="h-4 w-4 text-[var(--accent-primary)]" strokeWidth={2.2} />
          )}
          New Folder
        </button>
      </section>

      <FolderNameDialog
        open={createOpen}
        title="New Folder"
        confirmLabel="Create"
        onSubmit={(name) => createFolder(name)}
        onClose={() => setCreateOpen(false)}
      />

      <FolderNameDialog
        open={Boolean(renameTarget)}
        title="Rename Folder"
        initialValue={renameTarget?.name ?? ''}
        confirmLabel="Rename"
        onSubmit={(name) => {
          if (renameTarget) renameFolder(renameTarget.id, name);
        }}
        onClose={() => setRenameTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={`Delete "${deleteTarget?.name}"?`}
        description="Notes inside this folder will remain safely accessible in All Notes."
        confirmLabel="Delete Folder"
        onConfirm={() => {
          if (deleteTarget) deleteFolder(deleteTarget.id);
        }}
        onClose={() => setDeleteTarget(null)}
      />
    </NavigationShell>
  );
}
