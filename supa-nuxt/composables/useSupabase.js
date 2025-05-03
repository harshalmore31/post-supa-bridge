// composables/useSupabase.js
import { createClient } from '@supabase/supabase-js'

let supabaseInstance = null;

export const useSupabase = () => {
  if (!supabaseInstance) {
    const config = useRuntimeConfig();
    if (!config.public.supabaseUrl || !config.public.supabaseKey) {
      console.error('Supabase URL or Key is missing. Check your .env file and nuxt.config.ts');
      // Return a mock or throw an error, depending on how you want to handle it
      // For now, let's return null and handle it in the calling composable
      return { supabase: null, error: 'Supabase configuration missing' };
    }
    supabaseInstance = createClient(
      config.public.supabaseUrl,
      config.public.supabaseKey
    );
    console.log('Supabase client initialized.');
  }
  return { supabase: supabaseInstance, error: null };
}