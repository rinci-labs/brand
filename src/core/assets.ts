/**
 * The RINCI logo files, inlined. They are a few hundred bytes each, and as
 * strings they work in every bundler and in a CSS mask without asking the
 * consuming app to serve or copy anything.
 */
export const LOGO_ICON_SVG = "<svg xmlns=\"http://www.w3.org/2000/svg\" xml:space=\"preserve\" style=\"fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2\" viewBox=\"0 0 416 456\" width=\"416\" height=\"456\">\n  <path d=\"M313.922 0h101.393v101.393H313.922z\" style=\"fill:#2563eb\"/>\n  <path d=\"M101.393 101.393v354.424H0V101.393h.008V0h265.881v101.393z\"/>\n</svg>";

export const LOGO_TEXT_SVG = "<svg viewBox=\"0 0 1278 456\" xmlns=\"http://www.w3.org/2000/svg\" xml:space=\"preserve\" style=\"fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2\">\n  <path d=\"M467.417 455.817V151.992H771.86v.051h.227l.669 303.774H671.363l-.669-202.432H568.81v202.432zm658.502 0H820.746V151.374h.051v-.227h304.443V252.54H922.139v101.884h203.78zM1176.187 0h101.393v101.393h-101.393zM313.922 0h101.393v101.393H313.922zm0 151.827h101.393v303.99H313.922zm862.265 0h101.393v303.99h-101.393zM101.393 101.393v354.424H0V101.393h.008V0h265.881v101.393z\"/>\n</svg>";

const toDataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

export const LOGO_ICON_URL = toDataUrl(LOGO_ICON_SVG);
export const LOGO_TEXT_URL = toDataUrl(LOGO_TEXT_SVG);

/** Width / height of each file's viewBox. */
export const LOGO_ICON_RATIO = 416 / 456;
export const LOGO_TEXT_RATIO = 1278 / 456;

/**
 * Where the icon's accent square sits, as fractions of the icon box. The mask
 * paints the whole icon one colour, so the square is laid back over in signal.
 */
export const LOGO_ICON_ACCENT = { left: 0.7546, top: 0, width: 0.2437, height: 0.2224 } as const;
