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
      <h3>Bienvenue, organisatrice ✦</h3>
      <app-personal-link-card
        [key]="key"
        title="Votre lien organisatrice"
        hint="Il vous reconnecte à votre espace sur n’importe quel appareil. Gardez-le pour vous : il donne accès à l’organisation."
      />
      <button type="button" class="btn btn-primary btn-block" (click)="signedIn.emit()">
        Continuer ✦
      </button>
    } @else {
      <p class="lead-in">
        <strong>Invité·e&nbsp;?</strong> Ouvrez simplement le lien d’invitation reçu : un prénom et
        c’est parti, sans e-mail ni mot de passe.
      </p>

      <form class="block" (ngSubmit)="openLink()">
        <label class="field-label" for="personal-link">J’ai déjà mon lien personnel</label>
        <div class="inline">
          <input
            id="personal-link"
            name="link"
            [(ngModel)]="link"
            placeholder="Collez votre lien ici"
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
            <label for="org-name">Votre prénom</label>
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
            Créer mon accès organisatrice
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
