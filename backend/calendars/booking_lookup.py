"""
Find a guest's booking again without the mail they never received.

Name, email, or phone — exactly one — is enough. The cancel token is
re-issued so they can cancel from the public page.
"""

from __future__ import annotations

from django.db.models import QuerySet
from django.utils import timezone

from .booking_write import CANONICAL_ROLES, event_belongs_to_booking_link
from .models import Event, EventAttendee


def _digits(value: str) -> str:
    return "".join(character for character in value if character.isdigit())


def phones_match(stored: str, query: str) -> bool:
    """Same number even if one side kept spaces or a country code."""
    left = _digits(stored)
    right = _digits(query)
    if not left or not right:
        return False
    if left == right:
        return True
    return len(left) >= 8 and len(right) >= 8 and (
        left.endswith(right) or right.endswith(left)
    )


def _upcoming_guest_attendees(link) -> QuerySet[EventAttendee]:
    return (
        EventAttendee.objects.filter(
            organization=link.organization,
            is_organizer=False,
            event__is_deleted=False,
            event__start_datetime__gte=timezone.now(),
        )
        .exclude(event__status="cancelled")
        .select_related("event")
    )


def _dedupe_canonical(events: list[Event]) -> list[Event]:
    by_group: dict[str, Event] = {}
    for event in events:
        group = (event.metadata or {}).get("booking_group") or str(event.pk)
        role = (event.metadata or {}).get("booking_role")
        existing = by_group.get(group)
        if existing is None or role in CANONICAL_ROLES:
            by_group[group] = event
    return sorted(by_group.values(), key=lambda event: event.start_datetime)


def find_guest_bookings(
    *,
    link,
    name: str = "",
    email: str = "",
    phone: str = "",
) -> list[Event]:
    """
    Upcoming bookings on this link matching exactly one of name / email / phone.

    Dedupes primary + project copies. The cancel token names the canonical
    (host primary) row when both exist. The host's own attendee row is
    ignored so looking up the owner does not list every booking.
    """
    name = (name or "").strip()
    email = (email or "").strip()
    phone = (phone or "").strip()

    attendees = _upcoming_guest_attendees(link)
    matched: list[Event] = []
    for attendee in attendees:
        event = attendee.event
        if not event_belongs_to_booking_link(event, link):
            continue
        if email and (attendee.email or "").lower() == email.lower():
            matched.append(event)
        elif name and (attendee.display_name or "").strip().lower() == name.lower():
            matched.append(event)
        elif phone and phones_match(attendee.phone or "", phone):
            matched.append(event)

    return _dedupe_canonical(matched)
