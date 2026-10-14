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
  const words = (n: number) => 'x'.repeat(n);

  it('uses the largest size for a short quote', () => {
    expect(quoteTypeScale(words(40)).fontSize).toBe(27);
    expect(quoteTypeScale(words(90)).fontSize).toBe(27);
  });

  it('steps down once past the one-screen threshold', () => {
    expect(quoteTypeScale(words(91)).fontSize).toBe(22);
    expect(quoteTypeScale(words(180)).fontSize).toBe(22);
  });

  it('steps down again for a long passage', () => {
    expect(quoteTypeScale(words(181)).fontSize).toBe(18);
    expect(quoteTypeScale(words(MaxQuoteLength)).fontSize).toBe(18);
  });

  it('keeps line height above font size at every tier', () => {
    // The clipping bug that bit the day numeral and the wordmark: a line box
    // shorter than the font crops the glyphs.
    for (const length of [10, 90, 91, 180, 181, MaxQuoteLength]) {
      const scale = quoteTypeScale(words(length));
      expect(scale.lineHeight).toBeGreaterThan(scale.fontSize);
    }
  });

  it('ignores surrounding whitespace when measuring', () => {
    expect(quoteTypeScale(`   ${words(40)}   `).fontSize).toBe(27);
  });
});

describe('optional attribution', () => {
  it('carries a null author through pickQuote', () => {
    const anon: Quote[] = [{ id: 'a', text: 'A proverb', author: null }];
    expect(pickQuote(anon)?.author).toBeNull();
  });
});
