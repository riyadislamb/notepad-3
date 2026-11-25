import React, { useMemo } from 'react';
import { Search, Star } from 'lucide-react';
import { BulkActionBar, useBulkSelection } from '../components/BulkActionBar';
import { NavigationShell } from '../components/NavigationShell';
import { NoteCard } from '../components/NoteCard';
import { useNotes } from '../context/NotesContext';

export function FavoriteNotesScreen() {
  const { favoriteNotes, getFolderById, navigate } = useNotes();
  const visibleNoteIds = useMemo(() => favoriteNotes.map((n) => n.id), [favoriteNotes]);
  const bulk = useBulkSelection(visibleNoteIds);

  return (
    <NavigationShell showMobileTabs showFab={!bulk.selectionMode}>
      <header className="sticky top-0 z-20 bg-[var(--bg-canvas)]/95 backdrop-blur-md px-5 sm:px-8 pt-5 pb-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            Favorites
          </h1>

          <button
            type="button"
            onClick={() => navigate('search')}
            aria-label="Search notes"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
          >
            <Search className="h-5 w-5" strokeWidth={1.85} />
          </button>
        </div>

        <p className="mt-1.5 text-xs text-[var(--text-secondary)] tabular-nums">
          {favoriteNotes.length} {favoriteNotes.length === 1 ? 'favorite note' : 'favorite notes'}
        </p>
      </header>

      <section className="px-5 sm:px-8 pt-3">
        {favoriteNotes.length === 0 ? (
          <div className="mt-16 flex flex-col items-center text-center px-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] text-[var(--accent-primary)]">
              <Star className="h-6 w-6" strokeWidth={1.75} />
            </div>
            <h2 className="mt-4 text-base font-semibold">No favorites yet</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)] max-w-xs">
              Tap the star icon on any note to keep it in your favorites.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {favoriteNotes.map((note) => (
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
