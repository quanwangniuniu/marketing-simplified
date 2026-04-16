import React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('@/components/decisions/TaskPanel', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/decisions/SignalsPanel', () => ({
  __esModule: true,
  default: () => null,
}));

import { MeetingResultsTable } from '@/components/meetings/discovery/MeetingResultsTable';
import { MeetingSummaryKnowledgeNav } from '@/components/meetings/MeetingSummaryKnowledgeNav';
import { MeetingSummaryRelatedArtifacts } from '@/components/meetings/MeetingSummaryRelatedArtifacts';
import DecisionDetailView from '@/components/decisions/DecisionDetailView';
import { TaskOriginMeetingLink } from '@/components/tasks/TaskOriginMeetingLink';
import type { MeetingListItem } from '@/types/meeting';

describe('Meeting knowledge navigation (discovery + summary + detail hooks)', () => {
  it('Discovery cards show generated decision and task counts from API payloads', () => {
    const row: MeetingListItem = {
      id: 1,
      title: 'Weekly sync',
      summary: 'Notes',
      scheduled_date: null,
      scheduled_time: null,
      meeting_type: 'Planning',
      meeting_type_slug: 'planning',
      participants: [],
      tags: [],
      status: 'draft',
      decision_count: 1,
      task_count: 1,
      generated_decisions: [
        { id: 101, title: 'Pause spend', url: '/decisions/101?project_id=2' },
      ],
      generated_tasks: [
        { id: 201, title: 'Update settings', url: '/tasks/201' },
      ],
      related_decisions: [],
      related_tasks: [],
      is_archived: false,
    };

    render(
      <MeetingResultsTable
        rows={[row]}
        loading={false}
        selectedId={null}
        onSelect={() => {}}
        memberLabel={() => 'Member'}
        projectId={2}
        count={1}
        page={1}
        pageSize={20}
        onPageChange={() => {}}
        emptyTitle="Empty"
        emptySubtitle="—"
      />,
    );

    const counts = screen.getByTestId('meeting-card-generated-counts');
    expect(counts).toHaveTextContent('1 decision');
    expect(counts).toHaveTextContent('1 task');

    expect(screen.getByTestId('meeting-card-contextual-knowledge')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pause spend' })).toHaveAttribute(
      'href',
      '/decisions/101?project_id=2',
    );
    expect(screen.getByRole('link', { name: 'Update settings' })).toHaveAttribute(
      'href',
      '/tasks/201',
    );
    expect(screen.getByRole('link', { name: /Full meeting workspace/i })).toHaveAttribute(
      'href',
      '/projects/2/meetings/1#contextual-knowledge',
    );
  });

  it('Meeting summary knowledge + related artifact sections render links', () => {
    render(
      <>
        <MeetingSummaryKnowledgeNav
          generatedDecisions={[{ id: 1, title: 'D1', url: '/decisions/1?project_id=3' }]}
          generatedTasks={[{ id: 2, title: 'T2', url: '/tasks/2' }]}
        />
        <MeetingSummaryRelatedArtifacts
          relatedDecisions={[{ id: 9, title: 'Rd9', url: '/decisions/9?project_id=3' }]}
          relatedTasks={[{ id: 8, title: 'Rt8', url: '/tasks/8' }]}
        />
      </>,
    );

    expect(screen.getByTestId('meeting-summary-knowledge-nav')).toBeInTheDocument();
    expect(screen.getByTestId('meeting-summary-generated-decisions')).toBeInTheDocument();
    expect(screen.getByTestId('meeting-summary-related-artifacts')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'D1' })).toHaveAttribute(
      'href',
      '/decisions/1?project_id=3',
    );
    expect(screen.getByRole('link', { name: 'T2' })).toHaveAttribute(
      'href',
      '/tasks/2',
    );
    expect(screen.getByRole('link', { name: 'Rd9' })).toHaveAttribute(
      'href',
      '/decisions/9?project_id=3',
    );
    expect(screen.getByRole('link', { name: 'Rt8' })).toHaveAttribute('href', '/tasks/8');
  });

  it('Decision detail shows origin meeting link when API provides origin_meeting', () => {
    render(
      <DecisionDetailView
        decision={{
          id: 55,
          status: 'COMMITTED',
          title: 'A decision',
          origin_meeting: {
            id: 12,
            title: 'Weekly campaign review',
            url: '/projects/2/meetings/12',
          },
        }}
        projectId={2}
      />,
    );

    expect(screen.getByTestId('decision-origin-meeting')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Weekly campaign review' });
    expect(link).toHaveAttribute('href', '/projects/2/meetings/12');
  });

  it('Task detail origin line renders link from API-shaped origin_meeting', () => {
    render(
      <TaskOriginMeetingLink
        origin={{
          id: 12,
          title: 'Weekly campaign review',
          url: '/projects/2/meetings/12',
        }}
      />,
    );

    expect(screen.getByTestId('task-origin-meeting')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Weekly campaign review' });
    expect(link).toHaveAttribute('href', '/projects/2/meetings/12');
  });
});
