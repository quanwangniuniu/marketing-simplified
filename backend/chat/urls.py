from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ChatViewSet,
    MessageViewSet,
    AttachmentViewSet,
    StarredChatViewSet,
    fetch_link_preview,
)

# Create router
router = DefaultRouter()
router.register(r'starred', StarredChatViewSet, basename='chat-starred')
router.register(r'chats', ChatViewSet, basename='chat')
router.register(r'messages', MessageViewSet, basename='message')
router.register(r'attachments', AttachmentViewSet, basename='attachment')

# URL patterns
urlpatterns = [
    path('', include(router.urls)),
    path('link-preview/', fetch_link_preview, name='link-preview'),
]
