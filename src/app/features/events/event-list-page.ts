import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { HohowhoBackend } from '../../core/backend/hohowho-backend';
import { errorMessage, formatBudget } from '../../core/format';
import { EventStatus, EventSummary } from '../../core/models';
import { AdventDoor } from '../../shared/advent-door';
import { Divider } from '../../shared/ornaments';

const PHASES: Record<EventStatus, { label: string; icon: string }> = {
  open: { label: 'Inscriptions & envies', icon: '✉️' },
  exclusions: { label: 'Exclusions', icon: '🤫' },
  drawn: { label: 'Tirage effectué', icon: '🎁' },
};

@Component({
  selector: 'app-event-list-page',
  imports: [RouterLink, DatePipe, Divider, AdventDoor],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container">
      <header class="page-head center">
        <span class="eyebrow">Vos Secret Santa</span>
        <h1 class="script page-title">Mes Secret Santa</h1>
        <app-divider />
      </header>

      @if (error(); as e) {
        <div class="alert alert-error" role="alert">{{ e }}</div>
      }

      @if (events(); as list) {
        <div class="calendar">
          @for (event of list; track event.id; let i = $index) {
            <a
              class="slot"
              [routerLink]="['/events', event.id]"
              (click)="openDoor($event, event.id)"
              [attr.aria-label]="'Ouvrir ' + event.name"
            >
              <app-advent-door
                [open]="opening() === event.id"
                [peek]="true"
                [tone]="i % 3 === 1 ? 'emerald' : 'crimson'"
              >
                <div front class="door-front">
                  <span class="date">
                    @if (event.eventDate) {
                      <span class="day">{{ event.eventDate | date: 'd' }}</span>
                      <span class="month">{{ event.eventDate | date: 'MMM' }}</span>
                    } @else {
                      <span class="day">✦</span>
                    }
                  </span>
                  <span class="door-body">
                    <span class="name">{{ event.name }}</span>
                    <span class="budget">{{ budget(event) }}</span>
                    <span class="row">
                      <span class="badge">{{ phase(event).label }}</span>
                      @if (event.isOwner) {
                        <span class="badge">★ Organisateur</span>
                      }
                    </span>
                  </span>
                </div>
                <div inside class="door-inside">
                  <span class="gift" aria-hidden="true">{{ phase(event).icon }}</span>
                  <span class="caps">Entrer</span>
                </div>
              </app-advent-door>
            </a>
          }
          @if (canOrganize()) {
            <a routerLink="/events/new" class="slot new-door">
              <span class="plus" aria-hidden="true">＋</span>
              <span class="caps">Nouveau Secret Santa</span>
            </a>
          }
        </div>
        @if (list.length === 0) {
          <p class="muted center empty-hint">
            @if (canOrganize()) {
              Aucun Secret Santa pour l’instant : créez-en un et partagez le lien d’invitation.
            } @else {
              Vous ne participez encore à aucun Secret Santa. Ouvrez le lien d’invitation que
              l’organisateur vous a envoyé.
            }
          </p>
        }
      } @else {
        <p class="muted center">Chargement…</p>
      }
    </div>
  `,
  styles: `
    .page-head {
      margin-bottom: 1.5rem;
    }
    .page-title {
      font-size: 3.6rem;
      margin: 0;
      color: var(--gold-light);
    }
    .calendar {
      display: grid;
      gap: 1.25rem;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    }
    .slot {
      display: block;
      height: 230px;
      color: var(--ivory);
      text-decoration: none;
      border-radius: 4px;
    }
    app-advent-door {
      height: 100%;
    }
    .door-front {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .date {
      display: flex;
      flex-direction: column;
      line-height: 1;
      font-family: var(--font-caps);
      color: var(--gold-light);
    }
    .day {
      font-size: 2.3rem;
      font-weight: 700;
    }
    .month {
      font-size: 0.75rem;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      margin-top: 0.2rem;
    }
    .door-body {
      margin-top: auto;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    .name {
      font-family: var(--font-serif);
      font-size: 1.65rem;
      font-weight: 700;
      line-height: 1.1;
      padding-right: 1.5rem;
    }
    .budget {
      font-size: 0.85rem;
      color: rgb(247 240 225 / 75%);
    }
    .door-front .badge {
      background: rgb(247 240 225 / 14%);
      color: var(--ivory);
      box-shadow: inset 0 0 0 1px rgb(201 162 90 / 55%);
    }
    .door-inside {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      height: 100%;
      padding-left: 25%;
      color: var(--gold-light);
    }
    .gift {
      font-size: 3rem;
      filter: drop-shadow(0 6px 10px rgb(0 0 0 / 50%));
    }
    .new-door {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      color: var(--gold-light);
      border: 1.5px dashed var(--gold);
      background: rgb(15 43 31 / 45%);
      transition: background 0.2s ease;
    }
    .new-door:hover {
      background: rgb(201 162 90 / 12%);
    }
    .plus {
      font-size: 2.6rem;
      line-height: 1;
    }
    .new-door .caps {
      font-size: 0.8rem;
      font-weight: 700;
    }
    .empty-hint {
      margin-top: 1.25rem;
    }
  `,
})
export class EventListPage implements OnInit {
  private readonly backend = inject(HohowhoBackend);
  protected readonly events = signal<EventSummary[] | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly canOrganize = signal(false);
  /** Door currently swinging open before navigating to the event. */
  protected readonly opening = signal<string | null>(null);
  private readonly router = inject(Router);

  async ngOnInit(): Promise<void> {
    try {
      const [events, canOrganize] = await Promise.all([
        this.backend.listEvents(),
        this.backend.canOrganize(),
      ]);
      this.canOrganize.set(canOrganize);
      this.events.set(events);
    } catch (e) {
      this.error.set(errorMessage(e));
      this.events.set([]);
    }
  }

  /** Plays the door-opening animation, then enters the event. */
  openDoor(event: MouseEvent, eventId: string): void {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    if (this.opening()) return;
    this.opening.set(eventId);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(() => void this.router.navigate(['/events', eventId]), reduced ? 0 : 750);
  }

  budget(event: EventSummary): string {
    return formatBudget(event.budgetMin, event.budgetMax, event.currency);
  }

  phase(event: EventSummary) {
    return PHASES[event.status];
  }
}
