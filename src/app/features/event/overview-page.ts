import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MIN_PARTICIPANTS } from '@shared/draw';
import { HohowhoBackend } from '../../core/backend/hohowho-backend';
import { errorMessage } from '../../core/format';
import { CreatedInvitation, Exclusion, Participant } from '../../core/models';
import { EventStore } from './event-store';

@Component({
  selector: 'app-overview-page',
  imports: [FormsModule, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.detail(); as d) {
      @if (error(); as e) {
        <div class="alert alert-error" role="alert">{{ e }}</div>
      }
      @if (notice(); as n) {
        <div class="alert alert-success" role="status">{{ n }}</div>
      }

      @if (d.event.status === 'drawn') {
        <div class="card highlight">
          <h2>🎁 Names have been drawn!</h2>
          <p>Find out who you are buying a gift for, with their wishlist and gift ideas.</p>
          <button type="button" class="btn btn-primary" (click)="go('giftee')">
            See my giftee
          </button>
        </div>
      } @else if (!d.isOwner) {
        <div class="card">
          <h2>Waiting for the draw</h2>
          <p class="muted">
            The organiser will draw names once everyone has joined. Meanwhile, fill in your wishes
            so your Secret Santa knows what you like.
          </p>
          <button type="button" class="btn btn-green" (click)="go('wishes')">
            Fill in my wishes
          </button>
        </div>
      }

      <section class="card">
        <h2>Participants</h2>
        <ul class="list">
          @for (p of d.participants; track p.id) {
            <li class="spread">
              <span>
                {{ p.displayName }}
                @if (p.userId === d.event.ownerId) {
                  <span class="badge badge-red">Organiser</span>
                }
                @if (p.id === d.me.id) {
                  <span class="badge">You</span>
                }
              </span>
              @if (d.event.status === 'open' && d.isOwner && p.userId !== d.event.ownerId) {
                <button
                  type="button"
                  class="btn btn-sm btn-danger"
                  [disabled]="busy()"
                  (click)="removeParticipant(p)"
                >
                  Remove
                </button>
              }
            </li>
          }
        </ul>
        @if (d.event.status === 'open' && !d.isOwner) {
          <button
            type="button"
            class="btn btn-sm btn-danger leave"
            [disabled]="busy()"
            (click)="leave(d.me)"
          >
            Leave this event
          </button>
        }
      </section>

      @if (d.isOwner && d.event.status === 'open') {
        <section class="card">
          <h2>Invite participants</h2>
          <p class="muted small">
            Anyone with the link can join until it expires. For security, a link is shown only once:
            create a new one whenever you need it.
          </p>
          @if (invitation(); as inv) {
            <div class="invite">
              <label for="invite-link" class="visually-hidden">Invitation link</label>
              <input
                id="invite-link"
                readonly
                [value]="inviteUrl(inv)"
                (focus)="selectAll($event)"
              />
              <button type="button" class="btn btn-sm" (click)="copy(inviteUrl(inv))">
                {{ copied() ? 'Copied!' : 'Copy' }}
              </button>
            </div>
            <p class="muted small">Valid until {{ inv.expiresAt | date: 'medium' }}.</p>
          }
          <div class="row">
            <button
              type="button"
              class="btn btn-green"
              [disabled]="busy()"
              (click)="createInvitation()"
            >
              Create invitation link
            </button>
            @if (activeInvitations() > 0) {
              <button
                type="button"
                class="btn btn-danger"
                [disabled]="busy()"
                (click)="revokeInvitations()"
              >
                Revoke {{ activeInvitations() }} active link{{
                  activeInvitations() === 1 ? '' : 's'
                }}
              </button>
            }
          </div>
        </section>

        <section class="card">
          <h2>Exclusions</h2>
          <p class="muted small">
            Pairs who must not draw each other (for example partners who already exchange gifts).
          </p>
          @if (exclusions().length) {
            <ul class="list">
              @for (x of exclusions(); track x.id) {
                <li class="spread">
                  <span>{{ nameOf(x.participantA) }} ⇄ {{ nameOf(x.participantB) }}</span>
                  <button
                    type="button"
                    class="btn btn-sm btn-danger"
                    [disabled]="busy()"
                    (click)="removeExclusion(x)"
                  >
                    Remove
                  </button>
                </li>
              }
            </ul>
          }
          @if (d.participants.length >= 2) {
            <div class="row exclusion-form">
              <label class="visually-hidden" for="ex-a">First participant</label>
              <select id="ex-a" [(ngModel)]="exclusionA">
                <option value="">Choose…</option>
                @for (p of d.participants; track p.id) {
                  <option [value]="p.id">{{ p.displayName }}</option>
                }
              </select>
              <span aria-hidden="true">⇄</span>
              <label class="visually-hidden" for="ex-b">Second participant</label>
              <select id="ex-b" [(ngModel)]="exclusionB">
                <option value="">Choose…</option>
                @for (p of d.participants; track p.id) {
                  <option [value]="p.id">{{ p.displayName }}</option>
                }
              </select>
              <button
                type="button"
                class="btn btn-sm"
                (click)="addExclusion()"
                [disabled]="busy() || !exclusionA || !exclusionB || exclusionA === exclusionB"
              >
                Add
              </button>
            </div>
          }
        </section>

        <section class="card">
          <h2>Draw names</h2>
          @if (d.participants.length < minParticipants) {
            <p class="muted">
              You need at least {{ minParticipants }} participants to draw names ({{
                d.participants.length
              }}
              so far).
            </p>
          } @else {
            <p class="muted">
              Each participant will be secretly assigned someone to buy a gift for. Nobody, not even
              you, can see the full list. This cannot be undone, and nobody can join afterwards.
            </p>
          }
          <button
            type="button"
            class="btn btn-primary"
            (click)="draw()"
            [disabled]="busy() || d.participants.length < minParticipants"
          >
            🎲 Draw names now
          </button>
        </section>
      }

      @if (d.isOwner) {
        <section class="card danger-zone">
          <h2>Delete event</h2>
          <p class="muted small">
            Permanently deletes the event, assignments, wishlists and messages.
          </p>
          <button type="button" class="btn btn-danger" [disabled]="busy()" (click)="deleteEvent()">
            Delete this event
          </button>
        </section>
      }
    }
  `,
  styles: `
    .highlight {
      border-color: var(--green);
      background: var(--green-light);
    }
    .invite {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }
    .exclusion-form select {
      width: auto;
      flex: 1 1 140px;
    }
    .leave {
      margin-top: 0.75rem;
    }
    .danger-zone {
      border-color: #f0c4c0;
    }
  `,
})
export class OverviewPage {
  private readonly backend = inject(HohowhoBackend);
  private readonly router = inject(Router);
  protected readonly store = inject(EventStore);
  protected readonly minParticipants = MIN_PARTICIPANTS;

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly invitation = signal<CreatedInvitation | null>(null);
  protected readonly activeInvitations = signal(0);
  protected readonly exclusions = signal<Exclusion[]>([]);
  protected readonly copied = signal(false);
  protected exclusionA = '';
  protected exclusionB = '';

  private readonly names = computed(
    () => new Map(this.store.detail()?.participants.map((p) => [p.id, p.displayName]) ?? []),
  );

  constructor() {
    effect(() => {
      const detail = this.store.detail();
      if (detail?.isOwner && detail.event.status === 'open') {
        untracked(() => void this.loadAdminData(detail.event.id));
      }
    });
  }

  private get eventId(): string {
    return this.store.detail()!.event.id;
  }

  private async loadAdminData(eventId: string): Promise<void> {
    try {
      const [exclusions, active] = await Promise.all([
        this.backend.listExclusions(eventId),
        this.backend.countActiveInvitations(eventId),
      ]);
      this.exclusions.set(exclusions);
      this.activeInvitations.set(active);
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  nameOf(participantId: string): string {
    return this.names().get(participantId) ?? 'Former participant';
  }

  inviteUrl(invitation: CreatedInvitation): string {
    return new URL(`#/join/${invitation.token}`, document.baseURI).toString();
  }

  selectAll(event: FocusEvent): void {
    (event.target as HTMLInputElement).select();
  }

  async copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      this.error.set('Copy failed: select the link and copy it manually.');
    }
  }

  go(tab: string): void {
    void this.router.navigate(['/events', this.eventId, tab]);
  }

  /** Runs an action with busy/error handling. Returns true on success. */
  private async run(action: () => Promise<unknown>, notice?: string): Promise<boolean> {
    this.busy.set(true);
    this.error.set(null);
    this.notice.set(null);
    try {
      await action();
      if (notice) this.notice.set(notice);
      return true;
    } catch (e) {
      this.error.set(errorMessage(e));
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  async createInvitation(): Promise<void> {
    await this.run(async () => {
      this.invitation.set(await this.backend.createInvitation(this.eventId));
      this.activeInvitations.update((n) => n + 1);
    });
  }

  async revokeInvitations(): Promise<void> {
    if (
      !confirm('Revoke all invitation links? People who have not joined yet will need a new link.')
    )
      return;
    await this.run(async () => {
      await this.backend.revokeInvitations(this.eventId);
      this.invitation.set(null);
      this.activeInvitations.set(0);
    }, 'All invitation links have been revoked.');
  }

  async addExclusion(): Promise<void> {
    const ok = await this.run(() =>
      this.backend.addExclusion(this.eventId, this.exclusionA, this.exclusionB),
    );
    if (ok) {
      this.exclusionA = '';
      this.exclusionB = '';
      this.exclusions.set(await this.backend.listExclusions(this.eventId));
    }
  }

  async removeExclusion(exclusion: Exclusion): Promise<void> {
    const ok = await this.run(() => this.backend.removeExclusion(exclusion.id));
    if (ok) this.exclusions.update((list) => list.filter((x) => x.id !== exclusion.id));
  }

  async removeParticipant(participant: Participant): Promise<void> {
    if (!confirm(`Remove ${participant.displayName} from this event?`)) return;
    const ok = await this.run(
      () => this.backend.removeParticipant(participant.id),
      `${participant.displayName} has been removed.`,
    );
    if (ok) await this.store.reload();
  }

  async leave(me: Participant): Promise<void> {
    if (!confirm('Leave this event? Your wishes will be deleted.')) return;
    const ok = await this.run(() => this.backend.removeParticipant(me.id));
    if (ok) await this.router.navigateByUrl('/events');
  }

  async draw(): Promise<void> {
    if (!confirm('Draw names now? Nobody will be able to join or be removed afterwards.')) return;
    const ok = await this.run(
      () => this.backend.drawNames(this.eventId),
      'Names have been drawn! 🎉',
    );
    if (ok) await this.store.reload();
  }

  async deleteEvent(): Promise<void> {
    if (!confirm('Delete this event and all its data? This cannot be undone.')) return;
    const ok = await this.run(() => this.backend.deleteEvent(this.eventId));
    if (ok) await this.router.navigateByUrl('/events');
  }
}
