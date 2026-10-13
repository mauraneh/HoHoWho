import { AppEnvironment } from '../../../environments/environment.model';
import { loadRuntimeConfig } from '../config/runtime-config';
import { HohowhoBackend } from './hohowho-backend';

/**
 * Instantiates the backend for the current environment. Both implementations are lazy chunks,
 * so production bundles never download the mock data and development never needs Supabase.
 */
export async function createBackend(environment: AppEnvironment): Promise<HohowhoBackend> {
  if (environment.dataSource === 'mock') {
    const { MockBackend } = await import('./mock/mock-backend');
    return new MockBackend();
  }
  const [config, { SupabaseBackend }] = await Promise.all([
    loadRuntimeConfig(),
    import('./supabase/supabase-backend'),
  ]);
  return new SupabaseBackend(config);
}
