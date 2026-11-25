import React, { useMemo, useState } from 'react';
import { Archive, ChevronLeft } from 'lucide-react';
import { BulkActionBar, useBulkSelection } from '../components/BulkActionBar';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { NavigationShell } from '../components/NavigationShell';
import { NoteCard } from '../components/NoteCard';
import { useNotes } from '../context/NotesContext';

export function ArchiveScreen() {
  const {
    archivedNotes,
    getFolderById,
    restoreArchivedNote,
    permanentlyDeleteNote,
    navigate,
    goBack,
  } = useNotes();

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const visibleNoteIds = useMemo(() => archivedNotes.map((n) => n.id), [archivedNotes]);
  const bulk = useBulkSelection(visibleNoteIds);

  return (
    <NavigationShell showMobileTabs>
      <header className="sticky top-0 z-20 bg-[var(--bg-canvas)]/95 backdrop-blur-md px-4 sm:px-8 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goBack}
            aria-label="Back"
            className="lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2} />
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            Archived Notes
          </h1>
        </div>
        <p className="mt-1 text-xs text-[var(--text-secondary)] pl-12 lg:pl-0 tabular-nums">
          {archivedNotes.length} {archivedNotes.length === 1 ? 'archived note' : 'archived notes'}
        </p>
      </header>

      <section className="px-5 sm:px-8 pt-3">
        {archivedNotes.length === 0 ? (
          <div className="mt-16 flex flex-col items-center text-center px-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] text-[var(--text-secondary)]">
              <Archive className="h-6 w-6" strokeWidth={1.6} />
            </div>
            <h2 className="mt-4 text-base font-semibold">No archived notes</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)] max-w-xs">
              Notes you archive stay safely stored here out of your main list.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {archivedNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                folder={getFolderById(note.folderId)}
                selectionMode={bulk.selectionMode}
                selected={bulk.isSelected(note.id)}
                onLongPress={() => bulk.startSelection(note.id)}
                onClick={() =>
                  bulk.selectionMode
                    ? bulk.toggleSelect(note.id)
                    : navigate('note-details', { noteId: note.id })
                }
                onRestore={() => restoreArchivedNote(note.id)}
                onPermanentDelete={() => setDeleteId(note.id)}
              />
            ))}
          </div>
        )}
      </section>

      <BulkActionBar
        mode="archive"
        selectedIds={bulk.selectedIds}
        allSelected={bulk.allSelected}
        onToggleSelectAll={bulk.toggleSelectAll}
        onClear={bulk.clearSelection}
      />

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete Note Forever?"
        description="This action cannot be undone. The archived note will be permanently removed."
        confirmLabel="Delete Forever"
        onConfirm={() => {
          if (deleteId) permanentlyDeleteNote(deleteId);
        }}
        onClose={() => setDeleteId(null)}
      />
    </NavigationShell>
  );
}
