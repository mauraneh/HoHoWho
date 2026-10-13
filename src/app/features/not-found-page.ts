import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container narrow empty">
      <h1>Page not found</h1>
      <p>This page does not exist (or the elves misplaced it).</p>
      <a routerLink="/events" class="btn btn-primary">Back to my events</a>
    </div>
  `,
})
export class NotFoundPage {}
