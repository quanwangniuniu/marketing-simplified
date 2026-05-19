"""Shared DRF mixins for project-scoped resources."""

from rest_framework.exceptions import PermissionDenied, ValidationError

from core.models import ProjectMember


class ProjectScopedViewSetMixin:
    """
    Restrict list/create to a ?project= query param the user belongs to.
    Restrict retrieve/update/destroy to objects in accessible projects.
    """

    project_query_param = 'project'

    def _accessible_project_ids(self):
        if not self.request.user.is_authenticated:
            return []
        return ProjectMember.objects.filter(
            user=self.request.user,
            is_active=True,
        ).values_list('project_id', flat=True)

    def _parse_project_id(self, raw):
        if raw is None or str(raw).strip() == '':
            return None
        try:
            return int(raw)
        except (TypeError, ValueError):
            return None

    def _require_project_access(self, project_id):
        if project_id is None:
            raise ValidationError(
                {self.project_query_param: 'This query parameter is required.'}
            )
        if not ProjectMember.objects.filter(
            user=self.request.user,
            project_id=project_id,
            is_active=True,
        ).exists():
            raise PermissionDenied('You are not a member of this project.')
        return project_id

    def get_required_project_id(self):
        """Project id from query string; validated for membership."""
        raw = self.request.query_params.get(self.project_query_param)
        return self._require_project_access(self._parse_project_id(raw))

    def filter_by_accessible_projects(self, queryset):
        return queryset.filter(project_id__in=self._accessible_project_ids())
