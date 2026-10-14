import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { HohowhoBackend } from './core/backend/hohowho-backend';
import { errorMessage, initials } from './core/format';
import { DATA_SOURCE } from './core/tokens';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="topbar">
      <div class="topbar-inner">
        <a routerLink="/events" class="brand" aria-label="HoHoWho home">
          <span class="logo" aria-hidden="true">🎁</span>
          <span class="wordmark">Ho<em>Ho</em>Who</span>
        </a>
        @if (user(); as u) {
          <nav class="row" aria-label="Account">
            <a routerLink="/events" class="nav-link">My events</a>
            <span class="me" [title]="u.email">
              <span class="avatar" aria-hidden="true">{{ initials(u.displayName) }}</span>
              <span class="me-name">{{ u.displayName }}</span>
            </span>
            <button type="button" class="btn btn-sm signout" (click)="signOut()">Sign out</button>
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
      <p>Made with 🎄 · HoHoWho, the secret Secret Santa</p>
      @if (isMock) {
        <p>
          Demo mode: data lives only in this browser.
          <button type="button" class="link-btn" (click)="resetDemo()">Reset demo data</button>
        </p>
      }
    </footer>
  `,
  styles: `
    .topbar {
      position: sticky;
      top: 0;
      z-index: 10;
      background: rgb(18 55 42 / 96%);
      backdrop-filter: blur(8px);
      color: var(--snow);
      border-bottom: 3px solid var(--gold);
    }
    .topbar-inner {
      max-width: 1000px;
      margin: 0 auto;
      padding: 0.6rem 1rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--snow);
      text-decoration: none;
    }
    .logo {
      display: grid;
      place-items: center;
      width: 2.2rem;
      height: 2.2rem;
      border-radius: 12px;
      background: var(--gold);
      font-size: 1.2rem;
      transform: rotate(-6deg);
    }
    .wordmark {
      font-family: var(--font-display);
      font-weight: 800;
      font-size: 1.45rem;
      letter-spacing: -0.02em;
    }
    .wordmark em {
      color: var(--gold);
      font-style: italic;
    }
    .nav-link {
      color: var(--snow);
      font-weight: 700;
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
      background: var(--gold);
    }
    .me-name {
      color: var(--gold-soft);
      font-weight: 600;
    }
    .signout {
      background: transparent;
      color: var(--snow);
      border-color: rgb(251 247 240 / 35%);
    }
    @media (max-width: 560px) {
      .me-name,
      .nav-link {
        display: none;
      }
    }
    .footer {
      text-align: center;
      padding: 2.5rem 1rem;
    }
    .footer p {
      margin: 0.25rem 0;
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
