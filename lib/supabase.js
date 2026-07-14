import { createClient } from '@supabase/supabase-js';

const FLOW_CONFIG_STORAGE_KEY = 'taskApp.flowSupabaseConfig';

function readRuntimeSupabaseConfig() {
  if (typeof window === 'undefined') return {};

  try {
    const params = new URLSearchParams(window.location.search || '');
    const source = params.get('source');
    const url = params.get('supabase_url');
    const key = params.get('supabase_key');
    if (source === 'flow' && url && key) {
      const config = { url, key };
      window.sessionStorage.setItem(FLOW_CONFIG_STORAGE_KEY, JSON.stringify(config));
      return config;
    }
  } catch {
    // Ignore query/session parsing errors and fall back to build-time env.
  }

  try {
    const raw = window.sessionStorage.getItem(FLOW_CONFIG_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

const runtimeConfig = readRuntimeSupabaseConfig();
const url = runtimeConfig.url || import.meta.env.VITE_SUPABASE_URL;
const key = runtimeConfig.key || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.warn('[Supabase] Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_PUBLISHABLE_KEY trong .env');
}

export const supabase = createClient(url || '', key || '');
