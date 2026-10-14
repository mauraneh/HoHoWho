import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { safeReturnUrl } from '../../core/format';
import { takeNext } from '../../core/pending-navigation';
import { DATA_SOURCE } from '../../core/tokens';
import { SignInForm } from './sign-in-form';

@Component({
  selector: 'app-sign-in-page',
  imports: [SignInForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="hero">
      <div class="snow" aria-hidden="true"></div>
      <div class="hero-inner">
        <div class="hero-copy">
          <span class="eyebrow">Secret Santa · zero stress</span>
          <h1>Who gifts <em>who</em> this&nbsp;year?</h1>
          <p class="lead">
            Share one link, let everyone tell their wishes, close the list, and HoHoWho draws the
            names. Fair, secret, and free.
          </p>
          <ol class="steps">
            <li><span>1</span> Everyone joins with your link and shares their wishes</li>
            <li><span>2</span> Each person quietly picks who they'd rather skip</li>
            <li><span>3</span> Names are drawn, everyone discovers their giftee</li>
          </ol>
        </div>
        <div class="card signin-card">
          <h2>Start or join a Secret Santa</h2>
          <app-sign-in-form [next]="target()" (signedIn)="continue()" />
        </div>
      </div>
    </section>

    @if (isMock) {
      <div class="container narrow">
        <div class="card small">
          <strong>Demo accounts:</strong> <code>alice&#64;example.com</code> (organiser),
          <code>bob&#64;example.com</code>, <code>carol&#64;example.com</code>,
          <code>dave&#64;example.com</code> — or any e-mail.
        </div>
      </div>
    }
  `,
  styles: `
    .hero {
      position: relative;
      overflow: hidden;
      color: var(--snow);
      background:
        radial-gradient(circle at 10% 10%, rgb(226 178 74 / 22%), transparent 35%),
        radial-gradient(circle at 90% 80%, rgb(192 40 63 / 35%), transparent 40%),
        linear-gradient(160deg, var(--pine) 0%, #0b241b 100%);
    }
    .hero-inner {
      position: relative;
      max-width: 1000px;
      margin: 0 auto;
      padding: 3.5rem 1rem 4rem;
      display: grid;
      gap: 2.5rem;
      grid-template-columns: 1.1fr 1fr;
      align-items: center;
    }
    h1 {
      font-size: clamp(2.3rem, 6vw, 3.6rem);
      margin-bottom: 1rem;
    }
    h1 em {
      color: var(--gold);
    }
    .lead {
      font-size: 1.1rem;
      color: rgb(251 247 240 / 85%);
      max-width: 34rem;
    }
    .steps {
      list-style: none;
      padding: 0;
      margin: 1.5rem 0 0;
      display: grid;
      gap: 0.65rem;
    }
    .steps li {
      display: flex;
      gap: 0.75rem;
      align-items: center;
      color: rgb(251 247 240 / 90%);
    }
    .steps span {
      display: grid;
      place-items: center;
      flex: none;
      width: 1.9rem;
      height: 1.9rem;
      border-radius: 50%;
      background: var(--gold);
      color: var(--pine);
      font-weight: 800;
    }
    .signin-card {
      color: var(--ink);
      margin: 0;
      padding: 1.75rem;
      box-shadow: 0 30px 60px -20px rgb(0 0 0 / 45%);
    }
    @media (max-width: 760px) {
      .hero-inner {
        grid-template-columns: 1fr;
        padding-top: 2.25rem;
      }
    }
  `,
})
export class SignInPage {
  private readonly router = inject(Router);
  protected readonly isMock = inject(DATA_SOURCE) === 'mock';

  /** Bound from the `returnUrl` query parameter. */
  readonly returnUrl = input<string>();

  target(): string {
    return safeReturnUrl(this.returnUrl());
  }

  continue(): void {
    takeNext();
    void this.router.navigateByUrl(this.target());
  }
}
