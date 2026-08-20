import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import OverrideAuditFilterBar from '@/components/audit/OverrideAuditFilterBar';
import type { OverrideAuditFilters } from '@/types/adminOverrideAudit';

describe('OverrideAuditFilterBar', () => {
  it('renders the Filters toggle with no badge when no filters are active', () => {
    render(<OverrideAuditFilterBar filters={{}} onChange={jest.fn()} />);
    expect(screen.getByText('Filters')).toBeInTheDocument();
    expect(screen.queryByText('Clear all')).not.toBeInTheDocument();
  });

  it('shows a chip and active filter count for override_type', () => {
    render(<OverrideAuditFilterBar filters={{ override_type: 'SUPERUSER' }} onChange={jest.fn()} />);
    expect(screen.getByText('Superuser')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('shows a chip for module filter', () => {
    render(<OverrideAuditFilterBar filters={{ module: 'CAMPAIGN' }} onChange={jest.fn()} />);
    expect(screen.getByText('CAMPAIGN')).toBeInTheDocument();
  });

  it('shows a chip for user filter using the users list', () => {
    render(
      <OverrideAuditFilterBar
        filters={{ user_id: 42 }}
        onChange={jest.fn()}
        users={[{ id: 42, username: 'root' }]}
      />
    );
    expect(screen.getByText('root')).toBeInTheDocument();
  });

  it('falls back to "User #id" when the user is not in the known list', () => {
    render(<OverrideAuditFilterBar filters={{ user_id: 99 }} onChange={jest.fn()} />);
    expect(screen.getByText('User #99')).toBeInTheDocument();
  });

  it('shows a date range chip when from/to are set', () => {
    render(
      <OverrideAuditFilterBar
        filters={{ from: '2026-07-01T00:00:00Z' }}
        onChange={jest.fn()}
      />
    );
    expect(screen.getByText('Date range')).toBeInTheDocument();
  });

  it('calls onChange with all filters cleared when "Clear all" is clicked', () => {
    const onChange = jest.fn();
    render(
      <OverrideAuditFilterBar
        filters={{ override_type: 'SUPERUSER', module: 'ASSET' }}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByText('Clear all'));
    expect(onChange).toHaveBeenCalledWith({
      user_id: undefined,
      override_type: undefined,
      module: undefined,
      from: undefined,
      to: undefined,
    });
  });

  it('removes the override_type filter when its chip X is clicked', () => {
    const onChange = jest.fn();
    render(
      <OverrideAuditFilterBar filters={{ override_type: 'ORG_ADMIN' }} onChange={onChange} />
    );
    fireEvent.click(screen.getByLabelText('Remove override type filter'));
    expect(onChange).toHaveBeenCalledWith({ override_type: undefined });
  });

  it('opens the filter panel and updates override_type via the select', () => {
    const onChange = jest.fn();
    render(<OverrideAuditFilterBar filters={{}} onChange={onChange} />);
    fireEvent.click(screen.getByText('Filters'));
    const select = screen.getByLabelText('Override Type');
    fireEvent.change(select, { target: { value: 'SUPERUSER' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ override_type: 'SUPERUSER' })
    );
  });

  it('updates the module filter via the select', () => {
    const onChange = jest.fn();
    render(<OverrideAuditFilterBar filters={{}} onChange={onChange} />);
    fireEvent.click(screen.getByText('Filters'));
    const select = screen.getByLabelText('Module');
    fireEvent.change(select, { target: { value: 'CAMPAIGN' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ module: 'CAMPAIGN' })
    );
  });

  it('shows "No users in log yet" when the users list is empty', () => {
    render(<OverrideAuditFilterBar filters={{}} onChange={jest.fn()} />);
    fireEvent.click(screen.getByText('Filters'));
    expect(screen.getByText('No users in log yet')).toBeInTheDocument();
  });

  it('updates the from-date filter as an ISO start-of-day datetime', () => {
    const onChange = jest.fn();
    render(<OverrideAuditFilterBar filters={{}} onChange={onChange} />);
    fireEvent.click(screen.getByText('Filters'));
    const fromInput = screen.getByLabelText('From');
    fireEvent.change(fromInput, { target: { value: '2026-07-15' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ from: '2026-07-15T00:00:00Z' })
    );
  });
});
