'use client';

import { useState } from 'react';
import { OnboardingLayout } from './OnboardingLayout';

type Goal = {
  id: string;
  label: string;
  description: string;
};

const GOALS: Goal[] = [
  { id: 'pass-exams', label: 'Pass exams', description: 'Revision, speed, and common question patterns' },
  { id: 'deep-understanding', label: 'Deep understanding', description: 'Proofs, intuition, and visual reasoning' },
  { id: 'homework-help', label: 'Homework help', description: 'Guided steps without skipping the thinking' },
  { id: 'just-exploring', label: 'Just exploring', description: 'Curious explanations across topics' },
];

type GoalScreenProps = {
  currentStep: number;
  totalSteps: number;
  onContinue: (goal: string) => void;
  onBack: () => void;
};

export function GoalScreen({
  currentStep,
  totalSteps,
  onContinue,
  onBack,
}: GoalScreenProps) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <OnboardingLayout
      step={currentStep}
      totalSteps={totalSteps}
      height={691}
      contentPaddingTop={4}
      title="What are you trying to achieve?"
      subtitle="Your goal changes how direct or exploratory the tutor should be."
      onBack={onBack}
      onContinue={() => selected && onContinue(selected)}
      continueDisabled={!selected}
    >
      <div className="space-y-2.5">
        {GOALS.map((goal) => {
          const isSelected = selected === goal.id;
          return (
            <button
              key={goal.id}
              type="button"
              onClick={() => setSelected(goal.id)}
              className="relative w-full h-[70px] rounded-xl text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{
                background: isSelected ? '#e8e4d9' : '#ffffff',
                border: isSelected ? '1.5px solid #030213' : '1px solid #d9d4c9',
              }}
            >
              <span
                className="absolute text-[15px] font-semibold text-[#2d2d2d]"
                style={{ left: isSelected ? 16.5 : 17, top: isSelected ? 14.5 : 15 }}
              >
                {goal.label}
              </span>
              <span
                className="absolute text-[12px] text-[#717182]"
                style={{ left: isSelected ? 16.5 : 17, top: isSelected ? 40.5 : 41 }}
              >
                {goal.description}
              </span>
            </button>
          );
        })}
      </div>
    </OnboardingLayout>
  );
}
