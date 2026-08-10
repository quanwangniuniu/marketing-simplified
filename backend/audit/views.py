from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from .models import AdminAuditEvent
from .serializers import AdminAuditEventSerializer

class AdminAuditEventListView(ListAPIView):
    serializer_class = AdminAuditEventSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = AdminAuditEvent.objects.select_related('actor')

        # filter by action
        action = self.request.query_params.get("action")
        if action:
            qs = qs.filter(action = action)

        target_type = self.request.query_params.get("target_type")
        if target_type:
            qs = qs.filter(target_type=target_type)

        return qs