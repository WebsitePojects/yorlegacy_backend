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
