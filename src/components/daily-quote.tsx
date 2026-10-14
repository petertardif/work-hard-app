import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button, MonoLabel } from '@/components/ui-kit';
import { Colors, FontFamily, Spacing } from '@/constants/theme';
import { deviceTimezone } from '@/constants/timezones';
import { useProfile, useQuotes } from '@/hooks/use-work-hard';
import { normaliseDayEndsAt, todayKey } from '@/lib/api';
import {
  pickQuote,
  quoteStorageKey,
  quoteTypeScale,
  shouldShowQuote,
  type Quote,
} from '@/lib/daily-quote';

/**
 * `hidden` is terminal for the life of this mount.
 *
 * The decision depends on three things that resolve independently — the stored
 * day key, the profile and the quote list — so the effect below re-runs as they
 * land. Without a terminal state a late arrival could resurrect an overlay the
 * user had already dismissed.
 */
type Status = 'deciding' | 'showing' | 'hidden';

/**
 * The daily motivation overlay.
 *
 * Mounted between `<Stack>` and `<ColdOpen>` in the root layout, which is what
 * keeps the app from ever being seen loading: the cold open covers everything
 * for its first couple of seconds, and this is already painted opaque
 * underneath by the time it unmounts.
 *
 * Renders nothing at all unless it is actually this user's first launch of the
 * day, so on every other launch it costs one AsyncStorage read.
 */
export function DailyQuoteGate({ userId }: { userId: string | null }) {
  const { data: profile } = useProfile();
  const { data: quotes } = useQuotes();

  const [status, setStatus] = useState<Status>('deciding');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [lastShown, setLastShown] = useState<string | null>(null);
  const [storageRead, setStorageRead] = useState(false);

  // Read the stored day key once per user.
  useEffect(() => {
    if (!userId) {
      setStorageRead(true);
      return;
    }

    let active = true;
    AsyncStorage.getItem(quoteStorageKey(userId))
      .then((value) => {
        if (!active) return;
        setLastShown(value);
        setStorageRead(true);
      })
      .catch(() => {
        // A failed read should not swallow the feature; treat it as never shown.
        if (active) setStorageRead(true);
      });

    return () => {
      active = false;
    };
  }, [userId]);

  const available: Quote[] = (quotes ?? []).map((q) => ({
    id: q.id,
    text: q.text,
    author: q.author,
  }));

  // The user's own day boundary decides which day this is, not device midnight
  // — the same reckoning the Today screen uses.
  const today = profile
    ? todayKey(profile.timezone, normaliseDayEndsAt(profile.day_ends_at))
    : userId
      ? null
      : todayKey(deviceTimezone(), '00:00');

  useEffect(() => {
    if (status !== 'deciding') return;

    const show = shouldShowQuote({
      resolved: storageRead && (!userId || !!profile),
      userId,
      enabled: profile?.show_daily_quote !== false,
      today,
      lastShown,
      quotes: available,
    });

    if (!show) return;

    // Chosen once, here — picking during render would reshuffle the quote on
    // every re-render.
    setQuote(pickQuote(available));
    setStatus('showing');
  }, [status, storageRead, userId, profile, today, lastShown, available]);

  function dismiss() {
    setStatus('hidden');
    if (userId && today) {
      void AsyncStorage.setItem(quoteStorageKey(userId), today).catch(() => {
        // Worst case the quote shows again later today. Not worth surfacing.
      });
    }
  }

  if (status !== 'showing' || !quote) return null;

  return <QuoteOverlay quote={quote} onDismiss={dismiss} />;
}

/**
 * Space the overlay reserves for everything that is not the quote itself:
 * the dismiss button, the attribution line, and enough air that the text never
 * crowds either. Subtracted from the screen before the type size is chosen.
 */
const RESERVED_HEIGHT = 56 + 24 + 44 + 72;

/** Horizontal breathing room. Wider than the app's usual gutter — this is a
 *  reading surface, not a list. */
const QUOTE_GUTTER = 32;

function QuoteOverlay({ quote, onDismiss }: { quote: Quote; onDismiss: () => void }) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const fade = useRef(new Animated.Value(0)).current;

  // Measured against the real screen rather than assumed, so the same quote is
  // as large as it can be on any device without ever running off the page.
  const availableWidth = screenWidth - QUOTE_GUTTER * 2;
  const availableHeight =
    screenHeight - insets.top - insets.bottom - Spacing.four * 2 - RESERVED_HEIGHT;
  const scale = quoteTypeScale(quote.text, availableWidth, availableHeight);

  // The backdrop is opaque from the first frame — that is what prevents the
  // flash — while the words ease in, so the handoff from the cold open's
  // wordmark is not a hard cut.
  useEffect(() => {
    const animation = Animated.timing(fade, {
      toValue: 1,
      duration: 400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [fade]);

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + Spacing.four },
      ]}>
      {/* 2 above, 3 below: biases the text above centre and scales with the
          screen instead of relying on a fixed offset. */}
      <View style={styles.spacerTop} />

      <Animated.View style={{ opacity: fade }}>
        <ThemedText style={styles.quote}>{`“${quote.text}”`}</ThemedText>
        <MonoLabel style={styles.author}>{quote.author}</MonoLabel>
      </Animated.View>

      <View style={styles.spacerBottom} />

      <Animated.View style={{ opacity: fade }}>
        <Button label="Begin" onPress={onDismiss} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // Opaque, and above the Stack it covers.
    backgroundColor: Colors.dark.background,
    paddingHorizontal: QUOTE_GUTTER,
    zIndex: 50,
  },
  spacerTop: {
    flex: 2,
  },
  spacerBottom: {
    flex: 3,
  },
  quote: {
    fontFamily: FontFamily.medium,
    // fontSize and lineHeight come from quoteTypeScale().
    letterSpacing: -0.4,
    color: Colors.dark.text,
    textAlign: 'center',
  },
  author: {
    marginTop: Spacing.four,
    textAlign: 'center',
  },
});
