import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { personalLinkUrl } from '../core/personal-link';

/** Shows a personal link with copy / WhatsApp / share actions. */
@Component({
  selector: 'app-personal-link-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="link-box">
      <span class="eyebrow">{{ title() }}</span>
      <p class="hint">{{ hint() }}</p>
      <div class="share">
        <label class="visually-hidden" [for]="id">Lien personnel</label>
        <input [id]="id" readonly [value]="url()" (focus)="select($event)" />
        <button type="button" class="btn btn-sm" (click)="copy()">
          {{ copied() ? 'Copié ✓' : 'Copier' }}
        </button>
      </div>
      <div class="row">
        <a class="btn btn-green btn-sm" [href]="whatsapp()" target="_blank" rel="noopener">
          WhatsApp
        </a>
        @if (canShare) {
          <button type="button" class="btn btn-sm" (click)="share()">Partager…</button>
        }
      </div>
    </div>
  `,
  styles: `
    .link-box {
      padding: 1rem 1.1rem;
      border-radius: 14px;
      background: var(--soft);
      margin: 0.5rem 0 1rem;
    }
    .hint {
      color: var(--muted);
      font-size: 0.875rem;
      margin: 0.3rem 0 0.7rem;
    }
    .share {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 0.6rem;
    }
    input {
      font-size: 0.85rem;
    }
  `,
})
export class PersonalLinkCard {
  readonly key = input.required<string>();
  readonly title = input('Votre lien personnel');
  readonly hint = input(
    'Gardez-le précieusement : il vous reconnecte sur n’importe quel appareil. Ne le donnez à personne.',
  );
  /** Message used when sharing (WhatsApp / share sheet). */
  readonly message = input('Mon lien HoHoWho :');

  protected readonly id = `link-${Math.random().toString(36).slice(2, 8)}`;
  protected readonly copied = signal(false);
  protected readonly canShare = typeof navigator !== 'undefined' && 'share' in navigator;
  protected readonly url = computed(() => personalLinkUrl(this.key()));
  protected readonly whatsapp = computed(
    () => `https://wa.me/?text=${encodeURIComponent(`${this.message()} ${this.url()}`)}`,
  );

  select(event: FocusEvent): void {
    (event.target as HTMLInputElement).select();
  }

  async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.url());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      // Clipboard blocked: the field stays selectable.
    }
  }

  async share(): Promise<void> {
    try {
      await navigator.share({ title: 'HoHoWho', text: this.message(), url: this.url() });
    } catch {
      // Share sheet dismissed: nothing to do.
    }
  }
}
