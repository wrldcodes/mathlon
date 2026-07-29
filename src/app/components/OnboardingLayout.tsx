'use client';

import type { ReactNode } from 'react';
import { MathlonMark } from './MathlonMark';

type OnboardingLayoutProps = {
  step: number;
  totalSteps: number;
  height: number;
  title: string;
  subtitle: string;
  contentPaddingTop?: number;
  variant?: 'default' | 'ready';
  backLabel?: string;
  continueLabel?: string;
  onBack: () => void;
  onContinue: () => void;
  continueDisabled?: boolean;
  children: ReactNode;
};

export function OnboardingLayout({
  step,
  totalSteps,
  height,
  title,
  subtitle,
  contentPaddingTop = 0,
  variant = 'default',
  backLabel = 'Back',
  continueLabel = 'Continue',
  onBack,
  onContinue,
  continueDisabled = false,
  children,
}: OnboardingLayoutProps) {
  const progressWidth = (step / totalSteps) * 400;
  const isReady = variant === 'ready';

  return (
    <div className="min-h-screen h-screen flex items-center justify-center bg-[#f5f1e8]">
      <div
        className="relative bg-white overflow-hidden rounded-[16px] flex flex-col"
        style={{
          width: 480,
          height,
          boxShadow: '0px 2px 8px 0px rgba(0,0,0,0.04), 0px 8px 40px 0px rgba(0,0,0,0.07)',
        }}
      >
        {/* Fixed top section */}
        <div className="relative" style={{ height: isReady ? 0 : 210 }}>
          {/* Logo + wordmark */}
          <div className="absolute left-10 top-[48px] flex items-center">
            <MathlonMark size={28} />
            <span className="ml-[8px] text-[22px] font-bold text-[#030213]">mathlon</span>
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
          <p
            className={
              isReady
                ? 'absolute left-10 top-[260px] w-[400px] text-center text-[24px] font-semibold leading-[32px] text-[#111827]'
                : 'absolute left-10 top-[120px] w-[400px] text-[24px] font-semibold leading-[32px] text-[#111827]'
            }
          >
            {title}
          </p>

          {/* Subtitle */}
          <p
            className={
              isReady
                ? 'absolute left-10 top-[304px] w-[400px] text-center text-[14px] leading-[22px] text-[#6b7280]'
                : 'absolute left-10 top-[156px] w-[400px] text-[14px] leading-[22px] text-[#6b7280]'
            }
          >
            {subtitle}
          </p>
        </div>

        {/* Growing content area */}
        <div className="w-[400px]" style={{ marginLeft: 40, paddingTop: contentPaddingTop }}>
          {children}
        </div>

        {/* Spacer pushes footer down */}
        {!isReady && <div className="flex-1" />}

        {/* Fixed footer */}
        {isReady ? (
          <button
            type="button"
            disabled={continueDisabled}
            onClick={onContinue}
            className="absolute left-10 top-[380px] w-[400px] h-12 rounded-[10px] bg-[#030213] text-white text-[13px] font-semibold hover:bg-[#030213]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {continueLabel}
          </button>
        ) : (
        <div className="relative" style={{ height: 132 }}>
          {/* Continue button — 84px from card bottom */}
          <button
            type="button"
            disabled={continueDisabled}
            onClick={onContinue}
            className="absolute left-10 bottom-[84px] w-[400px] h-12 rounded-[10px] bg-[#030213] text-white text-[13px] font-semibold hover:bg-[#030213]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {continueLabel}
          </button>

          {/* Back link — 48px from card bottom (20px gap below button) */}
          <button
            type="button"
            onClick={onBack}
            className="absolute left-10 bottom-[48px] w-[400px] h-4 text-center text-[12px] font-medium text-[#717182] hover:text-[#030213] transition-colors"
          >
            {backLabel}
          </button>
        </div>
        )}
      </div>
    </div>
  );
}
