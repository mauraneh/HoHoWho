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
      <a routerLink="/events" class="back">← Mes Secret Santa</a>

      @if (store.error(); as e) {
        <div class="alert alert-error" role="alert">{{ e }}</div>
      }

      @if (store.detail(); as d) {
        <header class="banner">
          <h1>{{ d.event.name }}</h1>
          <div class="meta">
            <span>{{
              d.event.eventDate ? (d.event.eventDate | date: 'fullDate') : 'Date à définir'
            }}</span>
            <span>{{ budget() }}</span>
            <span
              >{{ d.participants.length }} participant{{
                d.participants.length === 1 ? '' : 's'
              }}</span
            >
          </div>
          @if (d.event.description) {
            <p class="description">{{ d.event.description }}</p>
          }
        </header>

        <nav class="tabs" aria-label="Sections">
          <a routerLink="." routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }"
            >Aperçu</a
          >
          <a routerLink="wishes" routerLinkActive="active">Mes envies</a>
          @if (d.event.status === 'exclusions') {
            <a routerLink="exclusions" routerLinkActive="active">
              Exclusions
              @if (!d.me.exclusionsConfirmed) {
                <span class="dot" aria-label="à faire"></span>
              }
            </a>
          }
          @if (d.event.status === 'drawn') {
            <a routerLink="giftee" routerLinkActive="active">🎁 Mon tirage</a>
            <a routerLink="messages" routerLinkActive="active">Messages</a>
          }
        </nav>

        <router-outlet />
      } @else if (!store.error()) {
        <p class="muted">Chargement…</p>
      }
    </div>
  `,
  styles: `
    .back {
      display: inline-block;
      color: var(--snow-soft);
      font-size: 0.9rem;
      font-weight: 600;
      text-decoration: none;
    }
    .back:hover {
      color: var(--white);
    }
    .banner {
      margin: 1.5rem 0 2rem;
    }
    .banner h1 {
      font-size: clamp(2.8rem, 9vw, 5.5rem);
      line-height: 0.95;
      letter-spacing: -0.05em;
      margin: 0 0 1rem;
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem 1.4rem;
      font-weight: 600;
      color: var(--snow-soft);
    }
    .meta span + span::before {
      content: '·';
      margin-right: 1.4rem;
      color: var(--red);
    }
    .description {
      max-width: 40rem;
      margin: 1rem 0 0;
      white-space: pre-line;
      color: var(--snow-soft);
    }
    .dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      margin-left: 0.3rem;
      border-radius: 50%;
      background: var(--red);
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
