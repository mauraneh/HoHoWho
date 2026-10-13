import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { formatBudget } from '../../core/format';
import { EventStore } from './event-store';

@Component({
  selector: 'app-event-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, DatePipe],
  providers: [EventStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container">
      <p><a routerLink="/events">← My events</a></p>

      @if (store.error(); as e) {
        <div class="alert alert-error" role="alert">{{ e }}</div>
      }

      @if (store.detail(); as d) {
        <header class="event-header">
          <div class="spread">
            <h1>{{ d.event.name }}</h1>
            @if (d.event.status === 'drawn') {
              <span class="badge badge-green">Names drawn</span>
            } @else {
              <span class="badge">Open for participants</span>
            }
          </div>
          <p class="muted">
            {{ d.event.eventDate ? (d.event.eventDate | date: 'fullDate') : 'Date not set' }}
            · Budget: {{ budget() }} · {{ d.participants.length }} participant{{
              d.participants.length === 1 ? '' : 's'
            }}
          </p>
          @if (d.event.description) {
            <p class="description">{{ d.event.description }}</p>
          }
        </header>

        <nav class="tabs" aria-label="Event sections">
          <a routerLink="." routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }"
            >Overview</a
          >
          <a routerLink="wishes" routerLinkActive="active">My wishes</a>
          @if (d.event.status === 'drawn') {
            <a routerLink="giftee" routerLinkActive="active">My giftee</a>
            <a routerLink="messages" routerLinkActive="active">Messages</a>
          }
        </nav>

        <router-outlet />
      } @else if (!store.error()) {
        <p class="muted">Loading event…</p>
      }
    </div>
  `,
  styles: `
    .description {
      white-space: pre-line;
    }
    .tabs {
      display: flex;
      gap: 0.25rem;
      overflow-x: auto;
      border-bottom: 1px solid var(--line);
      margin-bottom: 1rem;
    }
    .tabs a {
      padding: 0.6rem 1rem;
      color: var(--muted);
      font-weight: 600;
      text-decoration: none;
      border-bottom: 3px solid transparent;
      white-space: nowrap;
    }
    .tabs a.active {
      color: var(--red);
      border-bottom-color: var(--red);
    }
  `,
})
export class EventShell {
  protected readonly store = inject(EventStore);

  /** Route parameter `:id`. */
  readonly id = input.required<string>();

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => void this.store.load(id));
    });
  }

  budget(): string {
    const event = this.store.detail()!.event;
    return formatBudget(event.budgetMin, event.budgetMax, event.currency);
  }
}
