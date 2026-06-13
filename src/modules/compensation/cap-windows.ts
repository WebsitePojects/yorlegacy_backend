// Cap windows for salesmatch payouts. Business weeks run Monday 00:00 to
// Sunday 24:00 Asia/Manila (UTC+8, no DST); months are Manila calendar months.
// Pending company confirmation of the exact cutover instant — recorded in
// docs/qa/pending-company-decisions-2026-06.md.
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

export function manilaWeekStartIso(nowIso: string): string {
  const manila = new Date(new Date(nowIso).getTime() + MANILA_OFFSET_MS);
  const daysSinceMonday = (manila.getUTCDay() + 6) % 7;
  const mondayMidnight = Date.UTC(manila.getUTCFullYear(), manila.getUTCMonth(), manila.getUTCDate() - daysSinceMonday);
  return new Date(mondayMidnight - MANILA_OFFSET_MS).toISOString();
}

export function manilaMonthStartIso(nowIso: string): string {
  const manila = new Date(new Date(nowIso).getTime() + MANILA_OFFSET_MS);
  const firstMidnight = Date.UTC(manila.getUTCFullYear(), manila.getUTCMonth(), 1);
  return new Date(firstMidnight - MANILA_OFFSET_MS).toISOString();
}

export function manilaDateKey(nowIso: string): string {
  const manila = new Date(new Date(nowIso).getTime() + MANILA_OFFSET_MS);
  return manila.toISOString().slice(0, 10);
}

// Adds whole calendar months in Manila time, preserving the Manila time-of-day
// and clamping the day to the target month's last day (Jan 31 + 1mo => Feb 28/29).
// Used for the Get Yor Five 3-month group window (owner sign-off item 5).
export function addManilaMonths(nowIso: string, months: number): string {
  const manila = new Date(new Date(nowIso).getTime() + MANILA_OFFSET_MS);
  const year = manila.getUTCFullYear();
  const month = manila.getUTCMonth() + months;
  const day = manila.getUTCDate();
  const targetYear = year + Math.floor(month / 12);
  const targetMonth = ((month % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const clampedDay = Math.min(day, lastDay);
  const manilaTarget = Date.UTC(
    targetYear,
    targetMonth,
    clampedDay,
    manila.getUTCHours(),
    manila.getUTCMinutes(),
    manila.getUTCSeconds(),
    manila.getUTCMilliseconds()
  );
  return new Date(manilaTarget - MANILA_OFFSET_MS).toISOString();
}
