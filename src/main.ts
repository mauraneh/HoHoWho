import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { createAppConfig } from './app/app.config';
import { createBackend } from './app/core/backend/create-backend';
import { captureNextFromUrl } from './app/core/pending-navigation';
import { environment } from './environments/environment';

captureNextFromUrl();

createBackend(environment)
  .then((backend) => bootstrapApplication(App, createAppConfig(backend, environment)))
  .catch((error: unknown) => {
    console.error(error);
    const message = document.createElement('div');
    message.className = 'fatal-error';
    message.textContent = `HoHoWho could not start: ${(error as Error).message ?? error}`;
    document.body.replaceChildren(message);
  });
