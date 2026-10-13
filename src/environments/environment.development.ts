import { AppEnvironment } from './environment.model';

/** Local development: in-browser mock data, no network or account needed. */
export const environment: AppEnvironment = {
  production: false,
  dataSource: 'mock',
};
