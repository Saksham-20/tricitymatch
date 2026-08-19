/**
 * Floating pill tab bar — the current platform-native direction (Apple HIG,
 * 2026: "a tab bar floats above content at the bottom of the screen" on a
 * translucent background). iOS gets real blur; Android gets a near-opaque
 * themed surface (expo-blur is costly/inconsistent there).
 *
 * Elder mode deliberately does NOT use this component — MainNavigator falls
 * back to the docked full-width bar with larger targets.
 *
 * Screens must keep their last content clear of the pill: pad scroll content
 * with TAB_BAR_CLEARANCE.
 */
import React from 'react';
import { View, Text, StyleSheet, Platform, Keyboard } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type ThemeColours, borderRadius } from '@shared/constants/theme';
import { TabIcon } from '../motion';
import { PressableScale } from '../motion';
import { useTheme } from '../../hooks/useTheme';
import { haptics } from '../../utils/haptics';

/** Bottom padding tab screens need so content scrolls clear of the pill. */
export const TAB_BAR_CLEARANCE = 92;

type IconPair = { active: string; inactive: string };

interface Props extends BottomTabBarProps {
  icons: Record<string, IconPair>;
}

export default function FloatingTabBar({ state, descriptors, navigation, icons }: Props) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = React.useMemo(() => makeStyles(c), [c]);

  // Hide under the keyboard — a floating pill above the keyboard reads broken.
  const [keyboardUp, setKeyboardUp] = React.useState(false);
  React.useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const s = Keyboard.addListener(showEvt, () => setKeyboardUp(true));
    const h = Keyboard.addListener(hideEvt, () => setKeyboardUp(false));
    return () => { s.remove(); h.remove(); };
  }, []);
  if (keyboardUp) return null;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.pill}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : options.title ?? route.name;
          const focused = state.index === index;
          const pair = icons[route.name] ?? { active: 'ellipse', inactive: 'ellipse-outline' };

          const onPress = () => {
            haptics.light();
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name as never);
            }
          };

          return (
            <PressableScale
              key={route.key}
              scaleTo={0.92}
              onPress={onPress}
              style={styles.item}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              testID={`tab-${route.name}`}
            >
              <TabIcon
                name={(focused ? pair.active : pair.inactive) as never}
                size={22}
                color={focused ? c.primary : c.textMuted}
                focused={focused}
              />
              <Text style={[styles.label, { color: focused ? c.primary : c.textMuted }]} numberOfLines={1}>
                {label}
              </Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (c: ThemeColours) => StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: borderRadius.pill,
    backgroundColor: c.surfaceCard + 'F2', // ~95% opacity themed surface
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    // soft brand shadow, both platforms
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
    alignSelf: 'stretch',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    gap: 2,
  },
  label: { fontSize: 10, fontWeight: '600' },
});
