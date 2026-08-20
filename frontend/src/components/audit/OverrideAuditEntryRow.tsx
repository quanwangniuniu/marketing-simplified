'use client';

import { format } from 'date-fns';
import { TableRow, TableCell } from '@/components/ui/table';
import type { OverrideAuditEntry } from '@/types/adminOverrideAudit';

interface OverrideAuditEntryRowProps {
  entry: OverrideAuditEntry;
}

const OVERRIDE_TYPE_STYLES: Record<OverrideAuditEntry['override_type'], string> = {
  SUPERUSER: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  ORG_ADMIN: 'bg-[#3CCED7]/10 text-[#1a9ba3]',
};

const OVERRIDE_TYPE_LABELS: Record<OverrideAuditEntry['override_type'], string> = {
  SUPERUSER: 'Superuser',
  ORG_ADMIN: 'Org Admin',
};

export default function OverrideAuditEntryRow({ entry }: OverrideAuditEntryRowProps) {
  const timestamp = format(new Date(entry.created_at), 'MMM d, yyyy h:mm a');

  return (
    <TableRow>
      <TableCell className="whitespace-nowrap">{timestamp}</TableCell>
      <TableCell>{entry.username}</TableCell>
      <TableCell>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${OVERRIDE_TYPE_STYLES[entry.override_type]}`}>
          {OVERRIDE_TYPE_LABELS[entry.override_type]}
        </span>
      </TableCell>
      <TableCell>
        {entry.module ?? '—'} {entry.action ? `/ ${entry.action}` : ''}
      </TableCell>
      <TableCell className="text-gray-500 dark:text-gray-400 font-mono">
        {entry.method} {entry.path}
      </TableCell>
      <TableCell className="max-w-xs truncate" title={entry.reason || undefined}>
        {entry.reason || <span className="italic text-gray-400 dark:text-gray-500">No reason given</span>}
      </TableCell>
      <TableCell className="text-xs text-gray-400 dark:text-gray-500 font-mono whitespace-nowrap">{entry.ip_address ?? '—'}</TableCell>
    </TableRow>
  );
}
