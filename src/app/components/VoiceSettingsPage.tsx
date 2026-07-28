'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Play } from 'lucide-react';
import { AppSidebar } from '../components/AppSidebar';
import { useDisplayName } from '../hooks/useDisplayName';

interface ToggleProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

function Toggle({ checked, onCheckedChange }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        checked ? 'bg-primary' : 'bg-switch-background'
      }`}
    >
      <span
        className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

interface VoiceOptionProps {
  name: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}

function VoiceOption({ name, description, selected, onSelect }: VoiceOptionProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex items-center gap-4 p-4 rounded-xl border transition-colors text-left ${
        selected
          ? 'border-foreground bg-card'
          : 'border-border bg-card hover:border-foreground/50'
      }`}
    >
      <div className="w-12 h-12 rounded-full bg-[#e8ddd0] shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{name}</p>
        <p className="text-[13px] text-muted-foreground">{description}</p>
      </div>
    </button>
  );
}

interface PaceButtonProps {
  label: string;
  selected: boolean;
  onClick: () => void;
}

function PaceButton({ label, selected, onClick }: PaceButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-10 px-5 rounded-full text-sm font-medium transition-colors ${
        selected
          ? 'bg-primary text-primary-foreground'
          : 'bg-card border border-border text-foreground hover:bg-accent'
      }`}
    >
      {label}
    </button>
  );
}

const VOICES = [
  { name: 'Clara', description: 'Calm and encouraging.', fullDescription: 'Calm and encouraging, with a steady pace that works well for most students.' },
  { name: 'Marcus', description: 'Clear and steady.', fullDescription: 'Clear and steady, with articulate pronunciation that helps with complex topics.' },
  { name: 'Priya', description: 'Warm and patient.', fullDescription: 'Warm and patient, ideal for learners who need extra time to process.' },
  { name: 'Leo', description: 'Light and upbeat.', fullDescription: 'Light and upbeat, keeps energy high during longer study sessions.' },
];

export function VoiceSettingsPage() {
  const router = useRouter();
  const { name: displayName, initial: displayInitial } = useDisplayName();
  const [sidebarExpanded, setSidebarExpanded] = useState(true);

  const [voiceSessions, setVoiceSessions] = useState(true);
  const [autoFollow, setAutoFollow] = useState(true);
  const [selectedVoice, setSelectedVoice] = useState('Clara');
  const [teachingPace, setTeachingPace] = useState('Normal');

  const featuredVoice = VOICES.find((v) => v.name === selectedVoice) || VOICES[0];

  return (
    <div className="min-h-screen h-screen flex bg-background text-foreground overflow-hidden">
      <AppSidebar
        variant="home"
        expanded={sidebarExpanded}
        onExpandedChange={setSidebarExpanded}
        currentSessionTitle={null}
        isSessionActive={false}
        onNewSession={() => router.push('/')}
      />

      <div className="flex-1 min-w-0 flex flex-col overflow-y-auto">
        <div className="px-14 pt-10 pb-16 max-w-[920px]">
          <h1 className="text-[32px] font-semibold tracking-tight text-foreground">
            Voice & teaching
          </h1>
          <p className="text-[15px] text-muted-foreground mt-2">
            Control how live lessons behave while Mathlon teaches.
          </p>

          <div className="mt-8 bg-card border border-border rounded-2xl overflow-hidden">
            {/* Card header */}
            <div className="px-6 pt-6 pb-4">
              <p className="text-[15px] font-semibold text-foreground">
                Voice & teaching
              </p>
              <p className="text-[13px] text-muted-foreground mt-1">
                Controls for live math sessions.
              </p>
            </div>

            {/* Voice sessions toggle */}
            <div className="px-6 py-4 border-t border-border">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-foreground">Voice sessions</p>
                  <p className="text-[13px] text-muted-foreground">
                    Hold space to talk with Mathlon
                  </p>
                </div>
                <Toggle checked={voiceSessions} onCheckedChange={setVoiceSessions} />
              </div>
            </div>

            {/* Auto-follow canvas toggle */}
            <div className="px-6 py-4 border-t border-border">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-foreground">Auto-follow canvas</p>
                  <p className="text-[13px] text-muted-foreground">
                    Pan to the active teaching step
                  </p>
                </div>
                <Toggle checked={autoFollow} onCheckedChange={setAutoFollow} />
              </div>
            </div>

            {/* Tutor voice */}
            <div className="px-6 pt-6 pb-4 border-t border-border">
              <p className="text-sm font-medium text-foreground">Tutor voice</p>
              <p className="text-[13px] text-muted-foreground mt-1">
                Pick a preset voice for live lessons. Custom or cloned voices are not available in beta.
              </p>
            </div>

            {/* Featured voice card */}
            <div className="px-6 pb-6">
              <div className="flex items-start gap-4 p-4 rounded-xl bg-secondary/50">
                <div className="w-14 h-14 rounded-full bg-[#e8ddd0] shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{featuredVoice.name}</p>
                  <p className="text-[13px] text-muted-foreground mt-0.5">
                    {featuredVoice.fullDescription}
                  </p>
                  <button
                    type="button"
                    className="mt-3 inline-flex items-center gap-2 h-8 px-3 rounded-lg bg-card border border-border text-xs font-medium text-foreground hover:bg-accent transition-colors"
                  >
                    <Play className="w-3 h-3" />
                    Hear sample voice
                  </button>
                </div>
              </div>
            </div>

            {/* Voice grid */}
            <div className="px-6 pb-6 grid grid-cols-2 gap-3">
              {VOICES.map((voice) => (
                <VoiceOption
                  key={voice.name}
                  name={voice.name}
                  description={voice.description}
                  selected={selectedVoice === voice.name}
                  onSelect={() => setSelectedVoice(voice.name)}
                />
              ))}
            </div>

            {/* Note */}
            <div className="px-6 pb-6">
              <p className="text-[13px] text-muted-foreground">
                These map to a small curated set of ElevenLabs voices. We are not exposing the full voice library or voice cloning in the product.
              </p>
            </div>

            {/* Teaching pace */}
            <div className="px-6 pt-6 pb-4 border-t border-border">
              <p className="text-sm font-medium text-foreground">Teaching pace</p>
              <p className="text-[13px] text-muted-foreground mt-1">
                How quickly Mathlon explains and advances steps. You can still change pace during a lesson.
              </p>
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <PaceButton
                label="Slower"
                selected={teachingPace === 'Slower'}
                onClick={() => setTeachingPace('Slower')}
              />
              <PaceButton
                label="Normal"
                selected={teachingPace === 'Normal'}
                onClick={() => setTeachingPace('Normal')}
              />
              <PaceButton
                label="Faster"
                selected={teachingPace === 'Faster'}
                onClick={() => setTeachingPace('Faster')}
              />
            </div>

            {/* Footer actions */}
            <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => router.push('/settings')}
                className="h-10 px-5 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => router.push('/settings')}
                className="h-10 px-5 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Save voice settings
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
