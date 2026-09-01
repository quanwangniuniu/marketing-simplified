"""
Cancellation tokens for guests.

A guest has no account, so the only way to let them cancel is to hand them
something unforgeable at booking time. A signed token beats a random secret
stored on the row: nothing extra to persist, and it cannot be brute-forced.

The token is scoped to one event and expires when that event's usefulness does
- there is nothing to cancel once the meeting has passed.
"""

from __future__ import annotations

from django.core import signing

SALT = "calendars.booking.cancel"

# Long enough to cover a booking made far in advance, since max_advance_days
# already caps how far ahead a slot can be.
MAX_AGE_SECONDS = 400 * 24 * 60 * 60


def make_cancel_token(event_id) -> str:
    return signing.dumps(str(event_id), salt=SALT)


def read_cancel_token(token: str) -> str | None:
    """The event id the token vouches for, or None if it is bad or stale."""
    try:
        return signing.loads(token, salt=SALT, max_age=MAX_AGE_SECONDS)
    except signing.BadSignature:
        return None
