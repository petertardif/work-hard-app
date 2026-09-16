import { type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Spacing } from '@/constants/theme';

export type ScreenProps = {
  children: ReactNode;
  /**
   * Horizontal padding. The mockups use 24 on Today and 20 on the denser
   * list-style screens.
   */
  gutter?: number;
  /** Wrap the content in a ScrollView. Off for screens that pin a footer. */
  scroll?: boolean;
  contentStyle?: ViewStyle;
};

/**
 * The black canvas every screen sits on.
 *
 * The mockups bake the iOS status bar into their 64–72px top padding; here the
 * real safe-area inset does that job so the layout holds on any device.
 */
export function Screen({ children, gutter = Spacing.four, scroll = false, contentStyle }: ScreenProps) {
  const insets = useSafeAreaInsets();

  const padding: ViewStyle = {
    paddingTop: insets.top + Spacing.three,
    paddingBottom: insets.bottom + Spacing.four,
    paddingHorizontal: gutter,
  };

  if (scroll) {
    return (
      <ScrollView
        style={styles.root}
        contentContainerStyle={[padding, contentStyle]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    );
  }

  return <View style={[styles.root, padding, contentStyle]}>{children}</View>;
}

/** Pushes whatever follows it to the bottom of a non-scrolling screen. */
export function Spacer() {
  return <View style={styles.spacer} />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  spacer: {
    flex: 1,
  },
});
