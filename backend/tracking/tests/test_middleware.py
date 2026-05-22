from unittest.mock import MagicMock, patch

from django.contrib.auth.models import AnonymousUser
from django.http import HttpResponse
from django.test import RequestFactory, TestCase
from django.contrib.auth import get_user_model

from tracking.middleware import ServerSideTrackingMiddleware

User = get_user_model()


class ServerSideTrackingMiddlewareTests(TestCase):

    def setUp(self):
        self.factory = RequestFactory()
        self.user = User.objects.create_user(
            email="mw@test.com", username="mw", password="pw"
        )

    def _middleware(self, status=200):
        get_response = MagicMock(return_value=HttpResponse(status=status))
        return ServerSideTrackingMiddleware(get_response)

    @patch('tracking.middleware.emit_tracking_event')
    def test_unauthenticated_no_emit(self, mock_task):
        mw = self._middleware()
        request = self.factory.get('/api/tasks/9/')
        request.user = AnonymousUser()
        mw(request)
        mock_task.delay.assert_not_called()

    @patch('tracking.middleware.emit_tracking_event')
    def test_tracking_path_excluded(self, mock_task):
        mw = self._middleware()
        request = self.factory.get('/api/tracking/config/')
        request.user = self.user
        mw(request)
        mock_task.delay.assert_not_called()

    @patch('tracking.middleware.emit_tracking_event')
    def test_health_path_excluded(self, mock_task):
        mw = self._middleware()
        request = self.factory.get('/api/health/')
        request.user = self.user
        mw(request)
        mock_task.delay.assert_not_called()

    @patch('tracking.middleware.emit_tracking_event')
    def test_4xx_response_no_emit(self, mock_task):
        mw = self._middleware(status=404)
        request = self.factory.get('/api/tasks/9/')
        request.user = self.user
        mw(request)
        mock_task.delay.assert_not_called()

    @patch('tracking.middleware.emit_tracking_event')
    def test_5xx_response_no_emit(self, mock_task):
        mw = self._middleware(status=500)
        request = self.factory.get('/api/tasks/9/')
        request.user = self.user
        mw(request)
        mock_task.delay.assert_not_called()

    @patch('tracking.middleware.emit_tracking_event')
    def test_200_authenticated_business_path_emits(self, mock_task):
        mw = self._middleware(status=200)
        request = self.factory.get('/api/tasks/9/')
        request.user = self.user
        mw(request)
        mock_task.delay.assert_called_once_with(
            user_id=self.user.id,
            request_path='/api/tasks/9/',
            request_method='GET',
            request_meta={
                'user_agent': '',
                'referer': '',
                'view_name': None,
                'project_id': None,
                'internal_refetch': False,
            },
        )

    @patch('tracking.middleware.emit_tracking_event')
    def test_internal_refetch_header_passed_in_meta(self, mock_task):
        mw = self._middleware(status=200)
        request = self.factory.get(
            '/api/tasks/9/',
            HTTP_X_INTERNAL_REFETCH='1',
        )
        request.user = self.user
        mw(request)
        mock_task.delay.assert_called_once()
        assert mock_task.delay.call_args.kwargs['request_meta']['internal_refetch'] is True
