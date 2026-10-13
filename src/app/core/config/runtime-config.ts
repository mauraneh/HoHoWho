/** Deployment-specific settings read at startup from `config.json` (next to index.html). */
export interface RuntimeConfig {
  supabaseUrl: string;
  /** Public "anon" (publishable) key. Safe to expose: data access is enforced by RLS. */
  supabaseAnonKey: string;
}

export class RuntimeConfigError extends Error {}

export async function loadRuntimeConfig(fetchFn: typeof fetch = fetch): Promise<RuntimeConfig> {
  let raw: unknown;
  try {
    const response = await fetchFn('config.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    raw = await response.json();
  } catch (error) {
    throw new RuntimeConfigError(
      `Could not load config.json (${(error as Error).message}). Generate it with "pnpm config:write".`,
    );
  }
  return parseRuntimeConfig(raw);
}

export function parseRuntimeConfig(raw: unknown): RuntimeConfig {
  const value = (raw ?? {}) as Record<string, unknown>;
  const supabaseUrl = value['supabaseUrl'];
  const supabaseAnonKey = value['supabaseAnonKey'];
  if (typeof supabaseUrl !== 'string' || !/^https?:\/\/[^\s]+$/.test(supabaseUrl)) {
    throw new RuntimeConfigError('config.json: "supabaseUrl" must be an http(s) URL.');
  }
  if (typeof supabaseAnonKey !== 'string' || supabaseAnonKey.trim() === '') {
    throw new RuntimeConfigError('config.json: "supabaseAnonKey" is required.');
  }
  return { supabaseUrl: supabaseUrl.replace(/\/+$/, ''), supabaseAnonKey: supabaseAnonKey.trim() };
}
