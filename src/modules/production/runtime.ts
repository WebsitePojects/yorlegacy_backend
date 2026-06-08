import { env } from '../../config/env.js';
import { getSupabaseClient } from '../../lib/supabase.js';
import { ProductionEncodingService } from './encoding-service.js';
import { createSupabaseProductionEncodingRepository } from './supabase-encoding-repository.js';

export function isProductionMode() {
  return env.YOR_RUNTIME_MODE === 'production';
}

export function getProductionEncodingService(): ProductionEncodingService | null {
  const client = getSupabaseClient();
  if (!client) {
    return null;
  }
  return new ProductionEncodingService(createSupabaseProductionEncodingRepository(client));
}
