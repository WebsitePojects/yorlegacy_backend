import { describe, expect, it } from 'vitest';
import {
  buildCanonicalReferralCode,
  decodeReferralCode,
  encodeReferralCode,
  isCanonicalReferralCode,
  isCanonicalUsername
} from './referral-utils.js';

describe('canonical identity standards', () => {
  it('validates canonical usernames', () => {
    expect(isCanonicalUsername('YOR0001')).toBe(true);
    expect(isCanonicalUsername('yor1234')).toBe(true);
    expect(isCanonicalUsername('YOR12345')).toBe(true);
    expect(isCanonicalUsername('YOR001')).toBe(false);
    expect(isCanonicalUsername('MEMBER1')).toBe(false);
  });

  it('validates canonical referral codes', () => {
    expect(isCanonicalReferralCode('YOR-MEMBER-0001')).toBe(true);
    expect(isCanonicalReferralCode('YOR-MEMBER-001')).toBe(true);
    expect(isCanonicalReferralCode('YOR-MEMBER-1')).toBe(false);
    expect(isCanonicalReferralCode('SOME-REF')).toBe(false);
  });

  it('builds canonical referral codes from usernames', () => {
    expect(buildCanonicalReferralCode('YOR0001')).toBe('YOR-MEMBER-0001');
    expect(buildCanonicalReferralCode('yor1042')).toBe('YOR-MEMBER-1042');
    expect(() => buildCanonicalReferralCode('not-a-username')).toThrow(/non-canonical/);
  });

  it('decodes canonical referral codes back to usernames', () => {
    expect(decodeReferralCode('YOR-MEMBER-0001')).toBe('YOR0001');
    expect(decodeReferralCode('YOR-MEMBER-1042')).toBe('YOR1042');
  });

  it('still decodes legacy base32 referral tokens', () => {
    const legacyToken = encodeReferralCode('YOR0042');
    expect(decodeReferralCode(legacyToken)).toBe('YOR0042');
  });
});
