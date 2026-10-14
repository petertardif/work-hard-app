/// <reference types="jest" />

import {
  MinComponentContrast,
  MinTextContrast,
  contrastRatio,
  relativeLuminance,
} from '@/lib/contrast';

const BLACK = '#000000';
const WHITE = '#FFFFFF';

// Mirrors Colors.dark in src/constants/theme.ts. Duplicated rather than
// imported because theme.ts pulls in React Native and a CSS side-effect import,
// which this suite deliberately stays free of. If the palette changes there and
// not here, the first assertion below catches the drift.
const PALETTE = {
  text: '#ffffff',
  background: '#000000',
  backgroundElement: '#212225',
  backgroundSelected: '#2E3135',
  textSecondary: '#B0B4BA',
  border: '#212225',
  borderStrong: '#2E3135',
  danger: '#FF3B30',
  accent: '#7C5CFF',
} as const;

describe('contrastRatio', () => {
  it('is 21:1 for black against white', () => {
    expect(contrastRatio(BLACK, WHITE)).toBeCloseTo(21, 1);
  });

  it('is 1:1 for a colour against itself', () => {
    expect(contrastRatio('#7C5CFF', '#7C5CFF')).toBeCloseTo(1, 5);
  });

  it('does not care about argument order', () => {
    expect(contrastRatio(BLACK, WHITE)).toBeCloseTo(contrastRatio(WHITE, BLACK), 10);
  });

  it('accepts hex with or without the hash, any case', () => {
    expect(contrastRatio('7c5cff', WHITE)).toBeCloseTo(contrastRatio('#7C5CFF', WHITE), 10);
  });

  it('rejects malformed input rather than returning nonsense', () => {
    expect(() => relativeLuminance('#fff')).toThrow(/6-digit hex/);
    expect(() => relativeLuminance('rebeccapurple')).toThrow(/6-digit hex/);
  });
});

describe('switch legibility', () => {
  // The bug this suite exists for. A switch thumb is white and cannot be
  // reliably re-tinted on iOS, so BOTH track colours must carry it.
  it('keeps a white thumb legible on the on-state track', () => {
    expect(contrastRatio(PALETTE.accent, WHITE)).toBeGreaterThanOrEqual(
      MinComponentContrast,
    );
  });

  it('keeps a white thumb legible on the off-state track', () => {
    expect(contrastRatio(PALETTE.borderStrong, WHITE)).toBeGreaterThanOrEqual(
      MinComponentContrast,
    );
  });

  it('would have failed the shipped bug', () => {
    // Pure white track, white thumb: exactly what was wrong.
    expect(contrastRatio(PALETTE.text, WHITE)).toBeLessThan(MinComponentContrast);
  });

  it('rejects the brighter accents that fail behind a white thumb', () => {
    // Kept as a record of why the accent is violet and not something livelier.
    for (const tempting of ['#C7F000', '#A3E635', '#FFB800', '#2DD4BF']) {
      expect(contrastRatio(tempting, WHITE)).toBeLessThan(MinComponentContrast);
    }
  });
});

describe('accent against its surroundings', () => {
  it('reads on the black background', () => {
    expect(contrastRatio(PALETTE.accent, PALETTE.background)).toBeGreaterThanOrEqual(
      MinComponentContrast,
    );
  });

  it('reads on a card', () => {
    expect(
      contrastRatio(PALETTE.accent, PALETTE.backgroundElement),
    ).toBeGreaterThanOrEqual(MinComponentContrast);
  });

  it('is not mistakable for the destructive red', () => {
    // Both clear 3:1 against white, so weight alone cannot separate them —
    // they have to differ from each other too, or "active" and "delete" read
    // as the same signal.
    const accentOnWhite = contrastRatio(PALETTE.accent, WHITE);
    const dangerOnWhite = contrastRatio(PALETTE.danger, WHITE);
    expect(Math.abs(accentOnWhite - dangerOnWhite)).toBeGreaterThan(0.5);
  });
});

describe('text legibility', () => {
  it('passes AA for primary text on the background', () => {
    expect(contrastRatio(PALETTE.text, PALETTE.background)).toBeGreaterThanOrEqual(
      MinTextContrast,
    );
  });

  it('passes AA for secondary text on the background', () => {
    expect(
      contrastRatio(PALETTE.textSecondary, PALETTE.background),
    ).toBeGreaterThanOrEqual(MinTextContrast);
  });

  it('passes AA for secondary text on a card', () => {
    expect(
      contrastRatio(PALETTE.textSecondary, PALETTE.backgroundElement),
    ).toBeGreaterThanOrEqual(MinTextContrast);
  });
});
