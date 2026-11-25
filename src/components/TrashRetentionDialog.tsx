import React, { useEffect, useState } from 'react';
import { useNotes } from '../context/NotesContext';
import { InfoSheetDialog } from './ConfirmDialog';

interface TrashRetentionDialogProps {
  open: boolean;
  onClose: () => void;
}

export function TrashRetentionDialog({ open, onClose }: TrashRetentionDialogProps) {
  const { trashRetention, updateTrashRetention, disableTrashRetention, showToast } = useNotes();
  const [monthsInput, setMonthsInput] = useState('');
  const [daysInput, setDaysInput] = useState('');

  useEffect(() => {
    if (open) {
      setMonthsInput(trashRetention.months > 0 ? String(trashRetention.months) : '');
      setDaysInput(trashRetention.days > 0 ? String(trashRetention.days) : '');
    }
  }, [open, trashRetention.days, trashRetention.months]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const months = Math.max(0, Math.min(120, Math.floor(Number(monthsInput || '0'))));
    const days = Math.max(0, Math.min(365, Math.floor(Number(daysInput || '0'))));
    if (months === 0 && days === 0) {
      showToast('Enter at least 1 month or 1 day', 'danger');
      return;
    }
    updateTrashRetention(months, days);
    onClose();
  };

  return (
    <InfoSheetDialog open={open} title="Trash Auto-Delete" onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-2 gap-2.5">
          <input
            type="number"
            min={0}
            max={120}
            inputMode="numeric"
            value={monthsInput}
            onChange={(e) => setMonthsInput(e.target.value)}
            placeholder="Months"
            aria-label="Months"
            className="w-full min-h-[44px] rounded-xl bg-[var(--bg-canvas)] border border-[var(--divider)] px-3.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-primary)]"
          />
          <input
            type="number"
            min={0}
            max={365}
            inputMode="numeric"
            value={daysInput}
            onChange={(e) => setDaysInput(e.target.value)}
            placeholder="Days"
            aria-label="Days"
            className="w-full min-h-[44px] rounded-xl bg-[var(--bg-canvas)] border border-[var(--divider)] px-3.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-primary)]"
          />
        </div>

        <div className="flex gap-2.5">
          {trashRetention.enabled && (
            <button
              type="button"
              onClick={() => {
                disableTrashRetention();
                onClose();
              }}
              className="flex-1 min-h-[44px] rounded-xl bg-[#E45B5B]/10 text-sm font-semibold text-[#E45B5B] cursor-pointer"
            >
              Turn Off
            </button>
          )}
          <button
            type="submit"
            className="flex-1 min-h-[44px] rounded-xl bg-[var(--text-primary)] dark:bg-[var(--accent-primary)] text-sm font-semibold text-[var(--bg-card)] dark:text-[#171717] cursor-pointer"
          >
            Save
          </button>
        </div>
      </form>
    </InfoSheetDialog>
  );
}
