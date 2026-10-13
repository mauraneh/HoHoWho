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
      <p class="muted">Loading…</p>
    } @else if (giftee(); as g) {
      <section class="card reveal">
        <p class="muted">You are the Secret Santa of</p>
        <h2 class="name">🎁 {{ g.participant.displayName }}</h2>
        <p class="muted small">Keep it secret! Use the anonymous messages to ask questions.</p>
        <a routerLink="../messages" class="btn btn-sm">Send an anonymous message</a>
      </section>

      <div class="grid">
        <section class="card">
          <h2>What they told us</h2>
          @if (g.questionnaire; as q) {
            @if (q.interests.length) {
              <h3>Interests</h3>
              <div class="chips">
                @for (id of q.interests; track id) {
                  <span class="badge badge-green">{{ label(id) }}</span>
                }
              </div>
            }
            @if (q.giftStyles.length) {
              <h3>Favourite kinds of gifts</h3>
              <div class="chips">
                @for (id of q.giftStyles; track id) {
                  <span class="badge">{{ label(id) }}</span>
                }
              </div>
            }
            @if (q.avoid.length) {
              <h3>Please avoid</h3>
              <div class="chips">
                @for (id of q.avoid; track id) {
                  <span class="badge badge-red">{{ label(id) }}</span>
                }
              </div>
            }
            @if (q.sizes) {
              <h3>Sizes</h3>
              <p>{{ q.sizes }}</p>
            }
            @if (q.notes) {
              <h3>Notes</h3>
              <p class="pre">{{ q.notes }}</p>
            }
          } @else {
            <p class="muted">
              {{ g.participant.displayName }} has not answered the questionnaire yet.
            </p>
          }
        </section>

        <section class="card">
          <h2>Wishlist</h2>
          @if (g.wishlist.length) {
            <ul class="list">
              @for (item of g.wishlist; track item.id) {
                <li>
                  <strong>{{ item.title }}</strong>
                  @if (item.priority === 1) {
                    <span class="badge badge-red">Would love it</span>
                  }
                  @if (item.price !== null) {
                    <span class="muted small"> · ~{{ money(item.price) }}</span>
                  }
                  @if (item.notes) {
                    <div class="muted small">{{ item.notes }}</div>
                  }
                  @if (item.url) {
                    <div class="small">
                      <a [href]="item.url" target="_blank" rel="noopener noreferrer">View link ↗</a>
                    </div>
                  }
                </li>
              }
            </ul>
          } @else {
            <p class="muted">No wishes yet.</p>
          }
        </section>
      </div>

      <section class="card">
        <h2>Gift ideas</h2>
        <p class="muted small">
          Suggested from {{ g.participant.displayName }}’s answers, wishlist and the event budget.
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
            No matching ideas within the budget. Check the wishlist or send a message!
          </p>
        }
      </section>
    } @else {
      <div class="card empty">
        <p>You have no giftee in this event yet.</p>
      </div>
    }
  `,
  styles: `
    .reveal {
      text-align: center;
      background: linear-gradient(135deg, #fff 0%, var(--green-light) 100%);
    }
    .name {
      font-size: 2rem;
      color: var(--green);
    }
    .chips {
      margin-bottom: 0.75rem;
    }
    .pre {
      white-space: pre-line;
    }
    .idea {
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 0.9rem;
    }
    .reasons {
      margin: 0;
      padding-left: 1.1rem;
      color: var(--green);
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
