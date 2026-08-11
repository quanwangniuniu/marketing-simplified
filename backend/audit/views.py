from django.db.models import Q
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from .models import AdminAuditEvent
from .serializers import AdminAuditEventSerializer

class AdminAuditEventListView(ListAPIView):
    serializer_class = AdminAuditEventSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        # Always scope to the current user's organization so that admins from
        # different orgs cannot see each other's audit logs.
        org_id = getattr(user, 'current_organization_id', None) or getattr(user, 'organization_id', None)

        # Safety: if org_id is None we cannot determine which tenant this user
        # belongs to. Returning all null-org events would expose data across
        # org boundaries (filter(organization_id=None) generates IS NULL which
        # matches every system-level event). Staff/superusers may see all events.
        if org_id is None:
            if user.is_staff or user.is_superuser:
                qs = AdminAuditEvent.objects.select_related('actor').all()
            else:
                return AdminAuditEvent.objects.none()
        else:
            qs = AdminAuditEvent.objects.select_related('actor').filter(organization_id=org_id)

        # Optional: filter by project.
        # Returns events that belong to the given project OR have no project
        # (org-level actions like role changes, slug updates, etc.)
        project_id = self.request.query_params.get("project_id")
        if project_id:
            qs = qs.filter(Q(project_id=project_id) | Q(project__isnull=True))

        # Optional: filter by action code
        action = self.request.query_params.get("action")
        if action:
            qs = qs.filter(action=action)

        # Optional: filter by target model type
        target_type = self.request.query_params.get("target_type")
        if target_type:
            qs = qs.filter(target_type=target_type)

        return qs