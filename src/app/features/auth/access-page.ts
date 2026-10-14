import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { HohowhoBackend } from '../../core/backend/hohowho-backend';
import { errorMessage } from '../../core/format';
import { rememberKey } from '../../core/personal-link';

/** Target of personal links (#/k/<key>): signs in and enters the app. */
@Component({
  selector: 'app-access-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container narrow center">
      @if (error(); as e) {
        <div class="card">
          <h1>Lien non valable</h1>
          <p class="muted">{{ e }}</p>
          <a routerLink="/sign-in" class="btn">Retour à l’accueil</a>
        </div>
      } @else {
        <h1 class="opening">Un instant…</h1>
      }
    </div>
  `,
  styles: `
    .opening {
      margin-top: 4rem;
    }
  `,
})
export class AccessPage {
  private readonly backend = inject(HohowhoBackend);
  private readonly router = inject(Router);

  /** Route parameter `:key`. */
  readonly key = input.required<string>();
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      const key = this.key();
      untracked(() => void this.open(key));
    });
  }

  private async open(key: string): Promise<void> {
    try {
      if (this.backend.currentUser()) await this.backend.signOut();
      await this.backend.signInWithKey(key);
      rememberKey(key);
      await this.router.navigateByUrl('/events', { replaceUrl: true });
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }
}
