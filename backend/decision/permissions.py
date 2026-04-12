from rest_framework import permissions

from core.models import ProjectMember

from .models import Decision
from .constants import (
    APPROVAL_REVIEW_MAX_LEVEL,
    EDIT_MAX_LEVEL,
    ROLE_LEVELS,
    VIEW_MAX_LEVEL,
)


class DecisionPermission(permissions.BasePermission):
    def has_permission(self, request, view):
        if request is None or view is None:
            return False

        user = getattr(request, "user", None)
        if user is None or not user.is_authenticated:
            return False

        if user.is_superuser:
            return True

        action = getattr(view, "action", None)
        if action == "list":
            return ProjectMember.objects.filter(user=user, is_active=True).exists()

        raw_project_id = request.headers.get("x-project-id") or request.query_params.get(
            "project_id"
        )
        try:
            project_id = int(raw_project_id)
        except (TypeError, ValueError):
            return False

        membership = ProjectMember.objects.filter(
            user=user,
            project_id=project_id,
            is_active=True,
        ).first()
        if not membership:
            return False

        role = (membership.role or "").strip()
        role_level = ROLE_LEVELS.get(role, ROLE_LEVELS.get("viewer", 999))

        if action in ("approve", "reviews"):
            return role_level <= APPROVAL_REVIEW_MAX_LEVEL

        if action == "list":
            return role_level <= VIEW_MAX_LEVEL

        if action == "retrieve":
            return True

        if action == "connections":
            if request.method == "GET":
                return role_level <= VIEW_MAX_LEVEL
            return role_level <= EDIT_MAX_LEVEL

        if action in ("create", "update", "partial_update", "commit", "archive", "destroy"):
            return role_level <= EDIT_MAX_LEVEL

        return True

    def has_object_permission(self, request, view, obj):
        if request is None or obj is None:
            return False

        user = getattr(request, "user", None)
        if user is None or not user.is_authenticated:
            return False

        raw_project_id = request.headers.get("x-project-id") or request.query_params.get(
            "project_id"
        )
        try:
            project_id = int(raw_project_id)
        except (TypeError, ValueError):
            project_id = None

        if isinstance(obj, Decision):
            obj_pid = getattr(obj, "project_id", None)
            if obj_pid is not None and project_id is not None and int(obj_pid) != project_id:
                return False

        if user.is_superuser:
            return True

        if project_id is None:
            return False

        membership = ProjectMember.objects.filter(
            user=user,
            project_id=project_id,
            is_active=True,
        ).first()
        if not membership:
            return False

        action = getattr(view, "action", None)
        role = (membership.role or "").strip()
        role_level = ROLE_LEVELS.get(role, ROLE_LEVELS.get("viewer", 999))

        if action in ("approve", "reviews"):
            return role_level <= APPROVAL_REVIEW_MAX_LEVEL

        if action == "list":
            return role_level <= VIEW_MAX_LEVEL

        if action == "retrieve":
            return True

        if action == "connections":
            if request.method == "GET":
                return role_level <= VIEW_MAX_LEVEL
            return role_level <= EDIT_MAX_LEVEL

        if action in ("create", "update", "partial_update", "commit", "archive", "destroy"):
            return role_level <= EDIT_MAX_LEVEL

        return True
