import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HohowhoBackend } from '../../core/backend/hohowho-backend';
import { errorMessage, safeReturnUrl } from '../../core/format';
import { DATA_SOURCE } from '../../core/tokens';

type Mode = 'sign-in' | 'sign-up';

@Component({
  selector: 'app-sign-in-page',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container narrow">
      <div class="hero">
        <h1>Secret Santa, sorted.</h1>
        <p class="muted">
          Invite your group, draw names fairly, share wishlists, get gift ideas and chat anonymously
          with your giftee.
        </p>
      </div>

      <div class="card">
        <div class="tabs" role="tablist">
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="mode() === 'sign-in'"
            [class.active]="mode() === 'sign-in'"
            (click)="switchMode('sign-in')"
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="mode() === 'sign-up'"
            [class.active]="mode() === 'sign-up'"
            (click)="switchMode('sign-up')"
          >
            Create account
          </button>
        </div>

        @if (error(); as e) {
          <div class="alert alert-error" role="alert">{{ e }}</div>
        }
        @if (info(); as i) {
          <div class="alert alert-success" role="status">{{ i }}</div>
        }

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          @if (mode() === 'sign-up') {
            <div class="field">
              <label for="displayName">Your name</label>
              <input
                id="displayName"
                formControlName="displayName"
                autocomplete="nickname"
                maxlength="60"
              />
              <span class="hint">Shown to the other participants.</span>
            </div>
          }
          <div class="field">
            <label for="email">E-mail</label>
            <input id="email" type="email" formControlName="email" autocomplete="email" />
          </div>
          <div class="field">
            <label for="password">Password</label>
            <input
              id="password"
              type="password"
              formControlName="password"
              [attr.autocomplete]="mode() === 'sign-in' ? 'current-password' : 'new-password'"
            />
            @if (mode() === 'sign-up') {
              <span class="hint">At least 8 characters.</span>
            }
          </div>
          <button type="submit" class="btn btn-primary full" [disabled]="busy()">
            {{ busy() ? 'Please wait…' : mode() === 'sign-in' ? 'Sign in' : 'Create account' }}
          </button>
        </form>
      </div>

      @if (isMock) {
        <div class="card small">
          <strong>Demo mode.</strong> Sign in as <code>alice&#64;example.com</code>,
          <code>bob&#64;example.com</code>, <code>carol&#64;example.com</code> or
          <code>dave&#64;example.com</code> with password <code>password123</code>, or create an
          account. Data stays in this browser.
        </div>
      }
    </div>
  `,
  styles: `
    .hero {
      text-align: center;
      margin: 1.5rem 0;
    }
    .tabs {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }
    .tabs button {
      flex: 1;
      padding: 0.5rem;
      background: none;
      border: none;
      border-bottom: 3px solid transparent;
      font: inherit;
      font-weight: 600;
      color: var(--muted);
      cursor: pointer;
    }
    .tabs button.active {
      color: var(--red);
      border-bottom-color: var(--red);
    }
    .full {
      width: 100%;
    }
  `,
})
export class SignInPage {
  private readonly backend = inject(HohowhoBackend);
  private readonly router = inject(Router);
  protected readonly isMock = inject(DATA_SOURCE) === 'mock';

  /** Bound from the `returnUrl` query parameter. */
  readonly returnUrl = input<string>();

  protected readonly mode = signal<Mode>('sign-in');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly info = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    displayName: [''],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  switchMode(mode: Mode): void {
    this.mode.set(mode);
    this.error.set(null);
    this.info.set(null);
  }

  async submit(): Promise<void> {
    this.error.set(null);
    this.info.set(null);
    const { displayName, email, password } = this.form.getRawValue();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Please enter a valid e-mail address and password.');
      return;
    }
    if (this.mode() === 'sign-up') {
      if (!displayName.trim()) return this.error.set('Please tell us your name.');
      if (password.length < 8)
        return this.error.set('Use at least 8 characters for your password.');
    }

    this.busy.set(true);
    try {
      if (this.mode() === 'sign-in') {
        await this.backend.signIn(email, password);
      } else {
        const result = await this.backend.signUp(email, password, displayName);
        if (result.needsEmailConfirmation) {
          this.info.set(
            'Almost there! Confirm your e-mail address with the link we sent, then sign in.',
          );
          this.mode.set('sign-in');
          return;
        }
      }
      await this.router.navigateByUrl(safeReturnUrl(this.returnUrl()));
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
