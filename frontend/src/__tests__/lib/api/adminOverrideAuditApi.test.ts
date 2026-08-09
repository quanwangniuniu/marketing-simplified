/**
 * Tests for Admin Override Audit API Client
 *
 * Covers:
 * - URL and default pagination params
 * - Filter serialization (user_id, override_type, module, from, to)
 * - Response passthrough
 */

import { fetchOverrideAudits } from '@/lib/api/adminOverrideAuditApi';
import type { OverrideAuditResponse } from '@/types/adminOverrideAudit';

jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

import api from '@/lib/api';

const mockApi = api as jest.Mocked<typeof api>;

describe('adminOverrideAuditApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockResponse: OverrideAuditResponse = {
    count: 1,
    next: null,
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
        reason: 'Investigating incident',
        ip_address: '10.0.0.5',
        created_at: '2026-08-01T10:00:00Z',
      },
    ],
  };

  it('fetches with default pagination and no filters', async () => {
    mockApi.get.mockResolvedValue({ data: mockResponse });

    const result = await fetchOverrideAudits();

    expect(mockApi.get).toHaveBeenCalledWith(
      '/api/access_control/admin-override-audits/',
      { params: { page: 1, page_size: 50 } }
    );
    expect(result).toEqual(mockResponse);
  });

  it('serializes all filters into query params', async () => {
    mockApi.get.mockResolvedValue({ data: mockResponse });

    await fetchOverrideAudits(
      {
        user_id: 42,
        override_type: 'ORG_ADMIN',
        module: 'CAMPAIGN',
        from: '2026-07-01T00:00:00Z',
        to: '2026-07-31T23:59:59Z',
      },
      2,
      25
    );

    expect(mockApi.get).toHaveBeenCalledWith(
      '/api/access_control/admin-override-audits/',
      {
        params: {
          page: 2,
          page_size: 25,
          user_id: 42,
          override_type: 'ORG_ADMIN',
          module: 'CAMPAIGN',
          from: '2026-07-01T00:00:00Z',
          to: '2026-07-31T23:59:59Z',
        },
      }
    );
  });

  it('omits undefined filters from params', async () => {
    mockApi.get.mockResolvedValue({ data: mockResponse });

    await fetchOverrideAudits({ module: 'ASSET' });

    const [, config] = mockApi.get.mock.calls[0];
    expect(config?.params).toEqual({ page: 1, page_size: 50, module: 'ASSET' });
  });

  it('propagates errors from the underlying request', async () => {
    mockApi.get.mockRejectedValue(new Error('network error'));

    await expect(fetchOverrideAudits()).rejects.toThrow('network error');
  });
});
