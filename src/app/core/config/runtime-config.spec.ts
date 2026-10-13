import { loadRuntimeConfig, parseRuntimeConfig, RuntimeConfigError } from './runtime-config';

describe('runtime config', () => {
  it('parses a valid config and trims trailing slashes', () => {
    expect(
      parseRuntimeConfig({ supabaseUrl: 'https://x.supabase.co/', supabaseAnonKey: ' key ' }),
    ).toEqual({
      supabaseUrl: 'https://x.supabase.co',
      supabaseAnonKey: 'key',
    });
  });

  it('rejects invalid values', () => {
    expect(() => parseRuntimeConfig({ supabaseUrl: 'ftp://x', supabaseAnonKey: 'k' })).toThrow(
      RuntimeConfigError,
    );
    expect(() => parseRuntimeConfig({ supabaseUrl: 'https://x' })).toThrow(RuntimeConfigError);
    expect(() => parseRuntimeConfig(null)).toThrow(RuntimeConfigError);
  });

  it('explains how to fix a missing config.json', async () => {
    const fetchFn = (() => Promise.resolve(new Response('', { status: 404 }))) as typeof fetch;
    await expect(loadRuntimeConfig(fetchFn)).rejects.toThrow(/config:write/);
  });
});
