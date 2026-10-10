/**
 * FUN-07: the OS one-time-code autofill drops the whole code into the first
 * box. With maxLength=1 only the first digit survived. FUN-03: fixed-width
 * boxes pushed the signup page sideways on phones.
 */
import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OtpBoxes from '../../components/ui/OtpBoxes';

const Harness = ({ length = 6, onComplete }) => {
  const [value, setValue] = useState('');
  return (
    <>
      <OtpBoxes length={length} value={value} onChange={setValue} onComplete={onComplete} />
      <output data-testid="value">{value}</output>
    </>
  );
};

const boxes = () => screen.getAllByRole('textbox');

describe('OtpBoxes', () => {
  it('an autofilled code in the first box fills every box and completes', () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    fireEvent.change(boxes()[0], { target: { value: '482913' } });
    expect(screen.getByTestId('value').textContent).toBe('482913');
    expect(boxes().map((b) => b.value).join('')).toBe('482913');
    expect(onComplete).toHaveBeenCalledWith('482913');
  });

  it('a whole code dropped into a later box still starts at the first box', () => {
    const onComplete = vi.fn();
    render(<Harness length={4} onComplete={onComplete} />);
    fireEvent.change(boxes()[2], { target: { value: '7391' } });
    expect(onComplete).toHaveBeenCalledWith('7391');
  });

  it('typing one digit at a time still works, and typing over a digit replaces it', () => {
    const onComplete = vi.fn();
    render(<Harness length={4} onComplete={onComplete} />);
    fireEvent.change(boxes()[0], { target: { value: '1' } });
    fireEvent.change(boxes()[1], { target: { value: '2' } });
    // Box 1 already holds "2"; typing "5" after it is an overwrite, not a code.
    fireEvent.change(boxes()[1], { target: { value: '25' } });
    expect(screen.getByTestId('value').textContent).toBe('15');
    fireEvent.change(boxes()[2], { target: { value: '3' } });
    fireEvent.change(boxes()[3], { target: { value: '4' } });
    expect(onComplete).toHaveBeenCalledWith('1534');
  });

  it('boxes are flexible, so six fit a narrow phone', () => {
    render(<Harness />);
    for (const box of boxes()) {
      expect(box.className).toMatch(/\bflex-1\b/);
      expect(box.className).toMatch(/\bmin-w-0\b/);
      expect(box.className).not.toMatch(/\bw-11\b/);
    }
  });
});
