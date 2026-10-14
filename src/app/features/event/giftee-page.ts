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
      <section class="card card-night reveal">
        <div class="snow" aria-hidden="true"></div>
        <app-corners />
        <app-holly [size]="72" />
        <span class="eyebrow">Vous êtes le Père Noël secret de</span>
        <h2 class="script name">{{ g.participant.displayName }}</h2>
        <app-divider />
        <p class="muted">Chut… c’est un secret. Posez vos questions par message anonyme.</p>
        <a routerLink="../messages" class="btn btn-gold btn-sm">✉ Envoyer un message anonyme</a>
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
    .name {
      font-size: clamp(3.6rem, 12vw, 5.6rem);
      line-height: 1.05;
      color: var(--gold-light);
      margin: 0.3rem 0 0;
      text-shadow: 0 3px 0 rgb(0 0 0 / 30%);
      animation: reveal 1.2s ease-out both;
    }
    @keyframes reveal {
      from {
        opacity: 0;
        letter-spacing: 0.2em;
        filter: blur(6px);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .name {
        animation: none;
      }
    }
    .pair {
      grid-template-columns: repeat(auto-fit, minmax(270px, 1fr));
      align-items: start;
    }
    .name {
      font-size: clamp(2.4rem, 8vw, 3.6rem);
      color: var(--gold);
      margin: 0.35rem 0 0.75rem;
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

  label(id: string): string {
    return optionLabel(id);
  }

  money(amount: number): string {
    return formatMoney(amount, this.store.detail()?.event.currency ?? 'EUR');
  }
}
