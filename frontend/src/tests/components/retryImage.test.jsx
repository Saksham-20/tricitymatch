import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import RetryImage from '../../components/ui/RetryImage';

describe('RetryImage', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('retries once with a cache-busting query before surfacing the error', () => {
    const onError = vi.fn();
    render(<RetryImage src="https://cdn.test/a.jpg" alt="a" onError={onError} />);
    const img = screen.getByAltText('a');

    // First failure: swallowed, retry scheduled.
    fireEvent.error(img);
    expect(onError).not.toHaveBeenCalled();
    expect(img.getAttribute('src')).toBe('https://cdn.test/a.jpg');

    act(() => { vi.advanceTimersByTime(1500); });
    expect(img.getAttribute('src')).toBe('https://cdn.test/a.jpg?r=1');

    // Second failure: caller's fallback runs.
    fireEvent.error(img);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('appends with & when the src already has a query string', () => {
    render(<RetryImage src="https://cdn.test/a.jpg?v=2" alt="b" />);
    const img = screen.getByAltText('b');
    fireEvent.error(img);
    act(() => { vi.advanceTimersByTime(1500); });
    expect(img.getAttribute('src')).toBe('https://cdn.test/a.jpg?v=2&r=1');
  });

  it('resets the retry budget when src changes', () => {
    const onError = vi.fn();
    const { rerender } = render(<RetryImage src="https://cdn.test/a.jpg" alt="c" onError={onError} />);
    const img = screen.getByAltText('c');
    fireEvent.error(img);
    act(() => { vi.advanceTimersByTime(1500); });
    fireEvent.error(img);
    expect(onError).toHaveBeenCalledTimes(1);

    rerender(<RetryImage src="https://cdn.test/b.jpg" alt="c" onError={onError} />);
    fireEvent.error(img);
    expect(onError).toHaveBeenCalledTimes(1); // swallowed again: fresh budget
  });
});
