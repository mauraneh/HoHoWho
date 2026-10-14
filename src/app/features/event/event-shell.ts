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
import { Corners, Divider } from '../../shared/ornaments';
import { EventStore } from './event-store';

@Component({
  selector: 'app-event-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, DatePipe, Corners, Divider],
  providers: [EventStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container">
      <a routerLink="/events" class="back">← Mes Secret Santa</a>

      @if (store.error(); as e) {
        <div class="alert alert-error" role="alert">{{ e }}</div>
      }

      @if (store.detail(); as d) {
        <header class="card card-night banner">
          <div class="snow" aria-hidden="true"></div>
          <app-corners />
          <div class="banner-body">
            <span class="script banner-kicker">Secret Santa</span>
            <h1>{{ d.event.name }}</h1>
            <app-divider />
            <div class="meta">
              <span>{{
                d.event.eventDate ? (d.event.eventDate | date: 'fullDate') : 'Date à définir'
              }}</span>
              <span aria-hidden="true">✦</span>
              <span>{{ budget() }}</span>
              <span aria-hidden="true">✦</span>
              <span
                >{{ d.participants.length }} participant{{
                  d.participants.length === 1 ? '' : 's'
                }}</span
              >
            </div>
            @if (d.event.description) {
              <p class="description">{{ d.event.description }}</p>
            }
          </div>
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
      margin-bottom: 0.9rem;
      font-family: var(--font-caps);
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      text-decoration: none;
    }
    .banner {
      overflow: hidden;
      padding: 2.4rem 2rem 2.2rem;
      text-align: center;
    }
    .banner-body {
      position: relative;
    }
    .banner-kicker {
      display: block;
      font-size: 2.2rem;
      line-height: 1;
      color: var(--gold-light);
    }
    .banner h1 {
      margin: 0.3rem 0 0;
      font-size: clamp(2.2rem, 6vw, 3.2rem);
    }
    .banner app-divider {
      margin: 0.6rem auto;
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 0.6rem;
      font-family: var(--font-caps);
      font-size: 0.78rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: rgb(247 240 225 / 85%);
    }
    .meta span[aria-hidden] {
      color: var(--gold);
    }
    .description {
      max-width: 40rem;
      margin: 1rem auto 0;
      white-space: pre-line;
      font-family: var(--font-serif);
      font-size: 1.15rem;
      font-style: italic;
      color: rgb(247 240 225 / 85%);
    }
    .dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      margin-left: 0.3rem;
      border-radius: 50%;
      background: var(--crimson);
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
