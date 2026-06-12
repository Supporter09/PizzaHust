export function etaMinutes(promisedAt: string, now: Date): number {
  const promised = new Date(promisedAt).getTime();
  const diffMs = promised - now.getTime();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / 60_000);
}