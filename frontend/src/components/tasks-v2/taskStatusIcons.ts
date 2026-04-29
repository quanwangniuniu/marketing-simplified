import type { LucideIcon } from 'lucide-react';
import {
  Ban,
  CheckCircle2,
  Clock,
  HelpCircle,
  Lock,
  Search,
  Send,
  XCircle,
} from 'lucide-react';

/** Map API task `status` to Lucide icons (kanban list card badge). */
const TASK_STATUS_LUCIDE: Record<string, LucideIcon> = {
  DRAFT: Clock,
  SUBMITTED: Send,
  UNDER_REVIEW: Search,
  APPROVED: CheckCircle2,
  REJECTED: XCircle,
  LOCKED: Lock,
  CANCELLED: Ban,
};

export function getTaskStatusLucideIcon(status: string): LucideIcon {
  return TASK_STATUS_LUCIDE[status] ?? HelpCircle;
}
