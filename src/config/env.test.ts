import { describe, expect, it } from 'vitest';
import { assertProductionEnv } from './env.js';

describe('assertProductionEnv', () => {
  it('throws when production mode lacks a Supabase URL', () => {
    expect(() =>
      assertProductionEnv({
        YOR_RUNTIME_MODE: 'production',
        SUPABASE_URL: undefined,
        SUPABASE_SECRET_KEY: 'sb_secret_x',
        SUPABASE_SERVICE_ROLE_KEY: undefined,
        APP_SESSION_SECRET: 'a-strong-unique-secret-value-123'
      })
    ).toThrow(/SUPABASE_URL/i);
  });

  it('throws when production mode lacks a Supabase server key', () => {
    expect(() =>
      assertProductionEnv({
        YOR_RUNTIME_MODE: 'production',
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SECRET_KEY: undefined,
        SUPABASE_SERVICE_ROLE_KEY: undefined,
        APP_SESSION_SECRET: 'a-strong-unique-secret-value-123'
      })
    ).toThrow(/Supabase server key/i);
  });

  it('throws when production mode uses the default session secret', () => {
    expect(() =>
      assertProductionEnv({
        YOR_RUNTIME_MODE: 'production',
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SECRET_KEY: 'sb_secret_x',
        SUPABASE_SERVICE_ROLE_KEY: undefined,
        APP_SESSION_SECRET: 'yor-dev-session-secret-change-me'
      })
    ).toThrow(/session secret/i);
  });

  it('throws when production mode uses a short session secret', () => {
    expect(() =>
      assertProductionEnv({
        YOR_RUNTIME_MODE: 'production',
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SECRET_KEY: 'sb_secret_x',
        SUPABASE_SERVICE_ROLE_KEY: undefined,
        APP_SESSION_SECRET: 'short'
      })
    ).toThrow(/session secret/i);
  });

  it('passes for a complete production config', () => {
    expect(() =>
      assertProductionEnv({
        YOR_RUNTIME_MODE: 'production',
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SECRET_KEY: 'sb_secret_x',
        SUPABASE_SERVICE_ROLE_KEY: undefined,
        APP_SESSION_SECRET: 'a-strong-unique-secret-value-123'
      })
    ).not.toThrow();
  });

  it('accepts a service-role key as the server key', () => {
    expect(() =>
      assertProductionEnv({
        YOR_RUNTIME_MODE: 'production',
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SECRET_KEY: undefined,
        SUPABASE_SERVICE_ROLE_KEY: 'eyJ-service-role',
        APP_SESSION_SECRET: 'a-strong-unique-secret-value-123'
      })
    ).not.toThrow();
  });

  it('is a no-op for sandbox mode', () => {
    expect(() =>
      assertProductionEnv({
        YOR_RUNTIME_MODE: 'sandbox',
        SUPABASE_URL: undefined,
        SUPABASE_SECRET_KEY: undefined,
        SUPABASE_SERVICE_ROLE_KEY: undefined,
        APP_SESSION_SECRET: 'yor-dev-session-secret-change-me'
      })
    ).not.toThrow();
  });
});
