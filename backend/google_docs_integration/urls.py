from django.urls import path

from .views import (
    GoogleDocsCallbackView,
    GoogleDocsConnectView,
    GoogleDocsDocumentListView,
    GoogleDocsDisconnectView,
    GoogleDocsExportView,
    GoogleDocsRawExportView,
    GoogleDocsImportView,
    GoogleDocsStatusView,
)

urlpatterns = [
    path("status/", GoogleDocsStatusView.as_view(), name="google-docs-status"),
    path("connect/", GoogleDocsConnectView.as_view(), name="google-docs-connect"),
    path("callback/", GoogleDocsCallbackView.as_view(), name="google-docs-callback"),
    path("disconnect/", GoogleDocsDisconnectView.as_view(), name="google-docs-disconnect"),
    path("documents/", GoogleDocsDocumentListView.as_view(), name="google-docs-documents"),
    path("import/", GoogleDocsImportView.as_view(), name="google-docs-import"),
    path("export/", GoogleDocsExportView.as_view(), name="google-docs-export"),
    path("export/raw/", GoogleDocsRawExportView.as_view(), name="google-docs-export-raw"),
]
