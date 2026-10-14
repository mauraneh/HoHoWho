import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HohowhoBackend } from '../../core/backend/hohowho-backend';
import { errorMessage } from '../../core/format';

export const CURRENCIES = [
  'EUR',
  'USD',
  'GBP',
  'CHF',
  'CAD',
  'AUD',
  'SEK',
  'NOK',
  'DKK',
  'PLN',
  'JPY',
];

function budgetRange(group: AbstractControl): ValidationErrors | null {
  const min = group.get('budgetMin')?.value;
  const max = group.get('budgetMax')?.value;
  return min !== null && max !== null && min > max ? { budgetRange: true } : null;
}

@Component({
  selector: 'app-event-create-page',
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container narrow">
      <p><a routerLink="/events">← Mes Secret Santa</a></p>
      <h1>Nouveau Secret Santa</h1>
      <div class="card">
        @if (error(); as e) {
          <div class="alert alert-error" role="alert">{{ e }}</div>
        }
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="field">
            <label for="name">Nom du Secret Santa</label>
            <input
              id="name"
              formControlName="name"
              maxlength="80"
              placeholder="Noël en famille 2026"
            />
            @if (form.controls.name.touched && form.controls.name.invalid) {
              <span class="error">Il lui faut un petit nom (80 caractères max.).</span>
            }
          </div>
          <div class="field">
            <label for="description">Description <span class="muted">(facultatif)</span></label>
            <textarea
              id="description"
              formControlName="description"
              maxlength="1000"
              placeholder="Où, quand, pull moche obligatoire…"
            ></textarea>
          </div>
          <div class="field">
            <label for="eventDate"
              >Date de la grande distribution <span class="muted">(facultatif)</span></label
            >
            <input id="eventDate" type="date" formControlName="eventDate" />
          </div>
          <div class="field-row">
            <div class="field">
              <label for="budgetMin">Budget mini</label>
              <input id="budgetMin" type="number" min="0" step="1" formControlName="budgetMin" />
            </div>
            <div class="field">
              <label for="budgetMax">Budget maxi</label>
              <input id="budgetMax" type="number" min="0" step="1" formControlName="budgetMax" />
            </div>
            <div class="field">
              <label for="currency">Devise</label>
              <select id="currency" formControlName="currency">
                @for (c of currencies; track c) {
                  <option [value]="c">{{ c }}</option>
                }
              </select>
            </div>
          </div>
          @if (form.hasError('budgetRange')) {
            <p class="error small">Le budget mini ne peut pas dépasser le maxi (bien essayé).</p>
          }
          <button type="submit" class="btn btn-primary" [disabled]="busy()">
            {{ busy() ? 'Les lutins s’activent…' : 'Lancer le Secret Santa 🎄' }}
          </button>
        </form>
      </div>
    </div>
  `,
  styles: `
    .error {
      color: var(--red);
    }
  `,
})
export class EventCreatePage {
  private readonly backend = inject(HohowhoBackend);
  private readonly router = inject(Router);
  protected readonly currencies = CURRENCIES;
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group(
    {
      name: ['', [Validators.required, Validators.maxLength(80), Validators.pattern(/\S/)]],
      description: ['', [Validators.maxLength(1000)]],
      eventDate: [''],
      budgetMin: this.numberControl(),
      budgetMax: this.numberControl(),
      currency: ['EUR'],
    },
    { validators: budgetRange },
  );

  private numberControl() {
    return inject(NonNullableFormBuilder).control<number | null>(null, [Validators.min(0)]);
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.busy.set(true);
    this.error.set(null);
    try {
      const id = await this.backend.createEvent({
        name: value.name.trim(),
        description: value.description.trim(),
        eventDate: value.eventDate || null,
        budgetMin: value.budgetMin ?? null,
        budgetMax: value.budgetMax ?? null,
        currency: value.currency,
      });
      await this.router.navigate(['/events', id]);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
