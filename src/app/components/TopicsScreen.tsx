'use client';

import { useState } from 'react';
import { OnboardingLayout } from './OnboardingLayout';

type Topic = {
  id: string;
  label: string;
};

const TOPICS: Topic[] = [
  { id: 'algebra', label: 'Algebra' },
  { id: 'calculus', label: 'Calculus' },
  { id: 'geometry', label: 'Geometry' },
  { id: 'trigonometry', label: 'Trigonometry' },
  { id: 'statistics', label: 'Statistics' },
  { id: 'probability', label: 'Probability' },
  { id: 'linear-algebra', label: 'Linear algebra' },
  { id: 'discrete-math', label: 'Discrete math' },
  { id: 'differential-equations', label: 'Differential equations' },
  { id: 'precalculus', label: 'Precalculus' },
];

type TopicsScreenProps = {
  currentStep: number;
  totalSteps: number;
  onContinue: (topics: string[]) => void;
  onBack: () => void;
};

export function TopicsScreen({
  currentStep,
  totalSteps,
  onContinue,
  onBack,
}: TopicsScreenProps) {
  const [selected, setSelected] = useState<string[]>([]);

  const toggleTopic = (topicId: string) => {
    setSelected((prev) =>
      prev.includes(topicId)
        ? prev.filter((id) => id !== topicId)
        : [...prev, topicId]
    );
  };

  return (
    <OnboardingLayout
      step={currentStep}
      totalSteps={totalSteps}
      height={580}
      contentPaddingTop={6}
      title="What topics should we focus on?"
      subtitle="Pick everything you expect to ask Mathlon about. You can change this later."
      onBack={onBack}
      onContinue={() => selected.length > 0 && onContinue(selected)}
      continueDisabled={selected.length === 0}
    >
      <div className="flex flex-wrap gap-2.5">
        {TOPICS.map((topic) => {
          const isSelected = selected.includes(topic.id);
          return (
            <button
              key={topic.id}
              type="button"
              onClick={() => toggleTopic(topic.id)}
              className="h-10 px-4 rounded-full text-[13px] font-medium transition-colors"
              style={{
                background: isSelected ? '#030213' : '#ffffff',
                border: isSelected ? '1px solid #030213' : '1px solid #d9d4c9',
                color: isSelected ? '#ffffff' : '#2d2d2d',
              }}
            >
              {topic.label}
            </button>
          );
        })}
      </div>
    </OnboardingLayout>
  );
}
