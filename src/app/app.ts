import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { HohowhoBackend } from './core/backend/hohowho-backend';
import { errorMessage } from './core/format';
import { DATA_SOURCE } from './core/tokens';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="topbar">
      <div class="topbar-inner">
        <a routerLink="/events" class="brand" aria-label="HoHoWho home">
          <img src="favicon.svg" alt="" width="28" height="28" />
          <span>HoHoWho</span>
        </a>
        @if (user(); as u) {
          <nav class="row" aria-label="Account">
            <a routerLink="/events" class="nav-link">My events</a>
            <span class="muted small who">{{ u.displayName }}</span>
            <button type="button" class="btn btn-sm" (click)="signOut()">Sign out</button>
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
      <p>HoHoWho · Secret Santa made simple</p>
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
      background: var(--red);
      color: #fff;
    }
    .topbar-inner {
      max-width: 960px;
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
      color: #fff;
      text-decoration: none;
      font-weight: 800;
      font-size: 1.2rem;
    }
    .brand img {
      background: #fff;
      border-radius: 6px;
      padding: 2px;
    }
    .nav-link {
      color: #fff;
      font-weight: 600;
    }
    .who {
      color: #fde7e5;
    }
    .footer {
      text-align: center;
      padding: 2rem 1rem;
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
