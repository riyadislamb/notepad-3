import React, { useMemo, useState } from 'react';
import { ChevronLeft, FileText, Search } from 'lucide-react';
import { BulkActionBar, useBulkSelection } from '../components/BulkActionBar';
import { NavigationShell } from '../components/NavigationShell';
import { NoteCard } from '../components/NoteCard';
import { useNotes } from '../context/NotesContext';
import { NoteSortOption } from '../types/notes';

export function AllNotesScreen() {
  const { activeNotes, getFolderById, navigate, goBack } = useNotes();
  const [sortBy, setSortBy] = useState<NoteSortOption>('updated');

  const sortedNotes = useMemo(() => {
    const copy = [...activeNotes];
    if (sortBy === 'title') {
      return copy.sort((a, b) =>
        (a.title || 'Untitled').localeCompare(b.title || 'Untitled')
      );
    }
    if (sortBy === 'pinned') {
      return copy.sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
    }
    return copy.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }, [activeNotes, sortBy]);

  const visibleNoteIds = useMemo(() => sortedNotes.map((n) => n.id), [sortedNotes]);
  const bulk = useBulkSelection(visibleNoteIds);

  return (
    <NavigationShell showMobileTabs showFab={!bulk.selectionMode}>
      <header className="sticky top-0 z-20 bg-[var(--bg-canvas)]/95 backdrop-blur-md px-4 sm:px-8 pt-5 pb-3">
        <div className="flex items-center justify-between gap-3">
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
              All Notes
            </h1>
          </div>

          <button
            type="button"
            onClick={() => navigate('search')}
            aria-label="Search notes"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
          >
            <Search className="h-5 w-5" strokeWidth={1.85} />
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-xs text-[var(--text-secondary)] tabular-nums">
            {sortedNotes.length} {sortedNotes.length === 1 ? 'note' : 'notes'}
          </span>

          <div className="flex items-center gap-1.5">
            {(
              [
                { id: 'updated', label: 'Recent' },
                { id: 'pinned', label: 'Pinned' },
                { id: 'title', label: 'Title' },
              ] as { id: NoteSortOption; label: string }[]
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSortBy(opt.id)}
                className={`min-h-[32px] px-3 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  sortBy === opt.id
                    ? 'bg-[var(--text-primary)] text-[var(--bg-card)] dark:bg-[var(--accent-primary)] dark:text-[#171717]'
                    : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--divider)]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <section className="px-5 sm:px-8 pt-3">
        {sortedNotes.length === 0 ? (
          <div className="mt-16 flex flex-col items-center text-center px-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] text-[var(--text-secondary)]">
              <FileText className="h-6 w-6" strokeWidth={1.6} />
            </div>
            <h2 className="mt-4 text-base font-semibold">No notes yet</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Create your first note to see it listed here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {sortedNotes.map((note) => (
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
    </NavigationShell>
  );
}
