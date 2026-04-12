from django.urls import path
from . import views

urlpatterns = [
    path("connect/",    views.ZoomConnectView.as_view(),    name="zoom-connect"),
    path("callback/",   views.ZoomCallbackView.as_view(),   name="zoom-callback"),
    path("status/",     views.ZoomStatusView.as_view(),     name="zoom-status"),
    path("disconnect/", views.ZoomDisconnectView.as_view(), name="zoom-disconnect"),
    path("meetings/",   views.CreateMeetingView.as_view(),  name="zoom-create-meeting"),
]