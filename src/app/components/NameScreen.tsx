'use client';

import { useState } from 'react';
import { OnboardingLayout } from './OnboardingLayout';

type NameScreenProps = {
  currentStep: number;
  totalSteps: number;
  onContinue: (name: string) => void;
  onBack: () => void;
};

export function NameScreen({
  currentStep,
  totalSteps,
  onContinue,
  onBack,
}: NameScreenProps) {
  const [name, setName] = useState('');

  return (
    <OnboardingLayout
      step={currentStep}
      totalSteps={totalSteps}
      height={461}
      title="What should Mathlon call you?"
      subtitle="Choose the name your tutor should use during lessons."
      backLabel="Back to sign up"
      onBack={onBack}
      onContinue={() => name.trim() && onContinue(name.trim())}
      continueDisabled={!name.trim()}
    >
      <div className="space-y-2">
        <label htmlFor="preferred-name" className="text-[15px] font-medium text-[#2d2d2d]">
          Preferred name
        </label>
        <input
          id="preferred-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Somtochukwu"
          className="w-full h-12 px-4 rounded-[10px] bg-[#f3f3f5] border border-[#d9d4c9] text-[13px] text-[#2d2d2d] placeholder:text-[#717182] focus:outline-none focus:ring-2 focus:ring-[#030213]/20"
        />
      </div>
    </OnboardingLayout>
  );
}
