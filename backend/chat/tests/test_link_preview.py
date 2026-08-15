"""OpenGraph parsing, background fetch, and read-through delivery (MED-279, ticket 02).

The network is always mocked: `fetch_url_safely` is the seam, so these tests never
touch DNS or HTTP and never depend on a third-party site staying up.
"""
from unittest.mock import patch

import pytest
from django.test import TestCase
from django.utils import timezone

from chat.models import Chat, ChatParticipant, ChatType, LinkPreview, Message
from core.models import Organization, Project
from chat.services import (
    LinkPreviewFetchError,
    UnsafeUrlError,
    build_message_link_preview,
    parse_opengraph,
)
from chat.tasks import fetch_link_preview_task

OG_HTML = """
<html><head>
  <meta property="og:title" content="A great article">
  <meta property="og:description" content="Why it matters">
  <meta property="og:image" content="https://cdn.example.com/cover.jpg">
  <title>fallback title</title>
</head><body>ignored</body></html>
"""


class TestParseOpengraph:
    def test_reads_the_three_og_tags(self):
        assert parse_opengraph(OG_HTML) == {
            'title': 'A great article',
            'description': 'Why it matters',
            'image_url': 'https://cdn.example.com/cover.jpg',
        }

    def test_falls_back_to_the_title_tag(self):
        html = '<html><head><title>Just a title</title></head></html>'
        parsed = parse_opengraph(html)
        assert parsed['title'] == 'Just a title'
        assert parsed['description'] is None
        assert parsed['image_url'] is None

    def test_supports_the_name_attribute_spelling(self):
        # Some sites write <meta name="og:title"> instead of property=
        html = '<html><head><meta name="og:title" content="Named"></head></html>'
        assert parse_opengraph(html)['title'] == 'Named'

    @pytest.mark.parametrize('html', [
        '<html><head></head><body>nothing</body></html>',
        '',
        None,
    ])
    def test_page_without_metadata_yields_empty_fields(self, html):
        assert parse_opengraph(html) == {'title': None, 'description': None, 'image_url': None}

    def test_ignores_a_non_http_image(self):
        """og:image is handed straight to the browser — never emit javascript:/data:."""
        html = '<html><head><meta property="og:image" content="javascript:alert(1)"></head></html>'
        assert parse_opengraph(html)['image_url'] is None


class LinkPreviewTestCase(TestCase):
    """Shared fixture: one chat with one participant and a message holding a URL."""

    def setUp(self):
        from django.contrib.auth import get_user_model

        User = get_user_model()
        self.user = User.objects.create_user(
            username='preview-user', email='preview@example.com', password='pw12345!'
        )
        self.organization = Organization.objects.create(name='Link Preview Organization')
        self.project = Project.objects.create(
            name='Link Preview Project', organization=self.organization
        )
        self.chat = Chat.objects.create(
            project=self.project,
            type=ChatType.GROUP,
            name='previews',
            created_by=self.user,
        )
        ChatParticipant.objects.create(
            chat=self.chat, user=self.user, is_active=True, is_manager=True
        )
        self.message = Message.objects.create(
            chat=self.chat,
            sender=self.user,
            content='have a look at https://example.com/story',
        )
        # A successful fetch now broadcasts the preview (MED-279 ticket 03). Stub
        # the channel layer for every test here so none of them opens a real Redis
        # connection — tests that assert on the broadcast re-patch it themselves.
        broadcast_patcher = patch(
            'chat.tasks.broadcast_event_to_user_groups_sync', return_value=([], [])
        )
        broadcast_patcher.start()
        self.addCleanup(broadcast_patcher.stop)


