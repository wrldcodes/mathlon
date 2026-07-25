'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Pause, Play, Send, Square, X } from 'lucide-react';
import paperclipIcon from '../../assets/icons/paperclip.png';

export interface VapiControls {
  isSessionActive: boolean;
  isPaused?: boolean;
  isMicMuted?: boolean;
  isConnecting?: boolean;
  startSession: () => Promise<void>;
  stopSession: () => Promise<void>;
  pauseSession?: () => Promise<void>;
  resumeSession?: () => Promise<void>;
  setMicMuted?: (muted: boolean) => void;
  statusText: string;
  isConfigured: boolean;
  hideConnectionStatus?: boolean;
}

interface InputAreaProps {
  onTextSubmit: (message: string) => void;
  vapiControls: VapiControls;
  disabled?: boolean;
}

export function InputArea({ onTextSubmit, vapiControls, disabled }: InputAreaProps) {
  const [input, setInput] = useState('');
  const [attachedImages, setAttachedImages] = useState<File[]>([]);
  const [composeExpanded, setComposeExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    isSessionActive,
    isPaused = false,
    isMicMuted = false,
    startSession,
    stopSession,
    pauseSession,
    resumeSession,
    setMicMuted,
    statusText,
    isConfigured,
    hideConnectionStatus,
  } = vapiControls;

  const live = isSessionActive && !isPaused;

  useEffect(() => {
    if (composeExpanded) textareaRef.current?.focus();
  }, [composeExpanded]);

  // Space: pause when live, resume when paused, start when idle (not while typing)
  useEffect(() => {
    const isTypingElement = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName.toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (disabled || !isConfigured) return;
      if (e.code !== 'Space' || e.repeat) return;
      if (isTypingElement(e.target)) return;
      e.preventDefault();

      if (isSessionActive && isPaused) {
        void resumeSession?.();
        return;
      }
      if (isSessionActive && !isPaused) {
        void pauseSession?.();
        return;
      }
      setComposeExpanded(false);
      void startSession();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    disabled,
    isConfigured,
    isSessionActive,
    isPaused,
    pauseSession,
    resumeSession,
    startSession,
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled) return;
    const trimmed = input.trim();
    if (!trimmed && attachedImages.length === 0) return;
    const attachmentNote = attachedImages.length
      ? `\n\n[Attached images: ${attachedImages.map((f) => f.name).join(', ')}]`
      : '';
    onTextSubmit((trimmed || 'Please help me solve this from the attached image(s).') + attachmentNote);
    setInput('');
    setAttachedImages([]);
    setComposeExpanded(false);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextFiles = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/'));
    if (!nextFiles.length) return;
    setAttachedImages((prev) => [...prev, ...nextFiles].slice(0, 6));
    e.target.value = '';
  };

  const removeAttachedImage = (index: number) => {
    setAttachedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    }
  };

  const handlePause = () => {
    if (!isSessionActive || isPaused) return;
    void pauseSession?.();
  };

  const handlePlay = () => {
    if (isSessionActive && isPaused) {
      void resumeSession?.();
      return;
    }
    if (!isSessionActive) {
      setComposeExpanded(false);
      void startSession();
    }
  };

  const handleStop = () => {
    setComposeExpanded(false);
    void stopSession();
  };

  const handleMicClick = () => {
    if (!isConfigured || disabled) return;
    if (!isSessionActive) {
      setComposeExpanded(false);
      void startSession();
      return;
    }
    // Mic only mutes — never ends session
    setMicMuted?.(!isMicMuted);
  };

  const openCompose = () => {
    setComposeExpanded(true);
    if (isSessionActive && !isPaused) {
      void pauseSession?.();
    }
  };

  const attachedImagesBlock =
    attachedImages.length > 0 ? (
      <div className="flex flex-wrap gap-2 px-4 pt-3">
        {attachedImages.map((file, index) => (
          <div
            key={`${file.name}-${file.size}-${index}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent border border-border text-sm"
          >
            <span className="max-w-40 truncate">{file.name}</span>
            <button
              type="button"
              onClick={() => removeAttachedImage(index)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    ) : null;

  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      multiple
      className="hidden"
      onChange={handleFileSelect}
      disabled={disabled}
    />
  );

  const attachButton = (
    <button
      type="button"
      onClick={() => fileInputRef.current?.click()}
      disabled={disabled}
      title="Attach image"
      className="p-2 rounded-lg hover:bg-accent transition-colors disabled:opacity-40"
    >
      <img src={paperclipIcon.src} alt="Attach" className="w-5 h-5 opacity-50 dark:invert" />
    </button>
  );

  const sessionControls =
    isSessionActive ? (
      <div className="flex items-center gap-1.5 shrink-0 pl-1 ml-0.5 border-l border-border">
        {isPaused ? (
          <button
            type="button"
            onClick={handlePlay}
            disabled={disabled}
            title="Resume teaching"
            className="h-9 px-2.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold text-green-800 dark:text-green-300 bg-green-500/15 border border-green-500/30 hover:bg-green-500/25 transition-colors disabled:opacity-40"
          >
            <Play className="w-4 h-4 fill-current" />
            <span className="hidden sm:inline">Play</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handlePause}
            disabled={disabled || !pauseSession}
            title="Pause teaching"
            className="h-9 px-2.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold text-amber-900 dark:text-amber-200 bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/25 transition-colors disabled:opacity-40"
          >
            <Pause className="w-4 h-4 fill-current" />
            <span className="hidden sm:inline">Pause</span>
          </button>
        )}
        <button
          type="button"
          onClick={handleStop}
          disabled={disabled}
          title="End session"
          className="h-9 px-2.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold text-red-800 dark:text-red-300 bg-red-500/10 border border-red-500/25 hover:bg-red-500/20 transition-colors disabled:opacity-40"
        >
          <Square className="w-3.5 h-3.5 fill-current" />
          <span className="hidden sm:inline">Stop</span>
        </button>
      </div>
    ) : null;

  const micButton = (
    <button
      type="button"
      onClick={handleMicClick}
      disabled={disabled || !isConfigured}
      title={
        !isSessionActive
          ? 'Start voice session'
          : isPaused
            ? 'Microphone muted while paused'
            : isMicMuted
              ? 'Unmute microphone'
              : 'Mute microphone'
      }
      className={`p-2 rounded-full transition-colors disabled:opacity-40 ${
        isSessionActive && !isPaused && !isMicMuted
          ? 'bg-[#22c55e] hover:bg-green-600 text-white'
          : isSessionActive && (isPaused || isMicMuted)
            ? 'bg-muted text-muted-foreground'
            : 'hover:bg-accent text-muted-foreground'
      }`}
    >
      {isSessionActive && (isPaused || isMicMuted) ? (
        <MicOff className="w-5 h-5" />
      ) : (
        <Mic className={`w-5 h-5 ${isSessionActive && !isPaused && !isMicMuted ? 'text-white' : ''}`} />
      )}
    </button>
  );

  // Collapsed voice dock during live or paused session
  if (isSessionActive && !composeExpanded) {
    return (
      <div
        className={`w-full rounded-2xl backdrop-blur-xl border shadow-xl overflow-hidden ${
          isPaused
            ? 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800'
            : 'bg-card/80 border-border'
        }`}
      >
        {fileInput}
        {attachedImagesBlock}
        <div className="flex items-center gap-2.5 px-4 py-3">
          <div
            className={`w-2 h-2 rounded-full shrink-0 ${
              isPaused ? 'bg-amber-500' : 'bg-[#22c55e] animate-pulse'
            }`}
          />
          <span
            className={`text-sm font-medium shrink-0 ${
              isPaused
                ? 'text-amber-700 dark:text-amber-300'
                : 'text-[#16a34a] dark:text-[#22c55e]'
            }`}
          >
            {isPaused ? 'Paused' : 'Listening'}
          </span>
          <span className="flex-1 text-xs text-muted-foreground hidden sm:inline select-none">
            {isPaused ? 'Play resumes · Stop ends session' : 'Speak anytime · Space pauses'}
          </span>
          {attachButton}
          {sessionControls}
          {micButton}
          <button
            type="button"
            onClick={openCompose}
            className="text-xs font-medium text-muted-foreground hover:text-foreground underline-offset-2 hover:underline shrink-0"
          >
            Type or paste problem
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl bg-card/80 backdrop-blur-xl border border-border shadow-xl overflow-hidden">
      <form onSubmit={handleSubmit}>
        {isSessionActive && (
          <div
            className={`flex items-center gap-2 px-4 py-2 border-b border-border ${
              isPaused ? 'bg-amber-500/10' : 'bg-green-500/10'
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full shrink-0 ${
                isPaused ? 'bg-amber-500' : 'bg-[#22c55e] animate-pulse'
              }`}
            />
            <span
              className={`text-sm ${
                isPaused
                  ? 'text-amber-700 dark:text-amber-300'
                  : 'text-green-600 dark:text-green-400'
              }`}
            >
              {isPaused ? 'Teaching paused' : 'Listening'}
            </span>
            <span className="ml-auto text-xs text-muted-foreground hidden sm:inline">
              {isPaused ? 'Voice is quiet until you resume' : 'Speak anytime'}
            </span>
          </div>
        )}

        {attachedImagesBlock}
        {fileInput}

        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleTextareaChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          placeholder={
            isPaused
              ? 'Teaching is paused — type a problem or press Play…'
              : isSessionActive && composeExpanded
                ? 'Type or paste your problem…'
                : 'Ask me anything about math...'
          }
          disabled={disabled}
          className="w-full px-5 pt-4 pb-2 bg-transparent resize-none focus:outline-none text-base disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ minHeight: '64px', maxHeight: '200px' }}
          rows={1}
        />

        <div className="flex items-center gap-1 px-4 pb-3 pt-1">
          {attachButton}
          {sessionControls}
          {micButton}

          <div className="flex-1" />

          <span className="text-xs text-muted-foreground hidden sm:inline select-none pr-2">
            {isConfigured
              ? isPaused
                ? 'Play resumes · Stop ends session'
                : live
                  ? 'Space pauses · Stop ends session'
                  : isSessionActive
                    ? 'Session active'
                    : 'Space to start voice'
              : 'Set voice env vars to enable'}
          </span>

          <button
            type="submit"
            disabled={(!input.trim() && attachedImages.length === 0) || !!disabled}
            className="p-2.5 bg-primary text-primary-foreground rounded-xl hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>

      {statusText && !isSessionActive && !hideConnectionStatus && (
        <div className="px-4 pb-3 text-xs text-muted-foreground border-t border-border pt-2">
          {statusText}
        </div>
      )}
    </div>
  );
}
