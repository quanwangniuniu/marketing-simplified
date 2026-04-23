from django.urls import path
from .views import DashboardSummaryView, ProjectWorkspaceDashboardView

app_name = 'dashboard'

urlpatterns = [
    path('summary/', DashboardSummaryView.as_view(), name='dashboard-summary'),
    # SMP-472: Project Workspace Dashboard
    path('workspace/', ProjectWorkspaceDashboardView.as_view(), name='project-workspace'),
]