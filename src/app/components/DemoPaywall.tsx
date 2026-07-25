'use client';

import { MathBackdrop } from './MathBackdrop';

const FEATURES = [
  '15 voice minutes every day',
  'Canvas that draws as you talk',
  'Every step-by-step diagram',
  'Top up minutes anytime',
];

interface DemoPaywallProps {
  /** `overlay` covers the full canvas after the countdown expires; `inline` sits in place of the topic chips on a return visit. */
  variant: 'overlay' | 'inline';
  /** Only shown for the overlay variant, right after the countdown hits zero. */
  onDismiss?: () => void;
  /** The topic just taught, for a small personalized recap. */
  topic?: string;
}

export function DemoPaywall({ variant, onDismiss, topic }: DemoPaywallProps) {
  const checkoutUrl = process.env.NEXT_PUBLIC_BETA_CHECKOUT_URL;

  // Solid, opaque card — nothing shows through or sits behind it.
  const card = (
    <div className="relative z-10 w-full max-w-md rounded-2xl bg-card border-2 border-primary shadow-2xl p-7 text-center">
      <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">
        {variant === 'overlay' ? "Time's up" : 'Free demo used'}
      </p>
      <h3 className="text-2xl font-semibold mb-2">Ready to keep learning with Mathlon?</h3>

      {topic ? (
        <p className="inline-flex items-center gap-1.5 mb-4 px-3 py-1.5 rounded-full bg-accent text-xs font-medium text-foreground">
          You just explored <span className="font-semibold">{topic}</span>
        </p>
      ) : null}

      <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
        That was a real Mathlon session — voice, canvas, and all. Join the founding Beta to keep
        going, at a price that&apos;s locked in for as long as you stay subscribed.
      </p>

      <ul className="text-left space-y-2 mb-5 max-w-[280px] mx-auto">
        {FEATURES.map((feature) => (
          <li key={feature} className="flex items-center gap-2.5 text-sm">
            <span className="w-4 h-4 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
              ✓
            </span>
            {feature}
          </li>
        ))}
      </ul>

      <p className="text-3xl font-bold tracking-tight mb-5">
        $7 <span className="text-sm font-medium text-muted-foreground">/ month</span>
      </p>

      {checkoutUrl ? (
        <a
          href={checkoutUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Join the Beta — $7/mo
        </a>
      ) : (
        <button
          type="button"
          disabled
          title="Checkout link coming soon"
          className="block w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-medium opacity-40 cursor-not-allowed"
        >
          Checkout coming soon
        </button>
      )}

      {variant === 'overlay' && onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="mt-3 text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
        >
          Maybe later
        </button>
      )}

      <p
        className="mt-5 text-lg text-muted-foreground"
        style={{ fontFamily: 'var(--font-handwritten)' }}
      >
        Thanks for trying Mathlon — this price is yours for life.
      </p>
    </div>
  );

  // Inline: the home screen already renders MathBackdrop, so just drop the card in.
  if (variant === 'inline') return card;

  // Overlay: fully opaque background (nothing from the canvas bleeds through),
  // decorated with the same ambient backdrop, card sits solid on top.
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-background px-4">
      <MathBackdrop />
      {card}
    </div>
  );
}
