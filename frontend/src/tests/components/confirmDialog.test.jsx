import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { useConfirm } from '../../components/ui/ConfirmDialog';

const Harness = () => {
  const [confirm, dialog] = useConfirm();
  const [answer, setAnswer] = useState('none');
  return (
    <>
      <button onClick={async () => setAnswer(String(await confirm({ title: 'End match?', body: 'Sure?', confirmLabel: 'End', cancelLabel: 'Keep' })))}>ask</button>
      <p data-testid="answer">{answer}</p>
      {dialog}
    </>
  );
};

describe('useConfirm', () => {
  it('resolves true on confirm and false on cancel or Escape', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('ask'));
    expect(await screen.findByRole('alertdialog')).toBeTruthy();
    fireEvent.click(screen.getByText('End'));
    await waitFor(() => expect(screen.getByTestId('answer').textContent).toBe('true'));

    fireEvent.click(screen.getByText('ask'));
    await screen.findByRole('alertdialog');
    fireEvent.click(screen.getByText('Keep'));
    await waitFor(() => expect(screen.getByTestId('answer').textContent).toBe('false'));

    fireEvent.click(screen.getByText('ask'));
    await screen.findByRole('alertdialog');
    fireEvent.click(screen.getByText('End'));
    await waitFor(() => expect(screen.getByTestId('answer').textContent).toBe('true'));

    fireEvent.click(screen.getByText('ask'));
    await screen.findByRole('alertdialog');
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.getByTestId('answer').textContent).toBe('false'));
  });
});
