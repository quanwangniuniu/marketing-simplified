import asyncio

import pytest
from django.test import override_settings

from chat.realtime import broadcast_event_to_user_groups


class RecordingChannelLayer:
    def __init__(self, failing_user_id=None):
        self.failing_group = (
            f'chat_user_{failing_user_id}' if failing_user_id is not None else None
        )
        self.active = 0
        self.max_active = 0
        self.groups = []

    async def group_send(self, group, event):
        self.active += 1
        self.max_active = max(self.max_active, self.active)
        try:
            await asyncio.sleep(0.001)
            self.groups.append(group)
            if group == self.failing_group:
                raise RuntimeError('simulated Redis publish failure')
        finally:
            self.active -= 1


@pytest.mark.asyncio
@override_settings(CHAT_FANOUT_CONCURRENCY=2)
async def test_broadcast_is_bounded_and_isolates_recipient_failure():
    channel_layer = RecordingChannelLayer(failing_user_id=3)

    succeeded, failed = await broadcast_event_to_user_groups(
        channel_layer,
        [1, 2, 3, 4, 4],
        {'type': 'chat_message', 'message': {'id': 10}},
    )

    assert succeeded == [1, 2, 4]
    assert set(failed) == {3}
    assert channel_layer.max_active <= 2
    assert channel_layer.groups.count('chat_user_4') == 1

