/// <reference types="jest" />

import {
  MaxQuoteLength,
  pickQuote,
  quoteStorageKey,
  quoteTypeScale,
  shouldShowQuote,
  type Quote,
  type QuoteDecisionInput,
} from '@/lib/daily-quote';

const QUOTES: Quote[] = [
  { id: 'q1', text: 'First', author: 'A' },
  { id: 'q2', text: 'Second', author: 'B' },
  { id: 'q3', text: 'Third', author: 'C' },
];

function input(overrides: Partial<QuoteDecisionInput> = {}): QuoteDecisionInput {
  return {
    resolved: true,
    userId: 'user-1',
    enabled: true,
    today: '2026-10-11',
    lastShown: null,
    quotes: QUOTES,
    ...overrides,
  };
}

describe('shouldShowQuote', () => {
  it('shows on a day it has not been shown', () => {
    expect(shouldShowQuote(input())).toBe(true);
  });

  it('stays hidden once dismissed today', () => {
    expect(shouldShowQuote(input({ lastShown: '2026-10-11' }))).toBe(false);
  });

  it('returns the next day', () => {
    expect(shouldShowQuote(input({ lastShown: '2026-10-10' }))).toBe(true);
  });

  it('respects the preference being off', () => {
    expect(shouldShowQuote(input({ enabled: false }))).toBe(false);
  });

  it('never shows when signed out', () => {
    expect(shouldShowQuote(input({ userId: null }))).toBe(false);
  });

  it('waits rather than skipping while the stored value is unread', () => {
    // The distinction that matters: unresolved is "not yet", not "no".
    expect(shouldShowQuote(input({ resolved: false }))).toBe(false);
    expect(shouldShowQuote(input({ resolved: true }))).toBe(true);
  });

  it('waits while the day key is unknown', () => {
    expect(shouldShowQuote(input({ today: null }))).toBe(false);
  });

  it('does not show an empty overlay when no quotes have loaded', () => {
    expect(shouldShowQuote(input({ quotes: [] }))).toBe(false);
  });

  it('shows once quotes arrive late', () => {
    expect(shouldShowQuote(input({ quotes: [] }))).toBe(false);
    expect(shouldShowQuote(input({ quotes: QUOTES }))).toBe(true);
  });
});

describe('pickQuote', () => {
  it('returns null for an empty list', () => {
    expect(pickQuote([])).toBeNull();
  });

  it('picks by the injected random value', () => {
    expect(pickQuote(QUOTES, () => 0)?.id).toBe('q1');
    expect(pickQuote(QUOTES, () => 0.5)?.id).toBe('q2');
    expect(pickQuote(QUOTES, () => 0.99)?.id).toBe('q3');
  });

  it('clamps rather than returning undefined at the boundary', () => {
    // Guards against a random() of exactly 1, which would index past the end.
    expect(pickQuote(QUOTES, () => 1)?.id).toBe('q3');
  });

  it('only ever returns a member of the list', () => {
    for (let i = 0; i < 200; i++) {
      const picked = pickQuote(QUOTES);
      expect(QUOTES).toContain(picked);
    }
  });

  it('handles a single-quote list', () => {
    const one: Quote[] = [{ id: 'only', text: 'T', author: 'A' }];
    expect(pickQuote(one, () => 0.999)?.id).toBe('only');
  });
});

describe('quoteStorageKey', () => {
  it('scopes the key per user', () => {
    expect(quoteStorageKey('a')).not.toBe(quoteStorageKey('b'));
    expect(quoteStorageKey('a')).toContain('a');
  });
});

describe('quoteTypeScale', () => {
  // Real device boxes, after the overlay's gutters and reserved space.
  const IPHONE_SE = { w: 375 - 64, h: 667 - 47 - 34 - 48 - 196 };
  const IPHONE_12 = { w: 390 - 64, h: 844 - 47 - 34 - 48 - 196 };
  const IPHONE_MAX = { w: 430 - 64, h: 932 - 59 - 34 - 48 - 196 };

  const chars = (n: number) => 'x'.repeat(n);

  /** Mirrors the estimate the implementation uses, to assert the result fits. */
  function predictedHeight(text: string, width: number, scale: { fontSize: number; lineHeight: number }) {
    const perLine = Math.max(1, Math.floor(width / (scale.fontSize * 0.54)));
    return (Math.ceil(text.trim().length / perLine) + 1) * scale.lineHeight;
  }

  it('gives a short quote genuinely large type', () => {
    const scale = quoteTypeScale(chars(50), IPHONE_12.w, IPHONE_12.h);
    // The old fixed tiers topped out at 27.
    expect(scale.fontSize).toBeGreaterThan(27);
  });

  it('never overflows the box it was given, at any length or screen', () => {
    // The property that matters. Everything else is taste.
    for (const box of [IPHONE_SE, IPHONE_12, IPHONE_MAX]) {
      for (let length = 1; length <= MaxQuoteLength; length += 7) {
        const text = chars(length);
        const scale = quoteTypeScale(text, box.w, box.h);
        expect(predictedHeight(text, box.w, scale)).toBeLessThanOrEqual(box.h);
      }
    }
  });

  it('never returns a line height at or below the font size', () => {
    // The clipping bug that has bitten this project twice already.
    for (let length = 1; length <= MaxQuoteLength; length += 11) {
      const scale = quoteTypeScale(chars(length), IPHONE_SE.w, IPHONE_SE.h);
      expect(scale.lineHeight).toBeGreaterThan(scale.fontSize);
    }
  });

  it('never grows as a quote gets longer', () => {
    let previous = Infinity;
    for (let length = 10; length <= MaxQuoteLength; length += 10) {
      const { fontSize } = quoteTypeScale(chars(length), IPHONE_12.w, IPHONE_12.h);
      expect(fontSize).toBeLessThanOrEqual(previous);
      previous = fontSize;
    }
  });

  it('gives a bigger screen type at least as large as a smaller one', () => {
    for (const length of [40, 120, 220, MaxQuoteLength]) {
      const small = quoteTypeScale(chars(length), IPHONE_SE.w, IPHONE_SE.h);
      const large = quoteTypeScale(chars(length), IPHONE_MAX.w, IPHONE_MAX.h);
      expect(large.fontSize).toBeGreaterThanOrEqual(small.fontSize);
    }
  });

  it('degrades to the smallest size rather than overflowing an absurd box', () => {
    const scale = quoteTypeScale(chars(MaxQuoteLength), 120, 60);
    expect(scale.fontSize).toBe(16);
    expect(scale.lineHeight).toBeGreaterThan(scale.fontSize);
  });

  it('ignores surrounding whitespace when measuring', () => {
    const bare = quoteTypeScale(chars(60), IPHONE_12.w, IPHONE_12.h);
    const padded = quoteTypeScale(`   ${chars(60)}   `, IPHONE_12.w, IPHONE_12.h);
    expect(padded).toEqual(bare);
  });
});

describe('optional attribution', () => {
  it('carries a null author through pickQuote', () => {
    const anon: Quote[] = [{ id: 'a', text: 'A proverb', author: null }];
    expect(pickQuote(anon)?.author).toBeNull();
  });
});
