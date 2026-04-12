import datetime
from typing import Iterable, List, Tuple

from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone as dj_timezone
from django.utils.text import slugify

from rest_framework import serializers as drf_serializers

from core.models import Project, ProjectMember
from meetings.models import AgendaItem, Meeting, MeetingTypeDefinition, ParticipantLink


def validate_meeting_for_origin_link(*, meeting_id: int, project: Project, user) -> Meeting:
    """
    Ensure ``meeting_id`` can be used as the origin meeting for a task/decision in ``project``.

    Same-project rules are enforced here; membership is checked against ``project``.
    """
    if project is None:
        raise drf_serializers.ValidationError(
            {"origin_meeting_id": "Project is required."},
        )

    try:
        meeting = Meeting.objects.get(pk=meeting_id, is_deleted=False)
    except Meeting.DoesNotExist:
        raise drf_serializers.ValidationError({"origin_meeting_id": "Meeting not found."})

    if meeting.project_id != project.id:
        raise drf_serializers.ValidationError(
            {"origin_meeting_id": "Meeting must belong to the same project."},
        )

    if meeting.is_archived:
        raise drf_serializers.ValidationError(
            {"origin_meeting_id": "Cannot link to an archived meeting."},
        )

    has_membership = ProjectMember.objects.filter(
        user=user,
        project=project,
        is_active=True,
    ).exists()
    if not has_membership:
        raise drf_serializers.ValidationError(
            {"origin_meeting_id": "You do not have access to this project."},
        )

    return meeting

# Whitelist for GET /projects/{id}/meetings/ — must stay in sync with OpenAPI contract.
MEETING_LIST_ORDERING_MAP: dict[str, Tuple[str, ...]] = {
    "created_at": ("created_at", "id"),
    "-created_at": ("-created_at", "-id"),
    "scheduled_date": ("scheduled_date", "id"),
    "-scheduled_date": ("-scheduled_date", "-id"),
    "updated_at": ("updated_at", "id"),
    "-updated_at": ("-updated_at", "-id"),
    "title": ("title", "id"),
    "-title": ("-title", "-id"),
}


def meetings_base_queryset_for_project(project: Project):
    """
    Project-scoped meetings with provenance counts and ORM optimisation for list/detail.
    """

    return (
        Meeting.objects.for_knowledge_discovery()
        .filter(project=project, is_deleted=False)
        .annotate(
            decision_count=Count(
                "decision_origins",
                filter=Q(decision_origins__decision__is_deleted=False),
                distinct=True,
            ),
            task_count=Count("task_origins", distinct=True),
        )
    )


def apply_meeting_knowledge_filters(qs, filters: dict):
    """
    Apply validated query params. Callers should ``.distinct()`` after this when joins may duplicate rows.
    """

    q = filters.get("q")
    if q:
        qs = qs.filter(Q(title__icontains=q) | Q(summary__icontains=q))

    mt = filters.get("meeting_type")
    if mt:
        # Single slug or list — always OR via __in (never chain .filter(slug=a).filter(slug=b)).
        if isinstance(mt, str):
            slugs = [mt.strip()] if str(mt).strip() else []
        else:
            slugs = [str(x).strip() for x in mt if str(x).strip()]
        if slugs:
            qs = qs.filter(type_definition__slug__in=slugs)

    participants_in = filters.get("participant")
    if participants_in:
        if isinstance(participants_in, int):
            participants_in = [participants_in]
        qs = qs.filter(participant_links__user_id__in=participants_in).distinct()

    participants_ex = filters.get("exclude_participant")
    if participants_ex:
        if isinstance(participants_ex, int):
            participants_ex = [participants_ex]
        bad_meeting_ids = ParticipantLink.objects.filter(
            user_id__in=participants_ex
        ).values_list("meeting_id", flat=True)
        qs = qs.exclude(pk__in=bad_meeting_ids)

    tag = filters.get("tag")
    if tag:
        qs = qs.filter(tag_assignments__tag_definition__slug=tag)

    date_from = filters.get("date_from")
    date_to = filters.get("date_to")
    if date_from or date_to:
        qs = qs.filter(scheduled_date__isnull=False)
        if date_from:
            qs = qs.filter(scheduled_date__gte=date_from)
        if date_to:
            qs = qs.filter(scheduled_date__lte=date_to)

    if "is_archived" in filters:
        qs = qs.filter(is_archived=filters["is_archived"])

    # Origin-only: decision_count / task_count count origins (decisions exclude soft-deleted).
    hgd = filters.get("has_generated_decisions")
    if hgd is True:
        qs = qs.filter(decision_count__gt=0)
    elif hgd is False:
        qs = qs.filter(decision_count=0)

    hgt = filters.get("has_generated_tasks")
    if hgt is True:
        qs = qs.filter(task_count__gt=0)
    elif hgt is False:
        qs = qs.filter(task_count=0)

    return qs


