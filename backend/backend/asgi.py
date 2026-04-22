"""
ASGI config for backend project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/4.2/howto/deployment/asgi/
"""

import os
import django
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from opentelemetry.instrumentation.asgi import OpenTelemetryMiddleware

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from asset.routing import websocket_urlpatterns as asset_websocket_urlpatterns
from chat.routing import websocket_urlpatterns as chat_websocket_urlpatterns
from meetings.routing import websocket_urlpatterns as meetings_websocket_urlpatterns
from asset.middleware import JWTAuthMiddleware


http_application = get_asgi_application()
http_application = OpenTelemetryMiddleware(http_application)

application = ProtocolTypeRouter({
    "http": http_application,
    "websocket": JWTAuthMiddleware(
        URLRouter(
            asset_websocket_urlpatterns +
            chat_websocket_urlpatterns +
            meetings_websocket_urlpatterns
        )
    ),
})
