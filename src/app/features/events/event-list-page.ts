import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HohowhoBackend } from '../../core/backend/hohowho-backend';
import { errorMessage, formatBudget } from '../../core/format';
import { EventStatus, EventSummary } from '../../core/models';

const PHASES: Record<EventStatus, string> = {
  open: 'Inscriptions & envies',
  exclusions: 'Exclusions',
  drawn: 'Tirage effectué',
};

@Component({
  selector: 'app-event-list-page',
  imports: [RouterLink, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container">
      <div class="spread page-head">
        <h1>Mes Secret Santa</h1>
        @if (canOrganize()) {
          <a routerLink="/events/new" class="btn btn-primary">＋ Nouveau</a>
        }
      </div>

      @if (error(); as e) {
        <div class="alert alert-error" role="alert">{{ e }}</div>
      }

      @if (events(); as list) {
        <div class="grid">
          @for (event of list; track event.id) {
            <a class="card event" [routerLink]="['/events', event.id]">
              <span class="date">
                @if (event.eventDate) {
                  {{ event.eventDate | date: 'd MMMM' }}
                } @else {
                  Date à définir
                }
              </span>
              <span class="name">{{ event.name }}</span>
              <span class="budget">{{ budget(event) }}</span>
              <span class="row">
                <span class="badge" [class.badge-green]="event.status === 'drawn'">{{
                  phase(event)
                }}</span>
                @if (event.isOwner) {
                  <span class="badge badge-red">Organisatrice</span>
                }
              </span>
            </a>
          }
        </div>
        @if (list.length === 0) {
          <p class="muted empty-hint">
            @if (canOrganize()) {
              Aucun Secret Santa pour l’instant : créez-en un et partagez le lien d’invitation.
            } @else {
              Vous ne participez encore à aucun Secret Santa. Ouvrez le lien d’invitation que
              l’organisateur vous a envoyé.
            }
          </p>
        }
      } @else {
        <p class="muted">Chargement…</p>
      }
    </div>
  `,
  styles: `
    .page-head {
      margin: 1.5rem 0 2rem;
    }
    .page-head h1 {
      margin: 0;
    }
    .event {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      min-height: 190px;
      margin: 0;
      color: var(--ink) !important;
      text-decoration: none;
      transition: transform 0.15s ease;
    }
    .event:hover {
      transform: translateY(-3px);
    }
    .date {
      font-size: 0.8rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--red);
    }
    .name {
      font-size: 1.7rem;
      font-weight: 800;
      line-height: 1.05;
      letter-spacing: -0.03em;
    }
    .budget {
      color: var(--muted);
      font-size: 0.9rem;
      margin-bottom: auto;
    }
    .event .row {
      margin-top: 0.75rem;
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

  phase(event: EventSummary): string {
    return PHASES[event.status];
  }
}
