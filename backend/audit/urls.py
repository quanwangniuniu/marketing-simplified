from django.urls import path
from .views import AdminAuditEventListView

urlpatterns = [
    path("events/", AdminAuditEventListView.as_view(), name="audit-events"),
]