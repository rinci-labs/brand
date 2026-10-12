import { LOGO_ICON_URL, LOGO_TEXT_URL } from './assets.js';
import { hash, loadImage, prefersReducedMotion } from './motion.js';

export interface PixelLogoOptions {
  /** The icon instead of the wordmark. */
  mark?: boolean;
  /** Replay a short version on pointer enter. Default true. */
  replayOnHover?: boolean;
}

const PAPER = '#f4f5f3';
const SIGNAL = '#6fbf95';

/**
 * Block sizes as a fraction of the mark's height, coarse to fine. The last
 * step is about two device pixels; after it the clean mask takes over.
 */
const ENTRANCE = [0.2, 0.14, 0.1, 0.07, 0.05, 0.035, 0.024, 0.016, 0.01];
const REPLAY = [0.07, 0.035, 0.016];
const STEP_MS = 110;

/**
 * Resolves the logo out of coarse pixel blocks, then hands over to the clean
 * mark. Returns a function that cancels it and removes listeners.
 *
 * `root` must contain a `canvas[data-pixel-canvas]`. While the blocks are
 * showing, `root` carries `data-state="pixel"`; the stylesheet hides the clean
 * mark for that state and for `pending`, which a wrapper can set before first
 * paint so the clean mark never flashes ahead of the entrance.
 */
export function mountPixelLogo(root: HTMLElement, options: PixelLogoOptions = {}): () => void {
  const canvas = root.querySelector<HTMLCanvasElement>('canvas[data-pixel-canvas]');
  if (!canvas || prefersReducedMotion()) {
    delete root.dataset.state;
    return () => {};
  }

  const mark = options.mark ?? false;
  let cancelled = false;
  let running = false;
  let lastReplay = 0;
  let image: HTMLImageElement | null = null;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  };

  // Safety net: if the SVG never loads, show the clean mark anyway.
  later(() => {
    if (root.dataset.state === 'pending') delete root.dataset.state;
  }, 2500);

  const play = (steps: number[], assemble: boolean) => {
    if (running || !image || cancelled) return;
    const painter = createPainter(root, canvas, image, mark);
    if (!painter) {
      delete root.dataset.state;
      return;
    }
    running = true;
    root.dataset.state = 'pixel';
    steps.forEach((fraction, index) => {
      later(() => {
        // The coarse steps assemble rather than appear whole.
        const fill = assemble ? Math.min(1, 0.35 + (index / 3) * 0.65) : 1;
        painter.paint(fraction, fill, index);
      }, index * STEP_MS);
    });
    later(() => {
      painter.clear();
      delete root.dataset.state;
      running = false;
    }, steps.length * STEP_MS);
  };

  void loadImage(mark ? LOGO_ICON_URL : LOGO_TEXT_URL)
    .then((loaded) => {
      image = loaded;
      play(ENTRANCE, true);
      return loaded;
    })
    .catch(() => {
      delete root.dataset.state;
    });

  const onEnter = () => {
    const now = performance.now();
    if (now - lastReplay < 1200) return;
    lastReplay = now;
    play(REPLAY, false);
  };
  if (options.replayOnHover ?? true) root.addEventListener('pointerenter', onEnter);

  return () => {
    cancelled = true;
    for (const id of timers) clearTimeout(id);
    timers.clear();
    root.removeEventListener('pointerenter', onEnter);
    delete root.dataset.state;
  };
}

function createPainter(
  root: HTMLElement,
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  mark: boolean,
) {
  const rect = root.getBoundingClientRect();
  const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.round(rect.width * dpr));
  const h = Math.max(1, Math.round(rect.height * dpr));
  canvas.width = w;
  canvas.height = h;
  const context = canvas.getContext('2d');

  // Rendered once at device resolution; blocks sample its pixels.
  const scratch = document.createElement('canvas');
  scratch.width = w;
  scratch.height = h;
  const s = scratch.getContext('2d', { willReadFrequently: true });
  if (!context || !s) return null;
  s.drawImage(image, 0, 0, w, h);
  const data = s.getImageData(0, 0, w, h).data;

  const index = (x: number, y: number) => {
    const px = Math.min(w - 1, Math.max(0, Math.round(x)));
    const py = Math.min(h - 1, Math.max(0, Math.round(y)));
    return (py * w + px) * 4;
  };
  const covered = (x: number, y: number) => (data[index(x, y) + 3] ?? 0) > 127;
  // The icon's square is blue in the file; keep it the accent while pixelated.
  const isAccent = (x: number, y: number) => {
    if (!mark) return false;
    const i = index(x, y);
    const r = data[i] ?? 0;
    const b = data[i + 2] ?? 0;
    return b > 120 && b > r + 40;
  };

  return {
    paint(fraction: number, fill: number, salt: number) {
      const size = Math.max(2, Math.round(h * fraction));
      // A hairline gap on the coarse steps, so they read as pixels, not blur.
      const gap = size >= 10 ? Math.max(1, Math.round(size * 0.08)) : 0;
      const q = size / 4;
      context.clearRect(0, 0, w, h);
      for (let y = 0; y < h; y += size) {
        for (let x = 0; x < w; x += size) {
          // Four samples per block, so thin strokes survive the coarse steps.
          const hits =
            Number(covered(x + q, y + q)) +
            Number(covered(x + 3 * q, y + q)) +
            Number(covered(x + q, y + 3 * q)) +
            Number(covered(x + 3 * q, y + 3 * q));
          if (hits < 2) continue;
          const roll = hash(x / size, y / size, salt);
          if (roll > fill) continue;
          const flash = roll > fill - 0.06 && fill < 1;
          context.fillStyle = flash || isAccent(x + 2 * q, y + 2 * q) ? SIGNAL : PAPER;
          context.fillRect(x, y, size - gap, size - gap);
        }
      }
    },
    clear() {
      context.clearRect(0, 0, w, h);
    },
  };
}
