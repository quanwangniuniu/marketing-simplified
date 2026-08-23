import { useTaskStore } from '@/lib/taskStore';
import type { TaskData } from '@/types/task';

const originalTask: TaskData = {
  id: 1,
  project_id: 1,
  type: 'execution',
  summary: 'Original',
  priority: 'MEDIUM',
};

describe('taskStore concurrent operation reconciliation', () => {
  beforeEach(() => {
    useTaskStore.setState({
      tasks: [{ ...originalTask }],
      currentTask: { ...originalTask },
      latestTaskOperationIds: {},
    });
  });

  it('ignores a stale successful response', () => {
    const store = useTaskStore.getState();

    store.beginTaskOperation(
      1,
      'summary',
      'operation-a',
    );
    store.updateTask(1, { summary: 'Writer A' });

    store.beginTaskOperation(
      1,
      'summary',
      'operation-b',
    );
    store.updateTask(1, { summary: 'Writer B' });

    const staleApplied =
      useTaskStore
        .getState()
        .resolveTaskFromServer(
          1,
          { summary: 'Writer A' },
          'summary',
          'operation-a',
        );

    expect(staleApplied).toBe(false);
    expect(
      useTaskStore.getState().tasks[0].summary
    ).toBe('Writer B');

    const latestApplied =
      useTaskStore
        .getState()
        .resolveTaskFromServer(
          1,
          { summary: 'Writer B from server' },
          'summary',
          'operation-b',
        );

    expect(latestApplied).toBe(true);
    expect(
      useTaskStore.getState().tasks[0].summary
    ).toBe('Writer B from server');
  });

  it('ignores a stale failure rollback', () => {
    const store = useTaskStore.getState();

    store.beginTaskOperation(
      1,
      'summary',
      'operation-a',
    );
    store.updateTask(1, { summary: 'Writer A' });

    store.beginTaskOperation(
      1,
      'summary',
      'operation-b',
    );
    store.updateTask(1, { summary: 'Writer B' });

    const staleRollbackApplied =
      useTaskStore
        .getState()
        .rollbackTaskOperation(
          1,
          { summary: 'Original' },
          'summary',
          'operation-a',
        );

    expect(staleRollbackApplied).toBe(false);
    expect(
      useTaskStore.getState().tasks[0].summary
    ).toBe('Writer B');

    const latestRollbackApplied =
      useTaskStore
        .getState()
        .rollbackTaskOperation(
          1,
          { summary: 'Writer A' },
          'summary',
          'operation-b',
        );

    expect(latestRollbackApplied).toBe(true);
    expect(
      useTaskStore.getState().tasks[0].summary
    ).toBe('Writer A');
  });

  it('tracks different fields independently', () => {
    const store = useTaskStore.getState();

    store.beginTaskOperation(
      1,
      'summary',
      'summary-operation',
    );
    store.beginTaskOperation(
      1,
      'priority',
      'priority-operation',
    );

    const summaryApplied =
      useTaskStore
        .getState()
        .resolveTaskFromServer(
          1,
          { summary: 'Server summary' },
          'summary',
          'summary-operation',
        );

    const priorityApplied =
      useTaskStore
        .getState()
        .resolveTaskFromServer(
          1,
          { priority: 'HIGH' },
          'priority',
          'priority-operation',
        );

    expect(summaryApplied).toBe(true);
    expect(priorityApplied).toBe(true);
    expect(useTaskStore.getState().tasks[0]).toEqual(
      expect.objectContaining({
        summary: 'Server summary',
        priority: 'HIGH',
      })
    );
  });
});