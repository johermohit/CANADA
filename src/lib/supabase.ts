import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase env vars. Set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (or SUPABASE_URL + SUPABASE_ANON_KEY in Vercel).'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize on app load
export async function initializeSupabase() {
  try {
    const { data } = await supabase.auth.getSession();
    console.log('Supabase initialized:', !!data.session);
  } catch (error) {
    console.error('Supabase init error:', error);
  }
}
