import { AppEnvironment } from './environment.model';

/** Production: real data from Supabase. Credentials are read at runtime from `config.json`. */
export const environment: AppEnvironment = {
  production: true,
  dataSource: 'supabase',
};
