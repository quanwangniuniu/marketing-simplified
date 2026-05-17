from rest_framework import generics, permissions
from django.shortcuts import get_object_or_404

from task.models import Task
from .models import ClientCommunication
from .serializers import (
    ClientCommunicationSerializer,
    ClientCommunicationCreateSerializer,
)


class ClientCommunicationListCreateView(generics.ListCreateAPIView):
    """
    List and create client communications tied to tasks.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        task_id = self.request.query_params.get("task_id")
        queryset = ClientCommunication.objects.all()
        if task_id:
            queryset = queryset.filter(task_id=task_id)
        return queryset

    def get_serializer_class(self):
        if self.request.method == "POST":
            return ClientCommunicationCreateSerializer
        return ClientCommunicationSerializer

    def perform_create(self, serializer):
        task_id = serializer.validated_data.get("task")
        task = get_object_or_404(Task, id=task_id)
        comm = serializer.save(task=task)
        task.link_to_object(comm)
        task.save()


class ClientCommunicationDetailView(generics.RetrieveUpdateAPIView):
    """
    Retrieve and update a single client communication.
    """

    permission_classes = [permissions.IsAuthenticated]
    queryset = ClientCommunication.objects.all()
    serializer_class = ClientCommunicationSerializer

