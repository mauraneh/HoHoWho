import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { AdventDoor } from './advent-door';

interface Surprise {
  icon: string;
  text: string;
}

/** Shuffled like a real calendar: doors are never in order. */
const ORDER = [
  13, 4, 21, 8, 17, 1, 10, 24, 6, 15, 19, 3, 22, 11, 7, 2, 18, 14, 9, 23, 5, 16, 12, 20,
];

const SURPRISES: Record<number, Surprise> = {
  1: { icon: '🎄', text: 'On sort le sapin' },
  2: { icon: '🍪', text: 'Un biscuit à la cannelle' },
  3: { icon: '🧦', text: 'Des chaussettes douillettes' },
  4: { icon: '☕', text: 'Un chocolat chaud' },
  5: { icon: '⭐', text: 'Fais un vœu' },
  6: { icon: '🎅', text: 'Saint Nicolas passe' },
  7: { icon: '🕯️', text: 'Une bougie qui crépite' },
  8: { icon: '❄️', text: 'Premiers flocons' },
  9: { icon: '🦌', text: 'Les rennes s’échauffent' },
  10: { icon: '🎶', text: 'Un chant de Noël' },
  11: { icon: '🍊', text: 'Une clémentine' },
  12: { icon: '📮', text: 'Écris ta lettre' },
  13: { icon: '🔔', text: 'Les clochettes sonnent' },
  14: { icon: '🧣', text: 'Une écharpe tricotée' },
  15: { icon: '🍫', text: 'Un carré de chocolat' },
  16: { icon: '⛄', text: 'Un bonhomme de neige' },
  17: { icon: '🎀', text: 'Le plus beau des nœuds' },
  18: { icon: '📚', text: 'Une histoire au coin du feu' },
  19: { icon: '🌟', text: 'Une étoile au sommet' },
  20: { icon: '🥨', text: 'Un bretzel du marché' },
  21: { icon: '🛷', text: 'Une descente en luge' },
  22: { icon: '💌', text: 'Un mot gentil' },
  23: { icon: '🍷', text: 'Un vin chaud' },
  24: { icon: '🎁', text: 'Joyeux réveillon !' },
};

/** Decorative, interactive 24-door advent calendar. Today's door glows in December. */
@Component({
  selector: 'app-advent-calendar',
  imports: [AdventDoor],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid">
      @for (day of order; track day; let i = $index) {
        <button
          type="button"
          class="cell"
          [class.today]="day === today"
          [attr.aria-label]="'Case ' + day + (opened().has(day) ? ' : ' + surprises[day].text : '')"
          [attr.aria-pressed]="opened().has(day)"
          (click)="toggle(day)"
        >
          <app-advent-door
            [open]="opened().has(day)"
            [peek]="true"
            [tone]="(i + Math.floor(i / 6)) % 2 === 0 ? 'crimson' : 'emerald'"
          >
            <span front class="num">{{ day }}</span>
            <span inside class="surprise">
              <span class="icon" aria-hidden="true">{{ surprises[day].icon }}</span>
              <span class="text">{{ surprises[day].text }}</span>
            </span>
          </app-advent-door>
        </button>
      }
    </div>
  `,
  styles: `
    .grid {
      display: grid;
      gap: 0.75rem;
      grid-template-columns: repeat(6, 1fr);
    }
    @media (max-width: 640px) {
      .grid {
        grid-template-columns: repeat(4, 1fr);
      }
    }
    .cell {
      padding: 0;
      border: none;
      background: none;
      aspect-ratio: 1 / 1.05;
      cursor: pointer;
      border-radius: 4px;
      font: inherit;
    }
    app-advent-door {
      height: 100%;
    }
    .cell.today {
      box-shadow:
        0 0 0 2px var(--gold-light),
        0 0 24px 4px rgb(230 205 142 / 55%);
      animation: glow 2.4s ease-in-out infinite;
    }
    @keyframes glow {
      50% {
        box-shadow:
          0 0 0 2px var(--gold-light),
          0 0 34px 8px rgb(230 205 142 / 75%);
      }
    }
    .num {
      display: block;
      font-family: var(--font-caps);
      font-weight: 700;
      font-size: clamp(1.3rem, 3.5vw, 2rem);
      color: var(--gold-light);
      line-height: 1;
      margin: -0.35rem 0 0 -0.4rem;
    }
    .surprise {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 0.3rem 0.3rem 0.3rem 22%;
      text-align: center;
      gap: 0.2rem;
    }
    .icon {
      font-size: clamp(1.4rem, 4vw, 2.1rem);
    }
    .text {
      font-family: var(--font-serif);
      font-size: 0.8rem;
      line-height: 1.1;
      color: var(--gold-pale);
    }
    @media (max-width: 640px) {
      .text {
        display: none;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .cell.today {
        animation: none;
      }
    }
  `,
})
export class AdventCalendar {
  protected readonly order = ORDER;
  protected readonly surprises = SURPRISES;
  protected readonly Math = Math;
  protected readonly opened = signal<ReadonlySet<number>>(new Set());
  protected readonly today = (() => {
    const now = new Date();
    return now.getMonth() === 11 && now.getDate() <= 24 ? now.getDate() : null;
  })();

  toggle(day: number): void {
    this.opened.update((current) => {
      const next = new Set(current);
      if (!next.delete(day)) next.add(day);
      return next;
    });
  }
}
