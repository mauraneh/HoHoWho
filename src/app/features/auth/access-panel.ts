import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HohowhoBackend } from '../../core/backend/hohowho-backend';
import { errorMessage } from '../../core/format';
import { keyFromInput, rememberKey } from '../../core/personal-link';
import { DATA_SOURCE } from '../../core/tokens';
import { PersonalLinkCard } from '../../shared/personal-link-card';

/**
 * Home-page access: guests use their invitation or personal link; the organiser creates an
 * account with the organiser code and receives their own personal link.
 */
@Component({
  selector: 'app-access-panel',
  imports: [FormsModule, PersonalLinkCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (error(); as e) {
      <div class="alert alert-error" role="alert">{{ e }}</div>
    }

    @if (organizerKey(); as key) {
      <h3>Bienvenue dans l’atelier, cheffe des lutins 🎅</h3>
      <app-personal-link-card
        [key]="key"
        title="Ton lien organisatrice"
        hint="Il t’ouvre l’atelier depuis n’importe quel appareil. Garde-le pour toi : c’est la clé du traîneau."
      />
      <button type="button" class="btn btn-primary btn-block" (click)="signedIn.emit()">
        C’est parti ✦
      </button>
    } @else {
      <p class="lead-in">
        <strong>Invité·e&nbsp;?</strong> Ouvre juste le lien qu’on t’a envoyé : un prénom et hop, tu
        es dans la hotte.
      </p>

      <form class="block" (ngSubmit)="openLink()">
        <label class="field-label" for="personal-link">J’ai déjà mon lien perso</label>
        <div class="inline">
          <input
            id="personal-link"
            name="link"
            [(ngModel)]="link"
            placeholder="Colle ton lien ici"
            autocomplete="off"
          />
          <button type="submit" class="btn btn-primary" [disabled]="busy() || !link.trim()">
            Entrer
          </button>
        </div>
      </form>

      <details class="block organizer" [open]="isMock">
        <summary>Espace organisatrice</summary>
        <form (ngSubmit)="organize()">
          <div class="field">
            <label for="org-name">Ton prénom</label>
            <input
              id="org-name"
              name="name"
              [(ngModel)]="name"
              maxlength="60"
              autocomplete="given-name"
            />
          </div>
          <div class="field">
            <label for="org-code">Code organisatrice</label>
            <input
              id="org-code"
              name="code"
              type="password"
              [(ngModel)]="code"
              autocomplete="off"
            />
            @if (isMock) {
              <span class="hint">Démo : le code est <code>noel</code>.</span>
            }
          </div>
          <button
            type="submit"
            class="btn btn-green btn-block"
            [disabled]="busy() || !name.trim() || !code.trim()"
          >
            Ouvrir mon atelier 🎅
          </button>
        </form>
      </details>
    }
  `,
  styles: `
    .lead-in {
      font-size: 0.95rem;
      margin-bottom: 1.1rem;
    }
    .block {
      padding-top: 1rem;
      margin-top: 1rem;
      border-top: 1px solid var(--line);
    }
    .field-label {
      display: block;
      margin-bottom: 0.4rem;
      font-weight: 700;
      font-size: 0.9rem;
      color: var(--ink);
    }
    .inline {
      display: flex;
      gap: 0.5rem;
    }
    summary {
      cursor: pointer;
      font-weight: 700;
      font-size: 0.9rem;
      color: var(--red);
      margin-bottom: 0.75rem;
    }
    h3 {
      margin-top: 0;
    }
  `,
})
export class AccessPanel {
  private readonly backend = inject(HohowhoBackend);
  protected readonly isMock = inject(DATA_SOURCE) === 'mock';

  /** Emitted once the user is signed in and may enter the app. */
  readonly signedIn = output<void>();

  protected link = '';
  protected name = '';
  protected code = '';
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly organizerKey = signal<string | null>(null);

  async openLink(): Promise<void> {
    await this.run(async () => {
      const key = keyFromInput(this.link);
      await this.backend.signInWithKey(key);
      rememberKey(key);
      this.signedIn.emit();
    });
  }

  async organize(): Promise<void> {
    await this.run(async () => {
      const key = await this.backend.signUpAsOrganizer(this.name, this.code);
      rememberKey(key);
      this.organizerKey.set(key);
    });
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await action();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
