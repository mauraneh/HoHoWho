import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { safeReturnUrl } from '../../core/format';
import { takeNext } from '../../core/pending-navigation';
import { DATA_SOURCE } from '../../core/tokens';
import { Bauble, BowRibbon, Corners, Divider } from '../../shared/ornaments';
import { SignInForm } from './sign-in-form';

@Component({
  selector: 'app-sign-in-page',
  imports: [SignInForm, Bauble, BowRibbon, Corners, Divider],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="hero">
      <div class="snow" aria-hidden="true"></div>
      <app-bauble class="bauble b1" color="red" [drop]="70" />
      <app-bauble class="bauble b2" color="green" [drop]="40" />
      <app-bauble class="bauble b3" color="red" [drop]="55" />
      <div class="hero-inner">
        <div class="hero-copy">
          <app-corners />
          <span class="eyebrow">Depuis 2026 · Gratuit &amp; sans pub</span>
          <h1>
            <span class="script title">Secret Santa</span>
            <span class="subtitle">Qui gâte qui cette année ?</span>
          </h1>
          <app-divider />
          <p class="lead">
            Un seul lien à partager : chacun donne ses envies, vous fermez la liste et HoHoWho tire
            les noms au sort. Équitable, secret et tout simple.
          </p>
        </div>
        <div class="card signin-card">
          <span class="eyebrow">Organiser ou participer</span>
          <h2>Votre invitation vous attend</h2>
          <app-sign-in-form [next]="target()" (signedIn)="continue()" />
        </div>
      </div>
    </section>

    <app-bow-ribbon />

    <section class="container how">
      <span class="eyebrow">Comment ça marche</span>
      <h2 class="script how-title">Trois petites portes</h2>
      <div class="doors">
        @for (step of steps; track step.n) {
          <article class="door card-crimson">
            <span class="door-n">{{ step.n }}</span>
            <span class="door-icon" aria-hidden="true">{{ step.icon }}</span>
            <h3>{{ step.title }}</h3>
            <p>{{ step.text }}</p>
          </article>
        }
      </div>

      @if (isMock) {
        <div class="card small demo">
          <strong>Comptes de démo :</strong> <code>alice&#64;example.com</code> (organisatrice),
          <code>bob&#64;example.com</code>, <code>carol&#64;example.com</code>,
          <code>dave&#64;example.com</code>, ou n’importe quel e-mail.
        </div>
      }
    </section>
  `,
  styles: `
    .hero {
      position: relative;
      overflow: hidden;
      color: var(--ivory);
      background:
        radial-gradient(circle at 15% 15%, rgb(201 162 90 / 20%), transparent 35%),
        radial-gradient(circle at 85% 85%, rgb(160 24 42 / 30%), transparent 40%),
        repeating-linear-gradient(45deg, rgb(255 255 255 / 2%) 0 2px, transparent 2px 12px),
        linear-gradient(170deg, var(--emerald) 0%, var(--emerald-deep) 100%);
    }
    .bauble {
      position: absolute;
      top: 0;
    }
    .b1 {
      left: 4%;
    }
    .b2 {
      left: 9%;
    }
    .b3 {
      right: 5%;
    }
    .hero-inner {
      position: relative;
      max-width: 1040px;
      margin: 0 auto;
      padding: 3.5rem 1rem 3rem;
      display: grid;
      gap: 2.5rem;
      grid-template-columns: 1.15fr 1fr;
      align-items: center;
    }
    .hero-copy {
      position: relative;
      padding: 2.5rem 2rem;
      text-align: center;
    }
    .hero-copy .eyebrow {
      color: var(--gold-light);
    }
    h1 {
      margin: 0.5rem 0 0;
      color: var(--ivory);
    }
    .title {
      display: block;
      font-size: clamp(3.4rem, 9vw, 5.6rem);
      line-height: 1;
      color: var(--gold-light);
      text-shadow: 0 2px 0 rgb(0 0 0 / 25%);
    }
    .subtitle {
      display: block;
      margin-top: 0.4rem;
      font-family: var(--font-caps);
      font-size: clamp(0.95rem, 2.2vw, 1.2rem);
      letter-spacing: 0.16em;
      text-transform: uppercase;
    }
    .lead {
      font-family: var(--font-serif);
      font-size: 1.3rem;
      line-height: 1.45;
      color: rgb(247 240 225 / 88%);
      margin: 0;
    }
    .signin-card {
      color: var(--ink);
      margin: 0;
      padding: 2rem;
      box-shadow:
        var(--gold-rule),
        0 30px 60px -20px rgb(0 0 0 / 55%);
    }
    .how {
      text-align: center;
      padding-top: 1rem;
    }
    .how-title {
      font-size: 3rem;
      color: var(--emerald);
      margin-bottom: 1.5rem;
    }
    .doors {
      display: grid;
      gap: 1.25rem;
      grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
      text-align: left;
      margin-bottom: 2rem;
    }
    .door {
      position: relative;
      border-radius: 4px;
      padding: 1.4rem 1.4rem 1.5rem;
      min-height: 210px;
    }
    .door-n {
      font-family: var(--font-caps);
      font-size: 2.2rem;
      font-weight: 700;
      color: var(--gold-light);
      line-height: 1;
    }
    .door-icon {
      position: absolute;
      right: 1.2rem;
      top: 1.1rem;
      font-size: 1.8rem;
    }
    .door h3 {
      color: var(--ivory);
      margin: 1.4rem 0 0.4rem;
      font-size: 1.4rem;
    }
    .door p {
      margin: 0;
      color: rgb(247 240 225 / 85%);
    }
    .demo {
      text-align: left;
    }
    @media (max-width: 800px) {
      .hero-inner {
        grid-template-columns: 1fr;
        padding-top: 2.5rem;
      }
      .b2,
      .b3 {
        display: none;
      }
    }
  `,
})
export class SignInPage {
  private readonly router = inject(Router);
  protected readonly isMock = inject(DATA_SOURCE) === 'mock';

  /** Bound from the `returnUrl` query parameter. */
  readonly returnUrl = input<string>();

  protected readonly steps = [
    {
      n: 'I',
      icon: '✉️',
      title: 'Inscription & envies',
      text: 'Chacun ouvre votre lien, entre son e-mail et dit à son Père Noël secret ce qui lui ferait plaisir.',
    },
    {
      n: 'II',
      icon: '🤫',
      title: 'Exclusions',
      text: 'Une fois la liste fermée, chacun choisit en secret à qui il préfère ne pas offrir.',
    },
    {
      n: 'III',
      icon: '🎁',
      title: 'Le tirage',
      text: 'Quand tout le monde a validé, les noms sont tirés au sort et chacun découvre à qui il offre.',
    },
  ];

  target(): string {
    return safeReturnUrl(this.returnUrl());
  }

  continue(): void {
    takeNext();
    void this.router.navigateByUrl(this.target());
  }
}
