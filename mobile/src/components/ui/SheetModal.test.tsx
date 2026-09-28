import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_k: string, d?: string) => d ?? _k }),
}));

import SheetModal from './SheetModal';

const tree = (visible: boolean, onRequestClose = jest.fn()) => (
  <SheetModal visible={visible} onRequestClose={onRequestClose}>
    <Text>sheet body</Text>
  </SheetModal>
);
const hasBody = (r: TestRenderer.ReactTestRenderer) => r.root.findAllByProps({ children: 'sheet body' }).length > 0;

/** Fire the sheet's own onLayout, the event that starts the slide once its height is known. */
const layoutSheet = (r: TestRenderer.ReactTestRenderer) => {
  const sheet = r.root.findAll((n) => typeof n.props.onLayout === 'function' && n.props.pointerEvents !== undefined)[0];
  act(() => { sheet.props.onLayout({ nativeEvent: { layout: { height: 300, width: 400, x: 0, y: 0 } } }); });
};

describe('SheetModal lifecycle', () => {
  it('renders nothing while closed and mounts on open', () => {
    let r!: TestRenderer.ReactTestRenderer;
    act(() => { r = TestRenderer.create(tree(false)); });
    expect(hasBody(r)).toBe(false);
    act(() => { r.update(tree(true)); });
    expect(hasBody(r)).toBe(true);
  });

  it('unmounts from the exit animation\'s completion callback once laid out', () => {
    let r!: TestRenderer.ReactTestRenderer;
    act(() => { r = TestRenderer.create(tree(true)); });
    layoutSheet(r);
    // The Reanimated mock completes withTiming synchronously and reports finished=true, so
    // closing runs the whole exit -> runOnJS(unmount) path.
    act(() => { r.update(tree(false)); });
    expect(hasBody(r)).toBe(false);
  });

  it('unmounts straight away when closed before it ever laid out (nothing to animate)', () => {
    let r!: TestRenderer.ReactTestRenderer;
    act(() => { r = TestRenderer.create(tree(true)); });
    act(() => { r.update(tree(false)); });
    expect(hasBody(r)).toBe(false);
  });

  it('dismisses through onRequestClose from the scrim while open', () => {
    const close = jest.fn();
    let r!: TestRenderer.ReactTestRenderer;
    act(() => { r = TestRenderer.create(tree(true, close)); });
    const scrim = r.root.findAll((n) => n.props.accessibilityRole === 'button' && n.props.accessibilityLabel === 'Close')[0];
    act(() => { scrim.props.onPress(); });
    expect(close).toHaveBeenCalledTimes(1);
  });
});
