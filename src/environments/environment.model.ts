export type DataSource = 'mock' | 'supabase';

export interface AppEnvironment {
  production: boolean;
  /** `mock` keeps everything in the browser (development); `supabase` talks to the real backend. */
  dataSource: DataSource;
}
