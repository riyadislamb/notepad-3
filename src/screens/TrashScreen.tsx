import React, { useState } from 'react';
import { ChevronLeft, Clock, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { NavigationShell } from '../components/NavigationShell';
import { NoteCard } from '../components/NoteCard';
import { TrashRetentionDialog } from '../components/TrashRetentionDialog';
import { useNotes } from '../context/NotesContext';
import {
  formatTrashRemainingLabel,
  formatTrashRetentionDuration,
} from '../utils/noteHelpers';

export function TrashScreen() {
  const {
    trashedNotes,
    trashRetention,
    getFolderById,
    restoreDeletedNote,
    permanentlyDeleteNote,
    emptyTrash,
    goBack,
  } = useNotes();

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [emptyOpen, setEmptyOpen] = useState(false);
  const [retentionOpen, setRetentionOpen] = useState(false);

  const durationLabel = formatTrashRetentionDuration(trashRetention);
  const compactDurationLabel = formatTrashRetentionDuration(trashRetention, true);

  return (
    <NavigationShell showMobileTabs>
      <header className="sticky top-0 z-20 bg-[var(--bg-canvas)]/95 backdrop-blur-md px-4 sm:px-8 pt-5 pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={goBack}
              aria-label="Back"
              className="lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer shrink-0"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={2} />
            </button>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)] truncate">
              Trash
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setRetentionOpen(true)}
              aria-label="Set Trash auto-delete period"
              className="inline-flex min-h-[38px] items-center gap-1.5 px-3 rounded-full text-xs font-semibold text-[var(--text-primary)] bg-[var(--bg-card)] border border-[var(--divider)] hover:border-[var(--accent-primary)]/60 transition-colors cursor-pointer"
            >
              <Clock className="h-3.5 w-3.5 text-[var(--accent-primary)]" strokeWidth={2} />
              <span>{compactDurationLabel}</span>
            </button>

            {trashedNotes.length > 0 && (
              <button
                type="button"
                onClick={() => setEmptyOpen(true)}
                className="min-h-[38px] px-3.5 rounded-full text-xs font-semibold text-[#E45B5B] bg-[#E45B5B]/10 hover:bg-[#E45B5B]/15 transition-colors cursor-pointer"
              >
                Empty Trash
              </button>
            )}
          </div>
        </div>

        <p className="mt-1 text-xs text-[var(--text-secondary)] pl-12 lg:pl-0 tabular-nums">
          {trashedNotes.length} {trashedNotes.length === 1 ? 'deleted note' : 'deleted notes'} ·{' '}
          {trashRetention.enabled
            ? `Auto-deleted after ${durationLabel}`
            : 'Auto-delete turned off'}
        </p>
      </header>

      <section className="px-5 sm:px-8 pt-3">
        {trashedNotes.length === 0 ? (
          <div className="mt-16 flex flex-col items-center text-center px-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--bg-card)] border border-[var(--divider)] text-[var(--text-secondary)]">
              <Trash2 className="h-6 w-6" strokeWidth={1.6} />
            </div>
            <h2 className="mt-4 text-base font-semibold">Trash is empty</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)] max-w-xs">
              {trashRetention.enabled
                ? `Deleted notes stay here for ${durationLabel} before permanent removal.`
                : 'Deleted notes stay here until you restore or permanently delete them.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {trashedNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                folder={getFolderById(note.folderId)}
                onClick={() => restoreDeletedNote(note.id)}
                onRestore={() => restoreDeletedNote(note.id)}
                onPermanentDelete={() => setDeleteId(note.id)}
                footerBadge={formatTrashRemainingLabel(
                  note.deletedAt,
                  Date.now(),
                  trashRetention
                )}
              />
            ))}
          </div>
        )}
      </section>

      <TrashRetentionDialog open={retentionOpen} onClose={() => setRetentionOpen(false)} />

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete Note?"
        description="This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteId) permanentlyDeleteNote(deleteId);
        }}
        onClose={() => setDeleteId(null)}
      />

      <ConfirmDialog
        open={emptyOpen}
        title="Empty Trash?"
        description={`All ${trashedNotes.length} notes in Trash will be permanently deleted. This action cannot be undone.`}
        confirmLabel="Empty Trash"
        onConfirm={emptyTrash}
        onClose={() => setEmptyOpen(false)}
      />
    </NavigationShell>
  );
}
