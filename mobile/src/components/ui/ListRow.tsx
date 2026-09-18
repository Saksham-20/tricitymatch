import React from 'react';
import { useTheme } from '../../hooks/useTheme';
import { StyleSheet, Switch, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, type ThemeColours } from '@shared/constants/theme';
import { tapSize } from '../../utils/elderTheme';
import { PressableScale } from '../motion';
import Text from './Text';

interface ListRowProps {
  icon?: keyof typeof Ionicons.glyphMap;
  /** Tint for the icon and its soft circular tile background. Defaults to c.primary. */
  iconColor?: string;
  label: string;
  /** Secondary line under the label. */
  sublabel?: string;
  value?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  switchValue?: boolean;
  onSwitchChange?: (value: boolean) => void;
  destructive?: boolean;
  testID?: string;
}

/** Settings/list row — icon + label(+sublabel) + value/switch/chevron, 48px+ tap target, elder-mode aware. */
export default function ListRow({
  icon,
  iconColor,
  label,
  sublabel,
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
  const Container: React.ElementType = onPress ? PressableScale : View;
  const minHeight = tapSize(elder);
  const tint = destructive ? c.error : (iconColor ?? c.primary);

  return (
    <Container
      style={[styles.row, { minHeight }]}
      onPress={onPress}
      testID={testID}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label}
    >
      {icon ? (
        <View style={[styles.iconWrap, { backgroundColor: tint + '15' }]}>
          <Ionicons name={icon} size={18} color={tint} />
        </View>
      ) : null}
      <View style={styles.info}>
        <Text variant="subhead" color={destructive ? 'error' : 'textPrimary'} numberOfLines={1}>
          {label}
        </Text>
        {sublabel ? (
          <Text variant="footnote" color="textSecondary" style={styles.sublabel} numberOfLines={1}>
            {sublabel}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="footnote" color="textSecondary" numberOfLines={1}>
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
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
  },
  sublabel: {
    marginTop: 2,
  },
});
