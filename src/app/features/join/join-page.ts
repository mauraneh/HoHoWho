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

@Component({
  selector: 'app-join-page',
  imports: [RouterLink, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container narrow">
      <div class="card join">
        @if (error(); as e) {
          <h1>Invitation unavailable</h1>
          <div class="alert alert-error" role="alert">{{ e }}</div>
          <p class="muted">Ask the organiser for a new invitation link.</p>
          <a routerLink="/events" class="btn">Go to my events</a>
        } @else if (preview(); as p) {
          <p class="muted">{{ p.ownerName }} invites you to</p>
          <h1>🎄 {{ p.eventName }}</h1>
          @if (p.eventDate) {
            <p class="muted">{{ p.eventDate | date: 'fullDate' }}</p>
          }
          @if (p.alreadyMember) {
            <p>You are already taking part.</p>
            <a [routerLink]="['/events', p.eventId]" class="btn btn-primary">Open event</a>
          } @else {
            <p>Join the Secret Santa to receive your giftee when names are drawn.</p>
            <button type="button" class="btn btn-primary" [disabled]="busy()" (click)="join()">
              {{ busy() ? 'Joining…' : 'Join the Secret Santa' }}
            </button>
          }
        } @else {
          <p class="muted">Checking your invitation…</p>
        }
      </div>
    </div>
  `,
  styles: `
    .join {
      text-align: center;
      margin-top: 2rem;
    }
  `,
})
export class JoinPage {
  private readonly backend = inject(HohowhoBackend);
  private readonly router = inject(Router);

  /** Route parameter `:token`. */
  readonly token = input.required<string>();

  protected readonly preview = signal<InvitationPreview | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

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
