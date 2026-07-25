/** Sequential: bottom in (left) → top in (right) → pause → top out → bottom out. */
export function MathlonMarkLoader({ className = '' }: { className?: string }) {
  return (
    <div className={`relative w-16 h-16 text-primary ${className}`} aria-hidden="true">
      <svg
        width="64"
        height="64"
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute inset-0"
      >
        <rect
          x="6"
          y="22"
          width="21"
          height="12"
          rx="2.5"
          fill="currentColor"
          className="animate-mark-draw-bottom"
        />
        <rect
          x="13"
          y="8"
          width="21"
          height="12"
          rx="2.5"
          fill="currentColor"
          className="animate-mark-draw-top"
        />
      </svg>
    </div>
  );
}
