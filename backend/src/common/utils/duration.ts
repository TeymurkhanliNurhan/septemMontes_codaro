const UNIT_TO_MS: Readonly<Record<string, number>> = {
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

const DURATION_PATTERN = /^(\d+)(ms|s|m|h|d)?$/;

export function parseDuration(
  value: string | undefined,
  fallback: number,
): number {
  const match = DURATION_PATTERN.exec(value?.trim() ?? '');
  if (!match) {
    return fallback;
  }
  return Number(match[1]) * UNIT_TO_MS[match[2] ?? 'ms'];
}
