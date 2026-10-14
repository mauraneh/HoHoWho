import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HohowhoBackend } from '../../core/backend/hohowho-backend';
import { errorMessage } from '../../core/format';
import { rememberNext } from '../../core/pending-navigation';
import { DATA_SOURCE } from '../../core/tokens';

/** Passwordless sign-in: name + e-mail, then a one-click link arrives by e-mail. */
@Component({
  selector: 'app-sign-in-form',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (sentTo(); as email) {
      <div class="sent" role="status">
        <div class="envelope" aria-hidden="true">✉️</div>
        <h2>Regardez votre boîte mail</h2>
        <p>
          Nous avons envoyé un lien magique à <strong>{{ email }}</strong
          >. Ouvrez-le sur n’importe quel appareil pour continuer, sans mot de passe.
        </p>
        <p class="muted small">Rien après quelques minutes ? Regardez dans les spams, ou</p>
        <button type="button" class="link-btn" (click)="sentTo.set(null)">
          utilisez une autre adresse
        </button>
      </div>
    } @else {
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        @if (error(); as e) {
          <div class="alert alert-error" role="alert">{{ e }}</div>
        }
        <div class="field">
          <label for="displayName">Votre prénom</label>
          <input
            id="displayName"
            formControlName="displayName"
            autocomplete="given-name"
            maxlength="60"
            placeholder="ex. Camille"
          />
          <span class="hint"
            >Visible par les autres participants (demandé seulement la première fois).</span
          >
        </div>
        <div class="field">
          <label for="email">Votre e-mail</label>
          <input
            id="email"
            type="email"
            formControlName="email"
            autocomplete="email"
            placeholder="camille@example.com"
          />
        </div>
        <button type="submit" class="btn btn-primary btn-lg btn-block" [disabled]="busy()">
          {{ busy() ? 'Envoi…' : submitLabel() }}
        </button>
        <p class="muted small fine-print">
          {{
            isMock
              ? 'Mode démo : connexion immédiate, aucun e-mail n’est envoyé.'
              : 'Vous recevez un lien de connexion par e-mail. Pas de mot de passe, pas de compte à gérer.'
          }}
        </p>
      </form>
    }
  `,
  styles: `
    .sent {
      text-align: center;
    }
    .envelope {
      font-size: 3rem;
      animation: float 3s ease-in-out infinite;
    }
    @keyframes float {
      50% {
        transform: translateY(-6px) rotate(-4deg);
      }
    }
    .fine-print {
      margin: 0.75rem 0 0;
      text-align: center;
    }
  `,
})
export class SignInForm {
  private readonly backend = inject(HohowhoBackend);
  protected readonly isMock = inject(DATA_SOURCE) === 'mock';

  /** In-app path to open once signed in. */
  readonly next = input('/events');
  readonly submitLabel = input('Recevoir mon lien magique ✨');
  /** Emitted when the user is signed in right away (demo mode). */
  readonly signedIn = output<void>();

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly sentTo = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    displayName: ['', [Validators.maxLength(60)]],
    email: ['', [Validators.required, Validators.email]],
  });

  constructor() {
    this.error.set(this.backend.consumeAuthError());
  }

  async submit(): Promise<void> {
    this.error.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Merci d’indiquer une adresse e-mail valide.');
      return;
    }
    const { displayName, email } = this.form.getRawValue();
    this.busy.set(true);
    try {
      rememberNext(this.next());
      const result = await this.backend.requestSignInLink(email, displayName, this.next());
      if (result.signedIn) this.signedIn.emit();
      else this.sentTo.set(email.trim());
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
