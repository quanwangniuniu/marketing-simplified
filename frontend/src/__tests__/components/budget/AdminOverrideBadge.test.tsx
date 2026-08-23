import { render, screen } from '@testing-library/react';
import {
  AdminOverrideBadge,
  stripAdminOverrideNotes,
} from '@/components/budget/AdminOverrideBadge';

describe('AdminOverrideBadge', () => {
  it('renders the override label', () => {
    render(<AdminOverrideBadge />);
    expect(screen.getByTestId('admin-override-badge')).toHaveTextContent('Admin override');
  });
});

describe('stripAdminOverrideNotes', () => {
  it('removes machine-readable override marker lines', () => {
    const notes = [
      'Please prioritize',
      '[ORG_ADMIN_OVERRIDE] user_id=9 decision=approve',
      'Thanks',
    ].join('\n');
    expect(stripAdminOverrideNotes(notes)).toBe('Please prioritize\nThanks');
  });

  it('returns empty string when only override markers remain', () => {
    expect(stripAdminOverrideNotes('[ORG_ADMIN_OVERRIDE] alone')).toBe('');
  });
});
