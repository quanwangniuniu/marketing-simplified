from dataclasses import dataclass
from typing import Optional

from django.db.models import Q, QuerySet
from rest_framework.exceptions import ValidationError as DRFValidationError

from core.models import Organization, Project, ProjectMember
from core.permissions import PROJECT_MEMBER_ADMIN_SUPER_ROLES


SLACK_MANAGER_ROLES = PROJECT_MEMBER_ADMIN_SUPER_ROLES | {"owner"}


@dataclass(frozen=True)
class SlackAccessScope:
    can_manage_slack: bool
    manageable_projects: QuerySet
    organization: Optional[Organization] = None
    context_project: Optional[Project] = None


def can_manage_project_slack(user, project: Optional[Project]) -> bool:
    if (
        user is None
        or not getattr(user, "is_authenticated", False)
        or project is None
        or project.is_deleted
    ):
        return False

    if project.owner_id == user.id:
        return True

    return ProjectMember.objects.filter(
        user=user,
        project=project,
        is_active=True,
        role__in=SLACK_MANAGER_ROLES,
    ).exists()


def get_manageable_slack_projects(user, organization: Optional[Organization] = None) -> QuerySet:
    """
    Return the projects where the user may manage Slack settings.
    """
    if user is None or not getattr(user, "is_authenticated", False):
        return Project.objects.none()

    project_queryset = Project.objects.filter(is_deleted=False)
    if organization is not None:
        project_queryset = project_queryset.filter(organization=organization)

    return (
        project_queryset
        .filter(
            Q(owner_id=user.id)
            | Q(
                members__user=user,
                members__is_active=True,
                members__role__in=SLACK_MANAGER_ROLES,
            )
        )
        .distinct()
        .order_by("name")
    )


def _parse_context_id(raw_value, field_name: str) -> Optional[int]:
    if raw_value in (None, ""):
        return None

    try:
        return int(raw_value)
    except (TypeError, ValueError) as exc:
        raise DRFValidationError({field_name: "Must be a valid integer."}) from exc


def _build_scope(
    manageable_projects: QuerySet,
    organization: Optional[Organization] = None,
    context_project: Optional[Project] = None,
) -> SlackAccessScope:
    return SlackAccessScope(
        can_manage_slack=manageable_projects.exists(),
        manageable_projects=manageable_projects,
        organization=organization,
        context_project=context_project,
    )


def resolve_slack_access(user, request=None, organization_id=None, project_id=None) -> SlackAccessScope:
    if user is None or not getattr(user, "is_authenticated", False):
        return _build_scope(Project.objects.none())

    query_params = getattr(request, "query_params", None)
    if project_id is None and query_params is not None:
        project_id = _parse_context_id(query_params.get("project_id"), "project_id")
    if organization_id is None and query_params is not None:
        organization_id = _parse_context_id(
            query_params.get("organization_id"),
            "organization_id",
        )

    if project_id is not None:
        project = (
            Project.objects.select_related("organization")
            .filter(id=project_id, is_deleted=False)
            .first()
        )
        if project is None or not can_manage_project_slack(user, project):
            return _build_scope(Project.objects.none())

        manageable_projects = get_manageable_slack_projects(
            user,
            organization=project.organization,
        )
        return _build_scope(
            manageable_projects,
            organization=project.organization,
            context_project=project,
        )

    if organization_id is not None:
        organization = Organization.objects.filter(
            id=organization_id,
            is_deleted=False,
        ).first()
        if organization is None:
            raise DRFValidationError(
                {"organization_id": "Organization not found."}
            )

        manageable_projects = get_manageable_slack_projects(
            user,
            organization=organization,
        )
        return _build_scope(manageable_projects, organization=organization)

    active_project = getattr(user, "active_project", None)
    if can_manage_project_slack(user, active_project):
        manageable_projects = get_manageable_slack_projects(
            user,
            organization=active_project.organization,
        )
        return _build_scope(
            manageable_projects,
            organization=active_project.organization,
            context_project=active_project,
        )

    manageable_projects = get_manageable_slack_projects(user)
    organization_ids = list(
        manageable_projects.values_list("organization_id", flat=True).distinct()
    )

    if not organization_ids:
        return _build_scope(Project.objects.none())

    if len(organization_ids) > 1:
        raise DRFValidationError(
            {
                "project_id": (
                    "Slack context is ambiguous. Provide project_id or organization_id."
                )
            }
        )

    organization = Organization.objects.filter(
        id=organization_ids[0],
        is_deleted=False,
    ).first()
    if organization is None:
        return _build_scope(Project.objects.none())

    manageable_projects = manageable_projects.filter(organization=organization)
    return SlackAccessScope(
        can_manage_slack=True,
        manageable_projects=manageable_projects,
        organization=organization,
    )
