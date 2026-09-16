/**
 * The handful of shapes the design repeats across every screen.
 *
 * The mockups are visually dense but structurally narrow — a grouped card, an
 * uppercase mono caption, two button treatments and a section header cover
 * almost all of it.
 */

import { type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing, Typography } from '@/constants/theme';

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

export type MonoLabelProps = {
  children: ReactNode;
  /** The 11px variant used for section headers; 12px otherwise. */
  small?: boolean;
  /** Labels are secondary grey unless they carry emphasis. */
  bright?: boolean;
  style?: StyleProp<TextStyle>;
};

export function MonoLabel({ children, small, bright, style }: MonoLabelProps) {
  return (
    <ThemedText
      type={small ? 'monoLabelSmall' : 'monoLabel'}
      themeColor={bright ? 'text' : 'textSecondary'}
      style={style}>
      {children}
    </ThemedText>
  );
}

// ---------------------------------------------------------------------------
// Containers
// ---------------------------------------------------------------------------

export type CardProps = {
  children: ReactNode;
  /** Outlined rather than filled — used for the active run and archived rows. */
  outlined?: boolean;
  /** A white border marks the one active list. */
  emphasised?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Card({ children, outlined, emphasised, style }: CardProps) {
  return (
    <View
      style={[
        styles.card,
        outlined || emphasised ? styles.cardOutlined : styles.cardFilled,
        emphasised && styles.cardEmphasised,
        style,
      ]}>
      {children}
    </View>
  );
}

/** A horizontal hairline between rows inside a filled card. */
export function CardDivider() {
  return <View style={styles.cardDivider} />;
}

export type SectionHeaderProps = {
  title: string;
  /** Optional right-aligned value, e.g. a count or "5 / 25". */
  value?: string;
  style?: StyleProp<ViewStyle>;
};

export function SectionHeader({ title, value, style }: SectionHeaderProps) {
  return (
    <View style={[styles.sectionHeader, style]}>
      <MonoLabel small>{title}</MonoLabel>
      {value ? <ThemedText type="monoValue" themeColor="textSecondary">{value}</ThemedText> : null}
    </View>
  );
}

/** A label/value row inside a grouped Settings-style card. */
export function DetailRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
}) {
  const content = (
    <View style={styles.detailRow}>
      <ThemedText type="body">{label}</ThemedText>
      {value ? (
        <ThemedText type="body" themeColor="textSecondary">
          {value}
        </ThemedText>
      ) : null}
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      {content}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export type FieldProps = TextInputProps & {
  /** Renders at the list-name scale (20px semibold) rather than body size. */
  large?: boolean;
};

/** The design's filled input: `#212225`, 10px radius, generous padding. */
export function Field({ large, style, ...rest }: FieldProps) {
  return (
    <TextInput
      placeholderTextColor={Colors.dark.textSecondary}
      selectionColor={Colors.dark.text}
      {...rest}
      style={[styles.field, large ? Typography.cardTitle : Typography.body, style]}
    />
  );
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

export type ButtonVariant = 'primary' | 'outline' | 'quiet';

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  /** `primary` is the solid white call to action; `quiet` is a muted outline. */
  variant?: ButtonVariant;
  disabled?: boolean;
  /** Fill the row when sitting beside sibling buttons. */
  fill?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  fill,
  style,
}: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled || !onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' ? styles.buttonPrimary : styles.buttonOutline,
        fill && styles.buttonFill,
        pressed && styles.pressed,
        disabled && styles.buttonDisabled,
        style,
      ]}>
      <ThemedText
        type="body"
        themeColor={variant === 'primary' ? 'background' : variant === 'quiet' ? 'textSecondary' : 'text'}
        style={styles.buttonLabel}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 18,
  },
  cardFilled: {
    backgroundColor: Colors.dark.backgroundElement,
  },
  cardOutlined: {
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  cardEmphasised: {
    borderColor: Colors.dark.text,
  },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.dark.borderStrong,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.three,
  },
  field: {
    backgroundColor: Colors.dark.backgroundElement,
    borderRadius: 10,
    padding: Spacing.three,
    color: Colors.dark.text,
  },
  button: {
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
    backgroundColor: Colors.dark.text,
  },
  buttonOutline: {
    borderWidth: 1,
    borderColor: Colors.dark.borderStrong,
  },
  buttonFill: {
    flex: 1,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonLabel: {
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
