import { StyleSheet, Text, type TextProps } from 'react-native';

import { FontFamily, ThemeColor, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextType =
  | 'default'
  | 'body'
  | 'display'
  | 'screenTitle'
  | 'taskRow'
  | 'cardTitle'
  | 'monoLabel'
  | 'monoLabelSmall'
  | 'monoValue'
  | 'small'
  | 'smallBold';

export type ThemedTextProps = TextProps & {
  type?: ThemedTextType;
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[{ color: theme[themeColor ?? 'text'] }, styles[type], style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: Typography.body,
  body: Typography.body,
  display: Typography.display,
  screenTitle: Typography.screenTitle,
  taskRow: Typography.taskRow,
  cardTitle: Typography.cardTitle,
  monoLabel: Typography.monoLabel,
  monoLabelSmall: Typography.monoLabelSmall,
  monoValue: Typography.monoValue,
  small: {
    fontFamily: FontFamily.medium,
    fontSize: 14,
    lineHeight: 20,
  },
  smallBold: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    lineHeight: 20,
  },
});
