import math
import os
from time import perf_counter
from unittest.mock import patch

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from rest_framework import status

from task.models import Task, TaskHierarchy


def _tasks_from_response(response):
    data = response.data
    return data.get('results', data) if isinstance(data, dict) else data


@pytest.mark.django_db
@pytest.mark.parametrize('child_count', [1, 19, 199])
def test_task_list_prefetches_parent_hierarchy_within_query_budget(
    authenticated_client,
    project,
    user,
    monkeypatch,
    child_count,
):
    """MED-296: hierarchy lookups must not grow by one query per subtask."""
    user.active_project = project
    user.save(update_fields=['active_project'])
    from rest_framework.pagination import PageNumberPagination
    monkeypatch.setattr(PageNumberPagination, 'page_size', child_count + 1)

    parent = Task.objects.create(
        summary='Campaign launch',
        type='asset',
        project=project,
        owner=user,
        created_by=user,
    )
    children = []
    for index in range(child_count):
        child = Task.objects.create(
            summary=f'Campaign subtask {index}',
            type='asset',
            project=project,
            owner=user,
            created_by=user,
            is_subtask=True,
        )
        TaskHierarchy.objects.create(parent_task=parent, child_task=child)
        children.append(child)

    with CaptureQueriesContext(connection) as queries:
        response = authenticated_client.get(
            reverse('task-list'),
            {'include_subtasks': 'true'},
        )

    assert response.status_code == status.HTTP_200_OK
    assert len(queries) <= 12, [q['sql'] for q in queries]

    tasks = _tasks_from_response(response)
    assert len(tasks) == child_count + 1
    child_ids = {child.id for child in children}
    child_payloads = {
        task['id']: task
        for task in tasks
        if task['id'] in child_ids
    }
    assert len(child_payloads) == child_count
    assert all(
        payload['parent_relationship'] == [{
            'parent_task_id': parent.id,
            'parent_task_slug': parent.slug,
            'parent_task_summary': parent.summary,
        }]
        for payload in child_payloads.values()
    )

    if child_count == 199 and os.environ.get('MED296_PROFILE') == '1':
        # Diagnostic only: profiler overhead is not part of the p95 benchmark.
        import cProfile
        import pstats
        from task.views import TaskViewSet

        original = TaskViewSet.get_queryset

        def legacy_queryset(view):
            return original(view).prefetch_related(None)

        for mode, queryset_method in [('before', legacy_queryset), ('after', original)]:
            sql_times = []

            def time_sql(execute, sql, params, many, context):
                started = perf_counter()
                try:
                    return execute(sql, params, many, context)
                finally:
                    sql_times.append(perf_counter() - started)

            profiler = cProfile.Profile()
            with patch.object(TaskViewSet, 'get_queryset', queryset_method):
                with connection.execute_wrapper(time_sql):
                    started = perf_counter()
                    profiler.enable()
                    measured = authenticated_client.get(
                        reverse('task-list'), {'include_subtasks': 'true'},
                    )
                    measured.content
                    profiler.disable()
                    elapsed = perf_counter() - started
            assert measured.status_code == 200
            assert measured.data == response.data
            print(f'MED296 PROFILE {mode}: rows={len(tasks)} '
                  f'total={elapsed:.4f}s sql={sum(sql_times):.4f}s '
                  f'queries={len(sql_times)}')
            pstats.Stats(profiler).strip_dirs().sort_stats('cumulative').print_stats(30)
            pstats.Stats(profiler).strip_dirs().sort_stats('tottime').print_stats(15)

    if child_count == 199 and os.environ.get('MED296_BENCHMARK') == '1':
        # Opt-in endpoint benchmark; no production pagination changes and no
        # synthetic database delay. Alternate order to reduce warm-cache bias.
        from task.views import TaskViewSet
        original = TaskViewSet.get_queryset

        def legacy_queryset(view):
            return original(view).prefetch_related(None)

        timings = {'before': [], 'after': []}
        for iteration in range(34):
            modes = ('before', 'after') if iteration % 2 else ('after', 'before')
            for mode in modes:
                with patch.object(
                    TaskViewSet, 'get_queryset',
                    legacy_queryset if mode == 'before' else original,
                ):
                    started = perf_counter()
                    measured = authenticated_client.get(
                        reverse('task-list'), {'include_subtasks': 'true'},
                    )
                    measured.content
                    elapsed = perf_counter() - started
                assert measured.status_code == 200
                assert measured.data == response.data
                if iteration >= 4:
                    timings[mode].append(elapsed)
        p95 = {
            mode: sorted(samples)[math.ceil(len(samples) * .95) - 1]
            for mode, samples in timings.items()
        }
        improvement = 1 - p95['after'] / p95['before']
        print(f'MED296 p95 before={p95["before"]:.4f}s '
              f'after={p95["after"]:.4f}s improvement={improvement:.2%}')
        assert improvement > .5
