import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { Glyph, type GlyphKind } from '@/components/glyph';
import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily } from '@/constants/theme';

/**
 * The launch animation from design 2b: pickaxe, ant, sledge, then the words.
 *
 * The mockup's keyframes run over 8.4s, which reads as a canvas demo loop
 * rather than a real cold open — nobody should wait that long to see their
 * tasks. The same beats are compressed here, then the wordmark holds for about
 * three seconds before handing over. Adjust `GLYPH_MS`, `WORD_MS` and
 * `WORD_HOLD_MS` to taste.
 *
 * Uses React Native's core Animated rather than Reanimated so it carries no
 * Babel-plugin dependency; it is a plain opacity/scale sequence on the native
 * driver either way.
 */
const SEQUENCE: GlyphKind[] = ['pickaxe', 'ant', 'sledge'];
const GLYPH_MS = { in: 180, hold: 240, out: 180 };
const WORD_MS = 500;
/**
 * How long the wordmark stays up once it has faded in.
 *
 * With the 500ms fade before it, that is one second of “Work Hard” on screen.
 * Without any hold the sequence called `onDone` the instant the fade finished,
 * so the wordmark was gone almost as soon as it arrived.
 */
const WORD_HOLD_MS = 500;

export function ColdOpen({ onDone }: { onDone: () => void }) {
  const glyphValues = useRef(SEQUENCE.map(() => new Animated.Value(0))).current;
  const word = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const beats = glyphValues.flatMap((value) => [
      Animated.timing(value, {
        toValue: 1,
        duration: GLYPH_MS.in,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.delay(GLYPH_MS.hold),
      Animated.timing(value, {
        toValue: 2,
        duration: GLYPH_MS.out,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    const animation = Animated.sequence([
      ...beats,
      Animated.timing(word, {
        toValue: 1,
        duration: WORD_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.delay(WORD_HOLD_MS),
    ]);

    animation.start(({ finished }) => {
      if (finished) onDone();
    });

    return () => animation.stop();
    // Runs once; `onDone` is held in a ref-stable closure by the caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.root}>
      <View style={styles.stage}>
        {SEQUENCE.map((kind, i) => (
          <Animated.View
            key={kind}
            style={[
              styles.layer,
              {
                // 0 → hidden and small, 1 → visible, 2 → gone and slightly large.
                opacity: glyphValues[i].interpolate({
                  inputRange: [0, 1, 2],
                  outputRange: [0, 1, 0],
                }),
                transform: [
                  {
                    scale: glyphValues[i].interpolate({
                      inputRange: [0, 1, 2],
                      outputRange: [0.9, 1, 1.1],
                    }),
                  },
                ],
              },
            ]}>
            <Glyph kind={kind} size={92} />
          </Animated.View>
        ))}

        <Animated.View
          style={[
            styles.layer,
            {
              opacity: word,
              transform: [
                { scale: word.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
              ],
            },
          ]}>
          {/* Two Texts rather than one with a newline: each line needs a line
              box at least as tall as the font, or React Native clips the tops
              of the letters. The tight wordmark leading the design asks for
              comes from pulling the second line up instead. */}
          <ThemedText style={styles.word}>Work</ThemedText>
          <ThemedText style={[styles.word, styles.wordSecondLine]}>Hard</ThemedText>
        </Animated.View>
      </View>
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
    backgroundColor: Colors.dark.background,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  stage: {
    width: 220,
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
  },
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  word: {
    fontFamily: FontFamily.bold,
    fontSize: 44,
    // Font size plus a small cushion for Spline Sans Bold's ascenders. The
    // design's `line-height: .92` (41px) is below the font size and clips.
    lineHeight: 46,
    letterSpacing: -1.32,
    color: Colors.dark.text,
    textTransform: 'uppercase',
    textAlign: 'center',
    includeFontPadding: false,
  },
  // 46 - 5 restores the design's 41px visual leading without starving either
  // line's box.
  wordSecondLine: {
    marginTop: -5,
  },
});
