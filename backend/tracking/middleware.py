from tracking.tasks import emit_tracking_event


class ServerSideTrackingMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        if self._should_track(request, response):
            emit_tracking_event.delay(
                user_id=request.user.id,
                request_path=request.path,
                request_method=request.method,
                request_meta=self._build_meta(request),
            )

        return response

    def _should_track(self, request, response):
        return (
            request.user.is_authenticated
            and 200 <= response.status_code < 300
            and request.path.startswith('/api/')
            and not request.path.startswith('/api/tracking/')
            and not request.path.startswith('/api/health/')
        )

    def _build_meta(self, request):
        return {
            'user_agent': request.META.get('HTTP_USER_AGENT', '')[:512],
            'referer': request.META.get('HTTP_REFERER', '')[:512],
            'view_name': (
                request.resolver_match.view_name if request.resolver_match else None
            ),
            'project_id': self._extract_project_id(request),
            'internal_refetch': self._is_internal_refetch(request),
        }

    @staticmethod
    def _is_internal_refetch(request) -> bool:
        """In-page reload after save; must not count as a task page open."""
        value = request.META.get('HTTP_X_INTERNAL_REFETCH', '')
        return str(value).strip().lower() in ('1', 'true', 'yes')

    def _extract_project_id(self, request):
        if request.resolver_match:
            pk = request.resolver_match.kwargs.get('project_id')
            if pk is not None:
                try:
                    return int(pk)
                except (TypeError, ValueError):
                    pass
        raw = request.GET.get('project_id')
        if raw:
            try:
                return int(raw)
            except (TypeError, ValueError):
                pass
        return None
