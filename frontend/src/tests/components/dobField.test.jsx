import React, { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DobField, { daysInMonth } from '../../components/ui/DobField';

const Harness = ({ initial = '' }) => {
  const [value, setValue] = useState(initial);
  return (
    <>
      <DobField value={value} onChange={setValue} required />
      <output data-testid="value">{value}</output>
    </>
  );
};

describe('DobField', () => {
  it('renders three part selects with no calendar input', () => {
    render(<Harness />);
    expect(screen.getByLabelText('Day')).toBeInTheDocument();
    expect(screen.getByLabelText('Month')).toBeInTheDocument();
    expect(screen.getByLabelText('Year')).toBeInTheDocument();
    expect(document.querySelector('input[type="date"]')).toBeNull();
  });

  it('emits the composed YYYY-MM-DD only when all parts are chosen', () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('Day'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Month'), { target: { value: '3' } });
    expect(screen.getByTestId('value').textContent).toBe('');
    fireEvent.change(screen.getByLabelText('Year'), { target: { value: '1995' } });
    expect(screen.getByTestId('value').textContent).toBe('1995-03-05');
  });

  it('hydrates parts from an existing value', () => {
    render(<Harness initial="1992-11-30" />);
    expect(screen.getByLabelText('Day')).toHaveValue('30');
    expect(screen.getByLabelText('Month')).toHaveValue('11');
    expect(screen.getByLabelText('Year')).toHaveValue('1992');
  });

  it('clears an invalid day when the month change makes it impossible', () => {
    render(<Harness initial="1995-01-31" />);
    fireEvent.change(screen.getByLabelText('Month'), { target: { value: '2' } });
    expect(screen.getByLabelText('Day')).toHaveValue('');
    expect(screen.getByTestId('value').textContent).toBe('');
  });

  it('year options are bounded 18–100 years back', () => {
    render(<Harness />);
    const year = screen.getByLabelText('Year');
    const opts = [...year.querySelectorAll('option')].map((o) => o.value).filter(Boolean).map(Number);
    const now = new Date().getFullYear();
    expect(Math.max(...opts)).toBe(now - 18);
    expect(Math.min(...opts)).toBe(now - 100);
  });

  it('daysInMonth handles leap years', () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2023, 2)).toBe(28);
    expect(daysInMonth(1995, 4)).toBe(30);
  });
});
