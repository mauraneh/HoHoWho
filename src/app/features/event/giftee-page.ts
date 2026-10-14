import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { HohowhoBackend } from '../../core/backend/hohowho-backend';
import { errorMessage, formatMoney } from '../../core/format';
import { GifteeProfile } from '../../core/models';
import { optionLabel } from '../../recommendations/questionnaire-options';
import { GiftSuggestion } from '../../recommendations/recommendation.model';
import { RecommendationService } from '../../recommendations/recommendation.service';
import { Corners, Divider, Holly } from '../../shared/ornaments';
import { EventStore } from './event-store';

@Component({
  selector: 'app-giftee-page',
  imports: [RouterLink, Corners, Divider, Holly],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (error(); as e) {
      <div class="alert alert-error" role="alert">{{ e }}</div>
    }

    @if (loading()) {
      <p class="muted">Chargement…</p>
    } @else if (giftee(); as g) {
      <section class="card card-night reveal" [class.opened]="doorsOpen()">
        <div class="snow" aria-hidden="true"></div>
        <button
          type="button"
          class="gate"
          [attr.aria-hidden]="doorsOpen()"
          [tabIndex]="doorsOpen() ? -1 : 0"
          (click)="doorsOpen.set(true)"
        >
          <span class="gate-leaf left"><span class="panel"></span></span>
          <span class="gate-leaf right"><span class="panel"></span></span>
          <span class="seal">
            <span class="seal-mark" aria-hidden="true">✦</span>
            <span class="seal-text">Ouvrir</span>
          </span>
        </button>
        <app-corners />
        <app-holly [size]="72" />
        <span class="eyebrow">Vous êtes le Père Noël secret de</span>
        <h2 class="script name">{{ g.participant.displayName }}</h2>
        <app-divider />
        <p class="muted">Chut… c’est un secret. Posez vos questions par message anonyme.</p>
        <a routerLink="../messages" class="btn btn-gold btn-sm">✉ Envoyer un message anonyme</a>
        <button type="button" class="link-btn replay" (click)="replay()">
          ↺ Revoir l’ouverture
        </button>
      </section>

      <div class="grid pair">
        <section class="card">
          <h2>Ses réponses</h2>
          @if (g.questionnaire; as q) {
            @if (q.interests.length) {
              <h3>Centres d’intérêt</h3>
              <div class="chips">
                @for (id of q.interests; track id) {
                  <span class="badge badge-green">{{ label(id) }}</span>
                }
              </div>
            }
            @if (q.giftStyles.length) {
              <h3>Cadeaux préférés</h3>
              <div class="chips">
                @for (id of q.giftStyles; track id) {
                  <span class="badge">{{ label(id) }}</span>
                }
              </div>
            }
            @if (q.avoid.length) {
              <h3>À éviter</h3>
              <div class="chips">
                @for (id of q.avoid; track id) {
                  <span class="badge badge-red">{{ label(id) }}</span>
                }
              </div>
            }
            @if (q.sizes) {
              <h3>Tailles</h3>
              <p>{{ q.sizes }}</p>
            }
            @if (q.notes) {
              <h3>Précisions</h3>
              <p class="pre">{{ q.notes }}</p>
            }
          } @else {
            <p class="muted">{{ g.participant.displayName }} n’a pas encore rempli ses envies.</p>
          }
        </section>

        <section class="card">
          <h2>Liste de souhaits</h2>
          @if (g.wishlist.length) {
            <ul class="list">
              @for (item of g.wishlist; track item.id) {
                <li>
                  <strong>{{ item.title }}</strong>
                  @if (item.priority === 1) {
                    <span class="badge badge-red">Adorerait</span>
                  }
                  @if (item.price !== null) {
                    <span class="muted small"> · ~{{ money(item.price) }}</span>
                  }
                  @if (item.notes) {
                    <div class="muted small">{{ item.notes }}</div>
                  }
                  @if (item.url) {
                    <div class="small">
                      <a [href]="item.url" target="_blank" rel="noopener noreferrer"
                        >Voir le lien ↗</a
                      >
                    </div>
                  }
                </li>
              }
            </ul>
          } @else {
            <p class="muted">Pas encore de souhaits.</p>
          }
        </section>
      </div>

      <section class="card">
        <h2>Idées cadeaux</h2>
        <p class="muted small">
          D’après les réponses et la liste de {{ g.participant.displayName }}, et le budget du
          Secret Santa.
        </p>
        @if (suggestions().length) {
          <div class="grid">
            @for (s of suggestions(); track s.id) {
              <article class="idea">
                <h3>{{ s.title }}</h3>
                <p class="small">{{ s.description }}</p>
                <p class="small muted">≈ {{ money(s.minPrice) }} – {{ money(s.maxPrice) }}</p>
                <ul class="reasons small">
                  @for (r of s.reasons; track r) {
                    <li>{{ r }}</li>
                  }
                </ul>
              </article>
            }
          </div>
        } @else {
          <p class="muted">
            Aucune idée ne correspond au budget. Regardez sa liste ou envoyez-lui un message !
          </p>
        }
      </section>
    } @else {
      <div class="card empty">
        <p>Vous n’avez pas encore de tirage pour ce Secret Santa.</p>
      </div>
    }
  `,
  styles: `
    .reveal {
      overflow: hidden;
      text-align: center;
      padding: 2.6rem 1.5rem 2.4rem;
    }
    .reveal > :not(app-corners, .snow) {
      position: relative;
    }
    .reveal app-holly,
    .reveal .eyebrow {
      display: flex;
      justify-content: center;
    }
    .reveal {
      perspective: 1600px;
      min-height: 380px;
    }
    .name {
      font-size: clamp(3.6rem, 12vw, 5.6rem);
      line-height: 1.05;
      color: var(--gold-light);
      margin: 0.3rem 0 0;
      text-shadow: 0 3px 0 rgb(0 0 0 / 30%);
      opacity: 0;
    }
    .opened .name {
      animation: reveal 1.6s ease-out 0.7s both;
    }
    .gate {
      position: absolute !important;
      inset: 0;
      z-index: 5;
      padding: 0;
      border: none;
      background: none;
      cursor: pointer;
      transform-style: preserve-3d;
    }
    .gate-leaf {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 50%;
      background:
        linear-gradient(180deg, rgb(0 0 0 / 10%) 1px, transparent 1px),
        linear-gradient(170deg, #b8243a 0%, var(--crimson) 50%, var(--crimson-dark) 100%);
      background-size:
        100% 33.4%,
        100% 100%;
      box-shadow:
        inset 0 0 0 1px var(--gold),
        inset 0 0 0 7px rgb(0 0 0 / 12%),
        inset 0 0 0 8px rgb(201 162 90 / 55%);
      transition:
        transform 1.8s cubic-bezier(0.45, 0.05, 0.2, 1),
        opacity 0.6s ease 1.4s;
      backface-visibility: hidden;
    }
    .gate-leaf.left {
      left: 0;
      transform-origin: left center;
    }
    .gate-leaf.right {
      right: 0;
      transform-origin: right center;
    }
    .panel {
      position: absolute;
      inset: 14% 16%;
      border: 1px solid rgb(230 205 142 / 60%);
      border-radius: 3px;
      box-shadow: inset 0 0 18px rgb(0 0 0 / 25%);
    }
    .seal {
      position: absolute;
      left: 50%;
      top: 50%;
      width: 92px;
      height: 92px;
      margin: -46px 0 0 -46px;
      border-radius: 50%;
      display: grid;
      place-content: center;
      gap: 0.1rem;
      color: var(--emerald-deep);
      background: radial-gradient(circle at 35% 30%, #f6e2a8, var(--gold) 55%, #8a6a2c);
      box-shadow:
        0 0 0 4px rgb(138 106 44 / 60%),
        0 8px 18px rgb(0 0 0 / 45%),
        0 0 30px 6px rgb(230 205 142 / 45%);
      transition:
        transform 0.5s ease,
        opacity 0.4s ease;
      animation: pulse 2s ease-in-out infinite;
    }
    .seal-mark {
      font-size: 1.6rem;
      line-height: 1;
    }
    .seal-text {
      font-family: var(--font-caps);
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    @keyframes pulse {
      50% {
        transform: scale(1.06);
      }
    }
    .opened .gate {
      pointer-events: none;
    }
    .opened .gate-leaf.left {
      transform: rotateY(-115deg);
      opacity: 0;
    }
    .opened .gate-leaf.right {
      transform: rotateY(115deg);
      opacity: 0;
    }
    .opened .seal {
      transform: scale(0.2);
      opacity: 0;
      animation: none;
    }
    .replay {
      display: block;
      margin: 0.9rem auto 0;
      color: var(--gold-light) !important;
      font-size: 0.85rem;
    }
    @keyframes reveal {
      from {
        opacity: 0;
        letter-spacing: 0.2em;
        filter: blur(6px);
        transform: scale(0.9);
      }
      to {
        opacity: 1;
        letter-spacing: normal;
        filter: none;
        transform: none;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .name,
      .opened .name {
        animation: none;
        opacity: 1;
      }
      .gate-leaf,
      .seal {
        transition-duration: 0.01ms;
        animation: none;
      }
    }
    .pair {
      grid-template-columns: repeat(auto-fit, minmax(270px, 1fr));
      align-items: start;
    }
    .chips {
      margin-bottom: 0.75rem;
    }
    .pre {
      white-space: pre-line;
    }
    .idea {
      border: 1px solid var(--line);
      border-top: 3px solid var(--crimson);
      background: #fffdf7;
      border-radius: 4px;
      padding: 0.9rem;
    }
    .reasons {
      margin: 0;
      padding-left: 1.1rem;
      color: var(--emerald);
    }
  `,
})
export class GifteePage {
  private readonly backend = inject(HohowhoBackend);
  private readonly recommendations = inject(RecommendationService);
  private readonly store = inject(EventStore);

  protected readonly giftee = signal<GifteeProfile | null>(null);
  protected readonly suggestions = signal<GiftSuggestion[]>([]);
  protected readonly loading = signal(true);
  /** The double door in front of the name: opens by itself shortly after loading. */
  protected readonly doorsOpen = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    const eventId = computed(() => this.store.detail()?.event.id);
    effect(() => {
      const id = eventId();
      if (id) untracked(() => void this.load(id));
    });
  }

  private async load(eventId: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const giftee = await this.backend.getGiftee(eventId);
      this.giftee.set(giftee);
      this.doorsOpen.set(false);
      if (giftee) setTimeout(() => this.doorsOpen.set(true), 1100);
      if (giftee) {
        const event = this.store.detail()!.event;
        this.suggestions.set(
          await this.recommendations.recommend({
            questionnaire: giftee.questionnaire,
            wishlist: giftee.wishlist,
            budgetMin: event.budgetMin,
            budgetMax: event.budgetMax,
            currency: event.currency,
            limit: 6,
          }),
        );
      }
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  /** Closes the doors and opens them again, for the pleasure of it. */
  replay(): void {
    this.doorsOpen.set(false);
    setTimeout(() => this.doorsOpen.set(true), 900);
  }

  label(id: string): string {
    return optionLabel(id);
  }

  money(amount: number): string {
    return formatMoney(amount, this.store.detail()?.event.currency ?? 'EUR');
  }
}
