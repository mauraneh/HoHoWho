import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/*
 * Decorative Victorian-Christmas ornaments drawn as inline SVG (no image assets, crisp at any
 * size, themable through CSS colour variables). All are aria-hidden.
 */

/** Red satin ribbon across the page with a bow in the middle (section divider). */
@Component({
  selector: 'app-bow-ribbon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    <div class="band"></div>
    <svg class="bow" viewBox="0 0 140 96" width="120" height="82">
      <defs>
        <linearGradient id="bowFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#d0313f" />
          <stop offset="1" stop-color="#8e1220" />
        </linearGradient>
      </defs>
      <path
        d="M66 48 L46 92 L56 85 L63 94 L72 52Z"
        fill="url(#bowFill)"
        stroke="#6d0d18"
        stroke-width="1.5"
      />
      <path
        d="M74 48 L94 92 L84 85 L77 94 L68 52Z"
        fill="url(#bowFill)"
        stroke="#6d0d18"
        stroke-width="1.5"
      />
      <path
        d="M70 44 C48 8 6 6 12 36 C17 60 50 54 70 44Z"
        fill="url(#bowFill)"
        stroke="#6d0d18"
        stroke-width="1.5"
      />
      <path
        d="M70 44 C92 8 134 6 128 36 C123 60 90 54 70 44Z"
        fill="url(#bowFill)"
        stroke="#6d0d18"
        stroke-width="1.5"
      />
      <path
        d="M64 42 C48 22 26 20 24 34"
        fill="none"
        stroke="#f08a92"
        stroke-width="2"
        stroke-linecap="round"
        opacity=".55"
      />
      <path
        d="M76 42 C92 22 114 20 116 34"
        fill="none"
        stroke="#f08a92"
        stroke-width="2"
        stroke-linecap="round"
        opacity=".55"
      />
      <ellipse cx="70" cy="45" rx="11" ry="10" fill="#b51f30" stroke="#6d0d18" stroke-width="1.5" />
      <ellipse cx="67" cy="42" rx="4" ry="3" fill="#f08a92" opacity=".5" />
    </svg>
  `,
  styles: `
    :host {
      position: relative;
      display: grid;
      place-items: center;
      height: 64px;
      margin: 0.5rem 0;
    }
    .band {
      position: absolute;
      left: 0;
      right: 0;
      top: 50%;
      height: 16px;
      transform: translateY(-50%);
      background: linear-gradient(180deg, #c42a39 0%, var(--crimson) 50%, #7c1019 100%);
      box-shadow:
        inset 0 1.5px 0 var(--gold),
        inset 0 -1.5px 0 var(--gold),
        0 4px 10px -4px rgb(0 0 0 / 40%);
    }
    .bow {
      position: relative;
      filter: drop-shadow(0 4px 4px rgb(0 0 0 / 30%));
    }
  `,
})
export class BowRibbon {}

/** Thin gold rule with a central star, like the dividers of an antique book. */
@Component({
  selector: 'app-divider',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    <svg viewBox="0 0 260 24" width="260" height="24">
      <g fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round">
        <path d="M4 12 H96" />
        <path d="M164 12 H256" />
        <path d="M96 12 C104 4 112 4 116 12 C112 20 104 20 96 12Z" />
        <path d="M164 12 C156 4 148 4 144 12 C148 20 156 20 164 12Z" />
      </g>
      <path d="M130 2 L133 9 L140 12 L133 15 L130 22 L127 15 L120 12 L127 9Z" fill="currentColor" />
      <circle cx="24" cy="12" r="1.8" fill="currentColor" />
      <circle cx="236" cy="12" r="1.8" fill="currentColor" />
    </svg>
  `,
  styles: `
    :host {
      display: flex;
      justify-content: center;
      color: var(--gold);
      margin: 0.75rem auto;
      max-width: 100%;
    }
    svg {
      max-width: 100%;
      height: auto;
    }
  `,
})
export class Divider {}

/** Gold filigree in the four corners of the parent (parent must be position: relative). */
@Component({
  selector: 'app-corners',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    @for (corner of corners; track corner) {
      <svg [class]="corner" viewBox="0 0 64 64" width="56" height="56">
        <g fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">
          <path d="M4 60 V14 C4 8 8 4 14 4 H60" />
          <path d="M10 60 V20 C10 14 14 10 20 10 H60" opacity=".6" />
          <path d="M14 26 C14 18 18 14 26 14 C32 14 34 20 30 23 C27 25 23 23 24 20" />
          <path d="M22 4 C22 10 26 12 30 10" />
          <path d="M4 22 C10 22 12 26 10 30" />
        </g>
        <circle cx="4" cy="4" r="2.4" fill="currentColor" />
      </svg>
    }
  `,
  styles: `
    :host {
      position: absolute;
      inset: 10px;
      pointer-events: none;
      color: var(--gold);
    }
    svg {
      position: absolute;
    }
    .tl {
      top: 0;
      left: 0;
    }
    .tr {
      top: 0;
      right: 0;
      transform: scaleX(-1);
    }
    .bl {
      bottom: 0;
      left: 0;
      transform: scaleY(-1);
    }
    .br {
      bottom: 0;
      right: 0;
      transform: scale(-1);
    }
  `,
})
export class Corners {
  protected readonly corners = ['tl', 'tr', 'bl', 'br'];
}

/** Holly sprig: two leaves and three berries. */
@Component({
  selector: 'app-holly',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    <svg viewBox="0 0 80 48" [attr.width]="size()" [attr.height]="size() * 0.6">
      <path
        d="M40 30 C30 14 14 22 4 10 C10 26 6 30 12 36 C18 30 26 38 40 30Z"
        fill="#2f6b45"
        stroke="#173d2c"
        stroke-width="1.2"
      />
      <path
        d="M40 30 C50 14 66 22 76 10 C70 26 74 30 68 36 C62 30 54 38 40 30Z"
        fill="#3a7d53"
        stroke="#173d2c"
        stroke-width="1.2"
      />
      <path
        d="M40 30 C30 22 18 20 8 13 M40 30 C50 22 62 20 72 13"
        fill="none"
        stroke="#173d2c"
        stroke-width=".8"
        opacity=".6"
      />
      <circle cx="35" cy="34" r="5" fill="#b51f30" />
      <circle cx="45" cy="34" r="5" fill="#c42a39" />
      <circle cx="40" cy="41" r="5" fill="#a0182a" />
      <circle cx="34" cy="32.5" r="1.4" fill="#fff" opacity=".6" />
      <circle cx="44" cy="32.5" r="1.4" fill="#fff" opacity=".6" />
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
    }
  `,
})
export class Holly {
  readonly size = input(64);
}

/** Hanging Christmas bauble (gold cap, red or green glass). */
@Component({
  selector: 'app-bauble',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    <svg [attr.viewBox]="'0 0 40 ' + (drop() + 40)" width="40" [attr.height]="drop() + 40">
      <line x1="20" y1="0" [attr.y2]="drop()" stroke="currentColor" stroke-width="1" />
      <g [attr.transform]="'translate(0 ' + drop() + ')'">
        <rect x="15" y="0" width="10" height="7" rx="1.5" fill="currentColor" />
        <circle cx="20" cy="20" r="14" [attr.fill]="color() === 'red' ? '#a0182a' : '#1f5a3d'" />
        <path d="M8 18 Q20 26 32 18" fill="none" stroke="currentColor" stroke-width="1.4" />
        <path
          d="M7 23 Q20 31 33 23"
          fill="none"
          stroke="currentColor"
          stroke-width=".8"
          opacity=".7"
        />
        <ellipse cx="14" cy="14" rx="3.5" ry="2.2" fill="#fff" opacity=".35" />
      </g>
    </svg>
  `,
  styles: `
    :host {
      display: inline-block;
      color: var(--gold);
      transform-origin: top center;
      animation: sway 5s ease-in-out infinite;
    }
    @keyframes sway {
      50% {
        transform: rotate(4deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      :host {
        animation: none;
      }
    }
  `,
})
export class Bauble {
  readonly color = input<'red' | 'green'>('red');
  readonly drop = input(60);
}
