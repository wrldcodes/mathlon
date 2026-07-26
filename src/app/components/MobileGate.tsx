'use client';

import type { ReactNode } from 'react';
import { useIsMobile } from './ui/use-mobile';
import { MathlonMark } from './MathlonMark';

const EQUATIONS = [
  { text: 'a² + b² = c²', className: 'top-[8%] left-[6%]', rotate: -8, size: 'text-2xl' },
  { text: '∫ f(x) dx', className: 'top-[16%] right-[8%]', rotate: 6, size: 'text-xl' },
  { text: 'π r²', className: 'bottom-[24%] left-[10%]', rotate: -5, size: 'text-2xl' },
  { text: 'lim x→∞', className: 'bottom-[10%] right-[12%]', rotate: 4, size: 'text-xl' },
  { text: 'Σ n', className: 'top-[38%] left-[4%]', rotate: 7, size: 'text-2xl' },
  { text: 'dy/dx', className: 'top-[32%] right-[5%]', rotate: -6, size: 'text-lg' },
  { text: '√2', className: 'top-[6%] left-[30%]', rotate: 5, size: 'text-3xl' },
  { text: 'eⁱᵖ + 1 = 0', className: 'bottom-[6%] left-[20%]', rotate: -4, size: 'text-xl' },
  { text: 'sin²θ + cos²θ = 1', className: 'bottom-[30%] right-[6%]', rotate: 3, size: 'text-lg' },
  { text: 'x = −b ± √b²−4ac / 2a', className: 'top-[50%] right-[4%]', rotate: -7, size: 'text-sm' },
  { text: '∇ × F', className: 'top-[22%] left-[3%]', rotate: 8, size: 'text-xl' },
  { text: 'i² = −1', className: 'bottom-[18%] right-[3%]', rotate: -3, size: 'text-xl' },
];

export function MobileGate({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="relative flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center overflow-hidden">
        {/* Scattered handwritten equations */}
        <div className="pointer-events-none absolute inset-0 select-none" aria-hidden="true">
          {EQUATIONS.map((eq) => (
            <span
              key={eq.text}
              className={`absolute ${eq.className} ${eq.size} text-foreground/20 whitespace-nowrap`}
              style={{
                fontFamily: 'var(--font-handwritten)',
                transform: `rotate(${eq.rotate}deg)`,
              }}
            >
              {eq.text}
            </span>
          ))}
        </div>

        {/* Main card */}
        <div className="relative z-10 w-full max-w-sm rounded-2xl bg-card/80 backdrop-blur-xl border border-border shadow-xl p-8 flex flex-col items-center gap-5">
          <div className="text-5xl">📐</div>

          <div className="flex items-center gap-2">
            <MathlonMark />
            <span className="text-[2rem] font-semibold leading-none tracking-tight text-foreground">
              mathlon
            </span>
          </div>

          <div className="w-8 h-px bg-border" />

          <h1 className="text-base font-medium text-foreground">
            Not available on mobile
          </h1>

          <p className="text-sm leading-relaxed text-muted-foreground max-w-[260px]">
            The teaching canvas and voice experience require a larger screen.
            Please open Mathlon on a desktop or tablet in landscape.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
