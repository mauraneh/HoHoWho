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
import { EventStore } from './event-store';

@Component({
  selector: 'app-giftee-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (error(); as e) {
      <div class="alert alert-error" role="alert">{{ e }}</div>
    }

    @if (loading()) {
      <p class="muted">Chargement…</p>
    } @else if (giftee(); as g) {
      <section class="reveal" [class.opened]="revealed()">
        <span class="eyebrow">Tu offres un cadeau à</span>
        <h2 class="name">{{ g.participant.displayName }}</h2>
        <p class="muted">Chut… c’est top secret. Une question ? Envoie-lui un message anonyme.</p>
        <div class="row">
          <a routerLink="../messages" class="btn btn-primary">Envoyer un message anonyme</a>
          <button type="button" class="link-btn" (click)="replay()">↺ Revoir</button>
        </div>
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
            <p class="muted">
              {{ g.participant.displayName }} n’a pas encore rempli ses envies. Un petit message
              pour le relancer ?
            </p>
          }
        </section>

        <section class="card">
          <h2>Sa lettre au Père Noël</h2>
          @if (g.wishlist.length) {
            <ul class="list">
              @for (item of g.wishlist; track item.id) {
                <li>
                  <strong>{{ item.title }}</strong>
                  @if (item.priority === 1) {
                    <span class="badge badge-red">En rêve</span>
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
            <p class="muted">Sa lettre est encore vide.</p>
          }
        </section>
      </div>

      <section class="card">
        <h2>Idées pour viser juste</h2>
        <p class="muted small">
          Selon les réponses et la lettre de {{ g.participant.displayName }}, dans le budget du
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
            Aucune idée ne rentre dans le budget. Jette un œil à sa lettre ou envoie-lui un message
            !
          </p>
        }
      </section>
    } @else {
      <div class="card empty">
        <p>Pas encore de tirage pour ce Secret Santa. Patience !</p>
      </div>
    }
  `,
  styles: `
    .reveal {
      margin: 0.5rem 0 2.5rem;
    }
    .name {
      font-size: clamp(3.8rem, 15vw, 9rem);
      line-height: 0.92;
      letter-spacing: -0.055em;
      margin: 0.4rem 0 1rem;
      opacity: 0;
    }
    .opened .name {
      animation: reveal 1.1s cubic-bezier(0.2, 0.7, 0.2, 1) both;
    }
    .reveal .row {
      margin-top: 1.25rem;
    }
    @keyframes reveal {
      from {
        opacity: 0;
        filter: blur(14px);
        transform: translateY(24px);
      }
      to {
        opacity: 1;
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
      background: var(--soft);
      border-radius: 14px;
      padding: 1rem;
    }
    .reasons {
      margin: 0;
      padding-left: 1.1rem;
      color: var(--muted);
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
  /** Drives the name's fade-in; toggled off and on again to replay it. */
  protected readonly revealed = signal(false);
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
      this.revealed.set(false);
      if (giftee) setTimeout(() => this.revealed.set(true), 150);
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

  /** Plays the reveal again. */
  replay(): void {
    this.revealed.set(false);
    setTimeout(() => this.revealed.set(true), 50);
  }

  label(id: string): string {
    return optionLabel(id);
  }

  money(amount: number): string {
    return formatMoney(amount, this.store.detail()?.event.currency ?? 'EUR');
  }
}
