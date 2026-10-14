import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { safeReturnUrl } from '../../core/format';
import { DATA_SOURCE } from '../../core/tokens';
import { AccessPanel } from './access-panel';

@Component({
  selector: 'app-sign-in-page',
  imports: [AccessPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="container hero">
      <h1 class="display">Secret<br />Santa<span class="dot">.</span></h1>
      <p class="lead">
        Un lien, des prénoms, et le hasard fait le reste. Chacun dit ce qui lui ferait plaisir, les
        lutins tirent au sort, et personne ne sait qui gâte qui.
      </p>
    </section>

    <section class="container access">
      <div class="card signin-card">
        <h2>C’est par ici 👇</h2>
        <app-access-panel (signedIn)="continue()" />
      </div>
    </section>

    <section class="container">
      <h2 class="section-title">Comment ça marche ?</h2>
      <ol class="steps">
        @for (step of steps; track step.n) {
          <li>
            <span class="n">{{ step.n }}</span>
            <h3>{{ step.title }}</h3>
            <p class="muted">{{ step.text }}</p>
          </li>
        }
      </ol>

      @if (isMock) {
        <div class="card small demo">
          <strong>Liens de démo :</strong>
          <a href="#/k/demo-alice">Alice (organisatrice)</a> · <a href="#/k/demo-bob">Bob</a> ·
          <a href="#/k/demo-carol">Carol</a> · <a href="#/k/demo-dave">Dave</a>. Code organisatrice
          : <code>noel</code>.
        </div>
      }
    </section>
  `,
  styles: `
    .hero {
      padding-top: 4rem;
      padding-bottom: 1rem;
    }
    .dot {
      color: var(--red);
    }
    .lead {
      max-width: 34rem;
      font-size: clamp(1.1rem, 2.4vw, 1.35rem);
      color: var(--snow-soft);
      margin: 1.25rem 0 0;
    }
    .access {
      padding-top: 1rem;
      padding-bottom: 1rem;
    }
    .signin-card {
      max-width: 520px;
      margin: 0;
      padding: 2rem;
    }
    .section-title {
      font-size: clamp(2rem, 5vw, 3.2rem);
      margin-bottom: 1.5rem;
    }
    .steps {
      list-style: none;
      padding: 0;
      margin: 0 0 2.5rem;
      display: grid;
      gap: 2rem;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    }
    .n {
      display: block;
      font-size: 3.5rem;
      font-weight: 800;
      line-height: 1;
      letter-spacing: -0.05em;
      color: var(--red);
      margin-bottom: 0.6rem;
    }
    .steps h3 {
      font-size: 1.35rem;
    }
    .steps p {
      margin: 0;
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
      n: '01',
      title: 'Tout le monde dans le traîneau',
      text: 'Chacun ouvre le lien, tape son prénom et dit ce qui lui ferait vraiment plaisir (et ce qui finirait direct au fond d’un placard).',
    },
    {
      n: '02',
      title: 'Les petits arrangements',
      text: 'Liste fermée ? Chacun peut écarter quelqu’un en toute discrétion. On ne juge pas, et personne ne saura.',
    },
    {
      n: '03',
      title: 'Le grand tirage',
      text: 'Dès que tout le monde a validé, les lutins tirent au sort. Tu découvres à qui tu offres… et tu gardes le secret.',
    },
  ];

  continue(): void {
    void this.router.navigateByUrl(safeReturnUrl(this.returnUrl()));
  }
}
