/**
 * The handful of shapes the design repeats across every screen.
 *
 * The mockups are visually dense but structurally narrow — a grouped card, an
 * uppercase mono caption, two button treatments and a section header cover
 * almost all of it.
 */

import { useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  useWindowDimensions,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { IconStroke, Info } from '@/components/icons';
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
  /** Truncate rather than wrap — for labels sharing a row with fixed content. */
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
};

export function MonoLabel({ children, small, bright, numberOfLines, style }: MonoLabelProps) {
  return (
    <ThemedText
      type={small ? 'monoLabelSmall' : 'monoLabel'}
      themeColor={bright ? 'text' : 'textSecondary'}
      numberOfLines={numberOfLines}
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
// Info popover
// ---------------------------------------------------------------------------

/** Width of the popover card; also used to keep it inside the screen edges. */
const POPOVER_WIDTH = 260;
const POPOVER_MARGIN = Spacing.three;

export type InfoPopoverProps = {
  /** The explanatory text to reveal. */
  text: string;
  /** Announced by screen readers in place of the icon. */
  accessibilityLabel?: string;
};

/**
 * A tappable info icon that reveals a short explanation, dismissed by tapping
 * anywhere else.
 *
 * The card lives in a `Modal` rather than inline because only a full-screen
 * backdrop can reliably catch "tap anywhere else" — an absolutely positioned
 * overlay can never receive touches outside its own parent's bounds.
 */
export function InfoPopover({ text, accessibilityLabel = 'More information' }: InfoPopoverProps) {
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  const iconRef = useRef<View>(null);
  const { width: screenWidth } = useWindowDimensions();

  function open() {
    // Measured on press rather than on layout so the card follows the icon even
    // after the list above it has scrolled.
    iconRef.current?.measureInWindow((x, y, _w, h) => {
      const left = Math.min(
        Math.max(POPOVER_MARGIN, x - POPOVER_WIDTH / 2),
        screenWidth - POPOVER_WIDTH - POPOVER_MARGIN,
      );
      setAnchor({ top: y + h + Spacing.two, left });
    });
  }

  return (
    <>
      <Pressable
        ref={iconRef}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={open}
        style={({ pressed }) => pressed && styles.pressed}>
        <Info size={15} color={Colors.dark.textSecondary} strokeWidth={IconStroke} />
      </Pressable>

      <Modal
        visible={anchor !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setAnchor(null)}>
        <Pressable style={styles.popoverBackdrop} onPress={() => setAnchor(null)}>
          {anchor ? (
            <View style={[styles.popoverCard, { top: anchor.top, left: anchor.left }]}>
              <ThemedText type="small">{text}</ThemedText>
            </View>
          ) : null}
        </Pressable>
      </Modal>
    </>
  );
}

/** A grouped row carrying an on/off switch instead of a value. */
export function SwitchRow({
  label,
  value,
  onValueChange,
  disabled,
}: {
  label: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.detailRow}>
      <ThemedText type="body">{label}</ThemedText>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        // The thumb is white in BOTH states, deliberately. iOS draws it white
        // by default and `thumbColor` cannot be relied on to override that, so
        // legibility has to come from the track instead: accent when on (4.35:1
        // against white), dark grey when off (~13:1). An earlier version used a
        // white on-track with a black thumb and the control disappeared.
        trackColor={{ false: Colors.dark.borderStrong, true: Colors.dark.accent }}
        thumbColor={Colors.dark.text}
        // On iOS Fabric the off-track comes from here, not from trackColor.false.
        ios_backgroundColor={Colors.dark.borderStrong}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Picker sheet
// ---------------------------------------------------------------------------

export type PickerOption = {
  /** Stored value. */
  value: string;
  /** Primary line. */
  label: string;
  /** Optional right-hand detail, e.g. a UTC offset. */
  detail?: string;
  /** Optional grouping caption rendered above this row. */
  section?: string;
};

export type PickerSheetProps = {
  visible: boolean;
  title: string;
  options: PickerOption[];
  selected?: string | null;
  /** Shows a filter box. Worth it past a couple of dozen options. */
  searchable?: boolean;
  searchPlaceholder?: string;
  onSelect: (value: string) => void;
  onClose: () => void;
};

/**
 * A full-height modal list for choosing one value.
 *
 * Follows `InfoPopover`'s pattern — a Modal with a pressable backdrop — because
 * that is the only arrangement where tapping outside reliably dismisses.
 */
export function PickerSheet({
  visible,
  title,
  options,
  selected,
  searchable,
  searchPlaceholder = 'Search',
  onSelect,
  onClose,
}: PickerSheetProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const needle = query.trim().toLowerCase();
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(needle) || o.value.toLowerCase().includes(needle),
    );
  }, [options, query, searchable]);

  // A stale filter must not greet the next opening.
  function close() {
    setQuery('');
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.sheetRoot}>
        <Pressable style={styles.sheetBackdrop} onPress={close} />
        <View style={styles.sheetCard}>
          <View style={styles.sheetHeader}>
            <MonoLabel small bright>
              {title}
            </MonoLabel>
            <Pressable hitSlop={10} onPress={close}>
              <MonoLabel small>Close</MonoLabel>
            </Pressable>
          </View>

          {searchable ? (
            <Field
              value={query}
              onChangeText={setQuery}
              placeholder={searchPlaceholder}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.sheetSearch}
            />
          ) : null}

          <ScrollView
            style={styles.sheetList}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {filtered.length === 0 ? (
              <ThemedText type="monoValue" themeColor="textSecondary" style={styles.sheetEmpty}>
                No matches.
              </ThemedText>
            ) : null}

            {filtered.map((option, index) => {
              const isSelected = option.value === selected;
              const showSection =
                !!option.section && option.section !== filtered[index - 1]?.section;

              return (
                <View key={option.value}>
                  {showSection ? (
                    <MonoLabel small style={styles.sheetSection}>
                      {option.section}
                    </MonoLabel>
                  ) : null}
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => {
                      setQuery('');
                      onSelect(option.value);
                    }}
                    style={({ pressed }) => [styles.sheetRow, pressed && styles.pressed]}>
                    <ThemedText
                      type="body"
                      themeColor={isSelected ? 'text' : 'textSecondary'}
                      style={styles.sheetRowLabel}
                      numberOfLines={1}>
                      {option.label}
                    </ThemedText>
                    {option.detail ? (
                      <ThemedText type="monoValue" themeColor="textSecondary">
                        {option.detail}
                      </ThemedText>
                    ) : null}
                    {isSelected ? (
                      <ThemedText type="body" style={styles.sheetTick}>
                        ✓
                      </ThemedText>
                    ) : null}
                  </Pressable>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export type FieldProps = TextInputProps & {
  /** Renders at the list-name scale (20px semibold) rather than body size. */
  large?: boolean;
};

/**
 * The design's filled input: `#212225`, 10px radius, generous padding.
 *
 * Uses `Typography.input`, which deliberately carries no `lineHeight` — an
 * explicit one crops descenders inside a TextInput. Height comes from the
 * padding below instead.
 */
export function Field({ large, style, ...rest }: FieldProps) {
  return (
    <TextInput
      placeholderTextColor={Colors.dark.textSecondary}
      selectionColor={Colors.dark.text}
      {...rest}
      style={[
        styles.field,
        large ? Typography.inputLarge : Typography.input,
        large ? styles.fieldLarge : styles.fieldRegular,
        style,
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

export type ButtonVariant = 'primary' | 'outline' | 'quiet' | 'danger';

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  /**
   * `primary` is the solid white call to action, `quiet` a muted outline, and
   * `danger` a red-outlined destructive action — outlined rather than filled so
   * it is unmistakable without being the brightest thing on the screen.
   */
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
        variant === 'danger' && styles.buttonDanger,
        fill && styles.buttonFill,
        pressed && styles.pressed,
        disabled && styles.buttonDisabled,
        style,
      ]}>
      <ThemedText
        type="body"
        themeColor={
          variant === 'primary'
            ? 'background'
            : variant === 'quiet'
              ? 'textSecondary'
              : variant === 'danger'
                ? 'danger'
                : 'text'
        }
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
  sheetRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheetCard: {
    // Capped so the backdrop above it stays tappable to dismiss.
    maxHeight: '82%',
    backgroundColor: Colors.dark.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: Colors.dark.borderStrong,
    paddingTop: Spacing.four,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  sheetSearch: {
    marginBottom: Spacing.two,
  },
  sheetList: {
    flexGrow: 0,
  },
  sheetSection: {
    marginTop: Spacing.three,
    marginBottom: Spacing.one,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.dark.border,
  },
  sheetRowLabel: {
    flex: 1,
  },
  sheetTick: {
    width: 18,
    textAlign: 'right',
  },
  sheetEmpty: {
    paddingVertical: Spacing.four,
  },
  popoverBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  popoverCard: {
    position: 'absolute',
    width: POPOVER_WIDTH,
    padding: Spacing.three,
    borderRadius: 12,
    backgroundColor: Colors.dark.backgroundElement,
    borderWidth: 1,
    borderColor: Colors.dark.borderStrong,
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
    paddingHorizontal: Spacing.three,
    color: Colors.dark.text,
  },
  // Vertical padding carries the height now that lineHeight is gone. The extra
  // couple of points below the text leave room for descenders to breathe.
  fieldRegular: {
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three + 2,
  },
  fieldLarge: {
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three + 3,
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
  buttonDanger: {
    borderColor: Colors.dark.danger,
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
