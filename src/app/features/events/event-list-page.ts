import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HohowhoBackend } from '../../core/backend/hohowho-backend';
import { errorMessage, formatBudget } from '../../core/format';
import { EventStatus, EventSummary } from '../../core/models';

const PHASES: Record<EventStatus, { label: string; css: string }> = {
  open: { label: 'Joining & wishes', css: 'badge-gold' },
  exclusions: { label: 'Exclusions', css: 'badge-red' },
  drawn: { label: 'Names drawn', css: 'badge-green' },
};

@Component({
  selector: 'app-event-list-page',
  imports: [RouterLink, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container">
      <div class="spread page-head">
        <div>
          <span class="eyebrow eyebrow-dark">Your Secret Santas</span>
          <h1>My events</h1>
        </div>
        <a routerLink="/events/new" class="btn btn-primary">＋ New Secret Santa</a>
      </div>

      @if (error(); as e) {
        <div class="alert alert-error" role="alert">{{ e }}</div>
      }

      @if (events(); as list) {
        @if (list.length === 0) {
          <div class="card empty">
            <span class="empty-icon" aria-hidden="true">🎄</span>
            <h2>No Secret Santa yet</h2>
            <p>Create one and share the link, or open an invitation link from a friend.</p>
            <a routerLink="/events/new" class="btn btn-primary">Create a Secret Santa</a>
          </div>
        } @else {
          <div class="grid">
            @for (event of list; track event.id) {
              <a class="card event-card" [routerLink]="['/events', event.id]">
                <div class="ribbon" aria-hidden="true"></div>
                <div class="event-top">
                  @if (event.eventDate) {
                    <div class="date-tile">
                      <span class="day">{{ event.eventDate | date: 'd' }}</span>
                      <span class="month">{{ event.eventDate | date: 'MMM' }}</span>
                    </div>
                  } @else {
                    <div class="date-tile" aria-hidden="true"><span class="day">🎁</span></div>
                  }
                  <div>
                    <h2>{{ event.name }}</h2>
                    <p class="muted small">{{ budget(event) }}</p>
                  </div>
                </div>
                <div class="row">
                  <span class="badge" [class]="phase(event).css">{{ phase(event).label }}</span>
                  @if (event.isOwner) {
                    <span class="badge">★ Organiser</span>
                  }
                </div>
              </a>
            }
          </div>
        }
      } @else {
        <p class="muted">Loading your events…</p>
      }
    </div>
  `,
  styles: `
    .page-head {
      margin-bottom: 1.25rem;
    }
    .page-head h1 {
      margin: 0;
    }
    .eyebrow-dark {
      color: var(--berry);
    }
    .event-card {
      position: relative;
      display: block;
      overflow: hidden;
      padding-top: 1.6rem;
      color: inherit;
      text-decoration: none;
      transition:
        transform 0.15s ease,
        box-shadow 0.15s ease;
    }
    .event-card:hover {
      transform: translateY(-3px);
      box-shadow: var(--shadow-lift);
    }
    .ribbon {
      position: absolute;
      inset: 0 0 auto;
      height: 8px;
      background: repeating-linear-gradient(
        -45deg,
        var(--berry) 0 12px,
        #fff 12px 18px,
        var(--pine-3) 18px 30px,
        #fff 30px 36px
      );
    }
    .event-top {
      display: flex;
      gap: 0.9rem;
      align-items: center;
      margin-bottom: 0.75rem;
    }
    .event-top h2 {
      margin: 0 0 0.15rem;
      font-size: 1.25rem;
    }
    .event-top p {
      margin: 0;
    }
    .date-tile {
      flex: none;
      display: grid;
      place-items: center;
      width: 3.4rem;
      height: 3.6rem;
      border-radius: 14px;
      background: var(--pine);
      color: var(--snow);
      line-height: 1;
    }
    .day {
      font-family: var(--font-display);
      font-size: 1.5rem;
      font-weight: 800;
    }
    .month {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--gold);
    }
  `,
})
export class EventListPage implements OnInit {
  private readonly backend = inject(HohowhoBackend);
  protected readonly events = signal<EventSummary[] | null>(null);
  protected readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      this.events.set(await this.backend.listEvents());
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
