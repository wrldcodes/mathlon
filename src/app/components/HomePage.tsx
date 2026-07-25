'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { InputArea } from './InputArea';
import { MathBackdrop } from './MathBackdrop';
import { DemoPaywall } from './DemoPaywall';
import { AppSidebar } from './AppSidebar';
import { MathlonMark } from './MathlonMark';
import { useDemoMode } from '../hooks/useDemoMode';
import { useDisplayName } from '../hooks/useDisplayName';
import {
  TOPIC_SUGGESTIONS,
  HOME_TOPIC_CHIP_CLASSES,
  deriveSessionTitle,
  sessionPath,
} from '../lib/session';
import { createTeachingSession } from '../lib/sessionsApi';

export function HomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDemo = searchParams.get('demo') === 'true';
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const { name: displayName, ready: displayNameReady } = useDisplayName();

  const demo = useDemoMode(() => {});

  const goToSession = async (content: string, title: string) => {
    if (isCreatingSession) return;
    setIsCreatingSession(true);
    setCreateError(null);
    try {
      const session = await createTeachingSession({
        title,
        prompt: content,
        entryMode: content.trim() ? 'text-first' : 'mic-first',
        demo: isDemo,
      });
      router.push(sessionPath(session.id, isDemo));
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not start session.');
      setIsCreatingSession(false);
    }
  };

  const handleTextSubmit = (content: string) => {
    void goToSession(content, deriveSessionTitle(content));
  };

  const handleSuggestion = (topic: (typeof TOPIC_SUGGESTIONS)[number]) => {
    if (demo.isDemo) demo.start();
    void goToSession(topic.prompt, topic.label);
  };

  const vapiControls = {
    isSessionActive: false,
    isConnecting: isCreatingSession,
    startSession: async () => {
      void goToSession('', 'Voice session');
    },
    stopSession: async () => {},
    statusText: '',
    isConfigured: Boolean(
      process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID ||
        process.env.NEXT_PUBLIC_VAPI_API_KEY ||
        process.env.NEXT_PUBLIC_GEMINI_API_KEY,
    ),
    hideConnectionStatus: true,
  };

  return (
    <div className="min-h-screen h-screen flex bg-background text-foreground overflow-hidden">
      {!isDemo && (
        <AppSidebar
          variant="home"
          expanded={sidebarExpanded}
          onExpandedChange={setSidebarExpanded}
          currentSessionTitle={null}
          isSessionActive={false}
          onNewSession={() => router.push(isDemo ? '/?demo=true' : '/')}
        />
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        {isDemo ? (
          <div className="shrink-0 z-40 bg-card/85 backdrop-blur-md border-b border-border px-5 md:px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <MathlonMark />
              <h1 className="text-xl md:text-2xl font-semibold tracking-tight">mathlon</h1>
            </div>
            <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-accent text-muted-foreground whitespace-nowrap">
              Free demo
            </span>
          </div>
        ) : (
          <div className="md:hidden absolute top-0 left-0 right-0 z-40 bg-card/85 backdrop-blur-md border-b border-border px-4 py-3 flex items-center">
            <div className="flex items-center gap-2.5">
              <MathlonMark />
              <h1 className="text-2xl font-semibold tracking-tight">mathlon</h1>
            </div>
          </div>
        )}

        <div
          className={`relative flex-1 min-h-0 flex flex-col items-center justify-center px-6 md:px-12 pb-10 ${
            isDemo ? 'pt-10' : 'pt-20 md:pt-0'
          }`}
        >
          {isDemo && <MathBackdrop />}
          {isDemo && demo.isConsumed ? (
            <DemoPaywall variant="inline" />
          ) : (
            <div className="relative z-10 w-full max-w-2xl space-y-5">
              <div className="text-center space-y-2 mb-7">
                <h2 className="text-4xl font-semibold">
                  {isDemo
                    ? 'Try Mathlon — free for 5 minutes'
                    : displayNameReady
                      ? `Ready to learn, ${displayName}?`
                      : 'Ready to learn?'}
                </h2>
                <p className="text-base text-muted-foreground">
                  {isDemo
                    ? 'Pick a topic below to start your free demo session. No sign-up needed.'
                    : 'Pick a topic, paste a problem, or hold space to start talking.'}
                </p>
              </div>

              {!isDemo && (
                <InputArea
                  onTextSubmit={handleTextSubmit}
                  vapiControls={vapiControls}
                  disabled={isCreatingSession}
                />
              )}

              {createError && (
                <p className="text-center text-sm text-destructive" role="alert">
                  {createError}
                </p>
              )}

              <div
                className={`flex flex-wrap gap-2 justify-center max-w-[640px] mx-auto ${
                  isDemo ? '' : 'pt-1'
                }`}
              >
                {TOPIC_SUGGESTIONS.map((topic, index) => (
                  <button
                    key={topic.label}
                    onClick={() => handleSuggestion(topic)}
                    disabled={isCreatingSession}
                    className={
                      isDemo
                        ? 'h-12 px-5 rounded-full border-2 border-primary bg-card text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50'
                        : `h-10 px-4 rounded-full border border-border bg-card text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50 ${HOME_TOPIC_CHIP_CLASSES[index]}`
                    }
                  >
                    {topic.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
