import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import { HohowhoBackend } from '../../core/backend/hohowho-backend';
import { errorMessage, initials } from '../../core/format';
import { EventStore } from './event-store';

/** Each participant privately picks who they'd rather not give a gift to, then validates. */
@Component({
  selector: 'app-exclusions-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.detail(); as d) {
      @if (d.event.status !== 'exclusions') {
        <div class="card empty">
          <span class="empty-icon" aria-hidden="true">{{
            d.event.status === 'drawn' ? '🎉' : '⏳'
          }}</span>
          <p>
            {{
              d.event.status === 'drawn'
                ? 'Names have already been drawn.'
                : 'This step opens when the organiser closes the list.'
            }}
          </p>
        </div>
      } @else {
        <section class="card">
          <span class="eyebrow eyebrow-dark">Step 2 · Private</span>
          <h2>Anyone you'd rather not give a gift to?</h2>
          <p class="muted">
            Tick the people you don't want to draw — or nobody.
            <strong>Nobody will ever see your choices</strong>, not even the organiser. You can
            change them until the draw.
          </p>

          @if (error(); as e) {
            <div class="alert alert-error" role="alert">{{ e }}</div>
          }

          @if (loaded()) {
            <div class="people" role="group" aria-label="People to exclude">
              @for (p of others(); track p.id) {
                <label
                  class="person"
                  [class.on]="selected().has(p.id)"
                  [class.disabled]="!selected().has(p.id) && limitReached()"
                >
                  <input
                    type="checkbox"
                    [checked]="selected().has(p.id)"
                    [disabled]="busy() || (!selected().has(p.id) && limitReached())"
                    (change)="toggle(p.id)"
                  />
                  <span class="avatar" aria-hidden="true">{{ initials(p.displayName) }}</span>
                  <span class="name">{{ p.displayName }}</span>
                  <span class="mark" aria-hidden="true">{{
                    selected().has(p.id) ? '🚫' : ''
                  }}</span>
                </label>
              }
            </div>
            @if (limitReached()) {
              <p class="muted small">
                You must leave at least one person you could give a gift to.
              </p>
            }

            <div class="row actions">
              <button
                type="button"
                class="btn btn-primary btn-lg"
                [disabled]="busy()"
                (click)="validate()"
              >
                {{
                  busy()
                    ? 'Saving…'
                    : selected().size === 0
                      ? "✓ I'm happy with anyone"
                      : '✓ Validate my choices'
                }}
              </button>
              @if (d.me.exclusionsConfirmed) {
                <span class="badge badge-green">Validated</span>
              }
            </div>
          } @else {
            <p class="muted">Loading…</p>
          }
        </section>
      }
    }
  `,
  styles: `
    .eyebrow-dark {
      color: var(--berry);
    }
    .people {
      display: grid;
      gap: 0.6rem;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      margin: 1.25rem 0 0.75rem;
    }
    .person {
      position: relative;
      display: flex;
      align-items: center;
      padding: 0.7rem 0.9rem;
      border: 2px solid var(--line);
      border-radius: 16px;
      background: #fffdf9;
      cursor: pointer;
      transition: all 0.12s ease;
    }
    .person:hover {
      border-color: var(--pine-3);
    }
    .person input {
      position: absolute;
      opacity: 0;
    }
    .person:focus-within {
      outline: 3px solid var(--gold);
      outline-offset: 2px;
    }
    .person.on {
      border-color: var(--berry);
      background: var(--danger-bg);
    }
    .person.on .name {
      text-decoration: line-through;
    }
    .person.disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    .name {
      font-weight: 700;
      flex: 1;
    }
    .actions {
      margin-top: 1rem;
    }
  `,
})
export class ExclusionsPage {
  private readonly backend = inject(HohowhoBackend);
  private readonly router = inject(Router);
  protected readonly store = inject(EventStore);
  protected readonly initials = initials;

  protected readonly selected = signal<Set<string>>(new Set());
  protected readonly loaded = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly others = computed(() => {
    const d = this.store.detail();
    return d ? d.participants.filter((p) => p.id !== d.me.id) : [];
  });
  /** At least one possible giftee must remain. */
  protected readonly limitReached = computed(
    () => this.selected().size >= this.others().length - 1,
  );

  constructor() {
    const eventId = computed(() => {
      const d = this.store.detail();
      return d?.event.status === 'exclusions' ? d.event.id : null;
    });
    effect(() => {
      const id = eventId();
      if (id) untracked(() => void this.load(id));
    });
  }

  private async load(eventId: string): Promise<void> {
    try {
      this.selected.set(new Set(await this.backend.getMyExclusions(eventId)));
      this.loaded.set(true);
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  toggle(id: string): void {
    this.selected.update((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  async validate(): Promise<void> {
    const eventId = this.store.detail()!.event.id;
    this.busy.set(true);
    this.error.set(null);
    try {
      const { everyoneConfirmed } = await this.backend.submitExclusions(eventId, [
        ...this.selected(),
      ]);
      if (everyoneConfirmed) {
        // Last one to validate: draw names for everybody.
        try {
          await this.backend.drawNames(eventId);
        } catch (e) {
          await this.store.reload();
          // Someone else validated at the same moment and already triggered the draw.
          if (this.store.detail()?.event.status === 'drawn') {
            await this.router.navigate(['/events', eventId, 'giftee']);
            return;
          }
          this.error.set(`Everyone has validated, but the draw failed: ${errorMessage(e)}`);
          return;
        }
      }
      await this.store.reload();
      await this.router.navigate(
        everyoneConfirmed ? ['/events', eventId, 'giftee'] : ['/events', eventId],
      );
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
