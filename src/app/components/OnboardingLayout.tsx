'use client';

import type { ReactNode } from 'react';
import { MathlonMark } from './MathlonMark';

type OnboardingLayoutProps = {
  step: number;
  totalSteps: number;
  title: string;
  subtitle: string;
  backLabel?: string;
  onBack: () => void;
  onContinue: () => void;
  continueDisabled?: boolean;
  children: ReactNode;
};

/**
 * Shared onboarding card shell — logo, step pill, progress bar, title/subtitle,
 * content slot, continue button, back link. Every screen in the onboarding flow
 * wraps its unique content in this layout.
 *
 * Card height is determined by content; the footer (continue + back) is always
 * pinned 84px / 64px from the bottom.
 */
export function OnboardingLayout({
  step,
  totalSteps,
  title,
  subtitle,
  backLabel = 'Back',
  onBack,
  onContinue,
  continueDisabled = false,
  children,
}: OnboardingLayoutProps) {
  const progressWidth = (step / totalSteps) * 400;

  return (
    <div className="min-h-screen h-screen flex items-center justify-center bg-background">
      <div
        className="relative bg-card rounded-2xl overflow-hidden"
        style={{
          width: 480,
          boxShadow: '0px 2px 8px 0px rgba(0,0,0,0.04), 0px 8px 40px 0px rgba(0,0,0,0.07)',
        }}
      >
        {/* Logo + wordmark */}
        <div className="absolute left-10 top-12 flex items-center">
          <MathlonMark size={28} />
          <span className="ml-2 text-[22px] font-bold text-[#030213]">mathlon</span>
        </div>

        {/* Step pill */}
        <div className="absolute left-[340px] top-[47px] h-[30px] w-[100px] rounded-full bg-[#f6f7f9] border border-[#e7eaee] flex items-center justify-center">
          <span className="text-[12px] font-semibold text-[#4b5563]">
            Step {step} of {totalSteps}
          </span>
        </div>

        {/* Progress track */}
        <div className="absolute left-10 top-[92px] w-[400px] h-1 rounded-full bg-[#e7eaee]" />
        {/* Progress fill */}
        <div
          className="absolute left-10 top-[92px] h-1 rounded-full bg-[#111827]"
          style={{ width: progressWidth }}
        />

        {/* Title */}
        <p className="absolute left-10 top-[120px] w-[400px] text-[24px] font-semibold leading-8 text-[#111827]">
          {title}
        </p>

        {/* Subtitle */}
        <p className="absolute left-10 top-[156px] w-[400px] text-[14px] leading-[22px] text-[#6b7280]">
          {subtitle}
        </p>

        {/* Content slot — starts 214px from top, same as first option in LevelSelectScreen */}
        <div className="absolute left-10 top-[214px] w-[400px]">
          {children}
        </div>

        {/* Continue button — 84px from bottom */}
        <button
          type="button"
          disabled={continueDisabled}
          onClick={onContinue}
          className="absolute left-10 bottom-[64px] w-[400px] h-12 rounded-[10px] bg-[#030213] text-white text-[13px] font-semibold hover:bg-[#030213]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Continue
        </button>

        {/* Back link — 64px from bottom (behind button) */}
        <button
          type="button"
          onClick={onBack}
          className="absolute left-10 bottom-[44px] w-[400px] text-center text-[12px] font-medium text-[#717182] hover:text-[#030213] transition-colors"
        >
          {backLabel}
        </button>
      </div>
    </div>
  );
}
