'use client';

import { OnboardingLayout } from './OnboardingLayout';

type ReadyScreenProps = {
  currentStep: number;
  totalSteps: number;
  name: string;
  onStartLearning: () => void;
  onBack: () => void;
};

export function ReadyScreen({
  currentStep,
  totalSteps,
  name,
  onStartLearning,
  onBack,
}: ReadyScreenProps) {
  return (
    <OnboardingLayout
      step={currentStep}
      totalSteps={totalSteps}
      height={476}
      contentPaddingTop={142}
      variant="ready"
      title={`You're all set, ${name}`}
      subtitle="Mathlon is ready to shape lessons around your level, goals, and preferred teaching style."
      continueLabel="Start learning"
      onBack={onBack}
      onContinue={onStartLearning}
      continueDisabled={false}
    >
      <div className="flex flex-col items-center">
        {/* Success checkmark */}
        <div className="w-22 h-22 rounded-full bg-[#030213] flex items-center justify-center mb-6">
          <svg
            className="w-10 h-10 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>
    </OnboardingLayout>
  );
}
