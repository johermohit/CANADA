import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL;
const supabaseKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY;

const missingMsg =
  'Missing Supabase env vars. Set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (or SUPABASE_URL + SUPABASE_ANON_KEY in Vercel).';

if (!supabaseUrl || !supabaseKey) {
  if (import.meta.env.PROD) {
    throw new Error(missingMsg);
  } else {
    // In dev, warn instead of throwing to avoid crashing the app during local work.
    // The app can still function if it uses server-side APIs instead.
    // eslint-disable-next-line no-console
    console.warn(missingMsg);
  }
}

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseKey ? createClient(String(supabaseUrl), String(supabaseKey)) : null;

// Initialize on app load (no-op when client is not configured)
export async function initializeSupabase() {
  if (!supabase) {
    // eslint-disable-next-line no-console
    console.info('Supabase client not initialized (missing env). Skipping auth init.');
    return;
  }

  try {
    const { data } = await supabase.auth.getSession();
    // eslint-disable-next-line no-console
    console.log('Supabase initialized:', !!data.session);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Supabase init error:', error);
  }
}