def meeting_list_order_by_fields(ordering: str) -> Tuple[str, ...]:
    return MEETING_LIST_ORDERING_MAP[ordering]


def _is_scheduled_calendar_day_fully_past(
    scheduled_date,
    now: datetime.datetime,
) -> bool:
    """
    Mirror meetings hub client split (``meetingScheduleSplit``): a meeting is **Completed** when the
    scheduled **calendar day** has fully ended in Django's active timezone (see ``TIME_ZONE``).
    Undated meetings are **Incoming**.
    """

    if scheduled_date is None:
        return False
    tz = dj_timezone.get_current_timezone()
    naive_end = datetime.datetime.combine(
        scheduled_date, datetime.time(23, 59, 59, 999999)
    )
    end_of_day = dj_timezone.make_aware(naive_end, tz)
    return now > end_of_day


def hub_split_meeting_pks_for_project(project: Project) -> Tuple[set[int], set[int]]:
    """
    Split **all** project meetings into Incoming vs Completed hub lanes (same calendar-day rule
    as the frontend). Uses a lightweight ``Meeting`` query (no list annotations / JOINs).

    Returns:
        (incoming_pks, completed_pks)
    """

    now = dj_timezone.now()
    incoming: set[int] = set()
    completed: set[int] = set()
    qs = Meeting.objects.filter(project=project, is_deleted=False).values_list(
        "pk", "scheduled_date"
    )
    for pk, sd in qs.iterator(chunk_size=2000):
        if _is_scheduled_calendar_day_fully_past(sd, now):
            completed.add(pk)
        else:
            incoming.add(pk)
    return incoming, completed


def ensure_meeting_type_definition(project: Project, label: str) -> MeetingTypeDefinition:
    """
    Resolve a human-entered meeting type string to a **project-scoped** structured row.
    """

    raw = (label or "").strip() or "general"
    safe_label = raw[:160]
    base_slug = (slugify(raw)[:80] or "general")[:80]
    slug = base_slug
    for i in range(1000):
        if i > 0:
            suffix = f"-{i}"
            slug = (base_slug[: 80 - len(suffix)] + suffix)[:80]
        mtd, created = MeetingTypeDefinition.objects.get_or_create(
            project_id=project.id,
            slug=slug,
            defaults={"label": safe_label},
        )
        if created or mtd.label == safe_label:
            return mtd
    raise ValueError("Could not allocate meeting type slug")  # pragma: no cover - defensive
from core.models import ProjectMember
from meetings.models import AgendaItem, Meeting, MeetingDocument, ParticipantLink


def user_has_meeting_document_access(user_id: int, meeting: Meeting) -> bool:
    """Project member (active) or explicit meeting participant may load/sync the meeting document."""
    if ProjectMember.objects.filter(
        user_id=user_id,
        project_id=meeting.project_id,
        is_active=True,
    ).exists():
        return True
    return ParticipantLink.objects.filter(meeting_id=meeting.id, user_id=user_id).exists()


def reorder_agenda_items(meeting_id: int, items: Iterable[dict]) -> List[AgendaItem]:
    """
    Reorder agenda items for a given meeting.

    This function performs the update in a single transaction to avoid
    transient unique_together(meeting, order_index) conflicts.
    """

    items = list(items)

    temp_offset = 1000000

    with transaction.atomic():
        agenda_items = {
            item.id: item
            for item in AgendaItem.objects.select_for_update().filter(
                meeting_id=meeting_id, id__in=[i["id"] for i in items]
            )
        }

        for payload in items:
            agenda_item = agenda_items.get(payload["id"])
            if not agenda_item:
                continue
            agenda_item.order_index = payload["order_index"] + temp_offset
            agenda_item.save(update_fields=["order_index"])

        for payload in items:
            agenda_item = agenda_items.get(payload["id"])
            if not agenda_item:
                continue
            agenda_item.order_index = payload["order_index"]
            agenda_item.save(update_fields=["order_index"])

    return list(
        AgendaItem.objects.filter(meeting_id=meeting_id).order_by("order_index")
    )


def get_or_create_meeting_document(meeting_id: int) -> MeetingDocument:
    document, _ = MeetingDocument.objects.get_or_create(meeting_id=meeting_id)
    return document


def update_meeting_document_content(
    *,
    meeting_id: int,
    content: str,
    yjs_state: str | None = None,
    user_id: int | None = None,
) -> MeetingDocument:
    document = get_or_create_meeting_document(meeting_id)
    document.content = content
    if isinstance(yjs_state, str):
        document.yjs_state = yjs_state
    document.last_edited_by_id = user_id
    update_fields = ["content", "last_edited_by", "updated_at"]
    if isinstance(yjs_state, str):
        update_fields.append("yjs_state")
    document.save(update_fields=update_fields)
    return document