class TestFetchLinkPreviewTask(LinkPreviewTestCase):
    def test_stores_the_parsed_preview_as_ready(self):
        with patch('chat.tasks.fetch_url_safely', return_value=OG_HTML):
            fetch_link_preview_task(self.message.id, 'https://example.com/story')

        preview = LinkPreview.objects.get(url='https://example.com/story')
        assert preview.status == LinkPreview.STATUS_READY
        assert preview.title == 'A great article'
        assert preview.description == 'Why it matters'
        assert preview.image_url == 'https://cdn.example.com/cover.jpg'
        assert preview.fetched_at is not None

    def test_stores_the_normalized_url_as_the_key(self):
        with patch('chat.tasks.fetch_url_safely', return_value=OG_HTML):
            fetch_link_preview_task(self.message.id, 'https://EXAMPLE.com/story#top')

        assert LinkPreview.objects.filter(url='https://example.com/story').exists()

    def test_unsafe_url_is_recorded_as_blocked(self):
        with patch('chat.tasks.fetch_url_safely', side_effect=UnsafeUrlError('nope')):
            fetch_link_preview_task(self.message.id, 'https://example.com/story')

        preview = LinkPreview.objects.get(url='https://example.com/story')
        assert preview.status == LinkPreview.STATUS_BLOCKED
        assert preview.title is None

    def test_upstream_failure_is_recorded_as_failed(self):
        with patch('chat.tasks.fetch_url_safely', side_effect=LinkPreviewFetchError('500')):
            fetch_link_preview_task(self.message.id, 'https://example.com/story')

        assert LinkPreview.objects.get(url='https://example.com/story').status == LinkPreview.STATUS_FAILED

    def test_page_without_og_tags_is_ready_but_empty(self):
        with patch('chat.tasks.fetch_url_safely', return_value='<html><head></head></html>'):
            fetch_link_preview_task(self.message.id, 'https://example.com/story')

        preview = LinkPreview.objects.get(url='https://example.com/story')
        assert preview.status == LinkPreview.STATUS_READY
        assert preview.title is None

    def test_a_missing_message_does_not_raise(self):
        with patch('chat.tasks.fetch_url_safely', return_value=OG_HTML):
            fetch_link_preview_task(999_999, 'https://example.com/story')  # deleted mid-flight


class TestReadThroughDelivery(LinkPreviewTestCase):
    """What a message hands to the client on load."""

    def _store(self, **fields):
        defaults = {
            'url': 'https://example.com/story',
            'status': LinkPreview.STATUS_READY,
            'title': 'A great article',
            'description': 'Why it matters',
            'image_url': 'https://cdn.example.com/cover.jpg',
            'fetched_at': timezone.now(),
        }
        defaults.update(fields)
        return LinkPreview.objects.create(**defaults)

    def test_returns_the_preview_for_the_messages_url(self):
        self._store()
        payload = build_message_link_preview(self.message)
        assert payload == {
            'url': 'https://example.com/story',
            'title': 'A great article',
            'description': 'Why it matters',
            'image_url': 'https://cdn.example.com/cover.jpg',
        }

    def test_returns_none_when_nothing_is_cached_yet(self):
        assert build_message_link_preview(self.message) is None

    def test_only_ready_previews_are_exposed(self):
        # subTest rather than parametrize: this is a unittest TestCase, where
        # pytest's parametrize does not apply.
        for status in (LinkPreview.STATUS_BLOCKED, LinkPreview.STATUS_FAILED,
                       LinkPreview.STATUS_PENDING):
            with self.subTest(status=status):
                LinkPreview.objects.all().delete()
                self._store(status=status)
                assert build_message_link_preview(self.message) is None

    def test_a_ready_but_empty_preview_is_not_exposed(self):
        """No title and no image means there is nothing worth drawing."""
        self._store(title=None, description=None, image_url=None)
        assert build_message_link_preview(self.message) is None

    def test_a_message_without_a_url_gets_nothing(self):
        plain = Message.objects.create(chat=self.chat, sender=self.user, content='no links here')
        assert build_message_link_preview(plain) is None

    def test_serializer_exposes_the_preview(self):
        from chat.serializers import MessageSerializer

        self._store()
        data = MessageSerializer(self.message, context={'request': None}).data
        assert data['link_preview']['title'] == 'A great article'


