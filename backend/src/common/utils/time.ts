/** HH:mm (00:00–23:59) */
export const HH_MM_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** YYYY-MM-DD */
export const DATE_YMD_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseHhMmToMinutes(time: string): number {
  const [hours, minutes] = time.slice(0, 5).split(':').map(Number);
  return hours * 60 + minutes;
}

export function isValidHhMm(time: string): boolean {
  return HH_MM_PATTERN.test(time);
}

export function isEndAfterStart(startTime: string, endTime: string): boolean {
  return parseHhMmToMinutes(startTime) < parseHhMmToMinutes(endTime);
}

/** Half-open style: intervals overlap when startA < endB && startB < endA */
export function timesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  return (
    parseHhMmToMinutes(startA) < parseHhMmToMinutes(endB) &&
    parseHhMmToMinutes(startB) < parseHhMmToMinutes(endA)
  );
}

export function formatTimeHhMm(value: string | Date): string {
  if (value instanceof Date) {
    const hours = String(value.getUTCHours()).padStart(2, '0');
    const minutes = String(value.getUTCMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }
  return String(value).slice(0, 5);
}

export function formatDateYmd(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).slice(0, 10);
}
