/**
 * migrate-prod-to-dev.ts
 *
 * Copies prod data to dev. Clears each dev table before inserting.
 * Safe to re-run: delete + insert is idempotent.
 *
 * Usage from yor_backend:
 *   npx tsx scripts/migrate-prod-to-dev.ts
 *
 * Preferred env:
 *   YOR_PROD_SUPABASE_URL
 *   YOR_PROD_SUPABASE_SERVICE_ROLE_KEY
 *   YOR_DEV_SUPABASE_URL
 *   YOR_DEV_SUPABASE_SERVICE_ROLE_KEY
 *
 * Local fallback:
 *   Dev may use SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.
 *   Prod may use the first commented SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY
 *   block in .env until explicit YOR_PROD_* variables are added.
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { WebSocket } from 'ws';

type TableConfig = {
  name: string;
  deleteCol: string;
};

type ProjectConfig = {
  label: 'prod' | 'dev';
  url: string;
  serviceRoleKey: string;
};

type SchemaColumns = Map<string, Set<string>>;

type ShapeResult = {
  rows: Record<string, unknown>[];
  skippedColumns: string[];
};

const TABLES: TableConfig[] = [
  { name: 'app_users', deleteCol: 'id' },
  { name: 'package_catalog', deleteCol: 'id' },
  { name: 'compensation_policies', deleteCol: 'id' },
  { name: 'site_pages', deleteCol: 'id' },
  { name: 'legacy_access_accounts', deleteCol: 'id' },
  { name: 'admin_profiles', deleteCol: 'user_id' },
  { name: 'member_profiles', deleteCol: 'user_id' },
  { name: 'network_accounts', deleteCol: 'id' },
  { name: 'activation_codes', deleteCol: 'id' },
  { name: 'shadow_accounts', deleteCol: 'id' },
  { name: 'salesmatch_balances', deleteCol: 'user_id' },
  { name: 'earning_stream_policies', deleteCol: 'id' },
  { name: 'page_sections', deleteCol: 'id' },
  { name: 'activation_code_events', deleteCol: 'id' },
  { name: 'placement_reservations', deleteCol: 'id' },
  { name: 'wallet_ledger', deleteCol: 'id' },
  { name: 'compensation_queue', deleteCol: 'id' },
  { name: 'binary_tree_closure', deleteCol: 'created_at' },
  { name: 'binary_point_events', deleteCol: 'id' },
  { name: 'pairing_ledger', deleteCol: 'id' },
  { name: 'pairing_snapshots', deleteCol: 'id' },
  { name: 'rankings', deleteCol: 'id' },
  { name: 'encashments', deleteCol: 'id' },
  { name: 'repurchases', deleteCol: 'id' },
  { name: 'upgrade_events', deleteCol: 'id' },
  { name: 'payout_transactions', deleteCol: 'id' },
  { name: 'income_simulation_runs', deleteCol: 'id' },
  { name: 'admin_review_actions', deleteCol: 'id' },
];

const rtOpts = { transport: WebSocket as unknown as typeof globalThis.WebSocket };

function createSupabaseClient(config: ProjectConfig): SupabaseClient {
  return createClient(config.url, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    realtime: rtOpts,
  });
}

function loadProjectConfig(): { prod: ProjectConfig; dev: ProjectConfig } {
  const prodUrl =
    process.env.YOR_PROD_SUPABASE_URL ??
    process.env.PROD_SUPABASE_URL ??
    readCommentedDotenvValue('SUPABASE_URL');
  const prodKey =
    process.env.YOR_PROD_SUPABASE_SERVICE_ROLE_KEY ??
    process.env.PROD_SUPABASE_SERVICE_ROLE_KEY ??
    process.env.YOR_PROD_SUPABASE_SECRET_KEY ??
    process.env.PROD_SUPABASE_SECRET_KEY ??
    readCommentedDotenvValue('SUPABASE_SERVICE_ROLE_KEY') ??
    readCommentedDotenvValue('SUPABASE_SECRET_KEY');
  const devUrl =
    process.env.YOR_DEV_SUPABASE_URL ??
    process.env.DEV_SUPABASE_URL ??
    process.env.SUPABASE_URL;
  const devKey =
    process.env.YOR_DEV_SUPABASE_SERVICE_ROLE_KEY ??
    process.env.DEV_SUPABASE_SERVICE_ROLE_KEY ??
    process.env.YOR_DEV_SUPABASE_SECRET_KEY ??
    process.env.DEV_SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SECRET_KEY;

  const missing = [
    prodUrl ? null : 'YOR_PROD_SUPABASE_URL',
    prodKey ? null : 'YOR_PROD_SUPABASE_SERVICE_ROLE_KEY',
    devUrl ? null : 'YOR_DEV_SUPABASE_URL or SUPABASE_URL',
    devKey ? null : 'YOR_DEV_SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY',
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(`Missing migration config: ${missing.join(', ')}`);
  }

  return {
    prod: { label: 'prod', url: prodUrl!, serviceRoleKey: prodKey! },
    dev: { label: 'dev', url: devUrl!, serviceRoleKey: devKey! },
  };
}

function readCommentedDotenvValue(name: string): string | undefined {
  const dotenvPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(dotenvPath)) {
    return undefined;
  }

  const pattern = new RegExp(`^\\s*#\\s*${name}\\s*=\\s*(.+?)\\s*$`);
  for (const line of fs.readFileSync(dotenvPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(pattern);
    if (match?.[1]) {
      return match[1].replace(/^['"]|['"]$/g, '');
    }
  }

  return undefined;
}

export async function fetchSchemaColumns(config: ProjectConfig): Promise<SchemaColumns> {
  const response = await fetch(`${config.url}/rest/v1/`, {
    headers: {
      apikey: config.serviceRoleKey,
      authorization: `Bearer ${config.serviceRoleKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`fetch ${config.label} schema: ${response.status} ${response.statusText}`);
  }

  const document = await response.json() as {
    definitions?: Record<string, { properties?: Record<string, unknown> }>;
  };
  const schema = new Map<string, Set<string>>();

  for (const [table, definition] of Object.entries(document.definitions ?? {})) {
    schema.set(table, new Set(Object.keys(definition.properties ?? {})));
  }

  return schema;
}

export function shapeRowsForTarget(
  table: string,
  rows: object[],
  targetColumns: Set<string>,
): ShapeResult {
  if (targetColumns.size === 0) {
    throw new Error(`No target columns discovered for ${table}`);
  }

  const skippedColumns = new Set<string>();
  const shaped = rows.map((row) => {
    const next: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(row)) {
      if (targetColumns.has(key)) {
        next[key] = normalizeValueForTarget(table, key, value, targetColumns);
      } else {
        skippedColumns.add(key);
      }
    }

    return next;
  });

  return {
    rows: shaped,
    skippedColumns: Array.from(skippedColumns).sort(),
  };
}

function normalizeValueForTarget(
  table: string,
  key: string,
  value: unknown,
  targetColumns: Set<string>,
): unknown {
  if (table === 'activation_codes' && key === 'status' && value === 'unreleased') {
    return targetColumns.has('released_at') ? value : 'assigned';
  }

  if (table === 'activation_codes' && key === 'status' && value === 'lost') {
    return 'disabled';
  }

  return value;
}

function resolveDeleteColumn(table: TableConfig, targetColumns: Set<string>): string {
  if (targetColumns.has(table.deleteCol)) {
    return table.deleteCol;
  }

  const fallback = ['id', 'user_id', 'created_at'].find((column) => targetColumns.has(column));
  if (!fallback) {
    throw new Error(`No safe delete column found for ${table.name}`);
  }

  return fallback;
}

function deleteFilter(col: string) {
  if (col === 'created_at' || col === 'updated_at') {
    return { op: 'gte', val: '2000-01-01' } as const;
  }
  return { op: 'neq', val: '00000000-0000-0000-0000-000000000000' } as const;
}

async function clearTable(client: SupabaseClient, table: string, col: string): Promise<void> {
  const { op, val } = deleteFilter(col);
  const query = client.from(table).delete();
  const { error } = op === 'gte'
    ? await query.gte(col, val)
    : await query.neq(col, val);

  if (error) {
    throw new Error(`clear ${table}: ${error.message}`);
  }
}

async function fetchAll(client: SupabaseClient, table: string): Promise<object[]> {
  const pageSize = 1000;
  const all: object[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await client.from(table).select('*').range(from, from + pageSize - 1);
    if (error) {
      throw new Error(`fetch ${table}: ${error.message}`);
    }
    if (!data || data.length === 0) {
      break;
    }

    all.push(...data);
    if (data.length < pageSize) {
      break;
    }
    from += pageSize;
  }

  return all;
}

async function insertBatch(client: SupabaseClient, table: string, rows: object[]): Promise<void> {
  const batchSize = 500;
  for (let i = 0; i < rows.length; i += batchSize) {
    const { error } = await client.from(table).insert(rows.slice(i, i + batchSize));
    if (error) {
      throw new Error(`insert ${table}: ${error.message}`);
    }
  }
}

export async function main(): Promise<void> {
  const { prod: prodConfig, dev: devConfig } = loadProjectConfig();
  const prod = createSupabaseClient(prodConfig);
  const dev = createSupabaseClient(devConfig);

  console.log('=== Yor Prod -> Dev Migration ===\n');
  console.log('Reading Supabase Data API schemas...');

  const [prodSchema, devSchema] = await Promise.all([
    fetchSchemaColumns(prodConfig),
    fetchSchemaColumns(devConfig),
  ]);
  const skippedTables: string[] = [];

  for (const table of TABLES) {
    if (!prodSchema.has(table.name)) {
      console.log(`  ! ${table.name}: skipped because prod Data API does not expose this table`);
      skippedTables.push(table.name);
      continue;
    }

    const devColumns = devSchema.get(table.name);
    if (!devColumns) {
      console.log(`  ! ${table.name}: skipped because dev Data API does not expose this table`);
      skippedTables.push(table.name);
      continue;
    }

    const deleteCol = resolveDeleteColumn(table, devColumns);
    const rows = await fetchAll(prod, table.name);

    await clearTable(dev, table.name, deleteCol);

    if (rows.length === 0) {
      console.log(`  - ${table.name}: empty`);
      continue;
    }

    const shaped = shapeRowsForTarget(table.name, rows, devColumns);
    if (shaped.skippedColumns.length > 0) {
      console.log(`  ! ${table.name}: skipped dev-missing columns: ${shaped.skippedColumns.join(', ')}`);
    }

    await insertBatch(dev, table.name, shaped.rows);
    console.log(`  OK ${table.name}: ${rows.length} rows`);
  }

  if (skippedTables.length > 0) {
    console.log(`\nSkipped tables needing dev schema/API sync: ${skippedTables.join(', ')}`);
  }

  console.log('\n=== Migration complete ===');
}

function isMainModule(): boolean {
  return process.argv[1]
    ? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
    : false;
}

if (isMainModule()) {
  main().catch((err) => {
    console.error('\nFatal error:', err);
    process.exit(1);
  });
}
