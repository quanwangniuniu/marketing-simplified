from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_fsm import TransitionNotAllowed

from core.permissions import IsProjectMember
from core.viewset_mixins import ProjectScopedViewSetMixin

from .models import ExperienceGroup
from .serializers import ExperienceGroupSerializer, ExperienceGroupListSerializer


class ExperienceGroupViewSet(ProjectScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = ExperienceGroup.objects.all()
    serializer_class = ExperienceGroupSerializer
    permission_classes = [IsAuthenticated, IsProjectMember]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if self.action in ('list', 'create'):
            context['project_id'] = self.get_required_project_id()
        return context

    def get_serializer_class(self):
        if self.action == 'list':
            return ExperienceGroupListSerializer
        return ExperienceGroupSerializer

    def get_queryset(self):
        if self.action == 'list':
            project_id = self.get_required_project_id()
            return ExperienceGroup.objects.filter(project_id=project_id)
        return self.filter_by_accessible_projects(ExperienceGroup.objects.all())

    def perform_create(self, serializer):
        project_id = self.get_required_project_id()
        serializer.save(
            created_by=self.request.user,
            project_id=project_id,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()

        if instance.status == ExperienceGroup.PublishStatus.PUBLISHED:
            # Preserve the live published content in main fields.
            # Store incoming edits in draft_snapshot so publish()/preview() can apply them.
            allowed_fields = ['name', 'description']
            snapshot = {k: request.data[k] for k in allowed_fields if k in request.data}
            instance.revert_to_draft()
            instance.draft_snapshot = snapshot
            instance.save()
            serializer = self.get_serializer(instance)
            return Response(serializer.data)

        # DRAFT group: save edits directly to main fields and clear any stale snapshot.
        instance.draft_snapshot = None
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        if getattr(instance, '_prefetched_objects_cache', None):
            instance._prefetched_objects_cache = {}

        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()

        customer_count = instance.customers.count()
        if customer_count > 0:
            return Response(
                {
                    'detail': (
                        f'Cannot delete: {customer_count} customer(s) are assigned to this group. '
                        'Reassign them first.'
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        instance = self.get_object()

        if instance.draft_snapshot:
            snapshot = instance.draft_snapshot
            allowed_fields = ['name', 'description']
            for field in allowed_fields:
                if field in snapshot:
                    setattr(instance, field, snapshot[field])
            instance.draft_snapshot = None

        try:
            instance.publish()
        except TransitionNotAllowed:
            return Response(
                {'detail': 'This group cannot be published in its current state.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        instance.save()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def preview(self, request, pk=None):
        instance = self.get_object()

        preview_data = ExperienceGroupSerializer(instance).data

        if instance.draft_snapshot:
            for key, value in instance.draft_snapshot.items():
                if key in preview_data:
                    preview_data[key] = value

        preview_data['is_preview'] = True
        return Response(preview_data)
