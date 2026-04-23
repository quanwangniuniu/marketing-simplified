from django.urls import path

from .views import (
    GoogleCalendarCallbackView,
    GoogleCalendarConnectView,
    GoogleCalendarDisconnectView,
    GoogleCalendarStatusView,
    GoogleCalendarSyncView,
)

urlpatterns = [
    path("status/", GoogleCalendarStatusView.as_view(), name="google-calendar-status"),
    path("connect/", GoogleCalendarConnectView.as_view(), name="google-calendar-connect"),
    path("callback/", GoogleCalendarCallbackView.as_view(), name="google-calendar-callback"),
    path("disconnect/", GoogleCalendarDisconnectView.as_view(), name="google-calendar-disconnect"),
    path("sync/", GoogleCalendarSyncView.as_view(), name="google-calendar-sync"),
]
