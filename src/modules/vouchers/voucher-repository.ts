// GATE-VOUCHER-B1T1-20260615: data access for the vouchers table. All Supabase
// queries for vouchers live here; the service holds the business logic.
import { getSupabaseClient } from '../../lib/supabase.js';
import type { VoucherRecord, VoucherStatus } from './voucher-types.js';

type VoucherRow = {
  id: string;
  voucher_code: string;
  beneficiary_user_id: string | null;
  beneficiary_username: string;
  beneficiary_full_name: string | null;
  package_tier: string;
  quantity: number | string;
  remaining: number | string;
  status: VoucherStatus;
  granted_by_user_id: string | null;
  granted_by_label: string | null;
  remarks: string | null;
  issued_at: string;
  expires_at: string | null;
  updated_at: string;
};

function mapRow(row: VoucherRow): VoucherRecord {
  return {
    id: row.id,
    voucherCode: row.voucher_code,
    beneficiaryUserId: row.beneficiary_user_id,
    beneficiaryUsername: row.beneficiary_username,
    beneficiaryFullName: row.beneficiary_full_name,
    packageTier: row.package_tier,
    quantity: Number(row.quantity ?? 0),
    remaining: Number(row.remaining ?? 0),
    status: row.status,
    grantedByUserId: row.granted_by_user_id,
    grantedByLabel: row.granted_by_label,
    remarks: row.remarks,
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    updatedAt: row.updated_at
  };
}

export type InsertVoucherInput = {
  voucherCode: string;
  beneficiaryUserId: string | null;
  beneficiaryUsername: string;
  beneficiaryFullName: string | null;
  packageTier: string;
  quantity: number;
  grantedByUserId: string | null;
  grantedByLabel: string | null;
  remarks: string | null;
  expiresAt: string | null;
};

export const voucherRepository = {
  async list(limit = 500): Promise<VoucherRecord[]> {
    const client = getSupabaseClient();
    if (!client) return [];
    const { data, error } = await client
      .from('vouchers')
      .select('*')
      .order('issued_at', { ascending: false })
      .limit(limit);
    if (error) {
      console.error('[voucher-repository] list error:', error.message);
      return [];
    }
    return (data ?? []).map((row) => mapRow(row as VoucherRow));
  },

  async findById(id: string): Promise<VoucherRecord | null> {
    const client = getSupabaseClient();
    if (!client) return null;
    const { data, error } = await client.from('vouchers').select('*').eq('id', id).maybeSingle();
    if (error) {
      console.error('[voucher-repository] findById error:', error.message);
      return null;
    }
    return data ? mapRow(data as VoucherRow) : null;
  },

  async insert(input: InsertVoucherInput): Promise<VoucherRecord | null> {
    const client = getSupabaseClient();
    if (!client) return null;
    const { data, error } = await client
      .from('vouchers')
      .insert({
        voucher_code: input.voucherCode,
        beneficiary_user_id: input.beneficiaryUserId,
        beneficiary_username: input.beneficiaryUsername,
        beneficiary_full_name: input.beneficiaryFullName,
        package_tier: input.packageTier,
        quantity: input.quantity,
        remaining: input.quantity,
        status: 'available',
        granted_by_user_id: input.grantedByUserId,
        granted_by_label: input.grantedByLabel,
        remarks: input.remarks,
        expires_at: input.expiresAt
      })
      .select('*')
      .single();
    if (error) {
      console.error('[voucher-repository] insert error:', error.message);
      throw new Error(error.message);
    }
    return mapRow(data as VoucherRow);
  },

  async updateStatus(id: string, status: VoucherStatus): Promise<VoucherRecord | null> {
    const client = getSupabaseClient();
    if (!client) return null;
    const { data, error } = await client
      .from('vouchers')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) {
      console.error('[voucher-repository] updateStatus error:', error.message);
      throw new Error(error.message);
    }
    return mapRow(data as VoucherRow);
  },

  async countAll(): Promise<number> {
    const client = getSupabaseClient();
    if (!client) return 0;
    const { count, error } = await client.from('vouchers').select('id', { count: 'exact', head: true });
    if (error) {
      console.error('[voucher-repository] countAll error:', error.message);
      return 0;
    }
    return count ?? 0;
  }
};
