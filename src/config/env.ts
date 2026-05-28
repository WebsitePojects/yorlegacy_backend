import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(8787),
  FRONTEND_ORIGIN: z.string().default('http://127.0.0.1:5173'),
  APP_SESSION_SECRET: z.string().default('yor-dev-session-secret-change-me'),
  SESSION_TTL_HOURS: z.coerce.number().default(12),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  DEMO_MEMBER_EMAIL: z.string().email().default('member@yor.local'),
  DEMO_MEMBER_PASSWORD: z.string().min(8).default('YorMember123!'),
  DEMO_MEMBER_NAME: z.string().default('Yor Member'),
  DEMO_ADMIN_EMAIL: z.string().email().default('admin@yor.local'),
  DEMO_ADMIN_PASSWORD: z.string().min(8).default('YorAdmin123!'),
  DEMO_ADMIN_NAME: z.string().default('Yor Admin')
});

export const env = envSchema.parse(process.env);