class TestLegacyEndpointIsGuarded(LinkPreviewTestCase):
    """The pre-existing POST /api/chat/link-preview/ shares the SSRF guard.

    It is still used by comments, so it was hardened rather than removed: before
    MED-279 it validated only that a scheme and host were present and fetched with
    allow_redirects=True, so an internal address went straight through.
    """

    def setUp(self):
        super().setUp()
        from rest_framework.test import APIClient

        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.url = '/api/chat/link-preview/'

    def test_rejects_cloud_metadata_address(self):
        response = self.client.post(
            self.url, {'url': 'http://169.254.169.254/latest/meta-data/'}, format='json'
        )
        assert response.status_code == 400

    def test_rejects_loopback(self):
        response = self.client.post(self.url, {'url': 'http://127.0.0.1:8000/admin/'}, format='json')
        assert response.status_code == 400

    def test_rejects_private_range(self):
        response = self.client.post(self.url, {'url': 'http://10.0.0.5/secrets'}, format='json')
        assert response.status_code == 400

    def test_still_serves_a_public_url(self):
        with patch('chat.views.fetch_url_safely', return_value=OG_HTML), \
             patch('chat.views.validate_public_url', return_value='https://example.com/story'):
            response = self.client.post(
                self.url, {'url': 'https://example.com/story'}, format='json'
            )
        assert response.status_code == 200
        assert response.data['title'] == 'A great article'


class TestLivePreviewBroadcast(LinkPreviewTestCase):
    """A finished fetch reaches everyone currently watching the conversation."""

    def _broadcast_calls(self, mock_broadcast):
        return [call.args for call in mock_broadcast.call_args_list]

    def test_ready_preview_is_broadcast_to_participants(self):
        with patch('chat.tasks.fetch_url_safely', return_value=OG_HTML), \
             patch('chat.tasks.broadcast_event_to_user_groups_sync', return_value=([1], [])) as broadcast:
            fetch_link_preview_task(self.message.id, 'https://example.com/story')

        assert broadcast.call_count == 1
        _channel_layer, recipient_ids, event = broadcast.call_args.args
        assert list(recipient_ids) == [self.user.id]
        assert event['type'] == 'link_preview'
        assert event['message_id'] == self.message.id
        assert event['chat_id'] == self.chat.id
        assert event['preview'] == {
            'url': 'https://example.com/story',
            'title': 'A great article',
            'description': 'Why it matters',
            'image_url': 'https://cdn.example.com/cover.jpg',
        }

    def test_blocked_url_is_not_broadcast(self):
        with patch('chat.tasks.fetch_url_safely', side_effect=UnsafeUrlError('nope')), \
             patch('chat.tasks.broadcast_event_to_user_groups_sync') as broadcast:
            fetch_link_preview_task(self.message.id, 'https://example.com/story')

        broadcast.assert_not_called()

    def test_failed_fetch_is_not_broadcast(self):
        with patch('chat.tasks.fetch_url_safely', side_effect=LinkPreviewFetchError('500')), \
             patch('chat.tasks.broadcast_event_to_user_groups_sync') as broadcast:
            fetch_link_preview_task(self.message.id, 'https://example.com/story')

        broadcast.assert_not_called()

    def test_page_without_metadata_is_not_broadcast(self):
        """Ready but empty: nothing to draw, so nothing to push."""
        with patch('chat.tasks.fetch_url_safely', return_value='<html><head></head></html>'), \
             patch('chat.tasks.broadcast_event_to_user_groups_sync') as broadcast:
            fetch_link_preview_task(self.message.id, 'https://example.com/story')

        broadcast.assert_not_called()

    def test_a_broadcast_failure_does_not_lose_the_cached_preview(self):
        """The row is already committed; a channel-layer outage must not undo it."""
        with patch('chat.tasks.fetch_url_safely', return_value=OG_HTML), \
             patch('chat.tasks.broadcast_event_to_user_groups_sync', side_effect=RuntimeError('layer down')):
            fetch_link_preview_task(self.message.id, 'https://example.com/story')

        preview = LinkPreview.objects.get(url='https://example.com/story')
        assert preview.status == LinkPreview.STATUS_READY
        assert preview.title == 'A great article'
