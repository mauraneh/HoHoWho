import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { HohowhoBackend } from './core/backend/hohowho-backend';
import { errorMessage, initials } from './core/format';
import { DATA_SOURCE } from './core/tokens';
import { Holly } from './shared/ornaments';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, Holly],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="topbar">
      <div class="topbar-inner">
        <a routerLink="/events" class="brand" aria-label="Accueil HoHoWho">
          <app-holly [size]="40" />
          <span class="wordmark">HoHoWho</span>
          <span class="tagline">Secret Santa</span>
        </a>
        @if (user(); as u) {
          <nav class="row" aria-label="Compte">
            <a routerLink="/events" class="nav-link">Mes Secret Santa</a>
            <span class="me" [title]="u.email">
              <span class="avatar" aria-hidden="true">{{ initials(u.displayName) }}</span>
              <span class="me-name">{{ u.displayName }}</span>
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
      <p class="footer-mark">HoHoWho</p>
      <p>Le Secret Santa entre proches · gratuit et sans pub</p>
      @if (isMock) {
        <p>
          Mode démo : les données restent dans ce navigateur.
          <button type="button" class="link-btn" (click)="resetDemo()">
            Réinitialiser la démo
          </button>
        </p>
      }
    </footer>
  `,
  styles: `
    .topbar {
      position: sticky;
      top: 0;
      z-index: 10;
      color: var(--ivory);
      background:
        repeating-linear-gradient(45deg, rgb(255 255 255 / 2%) 0 2px, transparent 2px 10px),
        linear-gradient(180deg, var(--emerald) 0%, var(--emerald-deep) 100%);
      box-shadow:
        0 1px 0 var(--gold),
        0 4px 0 var(--emerald-deep),
        0 5px 0 rgb(201 162 90 / 60%),
        0 10px 24px -12px rgb(0 0 0 / 50%);
    }
    .topbar-inner {
      max-width: 1040px;
      margin: 0 auto;
      padding: 0.45rem 1rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      color: var(--gold-light);
      text-decoration: none;
    }
    .wordmark {
      font-family: var(--font-script);
      font-size: 2.2rem;
      line-height: 1;
      padding-top: 0.2rem;
    }
    .tagline {
      font-family: var(--font-caps);
      font-size: 0.62rem;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: rgb(247 240 225 / 65%);
      margin-left: 0.35rem;
      padding-left: 0.6rem;
      border-left: 1px solid rgb(201 162 90 / 50%);
    }
    .nav-link {
      color: var(--ivory);
      font-family: var(--font-caps);
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      text-decoration: none;
    }
    .me {
      display: inline-flex;
      align-items: center;
    }
    .me .avatar {
      width: 1.9rem;
      height: 1.9rem;
      margin-right: 0.4rem;
    }
    .me-name {
      color: var(--gold-light);
      font-family: var(--font-serif);
      font-size: 1.1rem;
      font-weight: 600;
    }
    .signout {
      background: transparent;
      color: var(--ivory);
      border-color: rgb(201 162 90 / 60%);
    }
    nav {
      flex-wrap: nowrap;
    }
    @media (max-width: 600px) {
      .me-name,
      .nav-link,
      .tagline {
        display: none;
      }
      .wordmark {
        font-size: 1.8rem;
      }
    }
    .footer {
      text-align: center;
      padding: 2.5rem 1rem 3rem;
    }
    .footer p {
      margin: 0.2rem 0;
    }
    .footer-mark {
      font-family: var(--font-script);
      font-size: 2rem;
      color: var(--crimson);
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
    try {
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
