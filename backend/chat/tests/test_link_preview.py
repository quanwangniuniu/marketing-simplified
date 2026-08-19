"""OpenGraph parsing, background fetch, and read-through delivery (MED-279, ticket 02).

The network is always mocked: `fetch_url_safely` is the seam, so these tests never
touch DNS or HTTP and never depend on a third-party site staying up.
"""
from datetime import timedelta
from unittest.mock import patch

import pytest
from django.test import TestCase
from django.utils import timezone

from chat.models import Chat, ChatParticipant, ChatType, LinkPreview, Message
from core.models import Organization, Project
from chat.services import (
    LinkPreviewFetchError,
    UnsafeUrlError,
    build_link_preview_map,
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


class TestCacheReuseAndSingleFlight(LinkPreviewTestCase):
    """A URL is fetched once per 24h, and once at a time (MED-279, ticket 04)."""

    def _second_message(self):
        return Message.objects.create(
            chat=self.chat,
            sender=self.user,
            content='someone else shares https://example.com/story',
        )

    def _aged(self, preview, **ago):
        """Move a cache row's timestamps back in time."""
        moment = timezone.now() - timedelta(**ago)
        LinkPreview.objects.filter(pk=preview.pk).update(fetched_at=moment, updated_at=moment)
        preview.refresh_from_db()
        return preview

    def test_a_second_mention_reuses_the_cache(self):
        with patch('chat.tasks.fetch_url_safely', return_value=OG_HTML) as fetch:
            fetch_link_preview_task(self.message.id, 'https://example.com/story')
            fetch_link_preview_task(self._second_message().id, 'https://example.com/story')

        assert fetch.call_count == 1

    def test_a_reused_cache_still_reaches_the_new_message(self):
        """No re-fetch, but the second poster must still see their card appear."""
        with patch('chat.tasks.fetch_url_safely', return_value=OG_HTML):
            fetch_link_preview_task(self.message.id, 'https://example.com/story')

        second = self._second_message()
        with patch('chat.tasks.fetch_url_safely') as fetch, \
             patch('chat.tasks.broadcast_event_to_user_groups_sync', return_value=([1], [])) as broadcast:
            fetch_link_preview_task(second.id, 'https://example.com/story')

        fetch.assert_not_called()
        assert broadcast.call_count == 1
        assert broadcast.call_args.args[2]['message_id'] == second.id

    def test_a_failed_url_is_not_retried_within_the_window(self):
        with patch('chat.tasks.fetch_url_safely', side_effect=LinkPreviewFetchError('500')) as fetch:
            fetch_link_preview_task(self.message.id, 'https://example.com/story')
            fetch_link_preview_task(self._second_message().id, 'https://example.com/story')

        assert fetch.call_count == 1

    def test_a_blocked_url_is_not_retried_within_the_window(self):
        """The important one: a refused URL must not become an amplifier."""
        with patch('chat.tasks.fetch_url_safely', side_effect=UnsafeUrlError('internal')) as fetch:
            fetch_link_preview_task(self.message.id, 'https://example.com/story')
            fetch_link_preview_task(self._second_message().id, 'https://example.com/story')

        assert fetch.call_count == 1

    def test_a_stale_entry_is_refreshed(self):
        with patch('chat.tasks.fetch_url_safely', return_value=OG_HTML) as fetch:
            fetch_link_preview_task(self.message.id, 'https://example.com/story')
            self._aged(LinkPreview.objects.get(url='https://example.com/story'), hours=25)
            fetch_link_preview_task(self._second_message().id, 'https://example.com/story')

        assert fetch.call_count == 2

    def test_a_claim_in_flight_stops_a_second_task(self):
        """Single-flight: the row exists as pending, so nobody else fetches."""
        LinkPreview.objects.create(url='https://example.com/story', status=LinkPreview.STATUS_PENDING)

        with patch('chat.tasks.fetch_url_safely') as fetch:
            fetch_link_preview_task(self.message.id, 'https://example.com/story')

        fetch.assert_not_called()

    def test_an_abandoned_claim_is_taken_over(self):
        """A worker that died mid-fetch must not wedge the URL forever."""
        stuck = LinkPreview.objects.create(
            url='https://example.com/story', status=LinkPreview.STATUS_PENDING
        )
        self._aged(stuck, hours=1)

        with patch('chat.tasks.fetch_url_safely', return_value=OG_HTML) as fetch:
            fetch_link_preview_task(self.message.id, 'https://example.com/story')

        assert fetch.call_count == 1
        assert LinkPreview.objects.get(url='https://example.com/story').status == LinkPreview.STATUS_READY


class TestDismissPreview(LinkPreviewTestCase):
    """Hiding a card is a personal view preference (MED-279, ticket 05)."""

    def setUp(self):
        super().setUp()
        from django.contrib.auth import get_user_model
        from rest_framework.test import APIClient

        User = get_user_model()
        self.other = User.objects.create_user(
            username='preview-other', email='other@example.com', password='pw12345!'
        )
        ChatParticipant.objects.create(chat=self.chat, user=self.other, is_active=True)
        self.preview = LinkPreview.objects.create(
            url='https://example.com/story',
            status=LinkPreview.STATUS_READY,
            title='A great article',
            description='Why it matters',
            image_url='https://cdn.example.com/cover.jpg',
            fetched_at=timezone.now(),
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.url = f'/api/chat/messages/{self.message.id}/hide_link_preview/'

    def test_dismissing_hides_the_card_for_that_user(self):
        assert build_message_link_preview(self.message, self.user) is not None

        response = self.client.post(self.url)

        assert response.status_code == 200
        self.message.refresh_from_db()
        assert build_message_link_preview(self.message, self.user) is None

    def test_other_participants_still_see_the_card(self):
        self.client.post(self.url)

        assert build_message_link_preview(self.message, self.other) is not None

    def test_dismissing_leaves_the_message_itself_alone(self):
        self.client.post(self.url)

        self.message.refresh_from_db()
        assert self.message.is_deleted is False
        assert 'https://example.com/story' in self.message.content
        assert not self.message.hidden_by_users.filter(id=self.user.id).exists()

    def test_the_same_link_in_another_message_is_unaffected(self):
        """Dismissal is per message; the shared cache is keyed by URL."""
        another = Message.objects.create(
            chat=self.chat, sender=self.user, content='again https://example.com/story'
        )

        self.client.post(self.url)

        assert build_message_link_preview(another, self.user) is not None

    def test_the_shared_cache_row_is_untouched(self):
        self.client.post(self.url)

        preview = LinkPreview.objects.get(url='https://example.com/story')
        assert preview.status == LinkPreview.STATUS_READY
        assert preview.title == 'A great article'

    def test_dismissing_twice_is_harmless(self):
        assert self.client.post(self.url).status_code == 200
        assert self.client.post(self.url).status_code == 200
        assert build_message_link_preview(self.message, self.user) is None

    def test_a_non_participant_cannot_dismiss(self):
        from django.contrib.auth import get_user_model

        outsider = get_user_model().objects.create_user(
            username='preview-outsider', email='outsider@example.com', password='pw12345!'
        )
        client = self.client.__class__()
        client.force_authenticate(user=outsider)

        response = client.post(self.url)

        assert response.status_code in (403, 404)
        assert build_message_link_preview(self.message, self.user) is not None


class TestPreviewQueryCount(LinkPreviewTestCase):
    """Resolving previews must cost one query for a page, not one per message.

    Measured on the preview path alone. MessageSerializer has other per-message
    lookups (statuses, reactions, mentions, thread summaries) that the list
    endpoint solves with prefetching; counting the whole serializer here would
    drown the thing this ticket is about.
    """

    def setUp(self):
        super().setUp()
        LinkPreview.objects.create(
            url='https://example.com/story',
            status=LinkPreview.STATUS_READY,
            title='A great article',
            description='Why it matters',
            image_url='https://cdn.example.com/cover.jpg',
            fetched_at=timezone.now(),
        )

    def _messages_with_links(self, count):
        return [
            Message.objects.create(
                chat=self.chat,
                sender=self.user,
                content=f'number {i} https://example.com/story',
            )
            for i in range(count)
        ]

    def test_a_whole_page_of_urls_costs_one_query(self):
        messages = self._messages_with_links(25)

        with self.assertNumQueries(1):
            preview_map = build_link_preview_map(messages)

        assert preview_map['https://example.com/story']['title'] == 'A great article'

    def test_the_cost_does_not_grow_with_the_page(self):
        from django.db import connection
        from django.test.utils import CaptureQueriesContext

        # Create outside the capture: the INSERTs are not what we are measuring.
        few = self._messages_with_links(5)
        many = self._messages_with_links(50)

        with CaptureQueriesContext(connection) as small:
            build_link_preview_map(few)
        with CaptureQueriesContext(connection) as large:
            build_link_preview_map(many)

        assert len(small.captured_queries) == len(large.captured_queries) == 1

    def test_reading_from_the_map_costs_nothing(self):
        """With the map primed, each message resolves without touching the DB."""
        messages = self._messages_with_links(25)
        preview_map = build_link_preview_map(messages)

        with self.assertNumQueries(0):
            payloads = [
                build_message_link_preview(message, None, preview_map=preview_map)
                for message in messages
            ]

        assert all(payload['title'] == 'A great article' for payload in payloads)

    def test_a_dismissed_card_is_read_from_the_prefetch(self):
        """The viewer check reads the prefetched row instead of querying."""
        message = self._messages_with_links(1)[0]
        message._link_preview_hidden_for_viewer = [self.user]
        preview_map = build_link_preview_map([message])

        with self.assertNumQueries(0):
            assert build_message_link_preview(message, self.user, preview_map=preview_map) is None

    def test_an_empty_page_asks_nothing(self):
        plain = [
            Message.objects.create(chat=self.chat, sender=self.user, content=f'no links {i}')
            for i in range(5)
        ]

        with self.assertNumQueries(0):
            assert build_link_preview_map(plain) == {}
