from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.permissions import IsProjectMember
from core.viewset_mixins import ProjectScopedViewSetMixin

from .models import Customer
from .serializers import CustomerSerializer


class CustomerViewSet(ProjectScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = Customer.objects.select_related('experience_group').all()
    serializer_class = CustomerSerializer
    permission_classes = [IsAuthenticated, IsProjectMember]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if self.action in ('list', 'create'):
            context['project_id'] = self.get_required_project_id()
        return context

    def get_queryset(self):
        base = Customer.objects.select_related('experience_group')
        if self.action == 'list':
            project_id = self.get_required_project_id()
            return base.filter(project_id=project_id)
        return self.filter_by_accessible_projects(base)

    def perform_create(self, serializer):
        project_id = self.get_required_project_id()
        serializer.save(project_id=project_id)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
