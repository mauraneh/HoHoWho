import { AppEnvironment } from './environment.model';

/** Local development against a Supabase project (local `supabase start` or a hosted one). */
export const environment: AppEnvironment = {
  production: false,
  dataSource: 'supabase',
};
