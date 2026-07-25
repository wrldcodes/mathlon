'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Link2,
  Copy,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import navHistory from '../../assets/icons/nav-history.png';
import navSettings from '../../assets/icons/nav-settings.png';
import { MathlonMark } from './MathlonMark';
import { Skeleton } from './ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { sessionPath } from '../lib/session';
import {
  createTeachingSession,
  deleteTeachingSession,
  listTeachingSessions,
  updateTeachingSession,
} from '../lib/sessionsApi';
import type { TeachingSession } from '@/lib/sessions/types';
import { useDisplayName } from '../hooks/useDisplayName';
import { DisplayNameSetup } from './DisplayNameSetup';

const RECENT_LIMIT = 12;

interface AppSidebarProps {
  variant: 'home' | 'session';
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  currentSessionTitle: string | null;
  currentSessionId?: string | null;
  isSessionActive: boolean;
  isPreparingSession?: boolean;
  onNewSession: () => void;
}

export function AppSidebar({
  variant,
  expanded,
  onExpandedChange,
  currentSessionTitle,
  currentSessionId = null,
  isSessionActive,
  isPreparingSession = false,
  onNewSession,
}: AppSidebarProps) {
  const router = useRouter();
  const isHome = variant === 'home';
  const {
    name: displayName,
    initial: displayInitial,
    setName,
    ready: displayNameReady,
    needsSetup,
  } = useDisplayName();
  const [sessions, setSessions] = useState<TeachingSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<TeachingSession | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const loadSessions = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setIsLoading(true);
      setLoadError(null);
    }
    try {
      const all = await listTeachingSessions();
      // Product sidebar: skip demo sessions
      setSessions(all.filter((s) => !s.demo).slice(0, RECENT_LIMIT));
    } catch (err) {
      if (!opts?.silent) {
        setLoadError(err instanceof Error ? err.message : 'Could not load sessions.');
        setSessions([]);
      }
    } finally {
      if (!opts?.silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    const onFocus = () => {
      void loadSessions({ silent: true });
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadSessions]);

  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus();
  }, [renamingId]);

  const recentForList = sessions.filter((s) => s.id !== currentSessionId);

  const openSession = (id: string) => {
    router.push(sessionPath(id));
  };

  const beginRename = (session: TeachingSession) => {
    setActionError(null);
    setRenamingId(session.id);
    setRenameValue(session.title || '');
  };

  const commitRename = async () => {
    if (!renamingId) return;
    const nextTitle = renameValue.trim() || 'Untitled session';
    const previous = sessions.find((s) => s.id === renamingId);
    setRenamingId(null);
    if (!previous || previous.title === nextTitle) return;

    setSessions((prev) =>
      prev.map((s) => (s.id === renamingId ? { ...s, title: nextTitle } : s)),
    );
    try {
      await updateTeachingSession(renamingId, { title: nextTitle });
    } catch (err) {
      setSessions((prev) =>
        prev.map((s) => (s.id === renamingId ? { ...s, title: previous.title } : s)),
      );
      setActionError(err instanceof Error ? err.message : 'Could not rename session.');
    }
  };

  const copySessionLink = async (session: TeachingSession) => {
    setActionError(null);
    const url = `${window.location.origin}${sessionPath(session.id)}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      setActionError('Could not copy link.');
    }
  };

  const duplicateSession = async (session: TeachingSession) => {
    setActionError(null);
    try {
      const created = await createTeachingSession({
        title: session.title ? `${session.title} (copy)` : 'Untitled session',
        prompt: session.prompt,
        entryMode: session.entryMode,
        demo: false,
      });
      setSessions((prev) => [created, ...prev].slice(0, RECENT_LIMIT));
      router.push(sessionPath(created.id));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not duplicate session.');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    setActionError(null);
    setSessions((prev) => prev.filter((s) => s.id !== target.id));
    try {
      await deleteTeachingSession(target.id);
    } catch (err) {
      setSessions((prev) => [target, ...prev].slice(0, RECENT_LIMIT));
      setActionError(err instanceof Error ? err.message : 'Could not delete session.');
    }
  };

  const recentList = (
    <>
      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 px-1">
        Recent
      </p>
      <div className="space-y-0.5">
        {isLoading ? (
          <div className="space-y-0.5" aria-hidden="true">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="px-3 py-2">
                <Skeleton className="h-4" style={{ width: `${[82, 68, 90, 60, 76][i]}%` }} />
              </div>
            ))}
          </div>
        ) : loadError ? (
          <p className="px-3 py-2 text-sm text-destructive" role="alert">
            {loadError}
          </p>
        ) : recentForList.length === 0 ? (
          <p className="px-3 py-2 text-sm text-muted-foreground">
            No recent sessions yet
          </p>
        ) : (
          recentForList.map((session) => {
            const isRenaming = renamingId === session.id;
            return (
              <div
                key={session.id}
                className="group relative flex items-center gap-0.5 rounded-lg hover:bg-accent transition-colors"
              >
                {isRenaming ? (
                  <input
                    ref={renameInputRef}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => void commitRename()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void commitRename();
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        setRenamingId(null);
                      }
                    }}
                    className="flex-1 min-w-0 mx-1 my-0.5 px-2 py-1.5 rounded-md text-sm bg-background border border-border outline-none focus:ring-1 focus:ring-ring"
                    aria-label="Rename session"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => openSession(session.id)}
                    className="flex-1 min-w-0 text-left px-3 py-2 rounded-lg text-sm text-muted-foreground group-hover:text-foreground transition-colors"
                    title={session.title}
                  >
                    <span className="truncate block">
                      {session.title || 'Untitled session'}
                    </span>
                  </button>
                )}

                {!isRenaming && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="shrink-0 mr-1 p-1.5 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100 hover:text-foreground hover:bg-background/70 transition-opacity"
                        aria-label={`Session options for ${session.title || 'Untitled session'}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" side="right" className="w-48">
                      <DropdownMenuItem onSelect={() => openSession(session.id)}>
                        <ExternalLink className="w-4 h-4" />
                        Open
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => beginRename(session)}>
                        <Pencil className="w-4 h-4" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => void copySessionLink(session)}>
                        <Link2 className="w-4 h-4" />
                        Copy link
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => void duplicateSession(session)}>
                        <Copy className="w-4 h-4" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => setDeleteTarget(session)}
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            );
          })
        )}
      </div>
      {actionError ? (
        <p className="px-3 pt-2 text-xs text-destructive" role="alert">
          {actionError}
        </p>
      ) : null}
    </>
  );

  return (
    <>
      <aside
        className={`hidden md:flex ${
          expanded ? 'w-72' : 'w-16'
        } transition-[width] duration-200 ease-in-out shrink-0 border-r border-border bg-card/60 backdrop-blur-md flex-col overflow-hidden`}
      >
        {expanded ? (
          <div className="flex flex-col h-full p-4 min-w-[288px]">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <MathlonMark />
                <h1 className="text-3xl font-semibold tracking-tight">mathlon</h1>
              </div>
              <button
                onClick={() => onExpandedChange(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                title="Collapse sidebar"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={onNewSession}
              className="flex items-center justify-center gap-2 w-full rounded-xl bg-primary text-primary-foreground py-2.5 px-4 text-sm font-medium hover:opacity-90 transition-opacity mb-6"
            >
              <Plus className="w-4 h-4" />
              New session
            </button>

            <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
              {isHome ? (
                recentList
              ) : (
                <>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 px-1">
                    Current session
                  </p>
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 px-3 py-2.5 mb-5 rounded-lg text-sm font-medium bg-accent text-foreground transition-colors"
                  >
                    <span className="relative flex items-center justify-center w-2 h-2 shrink-0">
                      {isSessionActive ? (
                        <>
                          <span className="absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-75 animate-ping" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22c55e]" />
                        </>
                      ) : (
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-muted-foreground/40" />
                      )}
                    </span>
                    <span className="truncate flex-1 text-left">
                      {currentSessionTitle ?? 'Current session'}
                      {isPreparingSession ? ' · Starting…' : isSessionActive ? ' · Live' : ''}
                    </span>
                  </button>

                  {recentList}
                </>
              )}
            </div>

            <button
              type="button"
              className="w-full flex items-center gap-3 px-3 py-2.5 mt-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <img
                src={navHistory.src}
                alt=""
                className="w-5 h-5 shrink-0 dark:invert opacity-50 transition-opacity"
              />
              View all history
            </button>

            <div className="mt-2 pt-4 border-t border-border">
              <div className="flex items-center gap-3 px-1">
                <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-semibold select-none shrink-0">
                  {displayInitial}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{displayName}</p>
                  <p className="text-xs text-muted-foreground">Free plan</p>
                </div>
                <button
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
                  title="Settings"
                >
                  <img
                    src={navSettings.src}
                    alt="Settings"
                    className="w-4 h-4 dark:invert opacity-70"
                  />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center py-4 gap-1 h-full">
            <div className="mb-2">
              <MathlonMark />
            </div>
            <button
              onClick={() => onExpandedChange(true)}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors mb-1"
              title="Expand sidebar"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={onNewSession}
              className="p-2.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity mb-2"
              title="New session"
            >
              <Plus className="w-5 h-5" />
            </button>
            {!isHome && (
              <button
                className="relative p-2.5 rounded-lg bg-accent text-foreground transition-colors"
                title={`${currentSessionTitle ?? 'Current session'}${isSessionActive ? ' · Live' : ''}`}
              >
                <span className="relative flex items-center justify-center w-2 h-2">
                  {isSessionActive ? (
                    <>
                      <span className="absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-75 animate-ping" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22c55e]" />
                    </>
                  ) : (
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-muted-foreground/40" />
                  )}
                </span>
              </button>
            )}
            <button
              className="p-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="View all history"
            >
              <img
                src={navHistory.src}
                alt="History"
                className="w-5 h-5 dark:invert opacity-50 transition-opacity"
              />
            </button>
            <div className="mt-auto flex flex-col items-center gap-2 mb-2">
              <button
                className="p-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                title="Settings"
              >
                <img
                  src={navSettings.src}
                  alt="Settings"
                  className="w-5 h-5 dark:invert opacity-50 transition-opacity"
                />
              </button>
              <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-semibold select-none">
                S
              </div>
            </div>
          </div>
        )}
      </aside>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete session?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleteTarget?.title || 'Untitled session'}” and its board will be permanently
              removed. This can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => void confirmDelete()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DisplayNameSetup open={displayNameReady && needsSetup} onSave={setName} />
    </>
  );
}
