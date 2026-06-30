import { getSupabaseClient } from '../../lib/supabase.js';
import {
  findSandboxAdminProfileByUserId,
  findSandboxMemberProfileByUserId,
  findSandboxUserByEmail,
  findSandboxUserByUsername,
  isSandboxMode
} from '../sandbox/dev-sandbox-store.js';
import type { AppRole, SessionUser } from '../../types/auth';
import type { AdminProfileRow, AppUserRow, MemberProfileRow } from '../../types/db';

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
  username?: string;
  fullName?: string;
  payoutMethod?: string;
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

export async function findAppUserByUsername(
  username: string
): Promise<PersistedUser | null> {
  if (isSandboxMode()) {
    const sandboxUser = findSandboxUserByUsername(username);

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

  // 1. Try to find the member profile by username
  const { data: memberProfile, error: memberProfileError } = await supabase
    .from('member_profiles')
    .select('user_id')
    .ilike('username', username.trim())
    .maybeSingle();

  if (memberProfileError) {
    console.error('findAppUserByUsername: member_profiles query error', memberProfileError);
  }

  let targetUserId = memberProfile?.user_id;

  // 2. If not found, check legacy_access_accounts
  if (!targetUserId) {
    const { data: legacyAccount } = await supabase
      .from('legacy_access_accounts')
      .select('display_name')
      .ilike('username', username.trim())
      .maybeSingle();

    if (legacyAccount) {
      const { data: appUser, error: appUserError } = await supabase
        .from('app_users')
        .select('id,email,display_name,role,status,password_hash,password_salt')
        .eq('display_name', legacyAccount.display_name)
        .maybeSingle<AppUserRow>();

      if (!appUserError && appUser) {
        return toSessionUser(appUser);
      }
    }

    // 3. Match admin/staff users by email prefix (username@domain)
    const { data: prefixUser } = await supabase
      .from('app_users')
      .select('id,email,display_name,role,status,password_hash,password_salt')
      .ilike('email', `${username.trim()}@%`)
      .maybeSingle<AppUserRow>();

    if (prefixUser) {
      return toSessionUser(prefixUser);
    }

    // 4. Exact email match — covers staff accounts stored with username-as-email (no domain)
    const { data: exactUser } = await supabase
      .from('app_users')
      .select('id,email,display_name,role,status,password_hash,password_salt')
      .ilike('email', username.trim())
      .maybeSingle<AppUserRow>();

    if (exactUser) {
      return toSessionUser(exactUser);
    }

    // 5. Match by display_name — covers cashier/staff accounts where display_name is their login handle.
    // Intentionally excludes 'member' role: members authenticate by username from member_profiles,
    // not display_name, to prevent stale display_name from granting access after a username change.
    const { data: displayNameUser } = await supabase
      .from('app_users')
      .select('id,email,display_name,role,status,password_hash,password_salt')
      .ilike('display_name', username.trim())
      .neq('role', 'member')
      .maybeSingle<AppUserRow>();

    if (displayNameUser) {
      return toSessionUser(displayNameUser);
    }
  } else {
    const { data: appUser, error: appUserError } = await supabase
      .from('app_users')
      .select('id,email,display_name,role,status,password_hash,password_salt')
      .eq('id', targetUserId)
      .maybeSingle<AppUserRow>();

    if (!appUserError && appUser) {
      return toSessionUser(appUser);
    }
  }

  return null;
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
    .select('referral_code,sponsor_code,package_tier,account_status,username,full_name,payout_method')
    .eq('user_id', userId)
    .maybeSingle<MemberProfileRow>();

  if (error || !data) {
    return null;
  }

  return {
    referralCode: data.referral_code ?? undefined,
    sponsorCode: data.sponsor_code ?? '',
    packageTier: data.package_tier ?? undefined,
    accountStatus: data.account_status ?? undefined,
    username: data.username ?? undefined,
    fullName: data.full_name ?? undefined,
    payoutMethod: data.payout_method ?? undefined
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

// GATE-ADMIN-PWD-20260615: staff (admin office) account directory + privileged
// password reset. Used by the admin Change Password surface.
export type StaffAccount = {
  id: string;
  email: string;
  displayName: string;
  role: AppRole;
};

export async function listStaffAccounts(): Promise<StaffAccount[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from('app_users')
    .select('id,email,display_name,role')
    .in('role', ['admin', 'superadmin', 'cashier', 'bod'])
    .order('role', { ascending: true });
  if (error || !data) {
    return [];
  }
  return (data as Array<Pick<AppUserRow, 'id' | 'email' | 'display_name' | 'role'>>).map((row) => ({
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role
  }));
}

export async function findStaffAccountById(id: string): Promise<StaffAccount | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase
    .from('app_users')
    .select('id,email,display_name,role')
    .eq('id', id)
    .in('role', ['admin', 'superadmin', 'cashier', 'bod'])
    .maybeSingle<Pick<AppUserRow, 'id' | 'email' | 'display_name' | 'role'>>();
  if (error || !data) {
    return null;
  }
  return { id: data.id, email: data.email, displayName: data.display_name, role: data.role };
}

export async function updateUserPassword(
  id: string,
  passwordHash: string,
  passwordSalt: string
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return false;
  }
  const { error } = await supabase
    .from('app_users')
    .update({ password_hash: passwordHash, password_salt: passwordSalt })
    .eq('id', id);
  if (error) {
    console.error('updateUserPassword error', error);
    return false;
  }
  return true;
}

// GATE-MEMBER-CREDENTIALS-20260630: persist a member's own email change. Mirrors
// updateUserPassword — direct app_users update by id.
export async function updateUserEmail(id: string, email: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return false;
  }
  const { error } = await supabase
    .from('app_users')
    .update({ email: email.trim().toLowerCase() })
    .eq('id', id);
  if (error) {
    console.error('updateUserEmail error', error);
    return false;
  }
  return true;
}
