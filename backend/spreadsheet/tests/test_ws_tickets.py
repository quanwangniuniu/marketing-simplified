import time
from concurrent.futures import ThreadPoolExecutor

import pytest
from django_redis import get_redis_connection

from spreadsheet.ws_tickets import (
    _redis_key,
    consume_websocket_ticket,
    mint_websocket_ticket,
)


@pytest.mark.integration
def test_redis_ticket_is_consumed_exactly_once_across_workers():
    ticket = mint_websocket_ticket(
        user_id=101,
        sheet_id=202,
        client_id="tab-303",
        connection_expires_at=int(time.time()) + 300,
        tenant_schema="org_med_293",
    )
    redis = get_redis_connection("default")

    try:
        def consume(_index):
            return consume_websocket_ticket(
                ticket,
                expected_sheet_id=202,
                expected_client_id="tab-303",
            )

        with ThreadPoolExecutor(max_workers=8) as executor:
            results = list(executor.map(consume, range(16)))

        winners = [result for result in results if result is not None]
        assert len(winners) == 1
        assert winners[0].user_id == 101
        assert winners[0].sheet_id == 202
        assert winners[0].client_id == "tab-303"
        assert winners[0].tenant_schema == "org_med_293"
    finally:
        redis.delete(_redis_key(ticket))
