/**
 * WCAG contrast ratios for the palette.
 *
 * This exists because of a real bug: the Daily quote switch shipped with a pure
 * white on-state track behind a white thumb — a ratio of 1.00, an invisible
 * control. It was the second "invisible UI" defect in this project after text
 * clipped by a line height below its font size. Both were arithmetic that no
 * amount of reading the diff would catch, and both were obvious the moment the
 * app ran on a phone.
 *
 * So the arithmetic is a test now. See `contrast.test.ts`.
 *
 * Pure, with no React Native imports, so it runs under plain Node.
 */

/** The WCAG floor for a UI component or graphical object against its neighbour. */
export const MinComponentContrast = 3;

/** The WCAG AA floor for body text. */
export const MinTextContrast = 4.5;

function channels(hex: string): [number, number, number] {
  const value = hex.replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(value)) {
    throw new Error(`Expected a 6-digit hex colour, got "${hex}"`);
  }
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ];
}

/** sRGB gamma expansion, per the WCAG definition. */
function linearise(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(hex).map(linearise);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Contrast ratio between two colours, from 1 (identical) to 21 (black on white).
 *
 * Order-independent.
 */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}
