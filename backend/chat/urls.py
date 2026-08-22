from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ChatViewSet,
    MessageViewSet,
    AttachmentViewSet,
    StarredChatViewSet,
    SavedMessageViewSet,
    ScheduledMessageViewSet,
    fetch_link_preview,
    link_preview_image,
    search_messages,
)

# Create router
router = DefaultRouter()
router.register(r'starred', StarredChatViewSet, basename='chat-starred')
router.register(r'saved', SavedMessageViewSet, basename='chat-saved')
router.register(r'scheduled', ScheduledMessageViewSet, basename='chat-scheduled')
router.register(r'chats', ChatViewSet, basename='chat')
router.register(r'messages', MessageViewSet, basename='message')
router.register(r'attachments', AttachmentViewSet, basename='attachment')

# URL patterns
urlpatterns = [
    path('', include(router.urls)),
    path('link-preview/', fetch_link_preview, name='link-preview'),
    path('link-preview-image/', link_preview_image, name='link-preview-image'),
    path('search/', search_messages, name='message-search'),
]
