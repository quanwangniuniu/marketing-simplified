from django.urls import path

from .views import (
    FacebookCallbackView,
    FacebookConnectView,
    FacebookDisconnectView,
    FacebookStatusView,
    FacebookSyncView,
    MetaAdAccountListView,
    MetaAdAccountLinkProjectView,
)


urlpatterns = [
    path("connect/", FacebookConnectView.as_view(), name="facebook-connect"),
    path("callback/", FacebookCallbackView.as_view(), name="facebook-callback"),
    path("status/", FacebookStatusView.as_view(), name="facebook-status"),
    path(
        "ad_accounts/",
        MetaAdAccountListView.as_view(),
        name="facebook-ad-accounts",
    ),
    path("disconnect/", FacebookDisconnectView.as_view(), name="facebook-disconnect"),
    path("sync/", FacebookSyncView.as_view(), name="facebook-sync"),
    path(
        "ad_accounts/<int:pk>/link_project/",
        MetaAdAccountLinkProjectView.as_view(),
        name="facebook-ad-account-link-project",
    ),
]
