import React from 'react';
import { render, screen } from '@testing-library/react';
import OverrideAuditEntryRow from '@/components/audit/OverrideAuditEntryRow';
import type { OverrideAuditEntry } from '@/types/adminOverrideAudit';

const baseEntry: OverrideAuditEntry = {
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
  created_at: '2026-08-01T10:30:00Z',
};

function renderRow(entry: OverrideAuditEntry) {
  return render(
    <table>
      <tbody>
        <OverrideAuditEntryRow entry={entry} />
      </tbody>
    </table>
  );
}

describe('OverrideAuditEntryRow', () => {
  it('renders the username', () => {
    renderRow(baseEntry);
    expect(screen.getByText('root')).toBeInTheDocument();
  });

  it('renders the override type badge label', () => {
    renderRow(baseEntry);
    expect(screen.getByText('Superuser')).toBeInTheDocument();
  });

  it('renders "Org Admin" label for ORG_ADMIN entries', () => {
    renderRow({ ...baseEntry, override_type: 'ORG_ADMIN' });
    expect(screen.getByText('Org Admin')).toBeInTheDocument();
  });

  it('renders module and action', () => {
    renderRow(baseEntry);
    expect(screen.getByText(/ASSET/)).toBeInTheDocument();
    expect(screen.getByText(/VIEW/)).toBeInTheDocument();
  });

  it('renders the HTTP method and path', () => {
    renderRow(baseEntry);
    expect(screen.getByText(/GET/)).toBeInTheDocument();
    expect(screen.getByText(/\/api\/assets\/list\//)).toBeInTheDocument();
  });

  it('renders the reason text', () => {
    renderRow(baseEntry);
    expect(screen.getByText('Investigating incident')).toBeInTheDocument();
  });

  it('renders a placeholder when reason is empty', () => {
    renderRow({ ...baseEntry, reason: '' });
    expect(screen.getByText('No reason given')).toBeInTheDocument();
  });

  it('renders the IP address', () => {
    renderRow(baseEntry);
    expect(screen.getByText('10.0.0.5')).toBeInTheDocument();
  });

  it('renders a dash when IP address is null', () => {
    renderRow({ ...baseEntry, ip_address: null });
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders a formatted timestamp', () => {
    renderRow(baseEntry);
    expect(screen.getByText(/Aug 1, 2026/)).toBeInTheDocument();
  });
});
