import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(8787),
  YOR_RUNTIME_MODE: z.enum(['playground', 'sandbox', 'production']).default('sandbox'),
  YOR_SANDBOX_DATA_FILE: z.string().default('dev-data/yor-sandbox.json'),
  FRONTEND_ORIGIN: z
    .string()
    .default(
      'http://localhost:5173,http://127.0.0.1:5173,https://yorinternational.net,https://www.yorinternational.net'
    ),
  APP_SESSION_SECRET: z.string().default('yor-dev-session-secret-change-me'),
  SESSION_TTL_HOURS: z.coerce.number().default(12),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SECRET_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  DEMO_MEMBER_EMAIL: z.string().email().default('yor01@yor.local'),
  DEMO_MEMBER_PASSWORD: z.string().min(1).default('1'),
  DEMO_MEMBER_NAME: z.string().default('Yor Company01'),
  DEMO_ADMIN_EMAIL: z.string().email().default('yoradmin@yor.local'),
  DEMO_ADMIN_PASSWORD: z.string().min(1).default('1'),
  DEMO_ADMIN_NAME: z.string().default('Yor Admin'),
  DEMO_CASHIER_EMAIL: z.string().email().default('yorcashier@yor.local'),
  DEMO_CASHIER_PASSWORD: z.string().min(1).default('1'),
  DEMO_CASHIER_NAME: z.string().default('Yor Cashier'),
  DEMO_BOD_EMAIL: z.string().email().default('yorbod@yor.local'),
  DEMO_BOD_PASSWORD: z.string().min(1).default('1'),
  DEMO_BOD_NAME: z.string().default('Yor BOD'),
  DEMO_SUPERADMIN_EMAIL: z.string().email().default('yorsuperadmin@yor.local'),
  DEMO_SUPERADMIN_PASSWORD: z.string().min(1).default('1'),
  DEMO_SUPERADMIN_NAME: z.string().default('Yor Super Admin')
});

const parsedEnv = envSchema.parse(process.env);

export const env =
  process.env.NODE_ENV === 'test'
    ? {
        ...parsedEnv,
        YOR_RUNTIME_MODE: 'sandbox',
        SUPABASE_URL: undefined,
        SUPABASE_PUBLISHABLE_KEY: undefined,
        SUPABASE_ANON_KEY: undefined,
        SUPABASE_SECRET_KEY: undefined,
        SUPABASE_SERVICE_ROLE_KEY: undefined
      }
    : parsedEnv;

export function getSupabaseServerKey(): string | null {
  return env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY ?? null;
}

export function getSupabasePublicKey(): string | null {
  return env.SUPABASE_PUBLISHABLE_KEY ?? env.SUPABASE_ANON_KEY ?? getSupabaseServerKey();
}

export function getAllowedFrontendOrigins(): string[] {
  return env.FRONTEND_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}
