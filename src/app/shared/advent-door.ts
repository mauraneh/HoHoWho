import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * An advent-calendar door: the front leaf swings open in 3D on its left hinge and reveals a
 * warmly lit compartment behind it.
 *
 * Usage:
 *   <app-advent-door [open]="isOpen" tone="crimson">
 *     <div front>…</div>
 *     <div inside>…</div>
 *   </app-advent-door>
 */
@Component({
  selector: 'app-advent-door',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.open]': 'open()',
    '[class.peek]': 'peek()',
    '[class.emerald]': "tone() === 'emerald'",
    '[style.--delay]': "delay() + 'ms'",
  },
  template: `
    <div class="compartment">
      <div class="light" aria-hidden="true"></div>
      <div class="inside"><ng-content select="[inside]" /></div>
    </div>
    <div class="leaf">
      <div class="face front">
        <span class="hinge top" aria-hidden="true"></span>
        <span class="hinge bottom" aria-hidden="true"></span>
        <span class="knob" aria-hidden="true"></span>
        <ng-content select="[front]" />
      </div>
      <div class="face back" aria-hidden="true"></div>
    </div>
  `,
  styles: `
    :host {
      position: relative;
      display: block;
      perspective: 1400px;
      --delay: 0ms;
      --angle: -108deg;
    }
    .compartment {
      position: absolute;
      inset: 0;
      overflow: hidden;
      border-radius: 4px;
      background:
        radial-gradient(ellipse at 50% 30%, rgb(255 214 140 / 55%), transparent 65%),
        linear-gradient(180deg, #3a1a10 0%, #1d0d08 100%);
      box-shadow:
        inset 0 0 0 1px rgb(201 162 90 / 60%),
        inset 0 10px 30px rgb(0 0 0 / 60%);
    }
    .light {
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at 50% 35%, rgb(255 236 190 / 70%), transparent 45%);
      opacity: 0;
      transition: opacity 0.9s ease var(--delay);
    }
    .inside {
      position: relative;
      height: 100%;
      color: var(--ivory);
    }
    .leaf {
      position: absolute;
      inset: 0;
      transform-origin: left center;
      transform-style: preserve-3d;
      transition: transform 1s cubic-bezier(0.22, 0.85, 0.25, 1) var(--delay);
      will-change: transform;
    }
    .face {
      position: absolute;
      inset: 0;
      border-radius: 4px;
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
    }
    .front {
      padding: 1rem 1.2rem 1.2rem;
      color: var(--ivory);
      background:
        linear-gradient(90deg, rgb(0 0 0 / 14%) 1px, transparent 1px),
        linear-gradient(180deg, rgb(0 0 0 / 10%) 1px, transparent 1px),
        linear-gradient(170deg, #b8243a 0%, var(--crimson) 45%, var(--crimson-dark) 100%);
      background-size:
        33.4% 100%,
        100% 50%,
        100% 100%;
      box-shadow:
        inset 0 0 0 1px rgb(201 162 90 / 75%),
        inset 0 0 0 6px rgb(0 0 0 / 8%),
        0 14px 28px -14px rgb(0 0 0 / 70%);
      overflow: hidden;
    }
    :host(.emerald) .front {
      background:
        linear-gradient(90deg, rgb(0 0 0 / 14%) 1px, transparent 1px),
        linear-gradient(180deg, rgb(0 0 0 / 10%) 1px, transparent 1px),
        linear-gradient(
          170deg,
          var(--emerald-light) 0%,
          var(--emerald) 50%,
          var(--emerald-deep) 100%
        );
      background-size:
        33.4% 100%,
        100% 50%,
        100% 100%;
    }
    .back {
      transform: rotateY(180deg);
      background:
        repeating-linear-gradient(90deg, rgb(255 255 255 / 4%) 0 3px, transparent 3px 9px),
        linear-gradient(180deg, #6e1a20, #3d0c10);
      box-shadow: inset 0 0 0 1px rgb(201 162 90 / 40%);
    }
    .knob {
      position: absolute;
      right: 0.8rem;
      top: 50%;
      width: 10px;
      height: 10px;
      margin-top: -5px;
      border-radius: 50%;
      background: radial-gradient(circle at 35% 35%, #f6e2a8, var(--gold) 60%, #8a6a2c);
      box-shadow: 0 1px 2px rgb(0 0 0 / 50%);
    }
    .hinge {
      position: absolute;
      left: -2px;
      width: 5px;
      height: 16px;
      border-radius: 2px;
      background: linear-gradient(90deg, #8a6a2c, var(--gold-light), #8a6a2c);
    }
    .hinge.top {
      top: 14%;
    }
    .hinge.bottom {
      bottom: 14%;
    }
    :host(.peek:hover) .leaf,
    :host(.peek:focus-within) .leaf {
      transform: rotateY(-32deg);
      transition-delay: 0ms;
    }
    :host(.peek:hover) .light,
    :host(.peek:focus-within) .light {
      opacity: 0.6;
      transition-delay: 0ms;
    }
    :host(.open) .leaf,
    :host(.open.peek:hover) .leaf {
      transform: rotateY(var(--angle));
    }
    :host(.open) .light {
      opacity: 1;
    }
    @media (prefers-reduced-motion: reduce) {
      .leaf,
      .light {
        transition-duration: 0.01ms;
      }
    }
  `,
})
export class AdventDoor {
  /** Fully open. */
  readonly open = input(false);
  /** Half-open on hover/focus, inviting a click. */
  readonly peek = input(false);
  readonly tone = input<'crimson' | 'emerald'>('crimson');
  /** Delay before the door moves (for staggered openings). */
  readonly delay = input(0);
}
