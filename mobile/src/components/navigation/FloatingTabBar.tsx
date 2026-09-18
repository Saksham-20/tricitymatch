/**
 * Floating pill tab bar — the current platform-native direction (Apple HIG,
 * 2026: "a tab bar floats above content at the bottom of the screen" on a
 * translucent background). Both platforms currently get the same near-opaque
 * themed surface (`c.surfaceCard + 'F2'`, ~95% opacity) — this does NOT ship
 * a real BlurView on either platform today (doctrine §10 open question 9:
 * whether to add one, with a Reduce Transparency fallback, is a Phase 4 call).
 *
 * Elder mode deliberately does NOT use this component — MainNavigator falls
 * back to the docked full-width bar with larger targets.
 *
 * Screens must keep their last content clear of the pill: pad scroll content
 * with useTabBarClearance(), which computes the real footprint from insets
 * rather than a guessed constant.
 */
import React from 'react';
import { View, Text, StyleSheet, Platform, Keyboard } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type ThemeColours, borderRadius } from '@shared/constants/theme';
import { TabIcon } from '../motion';
import { PressableScale } from '../motion';
import { useTheme } from '../../hooks/useTheme';
import { useUIStore } from '../../stores/uiStore';

/**
 * The pill's own height: `pill.paddingVertical` (8) × 2 + `item.minHeight`
 * (52) = 68. Combine with the wrap's own `paddingBottom`
 * (`max(insets.bottom, 12)`, below) via `useTabBarClearance()` — a screen
 * must never hardcode its clearance, which is how this drifted before (a
 * flat 92 undershot every Face-ID iPhone, where insets.bottom=34 gives a
 * real footprint of 34 + 68 = 102).
 */
export const TAB_BAR_PILL_HEIGHT = 68;

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
  // Stay out from under modal sheets. The pill is absolutely positioned over
  // the whole screen, so it otherwise floats on top of an open sheet and
  // covers that sheet's own footer buttons.
  const sheetUp = useUIStore((s) => s.bottomSheetOpen);

  if (keyboardUp || sheetUp) return null;

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
            // No haptic here — emitting 'tabPress' below is what fires
            // MainNavigator's screenListeners, the single haptic emitter
            // shared with elder mode's docked bar (doctrine §10.4).
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
