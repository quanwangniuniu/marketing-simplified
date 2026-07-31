import { render, screen } from '@testing-library/react';

import LastSyncTimeTooltip from '@/components/meta-ads/LastSyncTimeTooltip';
import {
  formatLastSyncedTooltip,
  isNewerSyncRun,
  resolveLastSyncedAt,
} from '@/components/meta-ads/metaAdsUtils';

describe('resolveLastSyncedAt', () => {
  it('prefers finished_at over started_at and connection timestamp', () => {
    expect(
      resolveLastSyncedAt({
        finishedAt: '2026-07-31T00:05:00Z',
        startedAt: '2026-07-30T23:50:00Z',
        connectionLastSyncedAt: '2026-07-29T12:00:00Z',
      })
    ).toBe('2026-07-31T00:05:00Z');
  });

  it('falls back to connection last_synced_at', () => {
    expect(
      resolveLastSyncedAt({
        connectionLastSyncedAt: '2026-07-31T12:42:52Z',
      })
    ).toBe('2026-07-31T12:42:52Z');
  });
});

describe('isNewerSyncRun', () => {
  it('detects a new run by id', () => {
    expect(
      isNewerSyncRun(
        { id: 3, started_at: '2026-07-31T14:00:00Z' },
        2,
        '2026-07-31T13:47:42Z'
      )
    ).toBe(true);
  });

  it('ignores the same baseline run', () => {
    expect(
      isNewerSyncRun(
        { id: 2, started_at: '2026-07-31T13:47:42Z' },
        2,
        '2026-07-31T13:47:42Z'
      )
    ).toBe(false);
  });
});

describe('formatLastSyncedTooltip', () => {
  it('returns not-synced copy when empty', () => {
    expect(formatLastSyncedTooltip(null)).toBe('Not synced yet');
    expect(formatLastSyncedTooltip('not-a-date')).toBe('Not synced yet');
  });

  it('formats a valid ISO timestamp', () => {
    const label = formatLastSyncedTooltip('2026-07-31T00:05:00.000Z');
    expect(label.startsWith('Last synced:')).toBe(true);
    expect(label).toMatch(/2026/);
  });
});

describe('LastSyncTimeTooltip', () => {
  it('exposes the formatted last-sync label for hover / a11y', () => {
    render(
      <LastSyncTimeTooltip lastSyncedAt="2026-07-31T00:05:00.000Z">
        <button type="button">Refresh data</button>
      </LastSyncTimeTooltip>
    );

    expect(screen.getByRole('button', { name: /refresh data/i })).toBeInTheDocument();
    expect(screen.getAllByLabelText(/last synced:/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('tooltip').textContent).toMatch(/Last synced:/);
  });

  it('shows not-synced copy when timestamp is missing', () => {
    render(
      <LastSyncTimeTooltip lastSyncedAt={null}>
        <button type="button">Refresh data</button>
      </LastSyncTimeTooltip>
    );

    expect(screen.getByRole('tooltip')).toHaveTextContent('Not synced yet');
  });
});
