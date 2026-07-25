/** Free-demo session length, in seconds. Shared by the server (session
 * creation, where the expiry deadline is anchored) and the client
 * (countdown display) so both sides agree without duplicating the value. */
export const DEFAULT_DEMO_DURATION_SECONDS = 300;

export function getDemoDurationSeconds(): number {
  const raw = Number(process.env.NEXT_PUBLIC_DEMO_DURATION_SECONDS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_DEMO_DURATION_SECONDS;
}
