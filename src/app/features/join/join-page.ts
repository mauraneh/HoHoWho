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
import { Router, RouterLink } from '@angular/router';
import { HohowhoBackend } from '../../core/backend/hohowho-backend';
import { errorMessage } from '../../core/format';
import { InvitationPreview } from '../../core/models';
import { BowRibbon, Corners, Divider } from '../../shared/ornaments';
import { SignInForm } from '../auth/sign-in-form';

/** Invitation landing page: works signed out (asks for an e-mail) and signed in (one click). */
@Component({
  selector: 'app-join-page',
  imports: [RouterLink, DatePipe, SignInForm, BowRibbon, Corners, Divider],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container narrow">
      @if (error(); as e) {
        <div class="card invite">
          <div class="big-icon" aria-hidden="true">🔒</div>
          <h1>Invitation indisponible</h1>
          <p class="muted">{{ e }}</p>
          <p class="muted small">Demandez un nouveau lien à l’organisateur.</p>
          <a routerLink="/events" class="btn">Mes Secret Santa</a>
        </div>
      } @else if (preview(); as p) {
        <div class="card card-night invite">
          <div class="snow" aria-hidden="true"></div>
          <app-corners />
          <span class="script kicker">Vous êtes invité·e</span>
          <span class="eyebrow">{{ p.ownerName }} vous invite au Secret Santa</span>
          <h1>{{ p.eventName }}</h1>
          <app-divider />
          @if (p.eventDate) {
            <p class="muted caps date">{{ p.eventDate | date: 'fullDate' }}</p>
          }
        </div>
        <app-bow-ribbon class="ribbon" />

        <div class="card">
          @if (!user()) {
            <h2>Rejoindre en 1 minute</h2>
            <p class="muted small">
              Indiquez votre prénom et votre e-mail. Vous direz ensuite à votre Père Noël secret ce
              qui vous ferait plaisir.
            </p>
            <app-sign-in-form
              [next]="'/join/' + token()"
              submitLabel="Rejoindre le Secret Santa 🎁"
              (signedIn)="load(token())"
            />
          } @else if (p.alreadyMember) {
            <h2>Vous en êtes ! 🎉</h2>
            <p class="muted">Vous participez déjà.</p>
            <a [routerLink]="['/events', p.eventId]" class="btn btn-primary"
              >Ouvrir le Secret Santa</a
            >
          } @else {
            <h2>Bonjour {{ user()!.displayName }} 👋</h2>
            <p class="muted">
              Rejoignez, puis dites à votre Père Noël secret quel cadeau vous ferait plaisir.
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
        </div>
      } @else {
        <p class="muted center">Ouverture de votre invitation…</p>
      }
    </div>
  `,
  styles: `
    .invite {
      overflow: hidden;
      text-align: center;
      margin: 1rem 0 0;
      padding: 2.6rem 1.75rem 2.2rem;
    }
    .invite > :not(app-corners, .snow) {
      position: relative;
    }
    .invite .eyebrow {
      display: block;
    }
    .kicker {
      display: block;
      font-size: 2.6rem;
      line-height: 1;
      color: var(--gold-light);
      margin-bottom: 0.4rem;
    }
    .invite h1 {
      font-size: clamp(2.2rem, 7vw, 3rem);
      margin: 0.5rem 0 0;
    }
    .date {
      font-size: 0.8rem;
      margin: 0;
    }
    .ribbon {
      margin: -0.4rem -1rem 0.6rem;
    }
    .big-icon {
      font-size: 2.5rem;
    }
    .center {
      text-align: center;
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

  constructor() {
    effect(() => {
      const token = this.token();
      untracked(() => void this.load(token));
    });
  }

  async load(token: string): Promise<void> {
    this.error.set(null);
    try {
      this.preview.set(await this.backend.previewInvitation(token));
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  async join(): Promise<void> {
    this.busy.set(true);
    try {
      const eventId = await this.backend.acceptInvitation(this.token());
      await this.router.navigate(['/events', eventId, 'wishes']);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
