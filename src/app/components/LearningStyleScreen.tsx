'use client';

import { useState } from 'react';
import { OnboardingLayout } from './OnboardingLayout';

type LearningStyle = {
  id: string;
  label: string;
  description: string;
};

const STYLES: LearningStyle[] = [
  { id: 'step-by-step', label: 'Step-by-step', description: 'Break each solution into small checkpoints' },
  { id: 'visual', label: 'Visual', description: 'Use diagrams and board layouts whenever useful' },
  { id: 'practice-heavy', label: 'Practice-heavy', description: 'Ask you to try steps before revealing them' },
  { id: 'mix-it-up', label: 'Mix it up', description: 'Adapt based on the question and your answers' },
];

type LearningStyleScreenProps = {
  currentStep: number;
  totalSteps: number;
  onContinue: (style: string) => void;
  onBack: () => void;
};

export function LearningStyleScreen({
  currentStep,
  totalSteps,
  onContinue,
  onBack,
}: LearningStyleScreenProps) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <OnboardingLayout
      step={currentStep}
      totalSteps={totalSteps}
      height={691}
      contentPaddingTop={4}
      title="How should Mathlon teach?"
      subtitle="Choose the default teaching style for voice and canvas lessons."
      onBack={onBack}
      onContinue={() => selected && onContinue(selected)}
      continueDisabled={!selected}
    >
      <div className="space-y-2.5">
        {STYLES.map((style) => {
          const isSelected = selected === style.id;
          return (
            <button
              key={style.id}
              type="button"
              onClick={() => setSelected(style.id)}
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
                {style.label}
              </span>
              <span
                className="absolute text-[12px] text-[#717182]"
                style={{ left: isSelected ? 16.5 : 17, top: isSelected ? 40.5 : 41 }}
              >
                {style.description}
              </span>
            </button>
          );
        })}
      </div>
    </OnboardingLayout>
  );
}
