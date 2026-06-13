// One-off, audited normalization of member referral codes to the canonical
// YOR-MEMBER-#### standard (BUSINESSRULE.md glossary). Safe by design:
//   - dry run by default; pass --apply to write
//   - every change is recorded in code_normalization_audit before the update
//   - sponsor_code references pointing at an old value are updated in the same run
// Usage:
//   npx tsx scripts/normalize-codes.ts            (dry run)
//   npx tsx scripts/normalize-codes.ts --apply    (write changes)
import { createClient } from '@supabase/supabase-js';
import { env, getSupabaseServerKey } from '../src/config/env.js';
import { buildCanonicalReferralCode, isCanonicalReferralCode } from '../src/lib/referral-utils.js';

async function main() {
  const apply = process.argv.includes('--apply');
  const serverKey = getSupabaseServerKey();
  if (!env.SUPABASE_URL || !serverKey) {
    throw new Error('SUPABASE_URL and a server key are required.');
  }
  const client = createClient(env.SUPABASE_URL, serverKey, { auth: { persistSession: false } });

  const { data: members, error } = await client
    .from('member_profiles')
    .select('user_id, username, referral_code, sponsor_code');
  if (error) {
    throw error;
  }

  const changes: Array<{ userId: string; username: string; oldCode: string; newCode: string }> = [];
  for (const member of members ?? []) {
    if (!member.username || !member.referral_code) {
      continue;
    }
    if (isCanonicalReferralCode(member.referral_code)) {
      continue;
    }
    let newCode: string;
    try {
      newCode = buildCanonicalReferralCode(member.username);
    } catch {
      console.warn(`SKIP ${member.username}: non-canonical username, needs manual review.`);
      continue;
    }
    changes.push({ userId: member.user_id, username: member.username, oldCode: member.referral_code, newCode });
  }

  console.log(`${changes.length} member referral code(s) need normalization.`);
  for (const change of changes) {
    console.log(`  ${change.username}: ${change.oldCode} -> ${change.newCode}`);
  }
  if (!apply) {
    console.log('Dry run complete. Re-run with --apply to write changes.');
    return;
  }

  for (const change of changes) {
    const { error: auditError } = await client.from('code_normalization_audit').insert({
      table_name: 'member_profiles',
      row_id: change.userId,
      column_name: 'referral_code',
      old_value: change.oldCode,
      new_value: change.newCode
    });
    if (auditError) {
      throw auditError;
    }
    const { error: updateError } = await client
      .from('member_profiles')
      .update({ referral_code: change.newCode })
      .eq('user_id', change.userId);
    if (updateError) {
      throw updateError;
    }
    const { error: sponsorError } = await client
      .from('member_profiles')
      .update({ sponsor_code: change.newCode })
      .eq('sponsor_code', change.oldCode);
    if (sponsorError) {
      throw sponsorError;
    }
  }
  console.log('Normalization applied with audit rows.');
}

main().catch((error) => {
  console.error('normalize-codes failed:', error);
  process.exitCode = 1;
});
