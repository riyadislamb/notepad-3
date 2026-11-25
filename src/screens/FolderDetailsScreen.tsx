import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  Edit2,
  FileText,
  Folder as FolderIcon,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { BulkActionBar, useBulkSelection } from '../components/BulkActionBar';
import { ConfirmDialog, FolderNameDialog } from '../components/ConfirmDialog';
import { NavigationShell } from '../components/NavigationShell';
import { NoteCard } from '../components/NoteCard';
import { useNotes } from '../context/NotesContext';
import { CV_GENERATION_FOLDER_ID } from '../data/initialData';

export function FolderDetailsScreen() {
  const {
    activeFolderId,
    activeNotes,
    getFolderById,
    renameFolder,
    deleteFolder,
    createNote,
    navigate,
    goBack,
  } = useNotes();

  const folder = activeFolderId ? getFolderById(activeFolderId) : undefined;
  const isCvFolder = Boolean(
    folder && (folder.isSystem || folder.id === CV_GENERATION_FOLDER_ID)
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [menuOpen]);

  const folderNotes = useMemo(
    () => (folder ? activeNotes.filter((n) => n.folderId === folder.id) : []),
    [activeNotes, folder]
  );

  const visibleNoteIds = useMemo(() => folderNotes.map((n) => n.id), [folderNotes]);
  const bulk = useBulkSelection(visibleNoteIds);

  if (!folder) {
    return (
      <NavigationShell showMobileTabs>
        <div className="p-8 text-center">
          <p className="text-sm text-[var(--text-secondary)]">Folder not found.</p>
          <button
            type="button"
            onClick={() => navigate('folders')}
            className="mt-4 min-h-[44px] rounded-full bg-[var(--text-primary)] dark:bg-[var(--accent-primary)] px-5 text-sm font-semibold text-[var(--bg-card)] dark:text-[#171717] cursor-pointer"
          >
            Back to Folders
          </button>
        </div>
      </NavigationShell>
    );
  }

  const handleNewNoteInFolder = () => {
    if (isCvFolder) {
      navigate('cv-generator');
      return;
    }
    const note = createNote({ folderId: folder.id });
    if (note) {
      navigate('create-note', { noteId: note.id });
    }
  };

  return (
    <NavigationShell
      showMobileTabs
      showFab={!bulk.selectionMode}
      fabFolderId={folder.id}
    >
      <header className="sticky top-0 z-20 bg-[var(--bg-canvas)]/95 backdrop-blur-md px-4 sm:px-8 pt-5 pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={goBack}
              aria-label="Back"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer shrink-0"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={2} />
            </button>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)] truncate">
              {folder.name}
            </h1>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => navigate('search')}
              aria-label="Search"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
            >
              <Search className="h-5 w-5" strokeWidth={1.85} />
            </button>

            {isCvFolder ? (
              <button
                type="button"
                onClick={() => navigate('cv-generator')}
                aria-label="Create CV"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-[var(--accent-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
              >
                <Plus className="h-5 w-5" strokeWidth={2.1} />
              </button>
            ) : (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-label="Folder options"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
                >
                  <MoreHorizontal className="h-5 w-5" strokeWidth={1.85} />
                </button>

                {menuOpen && (
                  <div className="absolute right-0 mt-1.5 w-44 rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] py-1.5 z-40">
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        setRenameOpen(true);
                      }}
                      className="flex w-full min-h-[42px] items-center gap-2.5 px-4 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
                    >
                      <Edit2 className="h-4 w-4 text-[var(--text-secondary)]" strokeWidth={1.8} />
                      Rename Folder
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        setDeleteOpen(true);
                      }}
                      className="flex w-full min-h-[42px] items-center gap-2.5 px-4 text-sm text-[#E45B5B] hover:bg-[var(--bg-subtle)] cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                      Delete Folder
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <p className="mt-1 text-xs text-[var(--text-secondary)] pl-12 tabular-nums">
          {folderNotes.length} {isCvFolder ? (folderNotes.length === 1 ? 'CV' : 'CVs') : folderNotes.length === 1 ? 'note' : 'notes'}
        </p>
      </header>

      <section className="px-5 sm:px-8 pt-3 space-y-4">
        {folderNotes.length === 0 ? (
          <div className="mt-16 flex flex-col items-center text-center px-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] text-[var(--accent-primary)]">
              {isCvFolder ? (
                <FileText className="h-6 w-6" strokeWidth={1.75} />
              ) : (
                <FolderIcon className="h-6 w-6" strokeWidth={1.75} />
              )}
            </div>
            <h2 className="mt-4 text-base font-semibold">
              {isCvFolder ? 'No CV generated yet' : 'This folder is empty'}
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)] max-w-xs">
              {isCvFolder
                ? 'Tap + to fill out the CV form. Your generated CV will appear here.'
                : `Add a new note directly into ${folder.name}.`}
            </p>
            <button
              type="button"
              onClick={handleNewNoteInFolder}
              className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[var(--text-primary)] dark:bg-[var(--accent-primary)] px-5 text-sm font-semibold text-[var(--bg-card)] dark:text-[#171717] cursor-pointer"
            >
              <Plus className="h-4 w-4" strokeWidth={2.2} />
              {isCvFolder ? 'Create CV' : 'New Note'}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {folderNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                folder={folder}
                showFolderName={false}
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

      <BulkActionBar
        selectedIds={bulk.selectedIds}
        allSelected={bulk.allSelected}
        onToggleSelectAll={bulk.toggleSelectAll}
        onClear={bulk.clearSelection}
      />

      <FolderNameDialog
        open={renameOpen}
        title="Rename Folder"
        initialValue={folder.name}
        confirmLabel="Rename"
        onSubmit={(name) => renameFolder(folder.id, name)}
        onClose={() => setRenameOpen(false)}
      />

      <ConfirmDialog
        open={deleteOpen}
        title={`Delete "${folder.name}"?`}
        description="Notes inside this folder will be moved to your first available folder."
        confirmLabel="Delete Folder"
        onConfirm={() => {
          deleteFolder(folder.id);
          navigate('folders');
        }}
        onClose={() => setDeleteOpen(false)}
      />
    </NavigationShell>
  );
}
