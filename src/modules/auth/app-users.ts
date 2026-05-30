import { getSupabaseClient } from '../../lib/supabase.js';
import {
  findSandboxAdminProfileByUserId,
  findSandboxMemberProfileByUserId,
  findSandboxUserByEmail,
  isSandboxMode
} from '../sandbox/dev-sandbox-store.js';
import type { AppRole, SessionUser } from '../../types/auth';

type AppUserRow = {
  id: string;
  email: string;
  display_name: string;
  role: AppRole;
  status: string;
  password_hash: string;
  password_salt: string;
};

type MemberProfileRow = {
  referral_code: string | null;
  sponsor_code: string | null;
  package_tier: string | null;
  account_status: string | null;
};

type AdminProfileRow = {
  access_scope: string | null;
  office_title: string | null;
};

export type PersistedUser = SessionUser & {
  passwordHash: string;
  passwordSalt: string;
  status: string;
};

export type PersistedMemberProfile = {
  referralCode?: string;
  sponsorCode?: string;
  packageTier?: string;
  accountStatus?: string;
};

export type PersistedAdminProfile = {
  accessScope?: string;
  officeTitle?: string;
};

function toSessionUser(row: AppUserRow): PersistedUser {
  return {
    id: row.id,
    name: row.display_name,
    email: row.email,
    role: row.role,
    passwordHash: row.password_hash,
    passwordSalt: row.password_salt,
    status: row.status
  };
}

export async function findAppUserByEmail(
  email: string
): Promise<PersistedUser | null> {
  if (isSandboxMode()) {
    const sandboxUser = findSandboxUserByEmail(email);

    if (!sandboxUser) {
      return null;
    }

    return {
      id: sandboxUser.id,
      name: sandboxUser.name,
      email: sandboxUser.email,
      role: sandboxUser.role,
      passwordHash: sandboxUser.passwordHash,
      passwordSalt: sandboxUser.passwordSalt,
      status: sandboxUser.status
    };
  }

  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('app_users')
    .select(
      'id,email,display_name,role,status,password_hash,password_salt'
    )
    .eq('email', email.trim().toLowerCase())
    .maybeSingle<AppUserRow>();

  if (error || !data) {
    return null;
  }

  return toSessionUser(data);
}

export async function findMemberProfileByUserId(
  userId: string
): Promise<PersistedMemberProfile | null> {
  if (isSandboxMode()) {
    const sandboxProfile = findSandboxMemberProfileByUserId(userId);

    if (!sandboxProfile) {
      return null;
    }

    return {
      referralCode: sandboxProfile.referralCode,
      sponsorCode: sandboxProfile.sponsorCode,
      packageTier: sandboxProfile.packageTier,
      accountStatus: sandboxProfile.accountStatus
    };
  }

  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('member_profiles')
    .select('referral_code,sponsor_code,package_tier,account_status')
    .eq('user_id', userId)
    .maybeSingle<MemberProfileRow>();

  if (error || !data) {
    return null;
  }

  return {
    referralCode: data.referral_code ?? undefined,
    sponsorCode: data.sponsor_code ?? undefined,
    packageTier: data.package_tier ?? undefined,
    accountStatus: data.account_status ?? undefined
  };
}

export async function findAdminProfileByUserId(
  userId: string
): Promise<PersistedAdminProfile | null> {
  if (isSandboxMode()) {
    const sandboxProfile = findSandboxAdminProfileByUserId(userId);

    if (!sandboxProfile) {
      return null;
    }

    return {
      accessScope: sandboxProfile.accessScope,
      officeTitle: sandboxProfile.officeTitle
    };
  }

  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('admin_profiles')
    .select('access_scope,office_title')
    .eq('user_id', userId)
    .maybeSingle<AdminProfileRow>();

  if (error || !data) {
    return null;
  }

  return {
    accessScope: data.access_scope ?? undefined,
    officeTitle: data.office_title ?? undefined
  };
}
