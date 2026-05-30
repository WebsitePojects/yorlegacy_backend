import { findMemberProfileByUserId } from '../auth/app-users.js';
import { buildMemberOfficeSnapshot } from '../operations/hybrid-operational-data.js';
import type { MemberOfficeData, SessionUser } from '../../types/auth';

export async function buildMemberOffice(user: SessionUser): Promise<MemberOfficeData> {
  const profile = await findMemberProfileByUserId(user.id);
  return buildMemberOfficeSnapshot(user, profile);
}
