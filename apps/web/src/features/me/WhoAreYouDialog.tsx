import type { GitUser } from '@mrdash/shared';
import { useState } from 'react';
import { Avatar } from '../../components/data/Avatar';
import { Dialog, DialogContent } from '../../components/ui/Dialog';
import { Input } from '../../components/ui/Input';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: readonly GitUser[];
  onPick: (user: GitUser) => void;
}

/** Password-mode identity picker: "Only mine" and "Waiting for your review" need to know who you are. */
export function WhoAreYouDialog({ open, onOpenChange, users, onPick }: Props) {
  const [text, setText] = useState('');
  const needle = text.trim().toLowerCase();
  const matches = users
    .filter((u) => !needle || `${u.displayName} ${u.username}`.toLowerCase().includes(needle))
    .slice(0, 50);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Who are you?"
        description="Pick your name so “Only mine” and “Waiting for your review” work. Saved in this browser."
      >
        <Input
          aria-label="Search people"
          placeholder="Search by name or username"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />
        <ul aria-label="People" className="mt-3 flex max-h-64 flex-col gap-0.5 overflow-y-auto">
          {matches.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => onPick(u)}
                className="flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left text-sm hover:bg-surface"
              >
                <Avatar name={u.displayName} avatarUrl={u.avatarUrl} size={20} />
                <span className="truncate">{u.displayName}</span>
                <span className="truncate text-xs text-fg-secondary">@{u.username}</span>
              </button>
            </li>
          ))}
          {matches.length === 0 ? (
            <li className="px-2 py-1.5 text-sm text-fg-muted">No one matches “{text}”.</li>
          ) : null}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
