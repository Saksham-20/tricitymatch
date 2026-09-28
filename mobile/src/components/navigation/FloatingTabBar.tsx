/**
 * Floating pill tab bar — the current platform-native direction (Apple HIG,
 * 2026: "a tab bar floats above content at the bottom of the screen"). Both
 * platforms get the same fully OPAQUE themed surface (`c.surfaceCard`).
 * Deliberately no blur AND no translucency: without a blur an alpha buys
 * nothing but ghosted list text showing through the pill, and a live blur costs
 * a compositing pass on every scroll frame on mid-range Android (Phase 4
 * decision, plan open question 9). Being solid by construction, the pill also
 * already satisfies Reduce Transparency — there is no special case to keep.
 *
 * The pill does not unmount under the keyboard or an open sheet: it fades out
 * (`duration.press`) and back in (`duration.menu`), inert and hidden from the
 * accessibility tree while away, so it never pops over the page on the last
 * frame of a sheet's exit. Opacity is applied to the pill itself (the element
 * that owns the shadow), not to its absolute-fill wrapper — an Android
 * elevation shadow does not reliably follow an ancestor's alpha.
 *
 * Elder mode deliberately does NOT use this component — MainNavigator falls
 * back to the docked full-width bar with larger targets.
 *
 * Screens must keep their last content clear of the pill: pad scroll content
 * with useTabBarClearance(), which computes the real footprint from insets
 * rather than a guessed constant.
 */
import React from 'react';
import { View, StyleSheet, Platform, Keyboard } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Text from '../ui/Text';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type ThemeColours, borderRadius } from '@shared/constants/theme';
import { duration, EASE_OUT } from '@shared/constants/motion';
import { PressableScale, TabIcon } from '../motion';
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
  const hidden = keyboardUp || sheetUp;

  // Leaving is quick (`press`), returning a beat slower (`menu`) — exits are
  // faster than entrances. Opacity only, so it needs no Reduce Motion branch.
  const opacity = useSharedValue(1);
  React.useEffect(() => {
    opacity.value = withTiming(hidden ? 0 : 1, {
      duration: hidden ? duration.press : duration.menu,
      easing: Easing.bezier(...EASE_OUT),
    });
  }, [hidden, opacity]);
  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View
      pointerEvents={hidden ? 'none' : 'box-none'}
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
      style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]}
    >
      <Animated.View style={[styles.pill, fade]}>
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
            // shared with elder mode's docked bar (doctrine §10.4). It stays
            // silent when this tab is already focused.
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name as never);
            }
          };

          return (
            <PressableScale
              key={route.key}
              scaleTo={0.96}
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
              <Text
                variant="micro"
                color={focused ? 'primary' : 'textMuted'}
                numberOfLines={1}
                // Fixed-height chrome: five labels share the pill, so past ~1.3x they become 'H…'.
                // The icon and the selected tint carry the rest.
                maxScale={1.3}
              >
                {label}
              </Text>
            </PressableScale>
          );
        })}
      </Animated.View>
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
    backgroundColor: c.surfaceCard, // opaque — see the header note on why there is no alpha
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
});
