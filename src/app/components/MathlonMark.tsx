type MathlonMarkProps = {
  size?: number;
};

export function MathlonMark({ size = 40 }: MathlonMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect x="6" y="22" width="21" height="12" rx="2.5" fill="currentColor" />
      <rect x="13" y="8" width="21" height="12" rx="2.5" fill="currentColor" />
    </svg>
  );
}
