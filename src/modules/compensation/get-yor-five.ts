// Get Yor Five group lifecycle (owner sign-off item 5, 2026-06-13).
// A sponsor's qualified same-package directs are grouped into batches of five.
// Each group has a 3-month window starting at its first direct's join date.
// - 5 within window  => COMPLETE (credited once; completedAt = 5th direct's join)
// - window expired with < 5 => VOID (retained for history, never credited; its
//   directs are consumed and a fresh group starts from the next direct)
// - window still open with < 5 => OPEN (shows remaining target + remaining days)
// Group `index` numbers only COMPLETE groups (1,2,3,...) so payout process keys
// stay stable; void/open groups carry index = null.
import { addManilaMonths } from './cap-windows.js';

const GROUP_SIZE = 5;
const WINDOW_MONTHS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

export type GyfDirect = {
  memberUserId: string;
  joinedAt: string; // ISO
};

export type GyfGroupStatus = 'complete' | 'open' | 'void';

export type GyfGroup = {
  index: number | null; // sequential number among COMPLETE groups; null otherwise
  status: GyfGroupStatus;
  memberUserIds: string[];
  startDate: string; // first direct's joinedAt
  deadline: string; // startDate + 3 Manila months
  completedAt: string | null; // 5th direct's joinedAt for complete groups
  remainingNeeded: number; // GROUP_SIZE - members for open/void; 0 for complete
  remainingDays: number; // days from asOf to deadline for open groups; 0 otherwise
};

export function computeGetYorFiveGroups(
  directsInput: GyfDirect[],
  options: { asOf: string; windowMonths?: number; groupSize?: number }
): GyfGroup[] {
  const windowMonths = options.windowMonths ?? WINDOW_MONTHS;
  const groupSize = options.groupSize ?? GROUP_SIZE;
  const asOfMs = new Date(options.asOf).getTime();

  const directs = [...directsInput].sort((a, b) => {
    const t = new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
    return t !== 0 ? t : a.memberUserId.localeCompare(b.memberUserId);
  });

  const groups: GyfGroup[] = [];
  let completeIndex = 0;
  let i = 0;

  while (i < directs.length) {
    const start = directs[i];
    const deadline = addManilaMonths(start.joinedAt, windowMonths);
    const deadlineMs = new Date(deadline).getTime();

    const members: GyfDirect[] = [];
    let j = i;
    while (
      j < directs.length &&
      members.length < groupSize &&
      new Date(directs[j].joinedAt).getTime() <= deadlineMs
    ) {
      members.push(directs[j]);
      j += 1;
    }

    if (members.length === groupSize) {
      completeIndex += 1;
      groups.push({
        index: completeIndex,
        status: 'complete',
        memberUserIds: members.map((m) => m.memberUserId),
        startDate: start.joinedAt,
        deadline,
        completedAt: members[groupSize - 1].joinedAt,
        remainingNeeded: 0,
        remainingDays: 0
      });
      i = j;
      continue;
    }

    // Fewer than groupSize collected for this window.
    if (asOfMs <= deadlineMs) {
      // Window still open. Every existing direct joined at or before asOf <=
      // deadline, so the loop above already absorbed all remaining directs into
      // this group; it is the trailing group.
      groups.push({
        index: null,
        status: 'open',
        memberUserIds: members.map((m) => m.memberUserId),
        startDate: start.joinedAt,
        deadline,
        completedAt: null,
        remainingNeeded: groupSize - members.length,
        remainingDays: Math.max(0, Math.ceil((deadlineMs - asOfMs) / DAY_MS))
      });
      break;
    }

    // Window expired without completing — void and continue from the next direct.
    groups.push({
      index: null,
      status: 'void',
      memberUserIds: members.map((m) => m.memberUserId),
      startDate: start.joinedAt,
      deadline,
      completedAt: null,
      remainingNeeded: groupSize - members.length,
      remainingDays: 0
    });
    i = j;
  }

  return groups;
}
