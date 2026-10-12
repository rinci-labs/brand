import {
  type ElementType,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import {
  LOGO_ICON_ACCENT,
  LOGO_ICON_RATIO,
  LOGO_ICON_URL,
  LOGO_TEXT_RATIO,
  LOGO_TEXT_URL,
  mountAsciiField,
  mountPixelLogo,
  prefersReducedMotion,
  runScramble,
} from '../core/index.js';

/**
 * The RINCI mark in ASCII. Fills its parent; size and place the parent.
 * `energy` (0-1) is an outside push on the motion and can change every render.
 */
export function AsciiField({ className, energy = 0 }: { className?: string; energy?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const energyRef = useRef(energy);
  energyRef.current = energy;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let cleanup = () => {};
    void (async () => {
      try {
        const dispose = await mountAsciiField(canvas, { energy: () => energyRef.current });
        if (disposed) dispose();
        else cleanup = dispose;
      } catch {
        canvas.remove();
      }
    })();
    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={['rinci-ascii-field', className].filter(Boolean).join(' ')}
    />
  );
}

/**
 * The wordmark (or icon with `mark`): clean at rest, resolving out of pixel
 * blocks on mount, replaying on hover. `width` is in CSS pixels.
 */
export function PixelLogo({
  mark = false,
  width,
  className,
  label = 'RINCI',
}: {
  mark?: boolean;
  width: number;
  className?: string;
  label?: string;
}) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const ratio = mark ? LOGO_ICON_RATIO : LOGO_TEXT_RATIO;
  const src = mark ? LOGO_ICON_URL : LOGO_TEXT_URL;

  // Before paint, so the clean mark never flashes ahead of the entrance.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (!prefersReducedMotion()) root.dataset.state = 'pending';
    return mountPixelLogo(root, { mark });
  }, [mark]);

  return (
    <span
      ref={rootRef}
      role="img"
      aria-label={label}
      className={['rinci-pixel-logo', className].filter(Boolean).join(' ')}
      style={{ width, height: Math.round(width / ratio) }}
    >
      <span
        aria-hidden="true"
        data-pixel-ink=""
        style={{
          WebkitMask: `url("${src}") no-repeat center / contain`,
          mask: `url("${src}") no-repeat center / contain`,
        }}
      />
      {mark ? (
        <span
          aria-hidden="true"
          data-pixel-accent=""
          style={{
            left: `${LOGO_ICON_ACCENT.left * 100}%`,
            top: `${LOGO_ICON_ACCENT.top * 100}%`,
            width: `${LOGO_ICON_ACCENT.width * 100}%`,
            height: `${LOGO_ICON_ACCENT.height * 100}%`,
          }}
        />
      ) : null}
      <canvas aria-hidden="true" data-pixel-canvas="" />
    </span>
  );
}

/**
 * Text that decodes into place on mount (after `delay` ms) and on hover.
 * Screen readers get the real text throughout.
 */
export function ScrambleText({
  text,
  as: Tag = 'span',
  className,
  delay = 0,
}: {
  text: string;
  as?: ElementType;
  className?: string;
  delay?: number;
}) {
  const [shown, setShown] = useState(text);
  const cancel = useRef<(() => void) | null>(null);

  const play = useCallback(() => {
    if (cancel.current) return;
    cancel.current = runScramble(text, (frame) => {
      setShown(frame);
      if (frame === text) cancel.current = null;
    });
  }, [text]);

  useEffect(() => {
    setShown(text);
    const id = setTimeout(play, delay);
    return () => {
      clearTimeout(id);
      cancel.current?.();
      cancel.current = null;
    };
  }, [text, delay, play]);

  return (
    <Tag className={className} aria-label={text} onPointerEnter={play}>
      <span aria-hidden="true">{shown}</span>
    </Tag>
  );
}
