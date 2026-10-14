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
import { Router } from '@angular/router';
import { MIN_PARTICIPANTS } from '@shared/draw';
import { HohowhoBackend } from '../../core/backend/hohowho-backend';
import { appUrl, errorMessage, initials, mailtoLink } from '../../core/format';
import { CreatedInvitation, EventDetail, Participant } from '../../core/models';
import { EventStore } from './event-store';

type Step = 'done' | 'current' | 'todo';

@Component({
  selector: 'app-overview-page',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.detail(); as d) {
      @if (error(); as e) {
        <div class="alert alert-error" role="alert">{{ e }}</div>
      }
      @if (notice(); as n) {
        <div class="alert alert-success" role="status">{{ n }}</div>
      }

      <ol class="stepper card" aria-label="Progress">
        @for (s of steps(); track s.title) {
          <li [class]="s.state">
            <span class="bullet">{{ s.state === 'done' ? '✓' : ['I', 'II', 'III'][$index] }}</span>
            <span class="step-text">
              <strong>{{ s.title }}</strong>
              <span class="muted small">{{ s.detail }}</span>
            </span>
          </li>
        }
      </ol>

      <!-- What the current user should do now -->
      <section class="card cta" [class.cta-done]="ctaDone()">
        @switch (d.event.status) {
          @case ('open') {
            @if (!d.me.profileCompleted) {
              <h2>🎁 Tell your Santa what you'd love</h2>
              <p class="muted">
                A few clicks: your interests, the kind of gifts you like, what to avoid, and an
                optional wishlist.
              </p>
              <button type="button" class="btn btn-primary" (click)="go('wishes')">
                Fill in my wishes
              </button>
            } @else {
              <h2>✓ Your wishes are saved</h2>
              <p class="muted">
                {{
                  d.isOwner
                    ? 'Close the list below once everyone has joined.'
                    : 'Next step when the organiser closes the list: choosing exclusions.'
                }}
              </p>
              <button type="button" class="btn btn-sm" (click)="go('wishes')">
                Edit my wishes
              </button>
            }
          }
          @case ('exclusions') {
            @if (!d.me.exclusionsConfirmed) {
              <h2>🤫 Anyone you'd rather not give a gift to?</h2>
              <p class="muted">
                Pick them privately (or nobody), then validate. Nobody will see your choices.
              </p>
              <button type="button" class="btn btn-primary" (click)="go('exclusions')">
                Choose my exclusions
              </button>
            } @else {
              <h2>✓ You've validated your exclusions</h2>
              <p class="muted">
                Names are drawn automatically when everyone has validated ({{ confirmedCount() }}/{{
                  d.participants.length
                }}
                so far).
              </p>
              <button type="button" class="btn btn-sm" (click)="go('exclusions')">
                Change my choices
              </button>
            }
          }
          @case ('drawn') {
            <h2>🎉 Names have been drawn!</h2>
            <p class="muted">Discover who you're buying a gift for, their wishes and gift ideas.</p>
            <button type="button" class="btn btn-gold btn-lg" (click)="go('giftee')">
              Reveal my giftee
            </button>
          }
        }
      </section>

      <section class="card">
        <div class="spread">
          <h2>Participants</h2>
          <span class="muted small">{{ progressLabel() }}</span>
        </div>
        <div class="progress" aria-hidden="true">
          <span [style.width.%]="progressPercent()"></span>
        </div>
        <ul class="list">
          @for (p of d.participants; track p.id) {
            <li class="spread">
              <span class="person">
                <span class="avatar" aria-hidden="true">{{ initials(p.displayName) }}</span>
                <span>
                  {{ p.displayName }}
                  @if (p.userId === d.event.ownerId) {
                    <span class="badge badge-gold">★ Organiser</span>
                  }
                  @if (p.id === d.me.id) {
                    <span class="badge">You</span>
                  }
                </span>
              </span>
              <span class="row">
                @if (d.event.status === 'open') {
                  <span class="badge" [class.badge-green]="p.profileCompleted">
                    {{ p.profileCompleted ? '✓ Wishes' : '… Wishes' }}
                  </span>
                } @else if (d.event.status === 'exclusions') {
                  <span class="badge" [class.badge-green]="p.exclusionsConfirmed">
                    {{ p.exclusionsConfirmed ? '✓ Validated' : '… Pending' }}
                  </span>
                }
                @if (d.event.status === 'open' && d.isOwner && p.userId !== d.event.ownerId) {
                  <button
                    type="button"
                    class="btn btn-sm btn-danger"
                    [disabled]="busy()"
                    (click)="removeParticipant(p)"
                    [attr.aria-label]="'Remove ' + p.displayName"
                  >
                    ✕
                  </button>
                }
              </span>
            </li>
          }
        </ul>
        @if (d.event.status === 'open' && !d.isOwner) {
          <button
            type="button"
            class="link-btn small leave"
            [disabled]="busy()"
            (click)="leave(d.me)"
          >
            Leave this Secret Santa
          </button>
        }
      </section>

      @if (d.isOwner) {
        <section class="card organiser">
          <span class="eyebrow">Organiser</span>
          @switch (d.event.status) {
            @case ('open') {
              <h2>1 · Invite everyone</h2>
              <p class="muted small">
                Share this link (WhatsApp, e-mail…). People enter their e-mail and fill in their
                wishes. For security a link is shown only once — create a new one whenever you need
                it.
              </p>
              @if (invitation(); as inv) {
                <div class="share">
                  <label for="invite-link" class="visually-hidden">Invitation link</label>
                  <input
                    id="invite-link"
                    readonly
                    [value]="inviteUrl(inv)"
                    (focus)="selectAll($event)"
                  />
                  <button type="button" class="btn btn-sm" (click)="copy(inviteUrl(inv))">
                    {{ copied() ? 'Copied ✓' : 'Copy' }}
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
                  🔗 {{ invitation() ? 'New invitation link' : 'Create the invitation link' }}
                </button>
                @if (activeInvitations() > 0) {
                  <button
                    type="button"
                    class="btn btn-sm btn-danger"
                    [disabled]="busy()"
                    (click)="revokeInvitations()"
                  >
                    Revoke {{ activeInvitations() }} link{{ activeInvitations() === 1 ? '' : 's' }}
                  </button>
                }
              </div>

              <hr />
              <h2>2 · Close the list</h2>
              @if (d.participants.length < minParticipants) {
                <p class="muted">
                  You need at least {{ minParticipants }} participants ({{ d.participants.length }}
                  so far).
                </p>
              } @else {
                <p class="muted">
                  When everyone has joined, close the list: nobody else can join, and everyone is
                  asked who they'd rather not give a gift to.
                  @if (missingWishes() > 0) {
                    <strong
                      >{{ missingWishes() }} participant(s) haven't filled in their wishes
                      yet.</strong
                    >
                  }
                </p>
              }
              <button
                type="button"
                class="btn btn-primary"
                [disabled]="busy() || d.participants.length < minParticipants"
                (click)="closeRegistrations()"
              >
                🔒 Close the list
              </button>
            }
            @case ('exclusions') {
              <h2>Send the exclusions link</h2>
              <p class="muted small">
                Everyone opens this link, picks who they'd rather skip, and validates.
              </p>
              <div class="share">
                <label for="exclusions-link" class="visually-hidden">Exclusions link</label>
                <input
                  id="exclusions-link"
                  readonly
                  [value]="link(d, 'exclusions')"
                  (focus)="selectAll($event)"
                />
                <button type="button" class="btn btn-sm" (click)="copy(link(d, 'exclusions'))">
                  {{ copied() ? 'Copied ✓' : 'Copy' }}
                </button>
              </div>
              <div class="row">
                <button
                  type="button"
                  class="btn btn-green"
                  [disabled]="busy()"
                  (click)="emailEveryone(d, 'exclusions')"
                >
                  ✉️ E-mail everyone
                </button>
              </div>
              <hr />
              <h2>Draw</h2>
              <p class="muted">
                Names are drawn automatically as soon as everyone has validated ({{
                  confirmedCount()
                }}/{{ d.participants.length }}). You can also draw now: people who haven't validated
                simply have no exclusions.
              </p>
              <div class="row">
                <button type="button" class="btn btn-primary" [disabled]="busy()" (click)="draw()">
                  🎲 Draw now
                </button>
                <button type="button" class="btn btn-sm" [disabled]="busy()" (click)="reopen()">
                  Reopen the list
                </button>
              </div>
            }
            @case ('drawn') {
              <h2>Tell everyone</h2>
              <p class="muted small">Everyone can now discover their giftee with this link.</p>
              <div class="share">
                <label for="giftee-link" class="visually-hidden">Event link</label>
                <input
                  id="giftee-link"
                  readonly
                  [value]="link(d, 'giftee')"
                  (focus)="selectAll($event)"
                />
                <button type="button" class="btn btn-sm" (click)="copy(link(d, 'giftee'))">
                  {{ copied() ? 'Copied ✓' : 'Copy' }}
                </button>
              </div>
              <button
                type="button"
                class="btn btn-green"
                [disabled]="busy()"
                (click)="emailEveryone(d, 'giftee')"
              >
                ✉️ E-mail everyone
              </button>
            }
          }
          <details class="danger-zone">
            <summary>Delete this Secret Santa</summary>
            <p class="muted small">Permanently deletes the event, wishes, draw and messages.</p>
            <button
              type="button"
              class="btn btn-sm btn-danger"
              [disabled]="busy()"
              (click)="deleteEvent()"
            >
              Delete permanently
            </button>
          </details>
        </section>
      }
    }
  `,
  styles: `
    .stepper {
      list-style: none;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.75rem;
      padding: 1rem 1.2rem;
    }
    .stepper li {
      display: flex;
      gap: 0.6rem;
      align-items: flex-start;
      opacity: 0.55;
    }
    .stepper li.current,
    .stepper li.done {
      opacity: 1;
    }
    .bullet {
      flex: none;
      display: grid;
      place-items: center;
      width: 2.3rem;
      height: 2.3rem;
      border-radius: 50%;
      border: 1px solid var(--gold);
      font-family: var(--font-caps);
      font-weight: 700;
      font-size: 0.85rem;
      color: var(--muted);
    }
    .current .bullet {
      background: var(--crimson);
      color: var(--ivory);
      box-shadow:
        inset 0 0 0 2px var(--crimson),
        inset 0 0 0 3px var(--gold-light),
        0 0 0 5px rgb(160 24 42 / 15%);
    }
    .done .bullet {
      background: var(--emerald);
      color: var(--gold-light);
    }
    .step-text strong {
      font-family: var(--font-serif);
      font-size: 1.15rem;
      color: var(--emerald);
    }
    .step-text {
      display: flex;
      flex-direction: column;
      line-height: 1.3;
    }
    @media (max-width: 640px) {
      .stepper {
        grid-template-columns: 1fr;
      }
    }
    .cta {
      border-top: 4px solid var(--crimson);
    }
    .cta-done {
      border-top-color: var(--emerald-light);
    }
    .progress {
      height: 8px;
      border-radius: 999px;
      background: #efe5d0;
      overflow: hidden;
      margin-bottom: 0.5rem;
    }
    .progress span {
      display: block;
      height: 100%;
      background: linear-gradient(90deg, var(--emerald-light), var(--gold));
      transition: width 0.3s ease;
    }
    .person {
      display: flex;
      align-items: center;
    }
    .leave {
      margin-top: 0.75rem;
    }
    .organiser hr {
      border: none;
      border-top: 1px dashed var(--line);
      margin: 1.4rem 0;
    }
    .share {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 0.6rem;
    }
    .danger-zone {
      margin-top: 1.5rem;
      color: var(--muted);
    }
    .danger-zone summary {
      cursor: pointer;
      font-size: 0.875rem;
    }
  `,
})
export class OverviewPage {
  private readonly backend = inject(HohowhoBackend);
  private readonly router = inject(Router);
  protected readonly store = inject(EventStore);
  protected readonly minParticipants = MIN_PARTICIPANTS;
  protected readonly initials = initials;

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly invitation = signal<CreatedInvitation | null>(null);
  protected readonly activeInvitations = signal(0);
  protected readonly copied = signal(false);

  protected readonly confirmedCount = computed(
    () => this.store.detail()?.participants.filter((p) => p.exclusionsConfirmed).length ?? 0,
  );
  protected readonly missingWishes = computed(
    () => this.store.detail()?.participants.filter((p) => !p.profileCompleted).length ?? 0,
  );

  protected readonly steps = computed(() => {
    const status = this.store.detail()?.event.status ?? 'open';
    const order = ['open', 'exclusions', 'drawn'];
    const state = (index: number): Step => {
      const current = order.indexOf(status);
      if (status === 'drawn' || index < current) return 'done';
      return index === current ? 'current' : 'todo';
    };
    return [
      { title: 'Join & wishes', detail: 'Everyone joins and shares wishes', state: state(0) },
      { title: 'Exclusions', detail: 'Each person picks who to skip', state: state(1) },
      { title: 'Draw', detail: 'Everyone discovers their giftee', state: state(2) },
    ];
  });

  protected readonly ctaDone = computed(() => {
    const d = this.store.detail();
    if (!d) return false;
    return d.event.status === 'open'
      ? d.me.profileCompleted
      : d.event.status === 'exclusions'
        ? d.me.exclusionsConfirmed
        : false;
  });

  protected readonly progressPercent = computed(() => {
    const d = this.store.detail();
    if (!d || d.participants.length === 0) return 0;
    if (d.event.status === 'drawn') return 100;
    const done =
      d.event.status === 'open'
        ? d.participants.filter((p) => p.profileCompleted).length
        : this.confirmedCount();
    return Math.round((done / d.participants.length) * 100);
  });

  protected readonly progressLabel = computed(() => {
    const d = this.store.detail();
    if (!d) return '';
    const n = d.participants.length;
    if (d.event.status === 'open')
      return `${n - this.missingWishes()}/${n} have filled in their wishes`;
    if (d.event.status === 'exclusions') return `${this.confirmedCount()}/${n} have validated`;
    return 'Everyone has a giftee 🎁';
  });

  constructor() {
    effect(() => {
      const detail = this.store.detail();
      if (detail?.isOwner && detail.event.status === 'open') {
        untracked(() => void this.loadInvitations(detail.event.id));
      }
    });
  }

  private get eventId(): string {
    return this.store.detail()!.event.id;
  }

  private async loadInvitations(eventId: string): Promise<void> {
    try {
      this.activeInvitations.set(await this.backend.countActiveInvitations(eventId));
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  inviteUrl(invitation: CreatedInvitation): string {
    return appUrl(`/join/${invitation.token}`);
  }

  link(detail: EventDetail, tab: string): string {
    return appUrl(`/events/${detail.event.id}/${tab}`);
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

  /** Opens the organiser's own mail app with everyone in BCC: free, nothing to configure. */
  async emailEveryone(detail: EventDetail, tab: 'exclusions' | 'giftee'): Promise<void> {
    await this.run(async () => {
      const emails = await this.backend.getParticipantEmails(detail.event.id);
      const name = detail.event.name;
      const url = this.link(detail, tab);
      const [subject, body] =
        tab === 'exclusions'
          ? [
              `${name}: one last step before the draw 🎁`,
              `Hi!\n\nThe list for "${name}" is closed. Before names are drawn, tell us privately if there's anyone you'd rather not give a gift to (or nobody), then validate:\n\n${url}\n\nNames are drawn as soon as everyone has validated.\n\nSee you soon! 🎄`,
            ]
          : [
              `${name}: discover your Secret Santa giftee 🎉`,
              `Hi!\n\nNames have been drawn for "${name}". Find out who you're buying a gift for (with their wishes and gift ideas):\n\n${url}\n\nShhh, it's a secret! 🤫`,
            ];
      window.location.href = mailtoLink(emails, subject, body);
    });
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

  async closeRegistrations(): Promise<void> {
    const missing = this.missingWishes();
    const warning =
      missing > 0
        ? `\n\n${missing} participant(s) haven't filled in their wishes yet (they still can afterwards).`
        : '';
    if (!confirm(`Close the list? Nobody else will be able to join.${warning}`)) return;
    const ok = await this.run(
      () => this.backend.closeRegistrations(this.eventId),
      'The list is closed. Send everyone the exclusions link below.',
    );
    if (ok) await this.store.reload();
  }

  async reopen(): Promise<void> {
    if (!confirm('Reopen the list? Everyone will have to validate their exclusions again.')) return;
    const ok = await this.run(
      () => this.backend.reopenRegistrations(this.eventId),
      'The list is open again.',
    );
    if (ok) await this.store.reload();
  }

  async removeParticipant(participant: Participant): Promise<void> {
    if (!confirm(`Remove ${participant.displayName} from this Secret Santa?`)) return;
    const ok = await this.run(
      () => this.backend.removeParticipant(participant.id),
      `${participant.displayName} has been removed.`,
    );
    if (ok) await this.store.reload();
  }

  async leave(me: Participant): Promise<void> {
    if (!confirm('Leave this Secret Santa? Your wishes will be deleted.')) return;
    const ok = await this.run(() => this.backend.removeParticipant(me.id));
    if (ok) await this.router.navigateByUrl('/events');
  }

  async draw(): Promise<void> {
    const waiting = (this.store.detail()?.participants.length ?? 0) - this.confirmedCount();
    const warning =
      waiting > 0 ? ` ${waiting} participant(s) haven't validated their exclusions.` : '';
    if (!confirm(`Draw names now?${warning} This cannot be undone.`)) return;
    const ok = await this.run(
      () => this.backend.drawNames(this.eventId),
      'Names have been drawn! 🎉',
    );
    if (ok) await this.store.reload();
  }

  async deleteEvent(): Promise<void> {
    if (!confirm('Delete this Secret Santa and all its data? This cannot be undone.')) return;
    const ok = await this.run(() => this.backend.deleteEvent(this.eventId));
    if (ok) await this.router.navigateByUrl('/events');
  }
}
