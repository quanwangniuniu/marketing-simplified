from django.urls import re_path

from spreadsheet.consumers import SheetConsumer

websocket_urlpatterns = [
    re_path(
        r"ws/spreadsheets/sheets/(?P<sheet_id>\d+)/$",
        SheetConsumer.as_asgi(),
    ),
]
