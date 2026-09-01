"""
Booking emails.

A guest has no account and no notification bell, so email is the only thing
that reaches them after they close the tab. It carries what they need to act on
the booking later: the cancellation link, and the subscription URL that keeps
their own calendar in step with ours.

Runs on Celery rather than in the request. Mail is slow and can fail, and a
confirmed booking must never depend on an SMTP round trip.
"""

from __future__ import annotations

import logging

from celery import shared_task
from django.conf import settings
from django.core.mail import EmailMultiAlternatives

logger = logging.getLogger(__name__)


def _plain_body(*, guest_name, title, when, host_name, cancel_url, feed_url) -> str:
    lines = [
        f"Hi {guest_name},",
        "",
        f"Your booking with {host_name} is confirmed.",
        "",
        f"{title}",
        f"{when}",
        "",
        "The calendar entry is attached.",
    ]
    if feed_url:
        lines += [
            "",
            "To keep it up to date automatically, subscribe your calendar to:",
            feed_url,
        ]
    if cancel_url:
        lines += ["", "Need to cancel? Use this link:", cancel_url]
    return "\n".join(lines)


@shared_task(bind=True, ignore_result=True, max_retries=3)
def send_booking_confirmation_task(
    self,
    *,
    to_email: str,
    guest_name: str,
    host_name: str,
    title: str,
    when: str,
    ics_body: str,
    cancel_url: str = "",
    feed_url: str = "",
):
    if not to_email:
        return

    try:
        message = EmailMultiAlternatives(
            subject=f"Confirmed: {title}",
            body=_plain_body(
                guest_name=guest_name,
                title=title,
                when=when,
                host_name=host_name,
                cancel_url=cancel_url,
                feed_url=feed_url,
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[to_email],
        )
        # Attached rather than inlined as METHOD:REQUEST: an invitation implies
        # an RSVP channel back to the host, and there is none.
        message.attach("booking.ics", ics_body, "text/calendar")
        message.send(fail_silently=False)
    except Exception as exc:
        logger.warning(
            "booking confirmation email failed to=%s title=%s: %s", to_email, title, exc
        )
        # Retry a transient SMTP problem, but never let it bubble: the booking
        # itself already succeeded and must not be reported as failed.
        try:
            self.retry(exc=exc, countdown=60)
        except Exception:
            logger.exception("booking confirmation email gave up to=%s", to_email)
