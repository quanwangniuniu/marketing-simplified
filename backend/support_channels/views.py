from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from core.models import ProjectMember
from .models import ExperienceGroup, SupportChannel
from .serializers import ExperienceGroupSerializer, SupportChannelSerializer


def _get_user_project_ids(user):
    return ProjectMember.objects.filter(
        user=user, is_active=True
    ).values_list('project_id', flat=True)


class ExperienceGroupViewSet(ModelViewSet):
    serializer_class = ExperienceGroupSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        project_ids = _get_user_project_ids(self.request.user)
        qs = ExperienceGroup.objects.filter(project_id__in=project_ids)
        project_id = self.request.query_params.get('project_id')
        if project_id:
            qs = qs.filter(project_id=project_id)
        return qs


class SupportChannelViewSet(ModelViewSet):
    serializer_class = SupportChannelSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        project_ids = _get_user_project_ids(self.request.user)
        qs = SupportChannel.objects.filter(
            project_id__in=project_ids
        ).prefetch_related('experience_groups')

        project_id = self.request.query_params.get('project_id')
        if project_id:
            qs = qs.filter(project_id=project_id)

        channel_type = self.request.query_params.get('channel_type')
        if channel_type:
            qs = qs.filter(channel_type=channel_type)

        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() == 'true')

        return qs

    @action(detail=False, methods=['get'], url_path='choices')
    def choices(self, request):
        return Response({
            'channel_types': [
                {'value': k, 'label': v}
                for k, v in SupportChannel.ChannelType.choices
            ]
        })

    @action(detail=True, methods=['post'], url_path='deactivate')
    def deactivate(self, request, pk=None):
        channel = self.get_object()
        channel.is_active = False
        channel.save()
        return Response(self.get_serializer(channel).data)

    @action(detail=True, methods=['post'], url_path='activate')
    def activate(self, request, pk=None):
        channel = self.get_object()
        channel.is_active = True
        channel.save()
        return Response(self.get_serializer(channel).data)
