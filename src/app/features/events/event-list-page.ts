import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HohowhoBackend } from '../../core/backend/hohowho-backend';
import { errorMessage, formatBudget } from '../../core/format';
import { EventSummary } from '../../core/models';

@Component({
  selector: 'app-event-list-page',
  imports: [RouterLink, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container">
      <div class="spread">
        <h1>My events</h1>
        <a routerLink="/events/new" class="btn btn-primary">+ New event</a>
      </div>

      @if (error(); as e) {
        <div class="alert alert-error" role="alert">{{ e }}</div>
      }

      @if (events(); as list) {
        @if (list.length === 0) {
          <div class="card empty">
            <h2>No events yet</h2>
            <p>Create your first Secret Santa, or open an invitation link from a friend.</p>
            <a routerLink="/events/new" class="btn btn-primary">Create an event</a>
          </div>
        } @else {
          <div class="grid">
            @for (event of list; track event.id) {
              <a class="card event-card" [routerLink]="['/events', event.id]">
                <div class="spread">
                  <h2>{{ event.name }}</h2>
                  @if (event.status === 'drawn') {
                    <span class="badge badge-green">Names drawn</span>
                  } @else {
                    <span class="badge">Open</span>
                  }
                </div>
                <p class="muted small">
                  {{ event.eventDate ? (event.eventDate | date: 'mediumDate') : 'Date not set' }}
                  · {{ budget(event) }}
                </p>
                @if (event.isOwner) {
                  <span class="badge badge-red">Organiser</span>
                }
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
    .event-card {
      display: block;
      color: inherit;
      text-decoration: none;
      transition: transform 0.1s ease;
    }
    .event-card:hover {
      transform: translateY(-2px);
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
}
