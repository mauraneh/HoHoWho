import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withHashLocation } from '@angular/router';
import { AppEnvironment } from '../environments/environment.model';
import { routes } from './app.routes';
import { HohowhoBackend } from './core/backend/hohowho-backend';
import { DATA_SOURCE } from './core/tokens';
import { GIFT_RECOMMENDATION_PROVIDERS } from './recommendations/recommendation.model';
import { RuleBasedRecommender } from './recommendations/rule-based-recommender';

registerLocaleData(localeFr);

export function createAppConfig(
  backend: HohowhoBackend,
  environment: AppEnvironment,
): ApplicationConfig {
  return {
    providers: [
      provideBrowserGlobalErrorListeners(),
      { provide: LOCALE_ID, useValue: 'fr' },
      // Hash URLs (#/events/…) work on any static host (GitHub Pages, S3, Netlify…) without
      // server-side rewrites, and survive page reloads and deep links.
      provideRouter(routes, withHashLocation(), withComponentInputBinding()),
      { provide: HohowhoBackend, useValue: backend },
      { provide: DATA_SOURCE, useValue: environment.dataSource },
      // Register further providers (e.g. an AI-backed one) here with `multi: true`.
      { provide: GIFT_RECOMMENDATION_PROVIDERS, useClass: RuleBasedRecommender, multi: true },
    ],
  };
}
