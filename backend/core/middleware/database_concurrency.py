"""Bound HTTP database concurrency before tenant middleware opens a connection."""

from __future__ import annotations

import threading

from django.conf import settings
from django.http import JsonResponse


class DatabaseConcurrencyLimitMiddleware:
    """Queue excess HTTP requests instead of exhausting PostgreSQL slots.

    The semaphore is deliberately process-local. Deployments with multiple web
    processes must divide their PostgreSQL connection budget between processes;
    PgBouncer remains the preferred production-wide pool.
    """

    def __init__(self, get_response):
        self.get_response = get_response
        limit = max(1, int(getattr(settings, 'DATABASE_REQUEST_CONCURRENCY', 20)))
        self.wait_seconds = max(
            0.1,
            float(getattr(settings, 'DATABASE_REQUEST_QUEUE_TIMEOUT_SECONDS', 30)),
        )
        self.semaphore = threading.BoundedSemaphore(limit)

    def __call__(self, request):
        acquired = self.semaphore.acquire(timeout=self.wait_seconds)
        if not acquired:
            return JsonResponse(
                {
                    'detail': (
                        'Server is busy processing database requests. '
                        'Please retry.'
                    )
                },
                status=503,
                headers={'Retry-After': '1'},
            )
        try:
            return self.get_response(request)
        finally:
            self.semaphore.release()
