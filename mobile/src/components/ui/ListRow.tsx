import React from 'react';
import { useTheme } from '../../hooks/useTheme';
import { StyleSheet, Switch, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, type ThemeColours } from '@shared/constants/theme';
import { tapSize } from '../../utils/elderTheme';
import Text from './Text';

interface ListRowProps {
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  switchValue?: boolean;
  onSwitchChange?: (value: boolean) => void;
  destructive?: boolean;
  testID?: string;
}

/** Settings/list row — icon + label + value/switch/chevron, 48px+ tap target, elder-mode aware. */
export default function ListRow({
  icon,
  label,
  value,
  onPress,
  rightElement,
  switchValue,
  onSwitchChange,
  destructive = false,
  testID,
}: ListRowProps) {
  const { c, elder } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const Container: React.ElementType = onPress ? TouchableOpacity : View;
  const minHeight = tapSize(elder);

  return (
    <Container
      style={[styles.row, { minHeight }]}
      onPress={onPress}
      disabled={!onPress}
      testID={testID}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label}
    >
      {icon ? (
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={20} color={destructive ? c.error : c.primary} />
        </View>
      ) : null}
      <Text variant="body" color={destructive ? 'error' : 'textPrimary'} style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      {value ? (
        <Text variant="footnote" color="textMuted" numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {onSwitchChange ? (
        <Switch
          value={!!switchValue}
          onValueChange={onSwitchChange}
          trackColor={{ false: c.border, true: c.primary }}
          thumbColor={c.surfaceCard}
          testID={testID ? `${testID}-switch` : undefined}
        />
      ) : rightElement ? (
        rightElement
      ) : onPress ? (
        <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
      ) : null}
    </Container>
  );
}

const makeStyles = (c: ThemeColours) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    backgroundColor: c.surfaceCard,
  },
  iconWrap: {
    width: 32,
    alignItems: 'center',
  },
  label: {
    flex: 1,
  },
});
