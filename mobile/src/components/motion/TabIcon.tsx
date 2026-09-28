import React from 'react';
import { Ionicons } from '@expo/vector-icons';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface TabIconProps {
  name: IoniconName;
  size: number;
  color: string;
  /**
   * Kept so callers can keep passing it. The selected state is carried by the
   * caller's choice of the filled glyph + the tint, not by motion.
   */
  focused?: boolean;
}

/**
 * Bottom-tab icon. Deliberately static: a tab switch is a 100+/day action
 * (animate-expo frequency gate), the item's own press scale already answers the
 * touch, and a focus "pop" stacked a hard `scale = 0.82` set on top of that
 * press scale — a visible discontinuity that compounded the squash. Filled
 * glyph + colour is the state indication.
 */
export default function TabIcon({ name, size, color }: TabIconProps) {
  return <Ionicons name={name} size={size} color={color} />;
}
