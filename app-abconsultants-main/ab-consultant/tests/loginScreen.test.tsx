import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Aggressive mocks — LoginScreen pulls in firebase auth + cloudFunctions.
vi.mock('../firebase', () => ({
  auth: { currentUser: null },
}));
vi.mock('../lib/cloudFunctions', () => ({
  refreshUserRole: vi.fn().mockResolvedValue({ data: { role: 'client' } }),
}));

import LoginScreen from '../components/LoginScreen';

describe('LoginScreen — smoke', () => {
  it('renders both account-type tabs', () => {
    render(<LoginScreen onLogin={() => {}} />);
    expect(
      screen.getByRole('tab', { name: /Espace Client/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: /Espace Consultant/i }),
    ).toBeInTheDocument();
  });

  it('defaults to the "client" tab (Connexion heading visible, not "Connexion Admin")', () => {
    render(<LoginScreen onLogin={() => {}} />);
    // The h3 reads "Connexion" on the client tab and "Connexion Admin" on the
    // consultant tab. Match by exact text via a function to avoid the partial
    // "Connexion Admin" match.
    expect(
      screen.getByRole('heading', { name: /^Connexion$/ }),
    ).toBeInTheDocument();
  });

  it('switches headline to "Connexion Admin" when the consultant tab is clicked', async () => {
    const user = userEvent.setup();
    render(<LoginScreen onLogin={() => {}} />);
    await user.click(screen.getByRole('tab', { name: /Espace Consultant/i }));
    expect(
      screen.getByRole('heading', { name: /Connexion Admin/i }),
    ).toBeInTheDocument();
  });

  it('renders the email and password inputs', () => {
    render(<LoginScreen onLogin={() => {}} />);
    // Inputs are not labelled with htmlFor — fall back to type-based queries.
    const emailInput = document.querySelector('input[type="email"]');
    const passwordInput = document.querySelector('input[type="password"]');
    expect(emailInput).toBeInTheDocument();
    expect(passwordInput).toBeInTheDocument();
  });
});
