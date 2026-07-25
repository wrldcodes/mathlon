'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { InputArea } from './InputArea';
import { TeachingCanvas, type TeachingCanvasHandle } from './TeachingCanvas';
import { DemoPaywall } from './DemoPaywall';
import { SessionPreparingScreen } from './SessionPreparingScreen';
import { AppSidebar } from './AppSidebar';
import { MathlonMark } from './MathlonMark';
import { useTeachingSession } from '../hooks/useTeachingSession';
import { formatDemoTime } from '../hooks/useDemoMode';
import {
  fetchTeachingSession,
  updateTeachingSession,
} from '../lib/sessionsApi';
import type { TeachingSession, PersistedCanvasState } from '@/lib/sessions/types';
import { summarizeBoard } from '../canvas/boardSummary';

export function SessionPage() {
  const router = useRouter();
  const params = useParams<{ sessionId: string }>();
  const searchParams = useSearchParams();
  const sessionId = params.sessionId;
  const isDemo = searchParams.get('demo') === 'true';
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [initialCanvasState, setInitialCanvasState] = useState<PersistedCanvasState | null>(null);
  // Seeded from the URL for the brief pre-load render; overwritten with the
  // persisted `session.demo` flag once fetched, which is the source of truth
  // (the URL param can be dropped on reload/resume — see demoExpiresAt below).
  const [isDemoSession, setIsDemoSession] = useState(isDemo);
  const [demoExpiresAt, setDemoExpiresAt] = useState<string | null>(null);
  const canvasRef = useRef<TeachingCanvasHandle>(null);
  const sessionHandledRef = useRef(false);
  const teachingSessionRef = useRef<TeachingSession | null>(null);

  const {
    isTeaching,
    overlayDismissed,
    setOverlayDismissed,
    currentSessionTitle,
    sessionBootstrap,
    micAccessState,
    isSessionActive,
    demo,
    beginSessionLaunch,
    handleAllowMic,
    cancelSessionBootstrap,
    handleTextSubmit,
    resetSession,
    vapiControls,
    exportSessionLog,
    persistCanvasNow,
  } = useTeachingSession(canvasRef, { sessionId, demoExpiresAt });

  const isPreparingSession = sessionBootstrap !== null;
  const isFinalCountdown =
    isDemoSession && demo.secondsLeft !== null && demo.secondsLeft > 0 && demo.secondsLeft <= 5;

  useEffect(() => {
    if (!sessionId || sessionHandledRef.current) return;

    let cancelled = false;

    (async () => {
      setIsLoadingSession(true);
      setLoadError(null);
      try {
        const session = await fetchTeachingSession(sessionId);
        if (cancelled) return;
        teachingSessionRef.current = session;
        sessionHandledRef.current = true;
        setIsLoadingSession(false);

        const savedBoard = session.canvasState?.steps?.length
          ? session.canvasState
          : null;
        setInitialCanvasState(savedBoard);
        setIsDemoSession(session.demo);
        setDemoExpiresAt(session.demoExpiresAt ?? null);

        void updateTeachingSession(sessionId, { status: 'active' }).catch(() => {
          /* non-blocking */
        });

        // Marks this browser's one-time free demo as used (best-effort, for
        // the homepage's "already used" gate) — the actual time cap is
        // enforced by demoExpiresAt above, not by this call.
        demo.start();

        // Demo already past its server-anchored deadline (e.g. reopened
        // hours later): don't spend a voice connection on a session that's
        // just going to show the paywall the instant the countdown ticks.
        const demoAlreadyExpired =
          session.demo &&
          session.demoExpiresAt != null &&
          new Date(session.demoExpiresAt).getTime() <= Date.now();
        if (demoAlreadyExpired) return;

        // Resume: keep the board, reconnect voice with board context (no fresh greeting).
        // Fresh session: launch with the stored prompt as before.
        if (savedBoard) {
          const board = summarizeBoard(savedBoard);
          const resumeBoardSummary = [
            `stepCount=${board.stepCount}`,
            ...board.steps.map(
              (s) =>
                `[${s.index}] ${s.kind}: ${s.preview}` +
                (s.annotationCount ? ` (annotations=${s.annotationCount})` : ''),
            ),
          ].join('\n');
          void beginSessionLaunch('', session.title, { resumeBoardSummary });
        } else {
          void beginSessionLaunch(session.prompt, session.title);
        }
      } catch (err) {
        if (cancelled) return;
        setIsLoadingSession(false);
        setLoadError(err instanceof Error ? err.message : 'Could not load session.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [beginSessionLaunch, demo, isDemo, sessionId]);

  useEffect(() => {
    if (!sessionId || !isSessionActive) return;
    void updateTeachingSession(sessionId, { status: 'active' }).catch(() => {
      /* non-blocking */
    });
  }, [isSessionActive, sessionId]);

  useEffect(() => {
    const title = isLoadingSession
      ? 'Loading session · Mathlon'
      : isPreparingSession
        ? 'Starting session · Mathlon'
        : isSessionActive
          ? 'Teaching Session · Mathlon'
          : isTeaching
            ? 'Teaching in Progress · Mathlon'
            : 'Session · Mathlon';
    document.title = title;
  }, [isLoadingSession, isPreparingSession, isSessionActive, isTeaching]);

  const goHome = () => {
    if (sessionId) {
      persistCanvasNow();
      void updateTeachingSession(sessionId, { status: 'ended' }).catch(() => {
        /* non-blocking */
      });
    }
    cancelSessionBootstrap();
    void resetSession();
    router.push(isDemo ? '/?demo=true' : '/');
  };

  if (isLoadingSession) {
    return (
      <div className="min-h-screen h-screen flex items-center justify-center bg-background text-foreground">
        <p className="text-sm text-muted-foreground">Loading session…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen h-screen flex flex-col items-center justify-center gap-4 bg-background text-foreground px-6">
        <p className="text-sm text-destructive text-center" role="alert">
          {loadError}
        </p>
        <button
          type="button"
          onClick={() => router.push(isDemo ? '/?demo=true' : '/')}
          className="rounded-xl bg-primary text-primary-foreground text-sm font-medium px-4 py-2 hover:opacity-90 transition-opacity"
        >
          Back to home
        </button>
      </div>
    );
  }

  if (isPreparingSession && sessionBootstrap) {
    return (
      <div className="min-h-screen h-screen bg-background text-foreground">
        <SessionPreparingScreen
          phase={sessionBootstrap.phase}
          topicTitle={sessionBootstrap.title}
          micState={micAccessState}
          errorMessage={sessionBootstrap.errorMessage}
          onAllowMic={() => void handleAllowMic()}
          onCancel={goHome}
          onRetry={() => void beginSessionLaunch(sessionBootstrap.content, sessionBootstrap.title)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen h-screen flex bg-background text-foreground overflow-hidden">
      {!isDemoSession && (
        <AppSidebar
          variant="session"
          expanded={sidebarExpanded}
          onExpandedChange={setSidebarExpanded}
          currentSessionTitle={currentSessionTitle}
          currentSessionId={sessionId}
          isSessionActive={isSessionActive}
          isPreparingSession={isPreparingSession}
          onNewSession={goHome}
        />
      )}

      <div className="flex-1 min-w-0 flex flex-col relative">
        {isDemoSession ? (
          <div className="shrink-0 z-40 bg-card/85 backdrop-blur-md border-b border-border px-5 md:px-6 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <MathlonMark />
              <h1 className="text-xl md:text-2xl font-semibold tracking-tight">mathlon</h1>
            </div>
            {demo.isActive && demo.secondsLeft !== null ? (
              <span
                className={`text-xs font-medium px-3 py-1.5 rounded-full border whitespace-nowrap tabular-nums ${
                  isFinalCountdown
                    ? 'countdown-danger border-transparent text-[#ef4444]'
                    : 'bg-accent border-transparent text-muted-foreground'
                }`}
              >
                Free demo · {formatDemoTime(demo.secondsLeft)} left
              </span>
            ) : (
              <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-accent text-muted-foreground whitespace-nowrap">
                {demo.hasExpired ? 'Demo ended' : 'Free demo'}
              </span>
            )}
          </div>
        ) : null}

        {isSessionActive && (
          <div
            className={`absolute left-1/2 -translate-x-1/2 z-30 px-5 py-2.5 bg-[#22c55e] text-white rounded-full shadow-lg border border-[#16a34a] flex items-center gap-2.5 text-sm font-medium whitespace-nowrap ${
              isDemoSession ? 'top-[4.75rem]' : 'top-4'
            }`}
          >
            <div className="w-2 h-2 rounded-full bg-white animate-pulse shrink-0" />
            Teaching in progress — feel free to interrupt
          </div>
        )}

        {isDemoSession && isFinalCountdown && demo.secondsLeft !== null && (
          <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
            <span
              key={demo.secondsLeft}
              className="countdown-center-number text-[16rem] md:text-[22rem] tabular-nums"
            >
              {demo.secondsLeft}
            </span>
          </div>
        )}

        <div className="flex-1 min-h-0 relative">
          <TeachingCanvas
            ref={canvasRef}
            isTeaching={isTeaching}
            currentStep=""
            initialCanvasState={initialCanvasState}
            onClear={() => {
              setInitialCanvasState({ version: 1, steps: [] });
              if (!sessionId) return;
              void updateTeachingSession(sessionId, {
                canvasState: { version: 1, steps: [] },
              }).catch(() => {
                /* non-blocking */
              });
            }}
          />
          {isDemoSession && demo.hasExpired && !overlayDismissed && (
            <DemoPaywall
              variant="overlay"
              onDismiss={() => setOverlayDismissed(true)}
              topic={currentSessionTitle ?? undefined}
            />
          )}
        </div>

        <div className="absolute bottom-4 left-4 right-4 z-40 pointer-events-none">
          <div className="max-w-[720px] mx-auto pointer-events-auto">
            {process.env.NODE_ENV !== 'production' ? (
              <div className="mb-3 flex justify-end">
                <button
                  type="button"
                  onClick={exportSessionLog}
                  className="rounded-xl bg-card/90 backdrop-blur border border-border shadow px-3 py-1.5 text-xs font-medium hover:opacity-90 transition-opacity"
                >
                  Export session log (JSON)
                </button>
              </div>
            ) : null}
            {isDemoSession && demo.hasExpired ? (
              <div className="w-full rounded-2xl bg-card/90 backdrop-blur-xl border border-border shadow-xl px-4 py-3 flex items-center gap-3">
                <span className="text-sm text-muted-foreground flex-1">
                  Your free demo has ended — join the Beta to keep learning.
                </span>
                {process.env.NEXT_PUBLIC_BETA_CHECKOUT_URL ? (
                  <a
                    href={process.env.NEXT_PUBLIC_BETA_CHECKOUT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 rounded-xl bg-primary text-primary-foreground text-sm font-medium px-4 py-2 hover:opacity-90 transition-opacity"
                  >
                    Join the Beta
                  </a>
                ) : null}
              </div>
            ) : (
              <InputArea onTextSubmit={handleTextSubmit} vapiControls={vapiControls} disabled={false} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
