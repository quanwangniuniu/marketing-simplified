import logging

from celery import shared_task

from .models import GoogleCalendarConnection
from .services import import_events_for_connection

logger = logging.getLogger(__name__)


@shared_task(bind=True, ignore_result=True)
def import_for_connection_task(self, connection_id: int):
    conn = GoogleCalendarConnection.objects.filter(id=connection_id, is_active=True).first()
    if not conn:
        return
    try:
        import_events_for_connection(conn)
    except Exception:
        logger.exception("google_calendar import_for_connection failed id=%s", connection_id)


@shared_task(bind=True, ignore_result=True)
def sync_all_google_calendar_imports(self):
    qs = GoogleCalendarConnection.objects.filter(is_active=True)
    for conn in qs.iterator():
        try:
            import_events_for_connection(conn)
        except Exception:
            logger.exception("google_calendar beat sync failed user=%s", conn.user_id)


@shared_task(bind=True, ignore_result=True)
def export_event_to_google_task(self, event_id: str, tenant_schema: str = 'public'):
    """
    Export one event to the owner's Google Calendar.

    `tenant_schema` is required for orgs with a provisioned schema: Event is
    tenant-scoped and a Celery worker never passes through
    TenantSchemaMiddleware, so without it the lookup runs against `public` and
    silently finds nothing. Defaults to 'public' so existing callers keep their
    current behaviour.

    Known gaps, deliberately left for follow-up work:
      - export only; there is no delete/update counterpart, so cancelling an
        event locally leaves it in place on Google.
      - only the primary calendar is picked up, and `is_primary` is set solely
        by the Google connect flow.
      - exercised against mocks only; not yet verified against live Google.
    """
    from calendars.models import Event

    from core.tenant_context import tenant_schema_context

    from .services import export_event_to_google

    with tenant_schema_context(tenant_schema):
        ev = Event.objects.filter(id=event_id).first()
        if not ev:
            return
        try:
            export_event_to_google(ev)
        except Exception:
            logger.exception("google_calendar export failed event=%s", event_id)
