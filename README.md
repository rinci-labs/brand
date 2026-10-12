# @rinci/brand

The RINCI brand system, shared by rin.ci, link.rin.ci and anything else that wears the brand.

- **Colours**: off-black `ink`, `paper` type, `dim` / `faint` greys, hairline `line`, and the one accent, `signal`.
- **Type**: Geist, Geist Mono and Geist Pixel. The fonts ship with the package.
- **The ASCII mark**: the RINCI icon drawn in monospace characters, moving like water, with pointer ripples.
- **The pixel logo**: the wordmark or icon, clean at rest, resolving out of pixel blocks on load and on hover.
- **Text scramble**: labels that decode through the ASCII glyphs.

All motion respects `prefers-reduced-motion`.

## Install

```sh
bun add @rinci/brand
```

## Tailwind CSS v4

```css
@import 'tailwindcss';
@import '@rinci/brand/tailwind.css';
```

This adds:

| Kind | Names |
| --- | --- |
| Colours | `ink`, `ink-2`, `paper`, `dim`, `faint`, `line`, `signal` (e.g. `bg-ink`, `text-signal`) |
| Fonts | `font-brand`, `font-brand-mono`, `font-pixel` |
| Utilities | `brand` (page root), `pixel-type` (pixel labels), `brand-in` (load entrance, stagger with `--brand-delay`), `reveal` (scroll reveal), `pixel-grid` |

The names sit beside a component library's theme instead of replacing its `--font-sans` or `--primary`, so a dashboard on another theme is unaffected.

Without Tailwind, import `@rinci/brand/components.css` for the fonts, the `--rinci-*` colour variables and the component styles.

## React

```tsx
import { AsciiField, PixelLogo, ScrambleText } from '@rinci/brand/react';

<div className="absolute inset-0 -z-10">
  <AsciiField energy={progress} />
</div>
<PixelLogo width={82} />
<PixelLogo mark width={22} />
<ScrambleText as="p" text="Leaving l.rin.ci" className="pixel-type" />
```

`AsciiField` fills its parent, so size and place the parent. `energy` (0 to 1) speeds the motion up, for example as a countdown runs out.

## Astro

```astro
---
import AsciiField from '@rinci/brand/astro/AsciiField.astro';
import PixelLogo from '@rinci/brand/astro/PixelLogo.astro';
---

<div class="absolute inset-0 -z-10"><AsciiField /></div>
<PixelLogo />              <!-- fills its container's width -->
<PixelLogo mark width={22} />
```

## Framework-free

```ts
import { mountAsciiField, mountPixelLogo, observeScramble } from '@rinci/brand';

const stop = await mountAsciiField(canvas, { energy: () => progress });
observeScramble(document.querySelectorAll('[data-scramble]'));
```

The logo files are exported as strings and data URLs (`LOGO_TEXT_SVG`, `LOGO_ICON_URL`, ...), and as files under `@rinci/brand/assets/`.

## Publishing

Push a version tag and the workflow publishes with provenance:

```sh
npm version patch
git push --follow-tags
```

It needs an `NPM_TOKEN` repository secret: an npm automation token with publish rights on the `@rinci` org.

## License

Code: MIT. Fonts: the Geist typefaces, SIL Open Font License 1.1 (`fonts/OFL.txt`).
