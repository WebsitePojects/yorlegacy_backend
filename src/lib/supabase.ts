import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, getSupabasePublicKey, getSupabaseServerKey } from '../config/env.js';

let serverClient: SupabaseClient | null = null;
let publicClient: SupabaseClient | null = null;
let hasLoggedServerDisabledState = false;
let hasLoggedPublicDisabledState = false;

export function getSupabaseClient(): SupabaseClient | null {
  const serverKey = getSupabaseServerKey();

  if (!env.SUPABASE_URL || !serverKey) {
    if (!hasLoggedServerDisabledState) {
      console.warn(
        'Supabase client disabled: missing SUPABASE_URL or SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY. Using local fallback data where available.'
      );
      hasLoggedServerDisabledState = true;
    }

    return null;
  }

  if (!serverClient) {
    serverClient = createClient(env.SUPABASE_URL, serverKey);
    console.info(`Supabase client initialized for ${env.SUPABASE_URL}`);
  }

  return serverClient;
}

export function getSupabasePublicClient(): SupabaseClient | null {
  const publicKey = getSupabasePublicKey();

  if (!env.SUPABASE_URL || !publicKey) {
    if (!hasLoggedPublicDisabledState) {
      console.warn(
        'Supabase public client disabled: missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY / SUPABASE_ANON_KEY.'
      );
      hasLoggedPublicDisabledState = true;
    }

    return null;
  }

  if (!publicClient) {
    publicClient = createClient(env.SUPABASE_URL, publicKey);
    console.info(`Supabase public client initialized for ${env.SUPABASE_URL}`);
  }

  return publicClient;
}

export function getSupabaseStatus(): {
  configured: boolean;
  url: string | null;
  keyType: 'secret' | 'service_role' | null;
  publicConfigured: boolean;
  publicKeyType: 'publishable' | 'anon' | 'secret' | 'service_role' | null;
} {
  return {
    configured: Boolean(env.SUPABASE_URL && getSupabaseServerKey()),
    url: env.SUPABASE_URL ?? null,
    keyType: env.SUPABASE_SECRET_KEY
      ? 'secret'
      : env.SUPABASE_SERVICE_ROLE_KEY
        ? 'service_role'
        : null,
    publicConfigured: Boolean(env.SUPABASE_URL && getSupabasePublicKey()),
    publicKeyType: env.SUPABASE_PUBLISHABLE_KEY
      ? 'publishable'
      : env.SUPABASE_ANON_KEY
        ? 'anon'
        : env.SUPABASE_SECRET_KEY
          ? 'secret'
          : env.SUPABASE_SERVICE_ROLE_KEY
            ? 'service_role'
            : null
  };
}
