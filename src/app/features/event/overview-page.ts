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
import { appUrl, errorMessage, initials } from '../../core/format';
import { CreatedInvitation, EventDetail, Participant } from '../../core/models';
import { PersonalLinkCard } from '../../shared/personal-link-card';
import { EventStore } from './event-store';

type Step = 'done' | 'current' | 'todo';

@Component({
  selector: 'app-overview-page',
  imports: [DatePipe, PersonalLinkCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.detail(); as d) {
      @if (error(); as e) {
        <div class="alert alert-error" role="alert">{{ e }}</div>
      }
      @if (notice(); as n) {
        <div class="alert alert-success" role="status">{{ n }}</div>
      }

      <ol class="stepper card" aria-label="Étapes">
        @for (s of steps(); track s.title) {
          <li [class]="s.state">
            <span class="bullet">{{ s.state === 'done' ? '✓' : $index + 1 }}</span>
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
              <h2>🎁 Dites à votre Père Noël secret ce qui vous ferait plaisir</h2>
              <p class="muted">
                Quelques clics : vos centres d’intérêt, le genre de cadeaux que vous aimez, ce qu’il
                faut éviter et, si vous voulez, une liste de souhaits.
              </p>
              <button type="button" class="btn btn-primary" (click)="go('wishes')">
                Remplir mes envies
              </button>
            } @else {
              <h2>✓ Vos envies sont enregistrées</h2>
              <p class="muted">
                {{
                  d.isOwner
                    ? 'Fermez la liste ci-dessous quand tout le monde a rejoint.'
                    : 'Prochaine étape quand l’organisateur fermera la liste : le choix des exclusions.'
                }}
              </p>
              <button type="button" class="btn btn-sm" (click)="go('wishes')">
                Modifier mes envies
              </button>
            }
          }
          @case ('exclusions') {
            @if (!d.me.exclusionsConfirmed) {
              <h2>🤫 Quelqu’un à qui vous préférez ne pas offrir ?</h2>
              <p class="muted">
                Choisissez en secret (ou personne), puis validez. Personne ne verra vos choix.
              </p>
              <button type="button" class="btn btn-primary" (click)="go('exclusions')">
                Choisir mes exclusions
              </button>
            } @else {
              <h2>✓ Vous avez validé vos exclusions</h2>
              <p class="muted">
                Le tirage se fait automatiquement quand tout le monde a validé ({{
                  confirmedCount()
                }}/{{ d.participants.length }} pour l’instant).
              </p>
              <button type="button" class="btn btn-sm" (click)="go('exclusions')">
                Modifier mes choix
              </button>
            }
          }
          @case ('drawn') {
            <h2>🎉 Le tirage a eu lieu !</h2>
            <p class="muted">
              Découvrez à qui vous offrez un cadeau, ses envies et des idées cadeaux.
            </p>
            <button type="button" class="btn btn-primary btn-lg" (click)="go('giftee')">
              Découvrir mon tirage
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
                    <span class="badge badge-red">Organisatrice</span>
                  }
                  @if (p.id === d.me.id) {
                    <span class="badge">Vous</span>
                  }
                </span>
              </span>
              <span class="row">
                @if (d.event.status === 'open') {
                  <span class="badge" [class.badge-green]="p.profileCompleted">
                    {{ p.profileCompleted ? '✓ Envies' : '… Envies' }}
                  </span>
                } @else if (d.event.status === 'exclusions') {
                  <span class="badge" [class.badge-green]="p.exclusionsConfirmed">
                    {{ p.exclusionsConfirmed ? '✓ Validé' : '… En attente' }}
                  </span>
                }
                @if (d.isOwner && p.id !== d.me.id) {
                  <button
                    type="button"
                    class="btn btn-sm"
                    [disabled]="busy()"
                    (click)="newLinkFor(p)"
                    [attr.aria-label]="'Nouveau lien pour ' + p.displayName"
                    title="Nouveau lien personnel"
                  >
                    🔗
                  </button>
                }
                @if (d.event.status === 'open' && d.isOwner && p.userId !== d.event.ownerId) {
                  <button
                    type="button"
                    class="btn btn-sm btn-danger"
                    [disabled]="busy()"
                    (click)="removeParticipant(p)"
                    [attr.aria-label]="'Retirer ' + p.displayName"
                  >
                    ✕
                  </button>
                }
              </span>
            </li>
          }
        </ul>
        @if (resetLink(); as r) {
          <app-personal-link-card
            [key]="r.key"
            [title]="'Nouveau lien de ' + r.name"
            hint="Envoyez-le-lui en privé : son ancien lien ne fonctionne plus."
            message="Ton nouveau lien HoHoWho :"
          />
        }
        @if (d.event.status === 'open' && !d.isOwner) {
          <button
            type="button"
            class="link-btn small leave"
            [disabled]="busy()"
            (click)="leave(d.me)"
          >
            Quitter ce Secret Santa
          </button>
        }
      </section>

      @if (d.isOwner) {
        <section class="card organiser">
          <span class="eyebrow">Espace organisateur</span>
          @switch (d.event.status) {
            @case ('open') {
              <h2>1 · Invitez tout le monde</h2>
              <p class="muted small">
                Partagez ce lien (WhatsApp, SMS…). Chacun entre son prénom puis remplit ses envies.
                Par sécurité, un lien n’est affiché qu’une fois : créez-en un nouveau quand vous en
                avez besoin.
              </p>
              @if (invitation(); as inv) {
                <div class="share">
                  <label for="invite-link" class="visually-hidden">Lien d’invitation</label>
                  <input
                    id="invite-link"
                    readonly
                    [value]="inviteUrl(inv)"
                    (focus)="selectAll($event)"
                  />
                  <button type="button" class="btn btn-sm" (click)="copy(inviteUrl(inv))">
                    {{ copied() ? 'Copié ✓' : 'Copier' }}
                  </button>
                </div>
                <p class="muted small">Valable jusqu’au {{ inv.expiresAt | date: 'medium' }}.</p>
              }
              <div class="row">
                <button
                  type="button"
                  class="btn btn-green"
                  [disabled]="busy()"
                  (click)="createInvitation()"
                >
                  🔗 {{ invitation() ? 'Nouveau lien d’invitation' : 'Créer le lien d’invitation' }}
                </button>
                @if (activeInvitations() > 0) {
                  <button
                    type="button"
                    class="btn btn-sm btn-danger"
                    [disabled]="busy()"
                    (click)="revokeInvitations()"
                  >
                    Révoquer {{ activeInvitations() }} lien{{
                      activeInvitations() === 1 ? '' : 's'
                    }}
                  </button>
                }
              </div>

              <hr />
              <h2>2 · Fermez la liste</h2>
              @if (d.participants.length < minParticipants) {
                <p class="muted">
                  Il faut au moins {{ minParticipants }} participants ({{ d.participants.length }}
                  pour l’instant).
                </p>
              } @else {
                <p class="muted">
                  Quand tout le monde a rejoint, fermez la liste : plus personne ne peut s’inscrire,
                  et chacun choisit à qui il préfère ne pas offrir.
                  @if (missingWishes() > 0) {
                    <strong
                      >{{ missingWishes() }} participant(s) n’ont pas encore rempli leurs
                      envies.</strong
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
                🔒 Fermer la liste
              </button>
            }
            @case ('exclusions') {
              <h2>Envoyez le lien des exclusions</h2>
              <p class="muted small">
                Chacun ouvre ce lien, choisit à qui il préfère ne pas offrir, puis valide.
              </p>
              <div class="share">
                <label for="exclusions-link" class="visually-hidden">Lien des exclusions</label>
                <input
                  id="exclusions-link"
                  readonly
                  [value]="link(d, 'exclusions')"
                  (focus)="selectAll($event)"
                />
                <button type="button" class="btn btn-sm" (click)="copy(link(d, 'exclusions'))">
                  {{ copied() ? 'Copié ✓' : 'Copier' }}
                </button>
              </div>
              <div class="row">
                <a
                  class="btn btn-green"
                  [href]="whatsapp(d, 'exclusions')"
                  target="_blank"
                  rel="noopener"
                >
                  💬 Prévenir tout le monde sur WhatsApp
                </a>
              </div>
              <hr />
              <h2>Tirage au sort</h2>
              <p class="muted">
                Le tirage se fait automatiquement dès que tout le monde a validé ({{
                  confirmedCount()
                }}/{{ d.participants.length }}). Vous pouvez aussi le lancer maintenant : ceux qui
                n’ont pas validé n’auront simplement aucune exclusion.
              </p>
              <div class="row">
                <button type="button" class="btn btn-primary" [disabled]="busy()" (click)="draw()">
                  🎲 Lancer le tirage
                </button>
                <button type="button" class="btn btn-sm" [disabled]="busy()" (click)="reopen()">
                  Rouvrir la liste
                </button>
              </div>
            }
            @case ('drawn') {
              <h2>Prévenez tout le monde</h2>
              <p class="muted small">Chacun peut maintenant découvrir son tirage avec ce lien.</p>
              <div class="share">
                <label for="giftee-link" class="visually-hidden">Lien du Secret Santa</label>
                <input
                  id="giftee-link"
                  readonly
                  [value]="link(d, 'giftee')"
                  (focus)="selectAll($event)"
                />
                <button type="button" class="btn btn-sm" (click)="copy(link(d, 'giftee'))">
                  {{ copied() ? 'Copié ✓' : 'Copier' }}
                </button>
              </div>
              <a
                class="btn btn-green"
                [href]="whatsapp(d, 'giftee')"
                target="_blank"
                rel="noopener"
              >
                💬 Prévenir tout le monde sur WhatsApp
              </a>
            }
          }
          <details class="danger-zone">
            <summary>Supprimer ce Secret Santa</summary>
            <p class="muted small">
              Supprime définitivement le Secret Santa, les envies, le tirage et les messages.
            </p>
            <button
              type="button"
              class="btn btn-sm btn-danger"
              [disabled]="busy()"
              (click)="deleteEvent()"
            >
              Supprimer définitivement
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
      width: 2.2rem;
      height: 2.2rem;
      border-radius: 50%;
      background: var(--soft);
      font-weight: 800;
      color: var(--muted);
    }
    .current .bullet {
      background: var(--red);
      color: var(--white);
    }
    .done .bullet {
      background: var(--ink);
      color: var(--white);
    }
    .step-text strong {
      font-size: 1.05rem;
      color: var(--ink);
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
      box-shadow:
        inset 6px 0 0 var(--red),
        var(--shadow);
    }
    .cta-done {
      box-shadow:
        inset 6px 0 0 var(--green),
        var(--shadow);
    }
    .progress {
      height: 8px;
      border-radius: 999px;
      background: var(--soft);
      overflow: hidden;
      margin-bottom: 0.5rem;
    }
    .progress span {
      display: block;
      height: 100%;
      background: var(--red);
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
  protected readonly resetLink = signal<{ name: string; key: string } | null>(null);

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
      {
        title: 'Inscriptions & envies',
        detail: 'Chacun rejoint et partage ses envies',
        state: state(0),
      },
      { title: 'Exclusions', detail: 'Chacun choisit à qui ne pas offrir', state: state(1) },
      { title: 'Tirage', detail: 'Chacun découvre à qui il offre', state: state(2) },
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
      return `${n - this.missingWishes()}/${n} ont rempli leurs envies`;
    if (d.event.status === 'exclusions') return `${this.confirmedCount()}/${n} ont validé`;
    return 'Tout le monde a son tirage 🎁';
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
      this.error.set('La copie a échoué : sélectionnez le lien et copiez-le à la main.');
    }
  }

  go(tab: string): void {
    void this.router.navigate(['/events', this.eventId, tab]);
  }

  /** WhatsApp message announcing the next step, with the right link (free, nothing to set up). */
  whatsapp(detail: EventDetail, tab: 'exclusions' | 'giftee'): string {
    const name = detail.event.name;
    const url = this.link(detail, tab);
    const text =
      tab === 'exclusions'
        ? `🎁 ${name} : la liste est fermée ! Avant le tirage, dis-nous en secret s’il y a quelqu’un à qui tu préfères ne pas offrir de cadeau (ou personne), puis valide : ${url}`
        : `🎉 ${name} : le tirage a eu lieu ! Découvre à qui tu offres un cadeau : ${url} (chut, c’est un secret 🤫)`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }

  /** Organiser: issue a new personal link for someone who lost theirs. */
  async newLinkFor(participant: Participant): Promise<void> {
    if (
      !confirm(
        `Créer un nouveau lien pour ${participant.displayName} ? Son ancien lien ne fonctionnera plus.`,
      )
    )
      return;
    await this.run(async () => {
      const key = await this.backend.resetParticipantKey(participant.id);
      this.resetLink.set({ name: participant.displayName, key });
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
      !confirm(
        'Révoquer tous les liens d’invitation ? Ceux qui n’ont pas encore rejoint auront besoin d’un nouveau lien.',
      )
    )
      return;
    await this.run(async () => {
      await this.backend.revokeInvitations(this.eventId);
      this.invitation.set(null);
      this.activeInvitations.set(0);
    }, 'Tous les liens d’invitation ont été révoqués.');
  }

  async closeRegistrations(): Promise<void> {
    const missing = this.missingWishes();
    const warning =
      missing > 0
        ? `\n\n${missing} participant(s) n’ont pas encore rempli leurs envies (ils pourront encore le faire après).`
        : '';
    if (!confirm(`Fermer la liste ? Plus personne ne pourra rejoindre.${warning}`)) return;
    const ok = await this.run(
      () => this.backend.closeRegistrations(this.eventId),
      'La liste est fermée. Envoyez le lien des exclusions à tout le monde ci-dessous.',
    );
    if (ok) await this.store.reload();
  }

  async reopen(): Promise<void> {
    if (!confirm('Rouvrir la liste ? Tout le monde devra valider à nouveau ses exclusions.'))
      return;
    const ok = await this.run(
      () => this.backend.reopenRegistrations(this.eventId),
      'La liste est de nouveau ouverte.',
    );
    if (ok) await this.store.reload();
  }

  async removeParticipant(participant: Participant): Promise<void> {
    if (!confirm(`Retirer ${participant.displayName} de ce Secret Santa ?`)) return;
    const ok = await this.run(
      () => this.backend.removeParticipant(participant.id),
      `${participant.displayName} a été retiré·e.`,
    );
    if (ok) await this.store.reload();
  }

  async leave(me: Participant): Promise<void> {
    if (!confirm('Quitter ce Secret Santa ? Vos envies seront supprimées.')) return;
    const ok = await this.run(() => this.backend.removeParticipant(me.id));
    if (ok) await this.router.navigateByUrl('/events');
  }

  async draw(): Promise<void> {
    const waiting = (this.store.detail()?.participants.length ?? 0) - this.confirmedCount();
    const warning =
      waiting > 0 ? ` ${waiting} participant(s) n’ont pas validé leurs exclusions.` : '';
    if (!confirm(`Lancer le tirage maintenant ?${warning} C’est irréversible.`)) return;
    const ok = await this.run(
      () => this.backend.drawNames(this.eventId),
      'Le tirage a eu lieu ! 🎉',
    );
    if (ok) await this.store.reload();
  }

  async deleteEvent(): Promise<void> {
    if (!confirm('Supprimer ce Secret Santa et toutes ses données ? C’est irréversible.')) return;
    const ok = await this.run(() => this.backend.deleteEvent(this.eventId));
    if (ok) await this.router.navigateByUrl('/events');
  }
}
