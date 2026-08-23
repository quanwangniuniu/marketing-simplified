import { parseTaskHierarchyApiError, TASK_HIERARCHY_CYCLE_CODE } from '@/lib/api/taskApi';
import { getTaskParentId, getTaskParentSlug, getTaskParentSummary } from '@/types/task';

describe('getTaskParentId', () => {
  it('returns parent id from parent_relationship array', () => {
    expect(getTaskParentId({ parent_relationship: [{ parent_task_id: 9 }] })).toBe(9);
  });

  it('returns null when relationship is missing', () => {
    expect(getTaskParentId({ parent_relationship: null })).toBeNull();
  });

  it('coerces string parent_task_id from API payloads', () => {
    expect(
      getTaskParentId({ parent_relationship: [{ parent_task_id: '9' as unknown as number }] }),
    ).toBe(9);
  });
});

describe('getTaskParentSlug', () => {
  it('returns slug when present on parent_relationship', () => {
    expect(
      getTaskParentSlug({
        parent_relationship: [{
          parent_task_id: 9,
          parent_task_slug: 'final-campaign-performance-summary',
        }],
      }),
    ).toBe('final-campaign-performance-summary');
  });
});

describe('getTaskParentSummary', () => {
  it('returns summary when present on parent_relationship', () => {
    expect(
      getTaskParentSummary({
        parent_relationship: [{
          parent_task_id: 9,
          parent_task_summary: 'A',
        }],
      }),
    ).toBe('A');
  });
});

describe('parseTaskHierarchyApiError', () => {
  it('detects hierarchy cycle from 422 response', () => {
    const parsed = parseTaskHierarchyApiError({
      response: {
        status: 422,
        data: {
          detail: 'Cannot set this parent: it would create a circular task hierarchy.',
          code: TASK_HIERARCHY_CYCLE_CODE,
        },
      },
    });

    expect(parsed.isHierarchyCycle).toBe(true);
    expect(parsed.message).toContain('circular task hierarchy');
  });

  it('treats generic errors as non-cycle', () => {
    const parsed = parseTaskHierarchyApiError({
      response: {
        status: 400,
        data: { error: 'Subtask relationship not found.' },
      },
    });

    expect(parsed.isHierarchyCycle).toBe(false);
    expect(parsed.message).toBe('Subtask relationship not found.');
  });
});
