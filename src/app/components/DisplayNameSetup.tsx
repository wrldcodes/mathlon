'use client';

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';

type DisplayNameSetupProps = {
  open: boolean;
  onSave: (name: string) => void;
};

/**
 * First-visit prompt so each teammate can set their own name before testing.
 */
export function DisplayNameSetup({ open, onSave }: DisplayNameSetupProps) {
  const [draft, setDraft] = useState('');

  const submit = () => {
    onSave(draft);
  };

  return (
    <AlertDialog open={open}>
      <AlertDialogContent
        onOpenAutoFocus={(event) => {
          // Focus the name field instead of the primary button
          event.preventDefault();
          const input = document.getElementById('mathlon-display-name');
          input?.focus();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>What should we call you?</AlertDialogTitle>
          <AlertDialogDescription>
            Mathlon will use this name in greetings and voice sessions. It stays in this
            browser only — each teammate can set their own.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <label className="block space-y-2">
            <span className="text-sm font-medium text-foreground">Display name</span>
            <input
              id="mathlon-display-name"
              type="text"
              autoComplete="name"
              maxLength={40}
              placeholder="e.g. Alex"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="w-full rounded-xl border border-border bg-input-background px-3 py-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <AlertDialogFooter>
            <AlertDialogAction type="submit" onClick={submit}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
