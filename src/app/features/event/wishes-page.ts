import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HohowhoBackend } from '../../core/backend/hohowho-backend';
import { errorMessage, formatMoney } from '../../core/format';
import { EMPTY_QUESTIONNAIRE, Questionnaire, WishlistItem } from '../../core/models';
import { AVOID, GIFT_STYLES, INTERESTS, Option } from '../../recommendations/questionnaire-options';
import { EventStore } from './event-store';

const PRIORITY_LABELS: Record<WishlistItem['priority'], string> = {
  1: 'J’adorerais',
  2: 'J’aimerais bien',
  3: 'Pourquoi pas',
};

@Component({
  selector: 'app-wishes-page',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (error(); as e) {
      <div class="alert alert-error" role="alert">{{ e }}</div>
    }

    <section class="card">
      <h2>Mes envies</h2>
      <p class="muted small">
        Seuls vous et votre Père Noël secret voyez ces réponses. Elles servent aux idées cadeaux qui
        lui sont proposées.
      </p>

      @if (loaded()) {
        <fieldset class="field">
          <legend>Qu’est-ce qui vous plaît ?</legend>
          <div class="chips">
            @for (o of interests; track o.id) {
              <label class="chip-toggle">
                <input
                  type="checkbox"
                  [checked]="answers().interests.includes(o.id)"
                  (change)="toggle('interests', o)"
                />
                <span>{{ o.label }}</span>
              </label>
            }
          </div>
        </fieldset>

        <fieldset class="field">
          <legend>Quel genre de cadeaux vous fait plaisir ?</legend>
          <div class="chips">
            @for (o of giftStyles; track o.id) {
              <label class="chip-toggle">
                <input
                  type="checkbox"
                  [checked]="answers().giftStyles.includes(o.id)"
                  (change)="toggle('giftStyles', o)"
                />
                <span>{{ o.label }}</span>
              </label>
            }
          </div>
        </fieldset>

        <fieldset class="field">
          <legend>À éviter</legend>
          <div class="chips">
            @for (o of avoid; track o.id) {
              <label class="chip-toggle">
                <input
                  type="checkbox"
                  [checked]="answers().avoid.includes(o.id)"
                  (change)="toggle('avoid', o)"
                />
                <span>{{ o.label }}</span>
              </label>
            }
          </div>
        </fieldset>

        <div class="field">
          <label for="sizes">Tailles <span class="muted">(facultatif)</span></label>
          <input
            id="sizes"
            maxlength="200"
            [value]="answers().sizes"
            (input)="setText('sizes', $event)"
            placeholder="T-shirt M, pointure 39…"
          />
        </div>
        <div class="field">
          <label for="notes">Autre chose à savoir ? <span class="muted">(facultatif)</span></label>
          <textarea
            id="notes"
            maxlength="1000"
            [value]="answers().notes"
            (input)="setText('notes', $event)"
            placeholder="Couleurs préférées, allergies, ce que vous avez déjà…"
          ></textarea>
        </div>

        <div class="row">
          <button
            type="button"
            class="btn btn-primary"
            [disabled]="saving()"
            (click)="saveAnswers()"
          >
            {{ saving() ? 'Enregistrement…' : 'Enregistrer mes envies' }}
          </button>
          @if (saved()) {
            <span class="muted small" role="status">Enregistré ✓</span>
          }
        </div>
      } @else {
        <p class="muted">Chargement…</p>
      }
    </section>

    <section class="card">
      <h2>Ma liste de souhaits</h2>
      @if (wishlist().length) {
        <ul class="list">
          @for (item of wishlist(); track item.id) {
            <li class="spread">
              <div>
                <strong>{{ item.title }}</strong>
                <span class="badge">{{ priorityLabel(item.priority) }}</span>
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
              </div>
              <button type="button" class="btn btn-sm btn-danger" (click)="removeItem(item)">
                Retirer
              </button>
            </li>
          }
        </ul>
      } @else {
        <p class="muted">
          Votre liste est vide. Ajoutez quelques idées pour aider votre Père Noël secret.
        </p>
      }

      <form [formGroup]="itemForm" (ngSubmit)="addItem()" class="add-item" novalidate>
        <h3>Ajouter un souhait</h3>
        <div class="field">
          <label for="title">Qu’aimeriez-vous ?</label>
          <input id="title" formControlName="title" maxlength="120" />
        </div>
        <div class="field-row">
          <div class="field">
            <label for="price">Prix approximatif</label>
            <input id="price" type="number" min="0" formControlName="price" />
          </div>
          <div class="field">
            <label for="priority">À quel point ?</label>
            <select id="priority" formControlName="priority">
              <option [ngValue]="1">J’adorerais</option>
              <option [ngValue]="2">J’aimerais bien</option>
              <option [ngValue]="3">Pourquoi pas</option>
            </select>
          </div>
        </div>
        <div class="field">
          <label for="url">Lien <span class="muted">(facultatif)</span></label>
          <input id="url" type="url" formControlName="url" placeholder="https://…" />
          @if (itemForm.controls.url.touched && itemForm.controls.url.invalid) {
            <span class="error">Le lien doit commencer par http:// ou https://</span>
          }
        </div>
        <div class="field">
          <label for="itemNotes">Précisions <span class="muted">(facultatif)</span></label>
          <input
            id="itemNotes"
            formControlName="notes"
            maxlength="500"
            placeholder="Couleur, taille, modèle…"
          />
        </div>
        <button type="submit" class="btn btn-green" [disabled]="adding()">
          Ajouter à ma liste
        </button>
      </form>
    </section>
  `,
  styles: `
    .add-item {
      margin-top: 1.25rem;
      padding-top: 1rem;
      border-top: 1px dashed var(--line);
    }
  `,
})
export class WishesPage {
  private readonly backend = inject(HohowhoBackend);
  private readonly store = inject(EventStore);

  protected readonly interests = INTERESTS;
  protected readonly giftStyles = GIFT_STYLES;
  protected readonly avoid = AVOID;

  protected readonly answers = signal<Questionnaire>(EMPTY_QUESTIONNAIRE);
  protected readonly wishlist = signal<WishlistItem[]>([]);
  protected readonly loaded = signal(false);
  protected readonly saving = signal(false);
  protected readonly saved = signal(false);
  protected readonly adding = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly itemForm = inject(NonNullableFormBuilder).group({
    title: ['', [Validators.required, Validators.maxLength(120), Validators.pattern(/\S/)]],
    url: ['', [Validators.pattern(/^https?:\/\/\S+$/i), Validators.maxLength(2000)]],
    notes: ['', [Validators.maxLength(500)]],
    price: inject(NonNullableFormBuilder).control<number | null>(null, [Validators.min(0)]),
    priority: inject(NonNullableFormBuilder).control<1 | 2 | 3>(2),
  });

  constructor() {
    // computed() de-duplicates, so reloading the event does not discard unsaved answers.
    const participantId = computed(() => this.store.detail()?.me.id);
    effect(() => {
      const id = participantId();
      if (id) untracked(() => void this.load(id));
    });
  }

  private get participantId(): string {
    return this.store.detail()!.me.id;
  }

  private async load(participantId: string): Promise<void> {
    try {
      const [questionnaire, wishlist] = await Promise.all([
        this.backend.getMyQuestionnaire(participantId),
        this.backend.listMyWishlist(participantId),
      ]);
      this.answers.set(questionnaire ?? EMPTY_QUESTIONNAIRE);
      this.wishlist.set(wishlist);
      this.loaded.set(true);
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  toggle(field: 'interests' | 'giftStyles' | 'avoid', option: Option): void {
    this.saved.set(false);
    this.answers.update((a) => {
      const values = a[field].includes(option.id)
        ? a[field].filter((v) => v !== option.id)
        : [...a[field], option.id];
      return { ...a, [field]: values };
    });
  }

  setText(field: 'sizes' | 'notes', event: Event): void {
    this.saved.set(false);
    const value = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
    this.answers.update((a) => ({ ...a, [field]: value }));
  }

  async saveAnswers(): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    try {
      const a = this.answers();
      await this.backend.saveMyQuestionnaire(this.participantId, {
        ...a,
        sizes: a.sizes.trim(),
        notes: a.notes.trim(),
      });
      this.saved.set(true);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.saving.set(false);
    }
  }

  async addItem(): Promise<void> {
    if (this.itemForm.invalid) {
      this.itemForm.markAllAsTouched();
      return;
    }
    const v = this.itemForm.getRawValue();
    this.adding.set(true);
    this.error.set(null);
    try {
      await this.backend.addWishlistItem(this.participantId, {
        title: v.title.trim(),
        url: v.url.trim() || null,
        notes: v.notes.trim(),
        price: v.price ?? null,
        priority: v.priority,
      });
      this.itemForm.reset();
      this.wishlist.set(await this.backend.listMyWishlist(this.participantId));
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.adding.set(false);
    }
  }

  async removeItem(item: WishlistItem): Promise<void> {
    this.error.set(null);
    try {
      await this.backend.removeWishlistItem(item.id);
      this.wishlist.update((list) => list.filter((w) => w.id !== item.id));
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  priorityLabel(priority: WishlistItem['priority']): string {
    return PRIORITY_LABELS[priority];
  }

  money(amount: number): string {
    return formatMoney(amount, this.store.detail()?.event.currency ?? 'EUR');
  }
}
