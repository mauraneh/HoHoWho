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
      <a routerLink="/events" class="back">← My events</a>

      @if (store.error(); as e) {
        <div class="alert alert-error" role="alert">{{ e }}</div>
      }

      @if (store.detail(); as d) {
        <header class="card card-night banner">
          <div class="snow" aria-hidden="true"></div>
          <div class="banner-body">
            <span class="eyebrow">Secret Santa</span>
            <h1>{{ d.event.name }}</h1>
            <div class="meta">
              <span
                >📅
                {{
                  d.event.eventDate ? (d.event.eventDate | date: 'fullDate') : 'Date to be decided'
                }}</span
              >
              <span>💰 {{ budget() }}</span>
              <span
                >👥 {{ d.participants.length }} participant{{
                  d.participants.length === 1 ? '' : 's'
                }}</span
              >
            </div>
            @if (d.event.description) {
              <p class="description">{{ d.event.description }}</p>
            }
          </div>
        </header>

        <nav class="tabs" aria-label="Event sections">
          <a routerLink="." routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }"
            >Overview</a
          >
          <a routerLink="wishes" routerLinkActive="active">My wishes</a>
          @if (d.event.status === 'exclusions') {
            <a routerLink="exclusions" routerLinkActive="active">
              Exclusions
              @if (!d.me.exclusionsConfirmed) {
                <span class="dot" aria-label="to do"></span>
              }
            </a>
          }
          @if (d.event.status === 'drawn') {
            <a routerLink="giftee" routerLinkActive="active">🎁 My giftee</a>
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
    .back {
      display: inline-block;
      margin-bottom: 0.9rem;
      font-weight: 700;
      text-decoration: none;
    }
    .banner {
      padding: 1.8rem 1.6rem;
    }
    .banner-body {
      position: relative;
    }
    .banner h1 {
      margin: 0.25rem 0 0.75rem;
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .meta span {
      padding: 0.25rem 0.75rem;
      border-radius: 999px;
      background: rgb(251 247 240 / 12%);
      font-size: 0.875rem;
    }
    .description {
      margin: 1rem 0 0;
      white-space: pre-line;
      color: rgb(251 247 240 / 85%);
    }
    .dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      margin-left: 0.3rem;
      border-radius: 50%;
      background: var(--berry);
      vertical-align: middle;
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
