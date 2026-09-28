import React from 'react';
import { Pressable, Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

const mockLight = jest.fn();
jest.mock('../../utils/haptics', () => ({
  haptics: { light: () => mockLight(), medium: jest.fn(), success: jest.fn(), warning: jest.fn() },
}));

// Records every write to a shared value so the fill test can tell "reset to 0" from "ease on".
const mockWrites: number[] = [];
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return {
    ...Reanimated,
    useSharedValue: (init: number) => {
      let v = init;
      return {
        get value() { return v; },
        set value(next: number) { mockWrites.push(next); v = next; },
      };
    },
    withTiming: (to: number) => to,
    withDelay: (_d: number, anim: number) => anim,
  };
});

import PressableScale from './PressableScale';
import { useFillAnimation } from './useFillAnimation';

beforeEach(() => {
  mockLight.mockClear();
  mockWrites.length = 0;
});

describe('PressableScale haptic', () => {
  const render = (props: Record<string, unknown>) => {
    let r!: TestRenderer.ReactTestRenderer;
    act(() => {
      r = TestRenderer.create(
        <PressableScale testID="p" {...props}>
          <Text>x</Text>
        </PressableScale>,
      );
    });
    return r.root.findByType(Pressable);
  };

  it('does not fire on touch-down — a finger landing to scroll must stay silent', () => {
    const node = render({ haptic: true, onPress: jest.fn() });
    act(() => { node.props.onPressIn({}); });
    expect(mockLight).not.toHaveBeenCalled();
  });

  it('fires once on commit, then runs the caller onPress', () => {
    const onPress = jest.fn();
    const node = render({ haptic: true, onPress });
    act(() => { node.props.onPressIn({}); });
    act(() => { node.props.onPressOut({}); });
    expect(mockLight).not.toHaveBeenCalled();
    act(() => { node.props.onPress({}); });
    expect(mockLight).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('stays silent when haptic is off, and when there is nothing to commit', () => {
    const onPress = jest.fn();
    const off = render({ onPress });
    act(() => { off.props.onPress({}); });
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(mockLight).not.toHaveBeenCalled();

    const inert = render({ haptic: true });
    expect(inert.props.onPress).toBeUndefined();
  });
});

describe('useFillAnimation', () => {
  function Probe({ to }: { to: number }) {
    useFillAnimation(to);
    return null;
  }

  it('fills from empty on first mount, then eases from the current value instead of resetting to 0', () => {
    let r!: TestRenderer.ReactTestRenderer;
    act(() => { r = TestRenderer.create(<Probe to={50} />); });
    expect(mockWrites).toEqual([0, 50]);

    mockWrites.length = 0;
    act(() => { r.update(<Probe to={64} />); });
    // The live query corrected the seeded figure: one write, straight to the new target — no 0 in between.
    expect(mockWrites).toEqual([64]);
  });
});
