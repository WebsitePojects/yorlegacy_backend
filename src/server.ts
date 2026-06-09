import { app } from './app.js';
import { env, getAllowedFrontendOrigins } from './config/env.js';
import { getSupabaseClient, getSupabaseStatus } from './lib/supabase.js';

app.listen(env.PORT, () => {
  const supabase = getSupabaseStatus();

  console.info(`yorinternational-backend listening on http://127.0.0.1:${env.PORT}`);
  console.info(`Allowed frontend origins: ${getAllowedFrontendOrigins().join(', ')}`);
  console.info(
    `Supabase: ${supabase.configured ? `configured (${supabase.url}, key=${supabase.keyType})` : 'not configured'}`
  );
  console.info(
    `Supabase public access: ${supabase.publicConfigured ? `configured (${supabase.url}, key=${supabase.publicKeyType})` : 'not configured'}`
  );

  // Eagerly initialize the Supabase client at startup so the first login request
  // does not pay the cold-start initialization cost.
  getSupabaseClient();
});
