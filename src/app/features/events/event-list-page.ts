import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HohowhoBackend } from '../../core/backend/hohowho-backend';
import { errorMessage, formatBudget } from '../../core/format';
import { EventStatus, EventSummary } from '../../core/models';
import { Divider } from '../../shared/ornaments';

const PHASES: Record<EventStatus, { label: string; css: string }> = {
  open: { label: 'Inscriptions & envies', css: 'badge-gold' },
  exclusions: { label: 'Exclusions', css: 'badge-red' },
  drawn: { label: 'Tirage effectué', css: 'badge-green' },
};

@Component({
  selector: 'app-event-list-page',
  imports: [RouterLink, DatePipe, Divider],
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
          @for (event of list; track event.id) {
            <a class="door card-crimson" [routerLink]="['/events', event.id]">
              <span class="date">
                @if (event.eventDate) {
                  <span class="day">{{ event.eventDate | date: 'd' }}</span>
                  <span class="month">{{ event.eventDate | date: 'MMM' }}</span>
                } @else {
                  <span class="day">✦</span>
                }
              </span>
              <span class="knob" aria-hidden="true"></span>
              <span class="door-body">
                <span class="name">{{ event.name }}</span>
                <span class="budget">{{ budget(event) }}</span>
                <span class="row">
                  <span class="badge" [class]="phase(event).css">{{ phase(event).label }}</span>
                  @if (event.isOwner) {
                    <span class="badge badge-gold">★ Organisateur</span>
                  }
                </span>
              </span>
            </a>
          }
          @if (canOrganize()) {
            <a routerLink="/events/new" class="door new-door">
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
      color: var(--emerald);
    }
    .calendar {
      display: grid;
      gap: 1rem;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    }
    .door {
      position: relative;
      display: flex;
      flex-direction: column;
      min-height: 220px;
      padding: 1rem 1.2rem 1.2rem;
      border-radius: 4px;
      color: var(--ivory);
      text-decoration: none;
      transition:
        transform 0.18s ease,
        box-shadow 0.18s ease;
      transform-origin: left center;
    }
    .door:hover {
      transform: perspective(900px) rotateY(-6deg);
      box-shadow: var(--shadow-lift);
    }
    .date {
      display: flex;
      flex-direction: column;
      line-height: 1;
      font-family: var(--font-caps);
      color: var(--gold-light);
    }
    .day {
      font-size: 2.1rem;
      font-weight: 700;
    }
    .month {
      font-size: 0.75rem;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      margin-top: 0.2rem;
    }
    .knob {
      position: absolute;
      right: 1rem;
      top: 50%;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: radial-gradient(circle at 35% 35%, #f6e2a8, var(--gold) 60%, #8a6a2c);
      box-shadow: 0 1px 2px rgb(0 0 0 / 40%);
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
    .door .badge {
      background: rgb(247 240 225 / 14%);
      color: var(--ivory);
      box-shadow: inset 0 0 0 1px rgb(201 162 90 / 55%);
    }
    .budget {
      font-size: 0.85rem;
      color: rgb(247 240 225 / 75%);
    }
    .new-door {
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      color: var(--emerald);
      border: 1.5px dashed var(--gold);
      background: rgb(255 250 240 / 60%);
    }
    .plus {
      font-size: 2.4rem;
      color: var(--crimson);
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

  budget(event: EventSummary): string {
    return formatBudget(event.budgetMin, event.budgetMax, event.currency);
  }

  phase(event: EventSummary) {
    return PHASES[event.status];
  }
}
