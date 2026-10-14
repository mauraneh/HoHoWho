import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { HohowhoBackend } from './core/backend/hohowho-backend';
import { errorMessage, initials } from './core/format';
import { forgetKey } from './core/personal-link';
import { DATA_SOURCE } from './core/tokens';
import { Snowfall } from './shared/snowfall';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, Snowfall],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-snowfall />
    <header class="topbar">
      <div class="topbar-inner">
        <a routerLink="/events" class="brand" aria-label="Accueil HoHoWho">
          <span class="wordmark">HoHoWho<span class="dot">.</span></span>
        </a>
        @if (user(); as u) {
          <nav class="row" aria-label="Compte">
            <a routerLink="/events" class="nav-link">Mes Secret Santa</a>
            <a routerLink="/mon-lien" class="nav-link">Mon lien</a>
            <span class="me" [title]="u.displayName">
              <span class="avatar" aria-hidden="true">{{ initials(u.displayName) }}</span>
            </span>
            <button type="button" class="btn btn-sm signout" (click)="signOut()">
              Déconnexion
            </button>
          </nav>
        }
      </div>
    </header>

    @if (error(); as e) {
      <div class="container">
        <div class="alert alert-error" role="alert">{{ e }}</div>
      </div>
    }

    <main>
      <router-outlet />
    </main>

    <footer class="footer muted small">
      <p>Fait avec amour et beaucoup de neige ❄</p>
      @if (isMock) {
        <p>
          Mode démo : tout reste dans ton navigateur.
          <button type="button" class="link-btn" (click)="resetDemo()">
            Réinitialiser la démo
          </button>
        </p>
      }
    </footer>
  `,
  styles: `
    .topbar {
      position: relative;
      z-index: 10;
    }
    .topbar-inner {
      max-width: 980px;
      margin: 0 auto;
      padding: 1.1rem 1.25rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }
    .brand {
      color: var(--white);
      text-decoration: none;
    }
    .wordmark {
      font-size: 1.35rem;
      font-weight: 800;
      letter-spacing: -0.04em;
    }
    .dot {
      color: var(--red);
    }
    nav {
      flex-wrap: nowrap;
      gap: 1.1rem;
    }
    .nav-link {
      color: var(--snow-soft);
      font-weight: 600;
      font-size: 0.92rem;
      text-decoration: none;
    }
    .nav-link:hover {
      color: var(--white);
    }
    .me {
      display: inline-flex;
      align-items: center;
    }
    .me .avatar {
      width: 2rem;
      height: 2rem;
      margin: 0;
      background: var(--red);
    }
    .signout {
      background: transparent;
      color: var(--white);
      border-color: rgb(255 255 255 / 30%);
    }
    .signout:hover:not(:disabled) {
      border-color: var(--white);
    }
    @media (max-width: 600px) {
      .nav-link:first-child,
      .me {
        display: none;
      }
      nav {
        gap: 0.7rem;
      }
    }
    main,
    .footer {
      position: relative;
      z-index: 1;
    }
    .footer {
      text-align: center;
      padding: 3rem 1rem;
    }
    .footer p {
      margin: 0.2rem 0;
    }
  `,
})
export class App {
  private readonly backend = inject(HohowhoBackend);
  private readonly router = inject(Router);
  protected readonly isMock = inject(DATA_SOURCE) === 'mock';
  protected readonly user = this.backend.currentUser;
  protected readonly error = signal<string | null>(null);
  protected readonly initials = initials;

  async signOut(): Promise<void> {
    if (
      !confirm(
        'Tu t’en vas ? Pour revenir, il te faudra ton lien perso (menu « Mon lien »). Tu l’as bien gardé ?',
      )
    ) {
      return;
    }
    try {
      forgetKey();
      await this.backend.signOut();
      await this.router.navigateByUrl('/sign-in');
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  async resetDemo(): Promise<void> {
    (this.backend as HohowhoBackend & { reset?: () => void }).reset?.();
    await this.router.navigateByUrl('/sign-in');
  }
}
