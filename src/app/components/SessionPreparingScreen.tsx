'use client';

import { Mic, Settings2 } from 'lucide-react';
import { MathlonMarkLoader } from './MathlonMarkLoader';
import type { MicAccessState } from '../voice/micAccess';

export type SessionPreparePhase = 'permission' | 'connecting' | 'error';

interface SessionPreparingScreenProps {
  phase: SessionPreparePhase;
  topicTitle?: string;
  micState: MicAccessState;
  errorMessage?: string;
  onAllowMic: () => void;
  onCancel: () => void;
  onRetry?: () => void;
}

export function SessionPreparingScreen({
  phase,
  topicTitle,
  micState,
  errorMessage,
  onAllowMic,
  onCancel,
  onRetry,
}: SessionPreparingScreenProps) {
  const needsPermission = phase === 'permission' && micState !== 'granted';

  return (
    <div className="relative size-full flex flex-col items-center justify-center px-6 md:px-12 py-16">
      <div className="relative z-10 w-full max-w-md text-center space-y-8">
        <div className="flex justify-center">
          <MathlonMarkLoader />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
            {phase === 'error'
              ? 'Could not start your session'
              : needsPermission
                ? 'Allow your microphone'
                : 'Preparing your lesson'}
          </h2>
          {topicTitle ? (
            <p className="text-sm text-muted-foreground truncate px-4">{topicTitle}</p>
          ) : null}
          <p className="text-base text-muted-foreground leading-relaxed">
            {phase === 'error'
              ? errorMessage ?? 'Something went wrong while connecting.'
              : needsPermission
                ? 'Mathlon teaches with voice and canvas together. Your browser will ask once — we never record without an active lesson.'
                : 'Setting up your tutor and canvas…'}
          </p>
        </div>

        {needsPermission ? (
          <div className="rounded-2xl border border-border bg-card/90 backdrop-blur-sm p-5 text-left space-y-4 shadow-lg">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Mic className="w-5 h-5" />
              </div>
              <div className="space-y-1 min-w-0">
                <p className="text-sm font-medium">Microphone access</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Tap below, then choose <span className="font-medium text-foreground">Allow</span> in
                  your browser&apos;s prompt. You can still type questions anytime.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onAllowMic}
              className="w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Allow microphone
            </button>
          </div>
        ) : phase === 'error' ? (
          <div className="space-y-3">
            {micState === 'denied' ? (
              <div className="rounded-2xl border border-border bg-card/90 p-4 text-left flex gap-3">
                <Settings2 className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Microphone access is blocked. Open your browser&apos;s site settings for this page
                  and allow the microphone, then try again.
                </p>
              </div>
            ) : null}
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              {onRetry ? (
                <button
                  type="button"
                  onClick={onRetry}
                  className="rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  Try again
                </button>
              ) : null}
              <button
                type="button"
                onClick={onCancel}
                className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
              >
                Back to home
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-mark-dot-1" />
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-mark-dot-2" />
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-mark-dot-3" />
          </div>
        )}

        {phase !== 'error' && !needsPermission ? (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </div>
  );
}
