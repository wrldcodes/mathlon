'use client';

import geometryArt from '../../assets/illustrations/geometry.svg';
import infinityArt from '../../assets/illustrations/infinity.svg';
import algebraArt from '../../assets/illustrations/algebra.svg';
import lightbulbArt from '../../assets/illustrations/lightbulb.svg';

/**
 * Ambient decoration for otherwise-empty screens: hand-drawn brand illustrations
 * tucked into the four corners, plus scattered handwritten equations around the
 * perimeter. Everything hugs the edges so the center stays clear for content —
 * nothing is ever placed where a card or chips would sit.
 */

type Eq = { text: string; className: string; rotate: number; size: string };

const EQUATIONS: Eq[] = [
  { text: 'a² + b² = c²', className: 'top-[12%] left-[7%]', rotate: -8, size: 'text-2xl' },
  { text: '√2', className: 'top-[7%] left-[26%]', rotate: 6, size: 'text-3xl' },
  { text: 'eⁱᵖ + 1 = 0', className: 'top-[10%] right-[8%]', rotate: 7, size: 'text-2xl' },
  { text: 'dy/dx', className: 'top-[24%] left-[58%]', rotate: -5, size: 'text-xl' },
  { text: '∫ f(x) dx', className: 'top-[45%] left-[5%]', rotate: 4, size: 'text-2xl' },
  { text: 'π r²', className: 'top-[42%] right-[6%]', rotate: -6, size: 'text-2xl' },
  { text: 'Σ n = n(n+1)/2', className: 'bottom-[24%] left-[8%]', rotate: 5, size: 'text-xl' },
  { text: 'sin²θ + cos²θ = 1', className: 'bottom-[26%] right-[7%]', rotate: -4, size: 'text-xl' },
  { text: 'lim x→∞', className: 'bottom-[9%] left-[24%]', rotate: -7, size: 'text-2xl' },
  { text: 'x = (−b ± √(b²−4ac)) / 2a', className: 'bottom-[8%] right-[16%]', rotate: 5, size: 'text-lg' },
];

export function MathBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden select-none" aria-hidden="true">
      {/* Corner illustrations */}
      <img
        src={geometryArt.src}
        alt=""
        className="absolute -top-8 -left-10 w-44 md:w-56 opacity-[0.30] -rotate-6"
      />
      <img
        src={infinityArt.src}
        alt=""
        className="absolute top-4 -right-10 w-44 md:w-56 opacity-[0.30] rotate-6"
      />
      <img
        src={algebraArt.src}
        alt=""
        className="absolute -bottom-10 -left-8 w-44 md:w-56 opacity-[0.30] rotate-3"
      />
      <img
        src={lightbulbArt.src}
        alt=""
        className="absolute -bottom-6 -right-6 w-32 md:w-40 opacity-[0.28] -rotate-3"
      />

      {/* Scattered handwritten equations */}
      {EQUATIONS.map((eq) => (
        <span
          key={eq.text}
          className={`absolute ${eq.className} ${eq.size} text-foreground/25 whitespace-nowrap`}
          style={{ fontFamily: 'var(--font-handwritten)', transform: `rotate(${eq.rotate}deg)` }}
        >
          {eq.text}
        </span>
      ))}
    </div>
  );
}
