'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { X } from 'lucide-react';

interface VoiceRecordingBarProps {
  isRecording: boolean;
  onStop: () => void;
  onCancel: () => void;
}

const BAR_COUNT = 32;
const MIN_BAR_HEIGHT = 4;
const MAX_BAR_HEIGHT = 40;
const SMOOTHING = 0.8;

export function VoiceRecordingBar({ isRecording, onStop, onCancel }: VoiceRecordingBarProps) {
  const [elapsed, setElapsed] = useState(0);
  const [barHeights, setBarHeights] = useState<number[]>(() => Array(BAR_COUNT).fill(MIN_BAR_HEIGHT));
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = 0;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  useEffect(() => {
    if (!isRecording) {
      cleanup();
      setElapsed(0);
      setBarHeights(Array(BAR_COUNT).fill(MIN_BAR_HEIGHT));
      return;
    }

    let cancelled = false;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        const ctx = new AudioContext();
        audioContextRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = SMOOTHING;
        source.connect(analyser);
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const draw = () => {
          analyser.getByteFrequencyData(dataArray);

          const step = Math.floor(dataArray.length / BAR_COUNT);
          const newHeights: number[] = [];
          for (let i = 0; i < BAR_COUNT; i++) {
            const value = dataArray[i * step] ?? 0;
            const normalized = value / 255;
            newHeights.push(MIN_BAR_HEIGHT + normalized * (MAX_BAR_HEIGHT - MIN_BAR_HEIGHT));
          }
          setBarHeights(newHeights);
          animationFrameRef.current = requestAnimationFrame(draw);
        };
        draw();
      } catch {
        // Microphone access denied — show flat bars
      }
    };

    void start();

    timerRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [isRecording, cleanup]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full rounded-2xl bg-[#1a1a1a] border border-white/10 shadow-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Pulsing red dot */}
        <div className="relative shrink-0">
          <div className="w-3 h-3 rounded-full bg-[#ef4444] animate-pulse" />
          <div className="absolute inset-0 w-3 h-3 rounded-full bg-[#ef4444] animate-ping opacity-75" />
        </div>

        {/* Timer */}
        <span className="text-sm font-mono text-white/90 tabular-nums shrink-0 min-w-[40px]">
          {formatTime(elapsed)}
        </span>

        {/* Frequency bars */}
        <div className="flex-1 flex items-center justify-center gap-[2px] h-10">
          {barHeights.map((height, i) => (
            <div
              key={i}
              className="w-[3px] rounded-full bg-gradient-to-t from-[#ef4444] to-[#f97316] transition-[height] duration-75"
              style={{ height: `${height}px` }}
            />
          ))}
        </div>

        {/* Cancel button */}
        <button
          type="button"
          onClick={onCancel}
          className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors shrink-0"
          title="Cancel recording"
        >
          <X className="w-4 h-4 text-white" />
        </button>

        {/* Stop/Save button */}
        <button
          type="button"
          onClick={onStop}
          className="w-10 h-10 rounded-full bg-[#ef4444] hover:bg-[#dc2626] flex items-center justify-center transition-colors shrink-0"
          title="Stop recording"
        >
          <div className="w-4 h-4 rounded-sm bg-white" />
        </button>
      </div>
    </div>
  );
}
