import logging
import re
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse, urljoin
from rest_framework import mixins, viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from django.db.models import Q, Prefetch
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.core.cache import cache
from datetime import datetime
from .models import Chat, ChatParticipant, Message, MessageStatus, ChatType, MessageAttachment
from .serializers import (
    ChatSerializer,
    ChatListSerializer,
    ChatStarSerializer,
    ChatStarCreateSerializer,
    ChatStarReorderSerializer,
    ChatCreateSerializer,
    MessageSerializer,
    MessageCreateSerializer,
    MessageWithAttachmentsSerializer,
    MessageCreateWithAttachmentsSerializer,
    ChatParticipantSerializer,
    MarkAsReadSerializer,
    ForwardBatchSerializer,
    MessageAttachmentSerializer,
    AttachmentUploadSerializer,
    AttachmentFileListRowSerializer,
)
from .services import ChatService, ChatStarService, MessageService, OnlineStatusService
from .tasks import notify_new_message

logger = logging.getLogger(__name__)


class StarredChatViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """
    Starred chats for the current user.

    - GET /starred/?project_id= - list starred chats in project (ordered)
    - POST /starred/ body { chat_id } - star a chat
    - DELETE /starred/{chat_id}/ - unstar (pk is chat id, not ChatStar row id)
    - POST /starred/reorder/ body { project_id, chat_ids } - reorder
    """

    permission_classes = [IsAuthenticated]
    serializer_class = ChatStarSerializer

    def get_queryset(self):
        return self.request.user.chat_stars.none()

    def list(self, request, *args, **kwargs):
        project_id = request.query_params.get('project_id')
        if not project_id:
            return Response(
                {'error': 'project_id is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            pid = int(project_id)
        except (TypeError, ValueError):
            return Response(
                {'error': 'Invalid project_id'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        stars = ChatStarService.list_starred_for_project(request.user, pid)
        serializer = ChatStarSerializer(stars, many=True, context={'request': request})
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        serializer = ChatStarCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            star, created = ChatStarService.star_chat(
                request.user, serializer.validated_data['chat_id']
            )
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        out = ChatStarSerializer(star, context={'request': request})
        return Response(
            out.data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def destroy(self, request, *args, **kwargs):
        try:
            chat_id = int(kwargs.get('pk'))
        except (TypeError, ValueError):
            return Response({'error': 'Invalid chat id'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            ChatStarService.unstar_chat(request.user, chat_id)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['post'], url_path='reorder')
    def reorder(self, request):
        serializer = ChatStarReorderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            ChatStarService.reorder_starred(
                request.user,
                serializer.validated_data['project_id'],
                serializer.validated_data['chat_ids'],
            )
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'status': 'ok'})


class ChatViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing chats.
    
    Endpoints:
    - GET /chats/ - List user's chats
    - POST /chats/ - Create a new chat
    - GET /chats/{id}/ - Get chat details
    - DELETE /chats/{id}/ - Leave a chat (soft delete for user)
    - POST /chats/{id}/add_participant/ - Add participant to group chat
    - POST /chats/{id}/remove_participant/ - Remove participant from group chat
    - POST /chats/{id}/mark_as_read/ - Mark all messages as read
    """
    
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Get chats where user is a participant"""
        # For retrieve/detail actions, return all chats (permission checked in retrieve method)
        if self.action == 'retrieve':
            return Chat.objects.all()
        
        # For list and other actions, filter by user participation
        user = self.request.user
        project_id = (
            self.request.query_params.get('project_id')
            or self.request.query_params.get('pro_ct_id')
        )
        
        return ChatService.get_user_chats(user, project_id)
    
    def get_serializer_class(self):
        """Return appropriate serializer based on action"""
        if self.action == 'list':
            return ChatListSerializer
        elif self.action == 'create':
            return ChatCreateSerializer
        return ChatSerializer
    
    def list(self, request, *args, **kwargs):
        """
        List user's chats with pagination.
        
        Query params:
        - project_id: Filter by project (optional)
        - type: Filter by chat type ('private' or 'group', optional)
        - page: Page number (default: 1)
        - page_size: Items per page (default: 20)
        - limit: Alternative to page_size (for compatibility)
        """
        logger.info(f"User {request.user.id} listing chats")
        
        queryset = self.get_queryset()
        
        # Filter by chat type if provided
        chat_type = request.query_params.get('type')
        if chat_type:
            queryset = queryset.filter(type=chat_type)
        
        # Pagination
        page = int(request.query_params.get('page', 1))
        # Support both 'page_size' and 'limit' parameters
        page_size = int(request.query_params.get('page_size', request.query_params.get('limit', 20)))
        
        start = (page - 1) * page_size
        end = start + page_size
        
        chats = queryset[start:end]
        serializer = self.get_serializer(chats, many=True)
        
        return Response({
            'results': serializer.data,
            'page': page,
            'page_size': page_size,
            'total': queryset.count()
        })
    
    def create(self, request, *args, **kwargs):
        """
        Create a new chat (private or group).
        
        Body:
        - project: Project ID
        - type: 'private' or 'group'
        - name: Chat name (required for group chats)
        - participant_ids: List of user IDs
        """
        logger.info(f"User {request.user.id} creating chat: {request.data}")
        
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        chat = serializer.save()
        
        # Notify all participants about the new chat via WebSocket
        self._notify_chat_created(chat, request)
        
        # Return full chat details
        response_serializer = ChatSerializer(chat, context={'request': request})
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)
    
    def _notify_chat_created(self, chat, request):
        """Send WebSocket notification to all participants about new chat"""
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        
        try:
            channel_layer = get_channel_layer()
            if not channel_layer:
                logger.warning("Channel layer not available for chat notification")
                return
            
            # Build chat data for notification
            chat_data = {
                'id': chat.id,
                'type': chat.type,
                'name': chat.name,
                'project': chat.project.id,
                'created_at': chat.created_at.isoformat(),
                'participants': [
                    {
                        'id': p.id,
                        'user': {
                            'id': p.user.id,
                            'username': p.user.username,
                            'email': p.user.email,
                        },
                        'joined_at': p.joined_at.isoformat() if p.joined_at else None,
                    }
                    for p in chat.participants.filter(is_active=True).select_related('user')
                ],
                'unread_count': 0,
                'last_message': None,
            }
            
            # Notify all participants except the creator
            for participant in chat.participants.filter(is_active=True).exclude(user=request.user):
                user_group = f'chat_user_{participant.user.id}'
                async_to_sync(channel_layer.group_send)(
                    user_group,
                    {
                        'type': 'chat_created',
                        'chat': chat_data,
                    }
                )
                logger.info(f"Notified user {participant.user.id} about new chat {chat.id}")
        
        except Exception as e:
            logger.error(f"Failed to notify participants about new chat: {e}")
    
    def retrieve(self, request, *args, **kwargs):
        """Get chat details"""
        chat = self.get_object()
        
        # Verify user is a participant
        if not ChatParticipant.objects.filter(
            chat=chat,
            user=request.user,
            is_active=True
        ).exists():
            logger.warning(f"User {request.user.id} attempted to access chat {chat.id} without permission")
            return Response(
                {'error': 'You are not a participant of this chat'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = self.get_serializer(chat)
        return Response(serializer.data)
    
    def destroy(self, request, *args, **kwargs):
        """
        Leave a chat (soft delete current user from chat participants).
        """
        chat = self.get_object()
        
        try:
            ChatService.leave_chat(chat, request.user)
            logger.info(f"User {request.user.id} left chat {chat.id}")
            return Response(status=status.HTTP_204_NO_CONTENT)
        except ValueError as e:
            logger.warning(f"Failed to remove user {request.user.id} from chat {chat.id}: {e}")
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def add_participant(self, request, pk=None):
        """
        Add a participant to a group chat.
        
        Body:
        - user_id: ID of user to add
        """
        chat = self.get_object()
        user_id = request.data.get('user_id')
        
        if not user_id:
            return Response(
                {'error': 'user_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            user = User.objects.get(id=user_id)
            
            participant = ChatService.add_participant(chat, user, request.user)
            
            serializer = ChatParticipantSerializer(participant)
            logger.info(f"User {request.user.id} added user {user_id} to chat {chat.id}")
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except ValueError as e:
            logger.warning(f"Failed to add user {user_id} to chat {chat.id}: {e}")
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def remove_participant(self, request, pk=None):
        """
        Remove a participant from a group chat.
        
        Body:
        - user_id: ID of user to remove
        """
        chat = self.get_object()
        user_id = request.data.get('user_id')
        
        if not user_id:
            return Response(
                {'error': 'user_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            user = User.objects.get(id=user_id)
            
            ChatService.remove_participant(chat, user, request.user)
            logger.info(f"User {request.user.id} removed user {user_id} from chat {chat.id}")
            return Response(status=status.HTTP_204_NO_CONTENT)
            
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except ValueError as e:
            logger.warning(f"Failed to remove user {user_id} from chat {chat.id}: {e}")
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def mark_as_read(self, request, pk=None):
        """
        Mark all messages in a chat as read (up to a specific message).
        
        Body (optional):
        - message_id: Mark messages up to this message (inclusive)
        """
        chat = self.get_object()
        
        serializer = MarkAsReadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        message_id = serializer.validated_data.get('message_id')
        message = None
        
        if message_id:
            message = get_object_or_404(Message, id=message_id, chat=chat)
        
        try:
            MessageService.mark_chat_as_read(chat, request.user, message)
            logger.info(f"User {request.user.id} marked chat {chat.id} as read")
            return Response({'status': 'success'})
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class MessageViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing messages.
    
    Endpoints:
    - GET /messages/?chat_id=X - List messages for a chat (with cursor pagination)
    - POST /messages/ - Send a message
    - GET /messages/{id}/ - Get message details
    """
    
    permission_classes = [IsAuthenticated]
    serializer_class = MessageSerializer
    
    def get_queryset(self):
        """Get messages for a specific chat"""
        # For retrieve/detail actions, return all messages (permission checked in retrieve method)
        if self.action in ['retrieve', 'mark_as_read']:
            return Message.objects.all()
        
        # For list action, require chat_id
        chat_id = self.request.query_params.get('chat_id')
        
        if not chat_id:
            return Message.objects.none()
        
        # Verify user is a participant
        if not ChatParticipant.objects.filter(
            chat_id=chat_id,
            user=self.request.user,
            is_active=True
        ).exists():
            return Message.objects.none()
        
        return Message.objects.filter(
            chat_id=chat_id,
            is_deleted=False
        ).select_related('sender').order_by('-created_at')
    
    def get_serializer_class(self):
        """Return appropriate serializer based on action"""
        if self.action == 'create':
            return MessageCreateWithAttachmentsSerializer
        if self.action == 'forward_batch':
            return ForwardBatchSerializer
        return MessageWithAttachmentsSerializer
    
    def list(self, request, *args, **kwargs):
        """
        List messages with cursor-based pagination.
        
        Query params:
        - chat_id: Chat ID (required)
        - before: Get messages before this timestamp (ISO format)
        - after: Get messages after this timestamp (ISO format)
        - page_size: Number of messages (default: 20, max: 100)
        """
        chat_id = request.query_params.get('chat_id')
        
        if not chat_id:
            return Response(
                {'error': 'chat_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            chat = Chat.objects.get(id=chat_id)
        except Chat.DoesNotExist:
            return Response(
                {'error': 'Chat not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Parse cursor parameters
        before_str = request.query_params.get('before')
        after_str = request.query_params.get('after')
        page_size = min(int(request.query_params.get('page_size', 20)), 100)
        
        before = None
        after = None
        
        if before_str:
            try:
                before = datetime.fromisoformat(before_str.replace('Z', '+00:00'))
            except ValueError:
                return Response(
                    {'error': 'Invalid before timestamp format'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        if after_str:
            try:
                after = datetime.fromisoformat(after_str.replace('Z', '+00:00'))
            except ValueError:
                return Response(
                    {'error': 'Invalid after timestamp format'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        try:
            messages = MessageService.get_chat_messages(
                chat,
                request.user,
                before=before,
                after=after,
                limit=page_size
            )
            
            serializer = self.get_serializer(messages, many=True)
            
            # Generate cursors for pagination
            data = serializer.data
            next_cursor = None
            prev_cursor = None
            
            if data:
                # For "before" queries (scrolling up), reverse the order
                if not after:
                    data = list(reversed(data))
                
                # Set cursors
                if len(data) == page_size:
                    # There might be more messages
                    if after:
                        next_cursor = data[-1]['created_at']
                    else:
                        prev_cursor = data[0]['created_at']
            
            return Response({
                'results': data,
                'next_cursor': next_cursor,
                'prev_cursor': prev_cursor,
                'page_size': page_size
            })
            
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_403_FORBIDDEN)
    
    def create(self, request, *args, **kwargs):
        """
        Send a message to a chat.
        
        Body:
        - chat: Chat ID
        - content: Message content (optional if attachments present)
        - attachment_ids: List of attachment IDs to link (optional)
        """
        logger.info(f"User {request.user.id} sending message to chat {request.data.get('chat')}")
        
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
            # Create message using serializer (handles attachments)
            message = serializer.save()
            
            # Create MessageStatus for all recipients (excluding sender)
            from .models import MessageStatus
            recipients = ChatParticipant.objects.filter(
                chat=message.chat,
                is_active=True
            ).exclude(user=request.user).select_related('user')
            
            MessageStatus.objects.bulk_create([
                MessageStatus(
                    message=message,
                    user=recipient.user,
                    status='sent'
                )
                for recipient in recipients
            ])
            
            # Trigger async notification task
            notify_new_message.delay(message.id)
            
            # Return message with attachments
            response_serializer = MessageWithAttachmentsSerializer(message, context={'request': request})
            logger.info(f"Message {message.id} created successfully with {message.attachments.count()} attachments")
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)
            
        except ValueError as e:
            logger.warning(f"Failed to create message: {e}")
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    def retrieve(self, request, *args, **kwargs):
        """Get message details"""
        message = self.get_object()
        
        # Verify user is a participant of the chat
        if not ChatParticipant.objects.filter(
            chat=message.chat,
            user=request.user,
            is_active=True
        ).exists():
            return Response(
                {'error': 'You are not a participant of this chat'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = self.get_serializer(message)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def mark_as_read(self, request, pk=None):
        """
        Mark a specific message as read.
        """
        message = self.get_object()
        
        try:
            MessageService.mark_message_as_read(message, request.user)
            logger.info(f"User {request.user.id} marked message {message.id} as read")
            return Response({'status': 'success'})
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        """
        Get unread message count for current user.
        
        Query params:
        - chat_id: Get unread count for specific chat (optional)
        """
        chat_id = request.query_params.get('chat_id')
        chat = None
        
        if chat_id:
            try:
                chat = Chat.objects.get(id=chat_id)
            except Chat.DoesNotExist:
                return Response(
                    {'error': 'Chat not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
        
        count = MessageService.get_unread_count(request.user, chat)
        
        return Response({
            'unread_count': count,
            'chat_id': chat_id
        })

    @action(detail=False, methods=['post'])
    def forward_batch(self, request):
        """
        Forward multiple messages to multiple chats/users in one request.

        Supports partial success and returns detailed failure records.
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        try:
            result = MessageService.forward_messages_batch(
                source_chat_id=data['source_chat_id'],
                source_message_ids=data['source_message_ids'],
                target_chat_ids=data.get('target_chat_ids', []),
                target_user_ids=data.get('target_user_ids', []),
                user=request.user
            )

            if result['status'] in ['success', 'partial_success']:
                return Response(result, status=status.HTTP_200_OK)

            return Response(result, status=status.HTTP_400_BAD_REQUEST)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)


class AttachmentViewSet(viewsets.GenericViewSet):
    """
    ViewSet for managing message attachments.
    
    Endpoints:
    - POST /attachments/ - Upload a new attachment
    - GET /attachments/{id}/ - Get attachment details
    - DELETE /attachments/{id}/ - Delete an unlinked attachment
    """
    
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    serializer_class = MessageAttachmentSerializer
    # Prevent `/attachments/<pk>/` from matching non-numeric paths like `/attachments/files/`.
    lookup_value_regex = r'\d+'
    
    def get_queryset(self):
        """Get attachments uploaded by current user"""
        return MessageAttachment.objects.filter(uploader=self.request.user)
    
    def create(self, request, *args, **kwargs):
        """
        Upload a new attachment.
        
        Body (multipart/form-data):
        - file: The file to upload
        
        Returns the attachment details including the file URL.
        The attachment is initially unlinked (message=null).
        When sending a message, include the attachment IDs to link them.
        """
        serializer = AttachmentUploadSerializer(
            data=request.data, 
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        attachment = serializer.save()
        
        logger.info(f"User {request.user.id} uploaded attachment {attachment.id}: {attachment.original_filename}")
        
        # Return attachment details
        response_serializer = MessageAttachmentSerializer(
            attachment, 
            context={'request': request}
        )
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)
    
    def retrieve(self, request, pk=None, *args, **kwargs):
        """Get attachment details"""
        try:
            attachment = MessageAttachment.objects.get(id=pk)
            
            # Check access: user must be uploader or participant of the chat
            if attachment.uploader != request.user:
                if attachment.message:
                    if not ChatParticipant.objects.filter(
                        chat=attachment.message.chat,
                        user=request.user,
                        is_active=True
                    ).exists():
                        return Response(
                            {'error': 'You do not have access to this attachment'},
                            status=status.HTTP_403_FORBIDDEN
                        )
                else:
                    return Response(
                        {'error': 'You do not have access to this attachment'},
                        status=status.HTTP_403_FORBIDDEN
                    )
            
            serializer = self.get_serializer(attachment)
            return Response(serializer.data)
            
        except MessageAttachment.DoesNotExist:
            return Response(
                {'error': 'Attachment not found'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    def destroy(self, request, pk=None, *args, **kwargs):
        """
        Delete an unlinked attachment.
        
        Only attachments that are not yet linked to a message can be deleted.
        This is for canceling uploads before sending.
        """
        try:
            attachment = MessageAttachment.objects.get(
                id=pk,
                uploader=request.user,
                message__isnull=True  # Only unlinked attachments
            )
            
            # Delete the file from storage
            if attachment.file:
                attachment.file.delete(save=False)
            if attachment.thumbnail:
                attachment.thumbnail.delete(save=False)
            
            attachment.delete()
            
            logger.info(f"User {request.user.id} deleted attachment {pk}")
            return Response(status=status.HTTP_204_NO_CONTENT)
            
        except MessageAttachment.DoesNotExist:
            return Response(
                {'error': 'Attachment not found or already linked to a message'},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=False, methods=['get'], url_path='files')
    def files(self, request):
        """
        List message attachments accessible to the current user for a project.

        Query params:
        - project_id: required
        - page: default 1
        - page_size: default 25
        """
        project_id = request.query_params.get('project_id')
        if not project_id:
            return Response(
                {'error': 'project_id is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            pid = int(project_id)
        except (TypeError, ValueError):
            return Response(
                {'error': 'Invalid project_id'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 25))
        page = max(page, 1)
        page_size = max(1, min(page_size, 100))

        chat_ids = ChatParticipant.objects.filter(
            user=request.user,
            is_active=True,
            chat__project_id=pid,
        ).values_list('chat_id', flat=True)

        queryset = (
            MessageAttachment.objects.filter(
                message__isnull=False,
                message__chat_id__in=chat_ids,
            )
            .select_related('uploader', 'message__chat')
            .order_by('-created_at')
        )

        total = queryset.count()
        start = (page - 1) * page_size
        end = start + page_size
        rows = queryset[start:end]
        serializer = AttachmentFileListRowSerializer(rows, many=True, context={'request': request})
        return Response(
            {
                'results': serializer.data,
                'page': page,
                'page_size': page_size,
                'total': total,
            }
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def fetch_link_preview(request):
    """
    Fetch metadata from a URL for link preview.
    
    Body:
    - url: The URL to fetch metadata from
    
    Returns:
    - title: Page title
    - description: Page description
    - image: Preview image URL
    - site_name: Site name
    - url: The original URL
    """
    url = request.data.get('url')
    
    if not url:
        return Response(
            {'error': 'URL is required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Validate URL
    try:
        parsed = urlparse(url)
        if not parsed.scheme or not parsed.netloc:
            return Response(
                {'error': 'Invalid URL format'},
                status=status.HTTP_400_BAD_REQUEST
            )
    except Exception:
        return Response(
            {'error': 'Invalid URL format'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Check cache first
    cache_key = f"link_preview:{url}"
    cached_data = cache.get(cache_key)
    if cached_data:
        return Response(cached_data)
    
    try:
        # Fetch the page with timeout
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.get(url, headers=headers, timeout=10, allow_redirects=True)
        response.raise_for_status()
        
        # Parse HTML
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Extract metadata
        preview_data = {
            'url': url,
            'title': None,
            'description': None,
            'image': None,
            'site_name': None,
            'type': 'website',
        }
        
        # Open Graph tags (preferred)
        og_title = soup.find('meta', property='og:title')
        og_description = soup.find('meta', property='og:description')
        og_image = soup.find('meta', property='og:image')
        og_site_name = soup.find('meta', property='og:site_name')
        og_type = soup.find('meta', property='og:type')
        
        if og_title:
            preview_data['title'] = og_title.get('content', '').strip()
        if og_description:
            preview_data['description'] = og_description.get('content', '').strip()
        if og_image:
            img_url = og_image.get('content', '').strip()
            # Make relative URLs absolute
            if img_url and not img_url.startswith(('http://', 'https://')):
                img_url = urljoin(url, img_url)
            preview_data['image'] = img_url
        if og_site_name:
            preview_data['site_name'] = og_site_name.get('content', '').strip()
        if og_type:
            preview_data['type'] = og_type.get('content', '').strip()
        
        # Fallback to Twitter cards
        if not preview_data['title']:
            twitter_title = soup.find('meta', attrs={'name': 'twitter:title'})
            if twitter_title:
                preview_data['title'] = twitter_title.get('content', '').strip()
        
        if not preview_data['description']:
            twitter_desc = soup.find('meta', attrs={'name': 'twitter:description'})
            if twitter_desc:
                preview_data['description'] = twitter_desc.get('content', '').strip()
        
        if not preview_data['image']:
            twitter_image = soup.find('meta', attrs={'name': 'twitter:image'})
            if twitter_image:
                img_url = twitter_image.get('content', '').strip()
                if img_url and not img_url.startswith(('http://', 'https://')):
                    img_url = urljoin(url, img_url)
                preview_data['image'] = img_url
        
        # Fallback to standard meta tags
        if not preview_data['title']:
            title_tag = soup.find('title')
            if title_tag:
                preview_data['title'] = title_tag.get_text().strip()
        
        if not preview_data['description']:
            meta_desc = soup.find('meta', attrs={'name': 'description'})
            if meta_desc:
                preview_data['description'] = meta_desc.get('content', '').strip()
        
        # Get site name from domain if not found
        if not preview_data['site_name']:
            preview_data['site_name'] = parsed.netloc.replace('www.', '')
        
        # Truncate description if too long
        if preview_data['description'] and len(preview_data['description']) > 300:
            preview_data['description'] = preview_data['description'][:297] + '...'
        
        # Cache the result for 1 hour
        cache.set(cache_key, preview_data, 60 * 60)
        
        return Response(preview_data)
        
    except requests.exceptions.Timeout:
        logger.warning(f"Timeout fetching link preview for {url}")
        return Response(
            {'error': 'Request timeout'},
            status=status.HTTP_504_GATEWAY_TIMEOUT
        )
    except requests.exceptions.RequestException as e:
        logger.warning(f"Error fetching link preview for {url}: {e}")
        return Response(
            {'error': 'Failed to fetch URL'},
            status=status.HTTP_502_BAD_GATEWAY
        )
    except Exception as e:
        logger.error(f"Unexpected error fetching link preview for {url}: {e}")
        return Response(
            {'error': 'Internal server error'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
