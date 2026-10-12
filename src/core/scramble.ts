import { prefersReducedMotion } from './motion.js';

/** The glyphs the ASCII field is drawn in, so labels decode out of the same set. */
export const SCRAMBLE_GLYPHS = '#+-.:=*/';

/**
 * Plays a decode: each character cycles through glyphs, then settles, left to
 * right. `render` receives every frame's string, ending with `text` itself.
 * Returns a cancel function. Under reduced motion it renders `text` once.
 */
export function runScramble(
  text: string,
  render: (frame: string) => void,
  duration = 520,
): () => void {
  if (prefersReducedMotion()) {
    render(text);
    return () => {};
  }

  let frame = 0;
  const start = performance.now();
  const tick = (now: number) => {
    const progress = Math.min(1, (now - start) / duration);
    let out = '';
    for (let i = 0; i < text.length; i++) {
      const char = text.charAt(i);
      const settled = i / text.length < progress * 1.15 - 0.15;
      out +=
        settled || char === ' '
          ? char
          : SCRAMBLE_GLYPHS.charAt((Math.random() * SCRAMBLE_GLYPHS.length) | 0);
    }
    if (progress < 1) {
      render(out);
      frame = requestAnimationFrame(tick);
    } else {
      render(text);
    }
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}

/**
 * Decodes elements' text when they scroll into view, and again on hover. The
 * real text stays in `aria-label`, and each element's width is held while it
 * runs so a button does not twitch as glyph widths change. Returns a cleanup.
 */
export function observeScramble(elements: Iterable<HTMLElement>): () => void {
  if (prefersReducedMotion()) return () => {};

  const running = new WeakSet<HTMLElement>();
  const play = (el: HTMLElement) => {
    if (running.has(el)) return;
    running.add(el);
    const text = (el.dataset.text ??= el.textContent?.trim() ?? '');
    el.setAttribute('aria-label', text);
    el.style.minWidth = `${el.offsetWidth}px`;
    runScramble(text, (frame) => {
      el.textContent = frame;
      if (frame === text) {
        el.style.minWidth = '';
        running.delete(el);
      }
    });
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        play(entry.target as HTMLElement);
      }
    },
    { rootMargin: '0px 0px -15% 0px' },
  );

  const listeners: Array<[HTMLElement, () => void]> = [];
  for (const el of elements) {
    observer.observe(el);
    const onEnter = () => play(el);
    el.addEventListener('pointerenter', onEnter);
    listeners.push([el, onEnter]);
  }

  return () => {
    observer.disconnect();
    for (const [el, onEnter] of listeners) el.removeEventListener('pointerenter', onEnter);
  };
}
