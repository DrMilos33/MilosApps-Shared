import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/App';

afterEach(() => {
  cleanup();
  document.documentElement.lang = 'de';
  delete window.milosAppEssentials;
});

describe('React starter bridge', () => {
  it('signals the framework-neutral ready lifecycle and handles interaction', async () => {
    const ready = vi.fn();
    window.milosAppEssentials = { ready };
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );

    expect(ready).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: 'Beispiel ausführen' }));
    expect(screen.getByText('Ausgeführt: 1')).toBeInTheDocument();
  });

  it('reacts to the shared locale event without owning shell persistence', () => {
    render(<App />);
    fireEvent(window, new CustomEvent('milosapps:localechange', { detail: { locale: 'en' } }));
    expect(screen.getByRole('heading', { name: 'One small, explicitly bounded React root' })).toBeInTheDocument();
  });
});
