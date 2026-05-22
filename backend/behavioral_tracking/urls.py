from django.urls import path

from .views import TaskEngagementSummaryView

app_name = "behavioral_tracking"

urlpatterns = [
    path(
        "tasks/<int:task_id>/engagement-summary/",
        TaskEngagementSummaryView.as_view(),
        name="task-engagement-summary",
    ),
]
