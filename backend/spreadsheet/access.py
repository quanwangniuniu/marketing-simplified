"""Project-scoped access helpers for spreadsheet HTTP and WebSocket paths."""

from django.db.models import Q, QuerySet
from django.shortcuts import get_object_or_404

from core.admin_utils import get_org_admin_org_ids
from core.models import Project

from .models import Sheet, Spreadsheet


def accessible_projects(user) -> QuerySet[Project]:
    """Projects the authenticated user may access.

    Active project membership is the normal access path. Project ownership is
    also accepted because ``Project.owner`` is the authoritative owner field,
    including for older projects whose owner membership was not backfilled.
    Organization administrators retain the same organization-wide access used
    by the shared project-scoped API mixins.
    """
    if not user or not getattr(user, "is_authenticated", False):
        return Project.objects.none()
    if getattr(user, "is_superuser", False):
        return Project.objects.all()

    access_filter = Q(owner_id=user.id) | Q(
        members__user_id=user.id,
        members__is_active=True,
    )
    org_ids = get_org_admin_org_ids(user)
    if org_ids:
        access_filter |= Q(organization_id__in=org_ids)
    return Project.objects.filter(access_filter).distinct()


def accessible_spreadsheets(user) -> QuerySet[Spreadsheet]:
    return (
        Spreadsheet.objects.filter(
            project_id__in=accessible_projects(user).values("id"),
            is_deleted=False,
        )
        .select_related("project")
        .distinct()
    )


def accessible_sheets(user) -> QuerySet[Sheet]:
    return (
        Sheet.objects.filter(
            spreadsheet__project_id__in=accessible_projects(user).values("id"),
            spreadsheet__is_deleted=False,
            is_deleted=False,
        )
        .select_related("spreadsheet", "spreadsheet__project")
        .distinct()
    )


def get_accessible_project_or_404(user, **lookup) -> Project:
    return get_object_or_404(accessible_projects(user), **lookup)


def get_accessible_spreadsheet_or_404(user, **lookup) -> Spreadsheet:
    return get_object_or_404(accessible_spreadsheets(user), **lookup)


def get_accessible_sheet_or_404(user, **lookup) -> Sheet:
    return get_object_or_404(accessible_sheets(user), **lookup)

