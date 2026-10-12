import { LOGO_ICON_URL } from './assets.js';
import { hash, loadImage, prefersReducedMotion } from './motion.js';

export interface AsciiFieldOptions {
  /**
   * An outside push on the motion, 0-1, read every frame. The redirect page
   * raises it as its countdown runs out, so the field gathers before leaving.
   */
  energy?: () => number;
  /** Where pointer movement is tracked. Defaults to the window, because page
   * content usually sits on top of the canvas. */
  pointerTarget?: EventTarget;
  /** Mark height as a share of the canvas height. Default 0.82. */
  scale?: number;
  /** Tilt in radians. Default -0.12. */
  rotation?: number;
}

/** Sparse to dense. Index 0 is an empty cell. */
const RAMP = [' ', '.', '-', '+', '#'] as const;
const PAPER_ALPHA = [0, 0.16, 0.22, 0.32, 0.46];
const SIGNAL_ALPHA = [0, 0.35, 0.5, 0.7, 0.9];
const PAPER = '244, 245, 243';
const SIGNAL = '111, 191, 149';

const FRAME_MS = 1000 / 30;
const INTRO_MS = 1800;
/** Mask supersampling per cell. */
const SS = 2;

/** Smooth value noise. Enough for streaks; no need for gradient noise. */
function noise(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/**
 * Draws the RINCI mark in monospace characters onto `canvas` and keeps it
 * moving. Returns a function that stops everything and removes listeners.
 *
 * Each cell reads how much of the mark covers it and picks a glyph by density,
 * from `#` in the solid body to `.` at the frayed edges. Rows drift on their
 * own waves and the noise is stretched along them, so the raster reads as
 * moving under water; the pointer drops ripples into the same field.
 *
 * Canvas blits from a glyph atlas at 30fps. The loop stops whenever the canvas
 * is off screen or the tab is hidden, and under reduced motion one still frame
 * is drawn instead. Sets `data-ready` on the canvas once the first frame is
 * ready, which the stylesheet uses to fade it in.
 */
export async function mountAsciiField(
  canvas: HTMLCanvasElement,
  options: AsciiFieldOptions = {},
): Promise<() => void> {
  const found = canvas.getContext('2d');
  if (!found) return () => {};
  const context: CanvasRenderingContext2D = found;

  const reduced = prefersReducedMotion();
  const scale = options.scale ?? 0.82;
  const rotation = options.rotation ?? -0.12;
  const outside = options.energy ?? (() => 0);

  const [image] = await Promise.all([
    loadImage(LOGO_ICON_URL),
    document.fonts?.load("12px 'Geist Mono'").catch(() => undefined),
  ]);

  let width = 0;
  let height = 0;
  let dpr = 1;
  let cellW = 0;
  let cellH = 0;
  let cols = 0;
  let rows = 0;
  let maskW = 0;
  let maskH = 0;
  let coverage = new Float32Array(0);
  let accent = new Uint8Array(0);
  let halo = new Float32Array(0);
  let atlas: HTMLCanvasElement | null = null;
  let glyphW = 0;
  let glyphH = 0;
  const pointer = { x: -9999, y: -9999, energy: 0 };

  function buildAtlas(fontSize: number) {
    const next = document.createElement('canvas');
    glyphW = Math.ceil(cellW * dpr);
    glyphH = Math.ceil(cellH * dpr);
    next.width = glyphW * RAMP.length;
    next.height = glyphH * 2;
    const a = next.getContext('2d');
    if (!a) return;
    a.font = `${fontSize * dpr}px "Geist Mono", ui-monospace, monospace`;
    a.textAlign = 'center';
    a.textBaseline = 'middle';
    RAMP.forEach((glyph, index) => {
      if (index === 0) return;
      a.fillStyle = `rgba(${PAPER}, ${PAPER_ALPHA[index]})`;
      a.fillText(glyph, glyphW * (index + 0.5), glyphH * 0.5);
      a.fillStyle = `rgba(${SIGNAL}, ${SIGNAL_ALPHA[index]})`;
      a.fillText(glyph, glyphW * (index + 0.5), glyphH * 1.5);
    });
    atlas = next;
  }

  function drawMark(m: CanvasRenderingContext2D) {
    // Sized in screen pixels, then mapped into cell space, so cells that are
    // taller than they are wide do not squash the mark.
    const markH = Math.min(height * scale, width * 1.05);
    const markW = (markH * image.naturalWidth) / image.naturalHeight;
    m.setTransform(SS / cellW, 0, 0, SS / cellH, 0, 0);
    m.translate(width * 0.5, height * 0.5);
    m.rotate(rotation);
    m.drawImage(image, -markW / 2, -markH / 2, markW, markH);
  }

  function buildMask() {
    maskW = cols * SS;
    maskH = rows * SS;
    const mask = document.createElement('canvas');
    mask.width = maskW;
    mask.height = maskH;
    const m = mask.getContext('2d', { willReadFrequently: true });
    if (!m) return;

    drawMark(m);
    const data = m.getImageData(0, 0, maskW, maskH).data;
    coverage = new Float32Array(maskW * maskH);
    accent = new Uint8Array(maskW * maskH);
    for (let i = 0; i < coverage.length; i++) {
      const r = data[i * 4] ?? 0;
      const b = data[i * 4 + 2] ?? 0;
      coverage[i] = (data[i * 4 + 3] ?? 0) / 255;
      // The square is the blue part of the icon; the body is black.
      accent[i] = b > 120 && b > r + 40 ? 1 : 0;
    }

    m.setTransform(1, 0, 0, 1, 0, 0);
    m.clearRect(0, 0, maskW, maskH);
    m.filter = `blur(${SS * 5}px)`;
    drawMark(m);
    const blurred = m.getImageData(0, 0, maskW, maskH).data;
    halo = new Float32Array(maskW * maskH);
    for (let i = 0; i < halo.length; i++) halo[i] = (blurred[i * 4 + 3] ?? 0) / 255;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    if (!width || !height) return;
    dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const fontSize = width < 640 ? 10 : 12;
    context.font = `${fontSize}px "Geist Mono", ui-monospace, monospace`;
    cellW = context.measureText('#').width || fontSize * 0.6;
    // Taller than the glyph, so rows separate into horizontal bands.
    cellH = fontSize * 1.32;
    cols = Math.ceil(width / cellW);
    rows = Math.ceil(height / cellH);
    buildAtlas(fontSize);
    buildMask();
  }

  const sample = (field: Float32Array | Uint8Array, x: number, y: number) => {
    const mx = Math.round(x * SS);
    const my = Math.round(y * SS);
    if (mx < 0 || my < 0 || mx >= maskW || my >= maskH) return 0;
    return field[my * maskW + mx] ?? 0;
  };

  function draw(time: number) {
    if (!atlas) return;
    const t = time / 1000;
    const intro = reduced ? 1 : Math.min(1, time / INTRO_MS);
    const introEase = 1 - Math.pow(1 - intro, 3);
    const push = reduced ? 0 : Math.min(1, Math.max(0, outside()));
    const drift = t * (1 + push * 1.6);

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);

    // Pointer in cell units, rows scaled to columns so ripples stay round.
    const px = pointer.x / cellW;
    const py = pointer.y / cellH;
    const aspect = cellH / cellW;
    const energy = pointer.energy;

    for (let row = 0; row < rows; row++) {
      // Each row slides on its own wave. Two frequencies, so the motion never
      // settles into an obvious period.
      const rowShift = reduced
        ? 0
        : (Math.sin(row * 0.38 + drift * 1.3) * 0.9 + Math.sin(row * 0.11 - drift * 0.55) * 1.8) *
          (1 + push * 1.5);

      for (let col = 0; col < cols; col++) {
        let shift = rowShift;
        let lift = 0;

        // The pointer drops a stone: rings travel outward, pushing rows
        // sideways and lighting up empty water as they pass.
        if (energy > 0.01) {
          const dx = col - px;
          const dy = (row - py) * aspect;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < 48) {
            const wave = Math.sin(distance * 0.6 - t * 8);
            shift += wave * 2.8 * Math.exp(-distance / 16) * energy;
            lift = Math.max(0, wave) * Math.exp(-distance / 11) * energy;
          }
        }

        const sx = col + shift;
        const cover = sample(coverage, sx, row);
        const near = sample(halo, sx, row);
        if (cover < 0.02 && near < 0.04 && lift < 0.05) continue;

        // Streaks: noise stretched along the row, drifting sideways.
        const band = noise(col * 0.07 - drift * 0.35, row * 0.85 + drift * 0.12);
        let value = cover * (0.35 + band * 0.85 + push * 0.25);

        if (cover < 0.5) {
          // Stray glyphs around the mark, reshuffled a few times a second so
          // the edge fizzes instead of sitting still.
          const tick = reduced ? 0 : Math.floor(t * (3 + push * 6));
          if (hash(col, row, tick) < near * (0.32 + push * 0.4)) {
            value = Math.max(value, 0.2 + band * 0.25);
          }
        }

        value += lift * (0.45 + band * 0.6);

        // Intro: cells arrive in a noisy sweep from the left.
        if (introEase < 1) {
          const gate = col / cols + (hash(col, row) - 0.5) * 0.35;
          if (gate > introEase * 1.35 - 0.2) continue;
        }

        const step = value < 0.12 ? 0 : value < 0.3 ? 1 : value < 0.5 ? 2 : value < 0.68 ? 3 : 4;
        if (step === 0) continue;

        const tone = sample(accent, sx, row) ? 1 : 0;
        context.drawImage(
          atlas,
          step * glyphW,
          tone * glyphH,
          glyphW,
          glyphH,
          Math.round(col * cellW * dpr),
          Math.round(row * cellH * dpr),
          glyphW,
          glyphH,
        );
      }
    }
  }

  resize();
  canvas.dataset.ready = '';

  const resizer = new ResizeObserver(() => {
    resize();
    if (reduced) draw(INTRO_MS);
  });
  resizer.observe(canvas);

  if (reduced) {
    draw(INTRO_MS);
    return () => resizer.disconnect();
  }

  const target = options.pointerTarget ?? globalThis;
  const onMove = (event: Event) => {
    const { clientX, clientY } = event as PointerEvent;
    const rect = canvas.getBoundingClientRect();
    pointer.x = clientX - rect.left;
    pointer.y = clientY - rect.top;
    pointer.energy = 1;
  };
  target.addEventListener('pointermove', onMove);

  let visible = true;
  let frame = 0;
  let last = 0;
  const start = performance.now();

  const loop = (now: number) => {
    frame = 0;
    if (!visible || document.hidden) return;
    frame = requestAnimationFrame(loop);
    if (now - last < FRAME_MS) return;
    last = now;
    // The ripple fades on its own once the pointer stops.
    pointer.energy *= 0.965;
    draw(now - start);
  };
  const kick = () => {
    if (!frame && visible && !document.hidden) frame = requestAnimationFrame(loop);
  };

  const observer = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? true;
    kick();
  });
  observer.observe(canvas);
  document.addEventListener('visibilitychange', kick);
  kick();

  return () => {
    cancelAnimationFrame(frame);
    resizer.disconnect();
    observer.disconnect();
    target.removeEventListener('pointermove', onMove);
    document.removeEventListener('visibilitychange', kick);
  };
}
