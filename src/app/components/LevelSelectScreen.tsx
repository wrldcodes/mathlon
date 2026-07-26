'use client';

import { useState } from 'react';
import { OnboardingLayout } from './OnboardingLayout';

export type Level = 'foundations' | 'exam-prep' | 'university' | 'self-learner';

const LEVELS: { id: Level; label: string; description: string }[] = [
  { id: 'foundations', label: 'Foundations', description: 'Arithmetic, algebra basics, and core skills' },
  { id: 'exam-prep', label: 'Exam prep', description: 'Algebra, geometry, trig, and test practice' },
  { id: 'university', label: 'University', description: 'Calculus, linear algebra, proofs' },
  { id: 'self-learner', label: 'Self-learner', description: 'Flexible explanations at your pace' },
];

type LevelSelectScreenProps = {
  currentStep: number;
  totalSteps: number;
  onContinue: (level: Level) => void;
  onBack: () => void;
};

export function LevelSelectScreen({
  currentStep,
  totalSteps,
  onContinue,
  onBack,
}: LevelSelectScreenProps) {
  const [selected, setSelected] = useState<Level | null>(null);

  return (
    <OnboardingLayout
      step={currentStep}
      totalSteps={totalSteps}
      title="What level are you studying?"
      subtitle="This helps Mathlon choose the right pace, notation, and examples."
      onBack={onBack}
      onContinue={() => selected && onContinue(selected)}
      continueDisabled={!selected}
    >
      <div className="space-y-2.5">
        {LEVELS.map((level, i) => {
          const isSelected = selected === level.id;
          return (
            <button
              key={level.id}
              type="button"
              onClick={() => setSelected(level.id)}
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
                {level.label}
              </span>
              <span
                className="absolute text-[12px] text-[#717182]"
                style={{ left: isSelected ? 16.5 : 17, top: isSelected ? 40.5 : 41 }}
              >
                {level.description}
              </span>
            </button>
          );
        })}
      </div>
    </OnboardingLayout>
  );
}
