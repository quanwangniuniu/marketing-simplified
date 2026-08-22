from django.http import JsonResponse
from django.test import RequestFactory, override_settings

from core.middleware.database_concurrency import DatabaseConcurrencyLimitMiddleware


@override_settings(
    DATABASE_REQUEST_CONCURRENCY=1,
    DATABASE_REQUEST_QUEUE_TIMEOUT_SECONDS=0.1,
)
def test_database_concurrency_middleware_releases_slot_after_response():
    middleware = DatabaseConcurrencyLimitMiddleware(
        lambda request: JsonResponse({'ok': True})
    )
    request = RequestFactory().get('/health/')

    assert middleware(request).status_code == 200
    assert middleware(request).status_code == 200


@override_settings(
    DATABASE_REQUEST_CONCURRENCY=1,
    DATABASE_REQUEST_QUEUE_TIMEOUT_SECONDS=0.1,
)
def test_database_concurrency_middleware_returns_retryable_busy_response():
    middleware = DatabaseConcurrencyLimitMiddleware(
        lambda request: JsonResponse({'ok': True})
    )
    request = RequestFactory().post('/api/chat/messages/')
    assert middleware.semaphore.acquire(blocking=False)
    try:
        response = middleware(request)
    finally:
        middleware.semaphore.release()

    assert response.status_code == 503
    assert response.headers['Retry-After'] == '1'
