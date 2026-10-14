import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HohowhoBackend } from '../../core/backend/hohowho-backend';
import { errorMessage } from '../../core/format';
import { rememberKey, rememberedKey } from '../../core/personal-link';
import { PersonalLinkCard } from '../../shared/personal-link-card';

/** Shows the current user's personal link and lets them issue a new one. */
@Component({
  selector: 'app-my-link-page',
  imports: [PersonalLinkCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container narrow">
      <div class="card">
        <span class="eyebrow">Votre accès</span>
        <h1>Mon lien personnel</h1>
        @if (error(); as e) {
          <div class="alert alert-error" role="alert">{{ e }}</div>
        }
        @if (key(); as k) {
          <app-personal-link-card [key]="k" />
        } @else {
          <p class="muted">
            Ce lien n’est pas enregistré sur cet appareil. Si vous l’avez perdu, générez-en un
            nouveau : l’ancien ne fonctionnera plus.
          </p>
        }
        <button type="button" class="btn btn-sm" [disabled]="busy()" (click)="reset()">
          ↻ Générer un nouveau lien
        </button>
      </div>
    </div>
  `,
})
export class MyLinkPage {
  private readonly backend = inject(HohowhoBackend);
  protected readonly key = signal(rememberedKey());
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  async reset(): Promise<void> {
    if (!confirm('Générer un nouveau lien ? L’ancien ne fonctionnera plus.')) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const key = await this.backend.resetMyKey();
      rememberKey(key);
      this.key.set(key);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
