import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import OverrideAuditTable from '@/components/audit/OverrideAuditTable';
import type { OverrideAuditResponse } from '@/types/adminOverrideAudit';

jest.mock('@/lib/api/adminOverrideAuditApi', () => ({
  fetchOverrideAudits: jest.fn(),
}));

import { fetchOverrideAudits } from '@/lib/api/adminOverrideAuditApi';

const mockFetch = fetchOverrideAudits as jest.MockedFunction<typeof fetchOverrideAudits>;

const page1: OverrideAuditResponse = {
  count: 2,
  next: 'http://api/next',
  previous: null,
  results: [
    {
      id: 1,
      user_id: 42,
      username: 'root',
      organization_id: 7,
      override_type: 'SUPERUSER',
      module: 'ASSET',
      action: 'VIEW',
      method: 'GET',
      path: '/api/assets/list/',
      reason: '',
      ip_address: '10.0.0.5',
      created_at: '2026-08-01T10:30:00Z',
    },
  ],
};

const page2: OverrideAuditResponse = {
  count: 2,
  next: null,
  previous: 'http://api/prev',
  results: [
    {
      id: 2,
      user_id: 7,
      username: 'admin',
      organization_id: 7,
      override_type: 'ORG_ADMIN',
      module: 'CAMPAIGN',
      action: 'APPROVE',
      method: 'PUT',
      path: '/api/campaigns/1/approve/',
      reason: 'Escalation approved',
      ip_address: null,
      created_at: '2026-08-02T10:30:00Z',
    },
  ],
};

describe('OverrideAuditTable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads and renders the first page of entries', async () => {
    mockFetch.mockResolvedValue(page1);
    render(<OverrideAuditTable />);

    await waitFor(() => expect(screen.getByText('root')).toBeInTheDocument());
    expect(mockFetch).toHaveBeenCalledWith({}, 1, 50);
    expect(screen.getByText('2 entries')).toBeInTheDocument();
  });

  it('shows a "Load more" button when a next page exists, and loads it', async () => {
    mockFetch.mockResolvedValueOnce(page1).mockResolvedValueOnce(page2);
    render(<OverrideAuditTable />);

    await waitFor(() => expect(screen.getByText('root')).toBeInTheDocument());
    const loadMore = screen.getByText('Load more');
    fireEvent.click(loadMore);

    await waitFor(() => expect(screen.getByText('admin')).toBeInTheDocument());
    expect(mockFetch).toHaveBeenCalledWith({}, 2, 50);
    // Both pages' rows should now be present
    expect(screen.getByText('root')).toBeInTheDocument();
  });

  it('does not show "Load more" when there is no next page', async () => {
    mockFetch.mockResolvedValue({ ...page1, next: null });
    render(<OverrideAuditTable />);

    await waitFor(() => expect(screen.getByText('root')).toBeInTheDocument());
    expect(screen.queryByText('Load more')).not.toBeInTheDocument();
  });

  it('shows an empty state when there are no results', async () => {
    mockFetch.mockResolvedValue({ count: 0, next: null, previous: null, results: [] });
    render(<OverrideAuditTable />);

    await waitFor(() =>
      expect(screen.getByText('No override audit entries found.')).toBeInTheDocument()
    );
  });

  it('shows an error state with a retry button on failure', async () => {
    mockFetch.mockRejectedValue(new Error('boom'));
    render(<OverrideAuditTable />);

    await waitFor(() => expect(screen.getByText('boom')).toBeInTheDocument());
    expect(screen.getByText(/Retry/)).toBeInTheDocument();
  });

  it('retries loading when the retry button is clicked', async () => {
    mockFetch.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(page1);
    render(<OverrideAuditTable />);

    await waitFor(() => expect(screen.getByText('boom')).toBeInTheDocument());
    fireEvent.click(screen.getByText(/Retry/));

    await waitFor(() => expect(screen.getByText('root')).toBeInTheDocument());
  });

  it('re-fetches with new filters when the filter bar changes', async () => {
    mockFetch.mockResolvedValue(page1);
    render(<OverrideAuditTable />);
    await waitFor(() => expect(screen.getByText('root')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Filters'));
    const select = screen.getByLabelText('Override Type');
    fireEvent.change(select, { target: { value: 'SUPERUSER' } });

    await waitFor(() =>
      expect(mockFetch).toHaveBeenLastCalledWith({ override_type: 'SUPERUSER' }, 1, 50)
    );
  });
});
