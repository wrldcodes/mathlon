'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppSidebar } from './AppSidebar';
import { useDisplayName } from '../hooks/useDisplayName';

const LEVELS = ['Middle school', 'High school', 'University', 'Self-learner'];

const TOPICS = [
  'Algebra',
  'Calculus',
  'Geometry',
  'Trigonometry',
  'Statistics',
  'Discrete math',
];

const GOALS = ['Pass exams', 'Deep understanding', 'Homework help', 'Just exploring'];

const STYLES = ['Step-by-step', 'Visual', 'Practice-heavy', 'Mix it up'];

interface ChoiceGridProps {
  options: string[];
  selected: string[];
  onToggle: (option: string) => void;
  multiple?: boolean;
}

function ChoiceGrid({ options, selected, onToggle, multiple = true }: ChoiceGridProps) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {options.map((option) => {
        const isSelected = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => onToggle(option)}
            className={`h-[38px] px-4 rounded-xl text-sm font-medium border transition-colors ${
              isSelected
                ? 'bg-foreground text-background border-foreground'
                : 'bg-card text-foreground border-border hover:border-foreground/50'
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

export function LearningProfilePage() {
  const router = useRouter();
  const { name: displayName, initial: displayInitial } = useDisplayName();
  const [sidebarExpanded, setSidebarExpanded] = useState(true);

  const [level, setLevel] = useState<string[]>(['University']);
  const [topics, setTopics] = useState<string[]>(['Calculus', 'Geometry', 'Statistics']);
  const [goal, setGoal] = useState<string[]>(['Deep understanding']);
  const [style, setStyle] = useState<string[]>(['Step-by-step', 'Visual']);

  const toggleSingle = (setter: React.Dispatch<React.SetStateAction<string[]>>) => (option: string) => {
    setter([option]);
  };

  const toggleMulti = (setter: React.Dispatch<React.SetStateAction<string[]>>) => (option: string) => {
    setter((prev) =>
      prev.includes(option) ? prev.filter((v) => v !== option) : [...prev, option]
    );
  };

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
        <div className="px-14 pt-10 pb-16 max-w-[1100px]">
          <h1 className="text-[32px] font-semibold tracking-tight text-foreground">
            Settings
          </h1>
          <p className="text-[15px] text-muted-foreground mt-2">
            Account, learning preferences, and voice teaching options.
          </p>

          <div className="mt-8 space-y-5 max-w-[920px]">
            {/* Level card */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="mb-4">
                <p className="text-[15px] font-semibold text-foreground">
                  What&apos;s your level?
                </p>
                <p className="text-[13px] text-muted-foreground mt-1">
                  This helps Mathlon adjust explanations to the right depth.
                </p>
              </div>
              <ChoiceGrid
                options={LEVELS}
                selected={level}
                onToggle={toggleSingle(setLevel)}
                multiple={false}
              />
            </div>

            {/* Topics card */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="mb-4">
                <p className="text-[15px] font-semibold text-foreground">
                  Focus topics
                </p>
                <p className="text-[13px] text-muted-foreground mt-1">
                  Pick the areas you want to work on most.
                </p>
              </div>
              <ChoiceGrid
                options={TOPICS}
                selected={topics}
                onToggle={toggleMulti(setTopics)}
              />
            </div>

            {/* Goal card */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="mb-4">
                <p className="text-[15px] font-semibold text-foreground">
                  What&apos;s your goal?
                </p>
                <p className="text-[13px] text-muted-foreground mt-1">
                  Mathlon will tailor sessions to match.
                </p>
              </div>
              <ChoiceGrid
                options={GOALS}
                selected={goal}
                onToggle={toggleSingle(setGoal)}
                multiple={false}
              />
            </div>

            {/* Learning style card */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="mb-4">
                <p className="text-[15px] font-semibold text-foreground">
                  Learning style
                </p>
                <p className="text-[13px] text-muted-foreground mt-1">
                  How do you learn best?
                </p>
              </div>
              <ChoiceGrid
                options={STYLES}
                selected={style}
                onToggle={toggleMulti(setStyle)}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
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
                className="h-10 px-5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Save learning profile
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
