import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container narrow empty">
      <h1>Page introuvable</h1>
      <p>Cette page n’existe pas (ou les lutins l’ont égarée).</p>
      <a routerLink="/events" class="btn btn-primary">Retour à mes Secret Santa</a>
    </div>
  `,
})
export class NotFoundPage {}
