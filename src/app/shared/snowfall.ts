import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';

interface Flake {
  x: number;
  y: number;
  /** Depth from 0.15 (far away) to 1 (close to the viewer). */
  z: number;
  radius: number;
  speed: number;
  phase: number;
}

/**
 * Full-page falling snow drawn on a canvas, with three depth layers (size, speed, blur and
 * opacity depend on depth), a gentle wind, 3D parallax following the pointer and the scroll.
 * Pauses when the tab is hidden and stays still when the user prefers reduced motion.
 */
@Component({
  selector: 'app-snowfall',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `<canvas #canvas></canvas>`,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 0;
      pointer-events: none;
    }
    canvas {
      display: block;
      width: 100%;
      height: 100%;
    }
  `,
})
export class Snowfall {
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => destroyRef.onDestroy(this.start(this.canvas().nativeElement)));
  }

  /** Starts the animation and returns the cleanup function. */
  private start(canvas: HTMLCanvasElement): () => void {
    const context = canvas.getContext('2d');
    if (!context) return () => undefined;
    const ctx = context;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Pre-rendered soft flake sprite (much cheaper than gradients per frame).
    const sprite = document.createElement('canvas');
    sprite.width = sprite.height = 64;
    const sctx = sprite.getContext('2d')!;
    const gradient = sctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.35, 'rgba(255,255,255,0.85)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    sctx.fillStyle = gradient;
    sctx.fillRect(0, 0, 64, 64);

    let width = 0;
    let height = 0;
    let flakes: Flake[] = [];
    const pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };

    const makeFlake = (y = Math.random() * height): Flake => {
      const z = 0.15 + Math.random() ** 1.6 * 0.85;
      return {
        x: Math.random() * width,
        y,
        z,
        radius: 1.2 + Math.random() * 2.6,
        speed: 18 + Math.random() * 26,
        phase: Math.random() * Math.PI * 2,
      };
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(320, Math.round((width * height) / 5200));
      flakes = Array.from({ length: count }, () => makeFlake());
    };

    const draw = (time: number, dt: number) => {
      ctx.clearRect(0, 0, width, height);
      pointer.x += (pointer.tx - pointer.x) * 0.04;
      pointer.y += (pointer.ty - pointer.y) * 0.04;
      const scroll = window.scrollY;
      const wind = Math.sin(time / 7000) * 14;

      for (const flake of flakes) {
        flake.y += flake.speed * flake.z * dt;
        flake.x += (Math.sin(time / 1600 + flake.phase) * 12 + wind) * flake.z * dt;
        if (flake.y > height + 10) Object.assign(flake, makeFlake(-10));
        if (flake.x > width + 10) flake.x = -10;
        if (flake.x < -10) flake.x = width + 10;

        // Parallax: close flakes move more with the pointer and the scroll (depth illusion).
        const px = flake.x + (pointer.x - 0.5) * -60 * flake.z;
        const py =
          ((((flake.y + (pointer.y - 0.5) * -30 * flake.z - scroll * 0.25 * flake.z) %
            (height + 20)) +
            height +
            20) %
            (height + 20)) -
          10;
        const size = flake.radius * (0.6 + flake.z * 1.9) * 2;
        ctx.globalAlpha = 0.25 + flake.z * 0.7;
        ctx.drawImage(sprite, px - size / 2, py - size / 2, size, size);
      }
      ctx.globalAlpha = 1;
    };

    resize();
    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      draw(now, dt);
      frame = requestAnimationFrame(loop);
    };

    const onPointer = (event: PointerEvent) => {
      pointer.tx = event.clientX / width;
      pointer.ty = event.clientY / height;
    };
    const onVisibility = () => {
      cancelAnimationFrame(frame);
      if (!document.hidden && !reducedMotion) {
        last = performance.now();
        frame = requestAnimationFrame(loop);
      }
    };
    const onResize = () => {
      resize();
      if (reducedMotion) draw(0, 0);
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('pointermove', onPointer, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    if (reducedMotion) draw(0, 0);
    else frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }
}
