import React from 'react';
import { AccessibilityInfo } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

/**
 * The store takes ONE AccessibilityInfo subscription when the module is first
 * imported, however many components consume it, and every consumer reads the
 * same value synchronously. (It used to be one async call + one listener per
 * component instance, each starting at `false`.)
 */
describe('useReduceMotion store', () => {
  it('subscribes once, resolves the initial value, and fans a live change out to every consumer', async () => {
    let onChange: (v: boolean) => void = () => {};
    const isEnabled = jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const addListener = jest
      .spyOn(AccessibilityInfo, 'addEventListener')
      .mockImplementation(((_evt: string, handler: (v: boolean) => void) => {
        onChange = handler;
        return { remove: jest.fn() };
      }) as never);

    // First (and only) load of the module in this test file — after the spies, so its import-time
    // subscription is the one being counted. (isolateModules would load a second copy of React.)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useReduceMotion } = require('./useReduceMotion') as { useReduceMotion: () => boolean };

    const seen: boolean[][] = [[], [], []];
    const Consumer = ({ i }: { i: number }) => {
      seen[i].push(useReduceMotion());
      return null;
    };

    // Let the initial isReduceMotionEnabled() promise resolve before anything renders.
    await act(async () => { await Promise.resolve(); });

    act(() => {
      TestRenderer.create(
        <>
          <Consumer i={0} />
          <Consumer i={1} />
          <Consumer i={2} />
        </>,
      );
    });

    expect(isEnabled).toHaveBeenCalledTimes(1);
    expect(addListener).toHaveBeenCalledTimes(1);
    // Correct on the FIRST render — no false-then-true flip.
    seen.forEach((s) => expect(s[0]).toBe(true));

    act(() => { onChange(false); });
    seen.forEach((s) => expect(s[s.length - 1]).toBe(false));
  });
});
