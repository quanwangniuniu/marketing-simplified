"""
In-app notifications for booking links.

Only people with an account here can be notified; a guest booking leaves
nothing to notify, which is why every helper takes a user or a null and simply
does less when it gets the null.

`notifications.services.create_notification` already suppresses the case where
the recipient is the actor, so setting up your own link stays silent without
any check here.
"""

from __future__ import annotations

import logging

from notifications.models import NotificationCategory, NotificationEventType
from notifications.services import create_notification

logger = logging.getLogger(__name__)

LINKS_URL = "/calendar/booking-links"
CALENDAR_URL = "/calendar"


def _display_name(user) -> str:
    if not user:
        return "Someone"
    return user.get_full_name() or user.get_username()


def _notify(**kwargs):
    """
    Never let a notification failure take down the thing it is reporting on.

    A booking that succeeded must not 500 because the bell could not be
    updated - the meeting is real either way.
    """
    try:
        return create_notification(**kwargs)
    except Exception:
        logger.exception(
            "booking notification failed event=%s recipient=%s",
            kwargs.get("event_type"),
            kwargs.get("recipient_id"),
        )
        return None


def notify_link_created(link, actor) -> None:
    """Tell the host, and any named guest, that a link now exists."""
    actor_id = getattr(actor, "pk", None)
    actor_name = _display_name(actor)

    if link.owner_id:
        _notify(
            recipient_id=link.owner_id,
            actor_id=actor_id,
            category=NotificationCategory.MEETINGS,
            event_type=NotificationEventType.MEETING_CREATED,
            title=f"{actor_name} set up a booking link for your time",
            body=link.title,
            related_object_type="booking_link",
            related_object_id=str(link.id),
            action_url=LINKS_URL,
        )

    if link.invitee_user_id and link.invitee_user_id != link.owner_id:
        _notify(
            recipient_id=link.invitee_user_id,
            actor_id=actor_id,
            category=NotificationCategory.MEETINGS,
            event_type=NotificationEventType.MEETING_PARTICIPANT_ADDED,
            title=f"{_display_name(link.owner)} is available to meet",
            body=link.title,
            related_object_type="booking_link",
            related_object_id=str(link.id),
            action_url=LINKS_URL,
        )


def notify_booking_made(link, event, booker_user, booker_name: str) -> None:
    """
    Tell the host someone booked, and confirm it to the guest if we can.

    The guest is anonymous by default, so the second notification only happens
    when their address matched an account.
    """
    _notify(
        recipient_id=link.owner_id,
        # Anonymous: there is no acting account behind a public booking.
        actor_id=None,
        category=NotificationCategory.MEETINGS,
        event_type=NotificationEventType.MEETING_CREATED,
        title=f"{booker_name} booked time with you",
        body=event.title,
        related_object_type="event",
        related_object_id=str(event.id),
        action_url=CALENDAR_URL,
    )

    booker_id = getattr(booker_user, "pk", None)
    if booker_id and booker_id != link.owner_id:
        _notify(
            recipient_id=booker_id,
            actor_id=None,
            category=NotificationCategory.MEETINGS,
            event_type=NotificationEventType.MEETING_PARTICIPANT_ADDED,
            title=f"You booked time with {_display_name(link.owner)}",
            body=event.title,
            related_object_type="event",
            related_object_id=str(event.id),
            action_url=CALENDAR_URL,
        )


def notify_booking_cancelled(event, host_id: int, guest_user_id, actor, by_guest: bool) -> None:
    """
    Cancelling tells the other side, whichever side did it.

    Mirrors how Google and Outlook behave: one cancellation ends the meeting for
    everyone, so nobody is left holding a slot that no longer exists.
    """
    actor_id = getattr(actor, "pk", None)
    who = "The guest" if by_guest else _display_name(actor)

    for recipient_id in {host_id, guest_user_id} - {None, actor_id}:
        _notify(
            recipient_id=recipient_id,
            actor_id=actor_id,
            category=NotificationCategory.MEETINGS,
            event_type=NotificationEventType.MEETING_UPDATED,
            title=f"{who} cancelled a booking",
            body=event.title,
            related_object_type="event",
            related_object_id=str(event.id),
            action_url=CALENDAR_URL,
        )
