import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HohowhoBackend } from '../../core/backend/hohowho-backend';
import { errorMessage } from '../../core/format';
import { InvitationPreview } from '../../core/models';
import { rememberKey } from '../../core/personal-link';
import { PersonalLinkCard } from '../../shared/personal-link-card';

/**
 * Invitation landing page. Signed out: a first name is enough, the account is created and the
 * person receives their personal link. Signed in: one click to join.
 */
@Component({
  selector: 'app-join-page',
  imports: [RouterLink, DatePipe, FormsModule, PersonalLinkCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container narrow">
      @if (error(); as e) {
        <div class="card">
          <h1>Oups, ce lien a fondu</h1>
          <p class="muted">{{ e }}</p>
          <p class="muted small">Demande un nouveau lien à l’orga.</p>
          <a routerLink="/events" class="btn">Mes Secret Santa</a>
        </div>
      } @else if (preview(); as p) {
        <header class="invite">
          <span class="eyebrow">{{ p.ownerName }} t’invite 🎄</span>
          <h1>{{ p.eventName }}</h1>
          @if (p.eventDate) {
            <p class="muted date">{{ p.eventDate | date: 'fullDate' }}</p>
          }
        </header>

        <div class="card">
          @if (welcomeKey(); as key) {
            <h2>Bienvenue {{ user()?.displayName }} ! 🎉</h2>
            <p class="muted">
              Tu es dans la hotte ! Voici ton lien perso : envoie-le-toi (sur WhatsApp par exemple)
              pour revenir plus tard, sur ce téléphone ou un autre.
            </p>
            <app-personal-link-card [key]="key" />
            <button type="button" class="btn btn-primary btn-lg btn-block" (click)="continue(p)">
              Remplir mes envies
            </button>
          } @else if (!user()) {
            <h2>Monte dans le traîneau</h2>
            <p class="muted small">
              Juste ton prénom : pas d’e-mail, pas de mot de passe. Ensuite, tu diras à ton Père
              Noël secret ce qui te ferait plaisir.
            </p>
            <form (ngSubmit)="joinAsNewcomer()">
              <div class="field">
                <label for="displayName">Ton prénom</label>
                <input
                  id="displayName"
                  name="displayName"
                  [(ngModel)]="name"
                  maxlength="60"
                  autocomplete="given-name"
                  placeholder="ex. Camille"
                />
                <span class="hint">Les autres le verront, pas de pseudo louche.</span>
              </div>
              <button
                type="submit"
                class="btn btn-primary btn-lg btn-block"
                [disabled]="busy() || !name.trim()"
              >
                {{ busy() ? 'Un instant…' : 'Rejoindre le Secret Santa 🎁' }}
              </button>
            </form>
            <p class="muted small already">
              Tu as déjà ton lien perso&nbsp;? Ouvre-le d’abord, puis reviens sur cette invitation.
            </p>
          } @else if (p.alreadyMember) {
            <h2>Tu en es déjà ! 🎉</h2>
            <p class="muted">Tu fais déjà partie de la bande.</p>
            <a [routerLink]="['/events', p.eventId]" class="btn btn-primary"
              >Ouvrir le Secret Santa</a
            >
          } @else {
            <h2>Bonjour {{ user()!.displayName }} 👋</h2>
            <p class="muted">
              Rejoins la bande, puis dis à ton Père Noël secret ce qui te ferait plaisir.
            </p>
            <button
              type="button"
              class="btn btn-primary btn-lg btn-block"
              [disabled]="busy()"
              (click)="join()"
            >
              {{ busy() ? 'Inscription…' : 'Rejoindre le Secret Santa 🎁' }}
            </button>
          }
          @if (formError(); as e) {
            <div class="alert alert-error" role="alert">{{ e }}</div>
          }
        </div>
      } @else {
        <p class="muted center">On déballe ton invitation…</p>
      }
    </div>
  `,
  styles: `
    .invite {
      margin: 2rem 0 2rem;
    }
    .invite h1 {
      font-size: clamp(2.8rem, 10vw, 4.8rem);
      line-height: 0.95;
      letter-spacing: -0.05em;
      margin: 0.5rem 0 0.6rem;
    }
    .date {
      margin: 0;
      font-weight: 600;
    }
    .card h1 {
      font-size: 2rem;
    }
    .already {
      margin: 1rem 0 0;
    }
    .alert {
      margin: 1rem 0 0;
    }
  `,
})
export class JoinPage {
  private readonly backend = inject(HohowhoBackend);
  private readonly router = inject(Router);

  /** Route parameter `:token`. */
  readonly token = input.required<string>();

  protected readonly user = this.backend.currentUser;
  protected readonly preview = signal<InvitationPreview | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly formError = signal<string | null>(null);
  /** Personal key of a newly created account, shown once after joining. */
  protected readonly welcomeKey = signal<string | null>(null);
  protected name = '';

  constructor() {
    effect(() => {
      const token = this.token();
      untracked(() => void this.load(token));
    });
  }

  private async load(token: string): Promise<void> {
    this.error.set(null);
    try {
      this.preview.set(await this.backend.previewInvitation(token));
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  /** New person: create the account, join, then show the personal link. */
  async joinAsNewcomer(): Promise<void> {
    await this.run(async () => {
      const key = await this.backend.joinWithInvitation(this.name, this.token());
      rememberKey(key);
      await this.backend.acceptInvitation(this.token());
      this.welcomeKey.set(key);
    });
  }

  async join(): Promise<void> {
    await this.run(async () => {
      const eventId = await this.backend.acceptInvitation(this.token());
      await this.router.navigate(['/events', eventId, 'wishes']);
    });
  }

  continue(preview: InvitationPreview): void {
    void this.router.navigate(['/events', preview.eventId, 'wishes']);
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.formError.set(null);
    try {
      await action();
    } catch (e) {
      this.formError.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
