import logging
from unittest.mock import patch
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from core.models import Project, Organization, Team, TeamMember, ProjectMember
from chat.models import Chat, ChatParticipant, ChatStar, Message, MessageAttachment, MessageStatus, ChatType
from chat.services import MessageService
from chat.serializers import MessageSerializer
from django.core.files.uploadedfile import SimpleUploadedFile

User = get_user_model()
logger = logging.getLogger(__name__)


class ChatAPITest(TestCase):
    """Test Chat API endpoints"""
    
    def setUp(self):
        """Set up test data"""
        # Create test users
        self.user1 = User.objects.create_user(
            email='user1@example.com',
            username='user1',
            password='testpass123'
        )
        self.user2 = User.objects.create_user(
            email='user2@example.com',
            username='user2',
            password='testpass123'
        )
        self.user3 = User.objects.create_user(
            email='user3@example.com',
            username='user3',
            password='testpass123'
        )
        
        # Create test organization
        self.organization = Organization.objects.create(
            name="Test Organization"
        )
        
        # Create test team
        self.team = Team.objects.create(
            organization=self.organization,
            name="Test Team"
        )
        
        # Create test project
        self.project = Project.objects.create(
            name="Test Project",
            organization=self.organization
        )
        
        # Add users to team
        TeamMember.objects.create(user=self.user1, team=self.team)
        TeamMember.objects.create(user=self.user2, team=self.team)
        
        # Add users to project
        ProjectMember.objects.create(user=self.user1, project=self.project, role='Team Leader', is_active=True)
        ProjectMember.objects.create(user=self.user2, project=self.project, role='member', is_active=True)
        
        # Setup API client
        self.client = APIClient()
        self.client.force_authenticate(user=self.user1)
    
    def test_create_private_chat(self):
        """Test creating a private chat"""
        url = reverse('chat-list')
        data = {
            'project': self.project.id,
            'type': ChatType.PRIVATE,
            'participant_ids': [self.user2.id]
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['type'], ChatType.PRIVATE)
        self.assertEqual(response.data['project'], self.project.id)
        self.assertEqual(len(response.data['participants']), 2)
        
        # Verify chat was created
        chat = Chat.objects.get(id=response.data['id'])
        self.assertEqual(chat.type, ChatType.PRIVATE)
        self.assertEqual(chat.participants.filter(is_active=True).count(), 2)
    
    def test_create_group_chat(self):
        """Test creating a group chat"""
        # Add user3 to project
        ProjectMember.objects.create(user=self.user3, project=self.project, role='member', is_active=True)
        
        url = reverse('chat-list')
        data = {
            'project': self.project.id,
            'type': ChatType.GROUP,
            'name': 'Test Group',
            'participant_ids': [self.user2.id, self.user3.id]
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['type'], ChatType.GROUP)
        self.assertEqual(response.data['name'], 'Test Group')
        self.assertEqual(len(response.data['participants']), 3)  # user1, user2, user3
    
    def test_create_group_chat_without_name(self):
        """Test creating a group chat without a name fails"""
        url = reverse('chat-list')
        data = {
            'project': self.project.id,
            'type': ChatType.GROUP,
            'participant_ids': [self.user2.id]
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('name', str(response.data))
    
    def test_create_private_chat_with_non_project_member(self):
        """Test creating a private chat with user not in project fails"""
        url = reverse('chat-list')
        data = {
            'project': self.project.id,
            'type': ChatType.PRIVATE,
            'participant_ids': [self.user3.id]  # user3 not in project
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_list_chats(self):
        """Test listing user's chats"""
        # Create a chat
        chat = Chat.objects.create(project=self.project, type=ChatType.PRIVATE)
        ChatParticipant.objects.create(chat=chat, user=self.user1, is_active=True)
        ChatParticipant.objects.create(chat=chat, user=self.user2, is_active=True)
        
        url = reverse('chat-list')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data['results']), 1)
    
    def test_retrieve_chat(self):
        """Test retrieving a specific chat"""
        # Create a chat
        chat = Chat.objects.create(project=self.project, type=ChatType.PRIVATE)
        ChatParticipant.objects.create(chat=chat, user=self.user1, is_active=True)
        ChatParticipant.objects.create(chat=chat, user=self.user2, is_active=True)
        
        url = reverse('chat-detail', kwargs={'pk': chat.id})
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], chat.id)
        self.assertEqual(len(response.data['participants']), 2)
    
    def test_retrieve_chat_without_permission(self):
        """Test retrieving a chat user is not part of fails"""
        # Create a chat without user1
        chat = Chat.objects.create(project=self.project, type=ChatType.PRIVATE)
        ChatParticipant.objects.create(chat=chat, user=self.user2, is_active=True)
        ChatParticipant.objects.create(chat=chat, user=self.user3, is_active=True)
        
        url = reverse('chat-detail', kwargs={'pk': chat.id})
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_add_participant_to_group_chat(self):
        """Test adding a participant to a group chat"""
        # Add user3 to project
        ProjectMember.objects.create(user=self.user3, project=self.project, role='member', is_active=True)
        
        # Create a group chat
        chat = Chat.objects.create(project=self.project, type=ChatType.GROUP, name='Test Group')
        ChatParticipant.objects.create(chat=chat, user=self.user1, is_active=True)
        ChatParticipant.objects.create(chat=chat, user=self.user2, is_active=True)
        
        url = reverse('chat-add-participant', kwargs={'pk': chat.id})
        data = {'user_id': self.user3.id}
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(chat.participants.filter(is_active=True).count(), 3)
    
    def test_add_participant_to_private_chat_fails(self):
        """Test adding a participant to a private chat fails"""
        # Create a private chat
        chat = Chat.objects.create(project=self.project, type=ChatType.PRIVATE)
        ChatParticipant.objects.create(chat=chat, user=self.user1, is_active=True)
        ChatParticipant.objects.create(chat=chat, user=self.user2, is_active=True)
        
        url = reverse('chat-add-participant', kwargs={'pk': chat.id})
        data = {'user_id': self.user3.id}
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_remove_participant_from_group_chat(self):
        """Test removing a participant from a group chat"""
        # Create a group chat
        chat = Chat.objects.create(project=self.project, type=ChatType.GROUP, name='Test Group')
        ChatParticipant.objects.create(chat=chat, user=self.user1, is_active=True)
        ChatParticipant.objects.create(chat=chat, user=self.user2, is_active=True)
        ChatParticipant.objects.create(chat=chat, user=self.user3, is_active=True)
        
        url = reverse('chat-remove-participant', kwargs={'pk': chat.id})
        data = {'user_id': self.user3.id}
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        
        # Verify participant was soft-deleted
        participant = ChatParticipant.objects.get(chat=chat, user=self.user3)
        self.assertFalse(participant.is_active)
    
    def test_leave_chat(self):
        """Test user leaving a chat"""
        # Create a chat
        chat = Chat.objects.create(project=self.project, type=ChatType.GROUP, name='Test Group')
        ChatParticipant.objects.create(chat=chat, user=self.user1, is_active=True)
        ChatParticipant.objects.create(chat=chat, user=self.user2, is_active=True)
        
        url = reverse('chat-detail', kwargs={'pk': chat.id})
        response = self.client.delete(url)
        
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        
        # Verify user left the chat
        participant = ChatParticipant.objects.get(chat=chat, user=self.user1)
        self.assertFalse(participant.is_active)

    def test_leave_private_chat(self):
        """Test user leaving a private chat"""
        chat = Chat.objects.create(project=self.project, type=ChatType.PRIVATE)
        ChatParticipant.objects.create(chat=chat, user=self.user1, is_active=True)
        ChatParticipant.objects.create(chat=chat, user=self.user2, is_active=True)

        url = reverse('chat-detail', kwargs={'pk': chat.id})
        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        user1_participant = ChatParticipant.objects.get(chat=chat, user=self.user1)
        user2_participant = ChatParticipant.objects.get(chat=chat, user=self.user2)
        self.assertFalse(user1_participant.is_active)
        self.assertTrue(user2_participant.is_active)
    
    def test_mark_chat_as_read(self):
        """Test marking all messages in a chat as read"""
        # Create a chat
        chat = Chat.objects.create(project=self.project, type=ChatType.PRIVATE)
        ChatParticipant.objects.create(chat=chat, user=self.user1, is_active=True)
        ChatParticipant.objects.create(chat=chat, user=self.user2, is_active=True)
        
        # Create a message
        message = Message.objects.create(chat=chat, sender=self.user2, content='Test message')
        MessageStatus.objects.create(message=message, user=self.user1, status='sent')
        
        url = reverse('chat-mark-as-read', kwargs={'pk': chat.id})
        response = self.client.post(url, {}, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify message status was updated
        msg_status = MessageStatus.objects.get(message=message, user=self.user1)
        self.assertEqual(msg_status.status, 'read')
        self.assertIsNotNone(msg_status.read_at)


class MessageAPITest(TestCase):
    """Test Message API endpoints"""
    
    def setUp(self):
        """Set up test data"""
        # Create test users
        self.user1 = User.objects.create_user(
            email='user1@example.com',
            username='user1',
            password='testpass123'
        )
        self.user2 = User.objects.create_user(
            email='user2@example.com',
            username='user2',
            password='testpass123'
        )
        
        # Create test organization
        self.organization = Organization.objects.create(
            name="Test Organization"
        )
        
        # Create test team
        self.team = Team.objects.create(
            organization=self.organization,
            name="Test Team"
        )
        
        # Create test project
        self.project = Project.objects.create(
            name="Test Project",
            organization=self.organization
        )
        
        # Add users to team and project
        TeamMember.objects.create(user=self.user1, team=self.team)
        TeamMember.objects.create(user=self.user2, team=self.team)
        ProjectMember.objects.create(user=self.user1, project=self.project, role='Team Leader', is_active=True)
        ProjectMember.objects.create(user=self.user2, project=self.project, role='member', is_active=True)
        
        # Create a chat
        self.chat = Chat.objects.create(project=self.project, type=ChatType.PRIVATE)
        ChatParticipant.objects.create(chat=self.chat, user=self.user1, is_active=True)
        ChatParticipant.objects.create(chat=self.chat, user=self.user2, is_active=True)
        
        # Setup API client
        self.client = APIClient()
        self.client.force_authenticate(user=self.user1)
    
    def test_send_message(self):
        """Test sending a message"""
        url = reverse('message-list')
        data = {
            'chat': self.chat.id,
            'content': 'Hello, this is a test message!'
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['content'], 'Hello, this is a test message!')
        self.assertEqual(response.data['sender']['id'], self.user1.id)
        self.assertEqual(response.data['chat'], self.chat.id)
        
        # Verify message was created
        message = Message.objects.get(id=response.data['id'])
        self.assertEqual(message.content, 'Hello, this is a test message!')
        self.assertEqual(message.sender, self.user1)
        
        # Verify message status was created for recipient
        msg_status = MessageStatus.objects.filter(message=message, user=self.user2)
        self.assertEqual(msg_status.count(), 1)
    
    def test_send_empty_message_fails(self):
        """Test sending an empty message fails"""
        url = reverse('message-list')
        data = {
            'chat': self.chat.id,
            'content': ''
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_send_message_to_unauthorized_chat(self):
        """Test sending a message to a chat user is not part of fails"""
        # Create another chat without user1
        other_chat = Chat.objects.create(project=self.project, type=ChatType.PRIVATE)
        ChatParticipant.objects.create(chat=other_chat, user=self.user2, is_active=True)
        
        url = reverse('message-list')
        data = {
            'chat': other_chat.id,
            'content': 'Hello!'
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_list_messages(self):
        """Test listing messages for a chat"""
        # Create some messages
        Message.objects.create(chat=self.chat, sender=self.user1, content='Message 1')
        Message.objects.create(chat=self.chat, sender=self.user2, content='Message 2')
        Message.objects.create(chat=self.chat, sender=self.user1, content='Message 3')
        
        url = reverse('message-list')
        response = self.client.get(url, {'chat_id': self.chat.id})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 3)
    
    def test_list_messages_without_chat_id(self):
        """Test listing messages without chat_id fails"""
        url = reverse('message-list')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_list_messages_with_cursor_pagination(self):
        """Test cursor-based pagination for messages"""
        # Create messages
        msg1 = Message.objects.create(chat=self.chat, sender=self.user1, content='Message 1')
        msg2 = Message.objects.create(chat=self.chat, sender=self.user2, content='Message 2')
        msg3 = Message.objects.create(chat=self.chat, sender=self.user1, content='Message 3')
        
        # Get messages before msg3
        url = reverse('message-list')
        response = self.client.get(url, {
            'chat_id': self.chat.id,
            'before': msg3.created_at.isoformat(),
            'page_size': 2
        })
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 2)
    
    def test_retrieve_message(self):
        """Test retrieving a specific message"""
        message = Message.objects.create(chat=self.chat, sender=self.user1, content='Test message')
        
        url = reverse('message-detail', kwargs={'pk': message.id})
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], message.id)
        self.assertEqual(response.data['content'], 'Test message')
    
    def test_mark_message_as_read(self):
        """Test marking a message as read"""
        message = Message.objects.create(chat=self.chat, sender=self.user2, content='Test message')
        MessageStatus.objects.create(message=message, user=self.user1, status='sent')
        
        url = reverse('message-mark-as-read', kwargs={'pk': message.id})
        response = self.client.post(url, {}, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify message status was updated
        msg_status = MessageStatus.objects.get(message=message, user=self.user1)
        self.assertEqual(msg_status.status, 'read')
        self.assertIsNotNone(msg_status.read_at)
    
    def test_get_unread_count(self):
        """Test getting unread message count"""
        # Create messages from user2
        msg1 = Message.objects.create(chat=self.chat, sender=self.user2, content='Message 1')
        msg2 = Message.objects.create(chat=self.chat, sender=self.user2, content='Message 2')
        
        MessageStatus.objects.create(message=msg1, user=self.user1, status='sent')
        MessageStatus.objects.create(message=msg2, user=self.user1, status='sent')
        
        url = reverse('message-unread-count')
        response = self.client.get(url, {'chat_id': self.chat.id})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['unread_count'], 2)

    @patch('chat.tasks.notify_new_message.delay')
    def test_forward_batch_success_multi_messages_multi_targets(self, mock_notify):
        """Test forwarding multiple messages to existing chat + member target."""
        user3 = User.objects.create_user(
            email='user3@example.com',
            username='user3',
            password='testpass123'
        )
        TeamMember.objects.create(user=user3, team=self.team)
        ProjectMember.objects.create(user=user3, project=self.project, role='member', is_active=True)

        target_group = Chat.objects.create(project=self.project, type=ChatType.GROUP, name='Target Group')
        ChatParticipant.objects.create(chat=target_group, user=self.user1, is_active=True)
        ChatParticipant.objects.create(chat=target_group, user=self.user2, is_active=True)

        source_msg_1 = Message.objects.create(chat=self.chat, sender=self.user2, content='Source 1')
        source_msg_2 = Message.objects.create(chat=self.chat, sender=self.user1, content='Source 2')

        url = reverse('message-forward-batch')
        payload = {
            'source_chat_id': self.chat.id,
            'source_message_ids': [source_msg_1.id, source_msg_2.id],
            'target_chat_ids': [target_group.id],
            'target_user_ids': [user3.id],
        }

        response = self.client.post(url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(response.data['summary']['requested_messages'], 2)
        self.assertEqual(response.data['summary']['forwardable_messages'], 2)
        self.assertEqual(response.data['summary']['target_chats'], 2)
        self.assertEqual(response.data['summary']['succeeded_sends'], 4)
        self.assertEqual(response.data['summary']['failed_sends'], 0)
        self.assertEqual(response.data['resolved']['skipped_message_ids'], [])

        # Existing target chat should receive forwarded messages.
        group_messages = list(
            Message.objects.filter(chat=target_group, sender=self.user1).order_by('created_at')
        )
        self.assertEqual(len(group_messages), 2)
        self.assertEqual(group_messages[0].content, 'Source 1')
        self.assertEqual(group_messages[1].content, 'Source 2')
        self.assertEqual(group_messages[0].forwarded_from_message_id, source_msg_1.id)
        self.assertEqual(group_messages[1].forwarded_from_message_id, source_msg_2.id)
        self.assertEqual(group_messages[0].forwarded_from_sender_display, self.user2.username)
        self.assertEqual(group_messages[1].forwarded_from_sender_display, self.user1.username)
        self.assertIsNotNone(group_messages[0].forwarded_from_created_at)
        self.assertIsNotNone(group_messages[1].forwarded_from_created_at)

        # User target should resolve to private chat and receive forwarded messages.
        user3_private_chat = Chat.objects.filter(
            project=self.project,
            type=ChatType.PRIVATE,
            participants__user=self.user1,
            participants__is_active=True
        ).filter(
            participants__user=user3,
            participants__is_active=True
        ).distinct().first()
        self.assertIsNotNone(user3_private_chat)
        self.assertEqual(
            Message.objects.filter(chat=user3_private_chat, sender=self.user1).count(),
            2
        )

        # 4 forwarded messages should trigger 4 async notifications.
        self.assertEqual(mock_notify.call_count, 4)

    @patch('chat.tasks.notify_new_message.delay')
    def test_forward_batch_partial_success_with_invalid_target_chat(self, mock_notify):
        """Test partial success when one target chat is invalid for the sender."""
        valid_target = Chat.objects.create(project=self.project, type=ChatType.GROUP, name='Valid Target')
        ChatParticipant.objects.create(chat=valid_target, user=self.user1, is_active=True)
        ChatParticipant.objects.create(chat=valid_target, user=self.user2, is_active=True)

        invalid_target = Chat.objects.create(project=self.project, type=ChatType.GROUP, name='Invalid Target')
        ChatParticipant.objects.create(chat=invalid_target, user=self.user2, is_active=True)

        source_message = Message.objects.create(chat=self.chat, sender=self.user2, content='Forward me')
        url = reverse('message-forward-batch')
        payload = {
            'source_chat_id': self.chat.id,
            'source_message_ids': [source_message.id],
            'target_chat_ids': [valid_target.id, invalid_target.id],
            'target_user_ids': [],
        }

        response = self.client.post(url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'partial_success')
        self.assertEqual(response.data['summary']['succeeded_sends'], 1)
        self.assertGreaterEqual(response.data['summary']['failed_sends'], 1)

        failure_reasons = {item['reason'] for item in response.data['failures']}
        self.assertIn('not_participant', failure_reasons)
        self.assertTrue(
            Message.objects.filter(chat=valid_target, sender=self.user1).exists()
        )
        self.assertEqual(mock_notify.call_count, 1)

    @patch('chat.tasks.notify_new_message.delay')
    def test_forward_batch_forwards_text_and_attachment_messages(self, mock_notify):
        """Text and attachment messages should both be forwardable."""
        target_chat = Chat.objects.create(project=self.project, type=ChatType.GROUP, name='Target Group')
        ChatParticipant.objects.create(chat=target_chat, user=self.user1, is_active=True)
        ChatParticipant.objects.create(chat=target_chat, user=self.user2, is_active=True)

        text_message = Message.objects.create(chat=self.chat, sender=self.user2, content='Forward this text')
        attachment_message = Message.objects.create(chat=self.chat, sender=self.user2, content='Has attachment')
        source_attachment = MessageAttachment.objects.create(
            uploader=self.user2,
            message=attachment_message,
            file=SimpleUploadedFile('proof.txt', b'proof'),
            file_type='document',
            file_size=5,
            original_filename='proof.txt',
            mime_type='text/plain'
        )

        url = reverse('message-forward-batch')
        payload = {
            'source_chat_id': self.chat.id,
            'source_message_ids': [text_message.id, attachment_message.id],
            'target_chat_ids': [target_chat.id],
            'target_user_ids': []
        }

        response = self.client.post(url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(response.data['summary']['forwardable_messages'], 2)
        self.assertEqual(response.data['summary']['succeeded_sends'], 2)
        self.assertEqual(response.data['resolved']['skipped_message_ids'], [])

        forwarded_messages = list(
            Message.objects.filter(chat=target_chat, sender=self.user1).order_by('created_at')
        )
        self.assertEqual(len(forwarded_messages), 2)
        self.assertEqual(forwarded_messages[0].content, 'Forward this text')
        self.assertEqual(forwarded_messages[1].content, 'Has attachment')
        self.assertFalse(forwarded_messages[0].has_attachments)
        self.assertTrue(forwarded_messages[1].has_attachments)

        copied_attachment = MessageAttachment.objects.get(message=forwarded_messages[1])
        self.assertEqual(copied_attachment.original_filename, source_attachment.original_filename)
        self.assertEqual(copied_attachment.file_size, source_attachment.file_size)
        self.assertEqual(copied_attachment.mime_type, source_attachment.mime_type)
        self.assertEqual(copied_attachment.uploader_id, self.user1.id)
        self.assertNotEqual(copied_attachment.file.name, source_attachment.file.name)
        self.assertEqual(mock_notify.call_count, 2)

    @patch('chat.tasks.notify_new_message.delay')
    def test_forward_batch_forwards_attachment_only_message(self, mock_notify):
        """Attachment-only message should forward successfully."""
        target_chat = Chat.objects.create(project=self.project, type=ChatType.GROUP, name='Attachment Target')
        ChatParticipant.objects.create(chat=target_chat, user=self.user1, is_active=True)
        ChatParticipant.objects.create(chat=target_chat, user=self.user2, is_active=True)

        attachment_only_message = Message.objects.create(chat=self.chat, sender=self.user2, content='')
        MessageAttachment.objects.create(
            uploader=self.user2,
            message=attachment_only_message,
            file=SimpleUploadedFile('diagram.png', b'fakepng'),
            file_type='image',
            file_size=7,
            original_filename='diagram.png',
            mime_type='image/png'
        )

        response = self.client.post(reverse('message-forward-batch'), {
            'source_chat_id': self.chat.id,
            'source_message_ids': [attachment_only_message.id],
            'target_chat_ids': [target_chat.id],
            'target_user_ids': []
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(response.data['summary']['forwardable_messages'], 1)
        self.assertEqual(response.data['resolved']['skipped_message_ids'], [])

        forwarded_message = Message.objects.get(chat=target_chat, sender=self.user1)
        self.assertEqual(forwarded_message.content, '')
        self.assertTrue(forwarded_message.has_attachments)
        self.assertEqual(forwarded_message.attachments.count(), 1)
        self.assertEqual(mock_notify.call_count, 1)

    @patch('chat.tasks.notify_new_message.delay')
    def test_forward_batch_attachment_copy_failure_returns_partial_success(self, mock_notify):
        """A single attachment copy failure should fail only that send unit."""
        target_chat_a = Chat.objects.create(project=self.project, type=ChatType.GROUP, name='Target A')
        target_chat_b = Chat.objects.create(project=self.project, type=ChatType.GROUP, name='Target B')
        for target_chat in (target_chat_a, target_chat_b):
            ChatParticipant.objects.create(chat=target_chat, user=self.user1, is_active=True)
            ChatParticipant.objects.create(chat=target_chat, user=self.user2, is_active=True)

        source_message = Message.objects.create(chat=self.chat, sender=self.user2, content='With attachment')
        MessageAttachment.objects.create(
            uploader=self.user2,
            message=source_message,
            file=SimpleUploadedFile('copyfail.txt', b'copy-fail'),
            file_type='document',
            file_size=9,
            original_filename='copyfail.txt',
            mime_type='text/plain'
        )

        original_copy = MessageService._copy_file_field_for_forward
        invocation_count = {'count': 0}

        def flaky_copy(*args, **kwargs):
            invocation_count['count'] += 1
            if invocation_count['count'] == 1:
                raise MessageService.AttachmentCopyError('simulated copy failure')
            return original_copy(*args, **kwargs)

        with patch('chat.services.MessageService._copy_file_field_for_forward', side_effect=flaky_copy):
            response = self.client.post(reverse('message-forward-batch'), {
                'source_chat_id': self.chat.id,
                'source_message_ids': [source_message.id],
                'target_chat_ids': [target_chat_a.id, target_chat_b.id],
                'target_user_ids': []
            }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'partial_success')
        self.assertEqual(response.data['summary']['attempted_sends'], 2)
        self.assertEqual(response.data['summary']['succeeded_sends'], 1)
        self.assertEqual(response.data['summary']['failed_sends'], 1)
        self.assertIn('attachment_copy_failed', {f['reason'] for f in response.data['failures']})
        self.assertEqual(Message.objects.filter(chat=target_chat_a, sender=self.user1).count(), 0)
        self.assertEqual(Message.objects.filter(chat=target_chat_b, sender=self.user1).count(), 1)
        self.assertEqual(mock_notify.call_count, 1)

    @patch('chat.tasks.notify_new_message.delay')
    def test_forward_batch_skips_empty_messages(self, mock_notify):
        """Messages with no text and no attachments should still be skipped."""
        target_chat = Chat.objects.create(project=self.project, type=ChatType.GROUP, name='Skip Empty Target')
        ChatParticipant.objects.create(chat=target_chat, user=self.user1, is_active=True)
        ChatParticipant.objects.create(chat=target_chat, user=self.user2, is_active=True)

        text_message = Message.objects.create(chat=self.chat, sender=self.user2, content='This should forward')
        empty_message = Message.objects.create(chat=self.chat, sender=self.user2, content='   ')

        response = self.client.post(reverse('message-forward-batch'), {
            'source_chat_id': self.chat.id,
            'source_message_ids': [text_message.id, empty_message.id],
            'target_chat_ids': [target_chat.id],
            'target_user_ids': []
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'partial_success')
        self.assertEqual(response.data['summary']['forwardable_messages'], 1)
        self.assertIn(empty_message.id, response.data['resolved']['skipped_message_ids'])
        self.assertEqual(Message.objects.filter(chat=target_chat, sender=self.user1).count(), 1)
        self.assertEqual(mock_notify.call_count, 1)

    def test_forward_batch_requires_source_participant(self):
        """Test that non-participants of source chat cannot forward messages."""
        outsider = User.objects.create_user(
            email='outsider@example.com',
            username='outsider',
            password='testpass123'
        )
        ProjectMember.objects.create(user=outsider, project=self.project, role='member', is_active=True)

        self.client.force_authenticate(user=outsider)

        target_chat = Chat.objects.create(project=self.project, type=ChatType.GROUP, name='Target Group')
        ChatParticipant.objects.create(chat=target_chat, user=outsider, is_active=True)
        ChatParticipant.objects.create(chat=target_chat, user=self.user2, is_active=True)

        source_message = Message.objects.create(chat=self.chat, sender=self.user2, content='Forbidden source')
        url = reverse('message-forward-batch')
        response = self.client.post(url, {
            'source_chat_id': self.chat.id,
            'source_message_ids': [source_message.id],
            'target_chat_ids': [target_chat.id],
            'target_user_ids': []
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('not a participant of the source chat', str(response.data))

    def test_message_serializer_returns_forward_metadata(self):
        """Forwarded messages should expose structured forward metadata."""
        source_message = Message.objects.create(chat=self.chat, sender=self.user2, content='Source message')
        forwarded_message = Message.objects.create(
            chat=self.chat,
            sender=self.user1,
            content='Forwarded body',
            forwarded_from_message=source_message,
            forwarded_from_sender_display=self.user2.username,
            forwarded_from_created_at=source_message.created_at,
        )

        data = MessageSerializer(forwarded_message).data
        self.assertTrue(data['is_forwarded'])
        self.assertIsNotNone(data['forwarded_from'])
        self.assertEqual(data['forwarded_from']['message_id'], source_message.id)
        self.assertEqual(data['forwarded_from']['sender_display'], self.user2.username)
        self.assertIsNotNone(data['forwarded_from']['created_at'])

    def test_message_serializer_keeps_forward_snapshot_when_source_deleted(self):
        """Forwarded message should preserve snapshot metadata after source delete."""
        source_message = Message.objects.create(chat=self.chat, sender=self.user2, content='Source message')
        forwarded_message = Message.objects.create(
            chat=self.chat,
            sender=self.user1,
            content='Forwarded body',
            forwarded_from_message=source_message,
            forwarded_from_sender_display=self.user2.username,
            forwarded_from_created_at=source_message.created_at,
        )

        source_message.delete()
        forwarded_message.refresh_from_db()

        data = MessageSerializer(forwarded_message).data
        self.assertTrue(data['is_forwarded'])
        self.assertIsNotNone(data['forwarded_from'])
        self.assertIsNone(data['forwarded_from']['message_id'])
        self.assertEqual(data['forwarded_from']['sender_display'], self.user2.username)
        self.assertIsNotNone(data['forwarded_from']['created_at'])

    def test_message_serializer_returns_non_forward_message_fields(self):
        """Regular messages should not expose forward metadata."""
        regular_message = Message.objects.create(chat=self.chat, sender=self.user1, content='Normal message')
        data = MessageSerializer(regular_message).data

        self.assertFalse(data['is_forwarded'])
        self.assertIsNone(data['forwarded_from'])


class AttachmentAPITest(TestCase):
    """Test Attachment API endpoints"""
    
    def setUp(self):
        """Set up test data"""
        from django.core.files.uploadedfile import SimpleUploadedFile
        from chat.models import MessageAttachment
        
        # Create test users
        self.user1 = User.objects.create_user(
            email='user1@example.com',
            username='user1',
            password='testpass123'
        )
        self.user2 = User.objects.create_user(
            email='user2@example.com',
            username='user2',
            password='testpass123'
        )
        
        # Create test organization
        self.organization = Organization.objects.create(
            name="Test Organization"
        )
        
        # Create test team
        self.team = Team.objects.create(
            organization=self.organization,
            name="Test Team"
        )
        
        # Create test project
        self.project = Project.objects.create(
            name="Test Project",
            organization=self.organization
        )
        
        # Add users to team and project
        TeamMember.objects.create(user=self.user1, team=self.team)
        TeamMember.objects.create(user=self.user2, team=self.team)
        ProjectMember.objects.create(user=self.user1, project=self.project, role='owner', is_active=True)
        ProjectMember.objects.create(user=self.user2, project=self.project, role='member', is_active=True)
        
        # Create a chat
        self.chat = Chat.objects.create(project=self.project, type=ChatType.PRIVATE)
        ChatParticipant.objects.create(chat=self.chat, user=self.user1, is_active=True)
        ChatParticipant.objects.create(chat=self.chat, user=self.user2, is_active=True)
        
        # Setup API client
        self.client = APIClient()
        self.client.force_authenticate(user=self.user1)
    
    def test_upload_attachment(self):
        """Test uploading an attachment"""
        from django.core.files.uploadedfile import SimpleUploadedFile
        
        test_file = SimpleUploadedFile(
            'test.txt',
            b'Test file content',
            content_type='text/plain'
        )
        
        url = reverse('attachment-list')
        response = self.client.post(url, {'file': test_file}, format='multipart')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['original_filename'], 'test.txt')
        self.assertEqual(response.data['file_type'], 'document')
        self.assertIn('file_url', response.data)
        self.assertIn('file_size_display', response.data)
    
    def test_upload_image(self):
        """Test uploading an image attachment"""
        from django.core.files.uploadedfile import SimpleUploadedFile
        
        # Create a minimal PNG file
        image_content = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR'
        image_file = SimpleUploadedFile(
            'test.png',
            image_content,
            content_type='image/png'
        )
        
        url = reverse('attachment-list')
        response = self.client.post(url, {'file': image_file}, format='multipart')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['file_type'], 'image')
    
    def test_get_attachment(self):
        """Test retrieving an attachment"""
        from django.core.files.uploadedfile import SimpleUploadedFile
        from chat.models import MessageAttachment
        
        attachment = MessageAttachment.objects.create(
            uploader=self.user1,
            file=SimpleUploadedFile('test.txt', b'content'),
            file_type='document',
            file_size=7,
            original_filename='test.txt',
            mime_type='text/plain'
        )
        
        url = reverse('attachment-detail', kwargs={'pk': attachment.id})
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], attachment.id)
    
    def test_delete_unlinked_attachment(self):
        """Test deleting an unlinked attachment"""
        from django.core.files.uploadedfile import SimpleUploadedFile
        from chat.models import MessageAttachment
        
        attachment = MessageAttachment.objects.create(
            uploader=self.user1,
            file=SimpleUploadedFile('test.txt', b'content'),
            file_type='document',
            file_size=7,
            original_filename='test.txt',
            mime_type='text/plain',
            message=None  # Unlinked
        )
        
        url = reverse('attachment-detail', kwargs={'pk': attachment.id})
        response = self.client.delete(url)
        
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(MessageAttachment.objects.filter(id=attachment.id).exists())
    
    def test_cannot_delete_linked_attachment(self):
        """Test that linked attachments cannot be deleted"""
        from django.core.files.uploadedfile import SimpleUploadedFile
        from chat.models import MessageAttachment
        
        message = Message.objects.create(
            chat=self.chat,
            sender=self.user1,
            content='Test'
        )
        
        attachment = MessageAttachment.objects.create(
            uploader=self.user1,
            message=message,  # Linked to message
            file=SimpleUploadedFile('test.txt', b'content'),
            file_type='document',
            file_size=7,
            original_filename='test.txt',
            mime_type='text/plain'
        )
        
        url = reverse('attachment-detail', kwargs={'pk': attachment.id})
        response = self.client.delete(url)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        # Attachment should still exist
        self.assertTrue(MessageAttachment.objects.filter(id=attachment.id).exists())
    
    def test_send_message_with_attachments(self):
        """Test sending a message with attachments"""
        from django.core.files.uploadedfile import SimpleUploadedFile
        from chat.models import MessageAttachment
        
        # Create unlinked attachment
        attachment = MessageAttachment.objects.create(
            uploader=self.user1,
            file=SimpleUploadedFile('test.txt', b'content'),
            file_type='document',
            file_size=7,
            original_filename='test.txt',
            mime_type='text/plain',
            message=None
        )
        
        url = reverse('message-list')
        response = self.client.post(url, {
            'chat': self.chat.id,
            'content': 'Message with attachment',
            'attachment_ids': [attachment.id]
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Verify attachment is linked
        attachment.refresh_from_db()
        self.assertEqual(attachment.message.id, response.data['id'])
        self.assertEqual(len(response.data['attachments']), 1)

    def test_list_accessible_files_requires_project_id(self):
        url = reverse('attachment-files')
        r = self.client.get(url)
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_list_accessible_files_scopes_to_project_and_participation(self):
        """
        User should see linked attachments from chats they participate in within the project,
        and should not see attachments from other projects or chats they are not in.
        """
        from django.core.files.uploadedfile import SimpleUploadedFile

        # Chat user1 participates in (same project) with an attachment from user2.
        msg_allowed = Message.objects.create(chat=self.chat, sender=self.user2, content='Has file')
        allowed_attachment = MessageAttachment.objects.create(
            uploader=self.user2,
            message=msg_allowed,
            file=SimpleUploadedFile('allowed.txt', b'allowed'),
            file_type='document',
            file_size=7,
            original_filename='allowed.txt',
            mime_type='text/plain',
        )

        # Chat in same project but user1 is NOT a participant.
        outsider = User.objects.create_user(
            email='outsider@example.com',
            username='outsider',
            password='testpass123',
        )
        ProjectMember.objects.create(user=outsider, project=self.project, role='member', is_active=True)
        chat_forbidden = Chat.objects.create(project=self.project, type=ChatType.PRIVATE)
        ChatParticipant.objects.create(chat=chat_forbidden, user=self.user2, is_active=True)
        ChatParticipant.objects.create(chat=chat_forbidden, user=outsider, is_active=True)
        msg_forbidden = Message.objects.create(chat=chat_forbidden, sender=self.user2, content='Forbidden file')
        MessageAttachment.objects.create(
            uploader=self.user2,
            message=msg_forbidden,
            file=SimpleUploadedFile('forbidden.txt', b'forbidden'),
            file_type='document',
            file_size=9,
            original_filename='forbidden.txt',
            mime_type='text/plain',
        )

        # Another project where user1 participates; should be excluded when querying self.project.id.
        other_project = Project.objects.create(name='Other Project', organization=self.organization)
        ProjectMember.objects.create(user=self.user1, project=other_project, role='owner', is_active=True)
        ProjectMember.objects.create(user=self.user2, project=other_project, role='member', is_active=True)
        other_chat = Chat.objects.create(project=other_project, type=ChatType.PRIVATE)
        ChatParticipant.objects.create(chat=other_chat, user=self.user1, is_active=True)
        ChatParticipant.objects.create(chat=other_chat, user=self.user2, is_active=True)
        other_msg = Message.objects.create(chat=other_chat, sender=self.user2, content='Other project file')
        MessageAttachment.objects.create(
            uploader=self.user2,
            message=other_msg,
            file=SimpleUploadedFile('other.txt', b'other'),
            file_type='document',
            file_size=5,
            original_filename='other.txt',
            mime_type='text/plain',
        )

        url = reverse('attachment-files')
        r = self.client.get(url, {'project_id': self.project.id, 'page': 1, 'page_size': 25})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIn('results', r.data)
        ids = {row['id'] for row in r.data['results']}
        self.assertIn(allowed_attachment.id, ids)
        self.assertEqual(ids, {allowed_attachment.id})

        row = r.data['results'][0]
        self.assertIn('uploader', row)
        self.assertEqual(row['uploader']['id'], self.user2.id)
        self.assertIn('chat', row)
        self.assertEqual(row['chat']['id'], self.chat.id)
        self.assertEqual(row['message_id'], msg_allowed.id)


class StarredChatAPITest(TestCase):
    """Test starred chat API."""

    def setUp(self):
        self.user1 = User.objects.create_user(
            email='star1@example.com',
            username='star1',
            password='testpass123',
        )
        self.user2 = User.objects.create_user(
            email='star2@example.com',
            username='star2',
            password='testpass123',
        )
        self.user3 = User.objects.create_user(
            email='star3@example.com',
            username='star3',
            password='testpass123',
        )
        self.organization = Organization.objects.create(name='Star Org')
        self.team = Team.objects.create(organization=self.organization, name='Star Team')
        self.project = Project.objects.create(name='Star Project', organization=self.organization)
        TeamMember.objects.create(user=self.user1, team=self.team)
        TeamMember.objects.create(user=self.user2, team=self.team)
        ProjectMember.objects.create(
            user=self.user1, project=self.project, role='Team Leader', is_active=True
        )
        ProjectMember.objects.create(
            user=self.user2, project=self.project, role='member', is_active=True
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user1)

    def _private_chat(self):
        chat = Chat.objects.create(project=self.project, type=ChatType.PRIVATE)
        ChatParticipant.objects.create(chat=chat, user=self.user1, is_active=True)
        ChatParticipant.objects.create(chat=chat, user=self.user2, is_active=True)
        return chat

    def _group_chat(self):
        chat = Chat.objects.create(
            project=self.project, type=ChatType.GROUP, name='Starred Group'
        )
        ChatParticipant.objects.create(chat=chat, user=self.user1, is_active=True)
        ChatParticipant.objects.create(chat=chat, user=self.user2, is_active=True)
        return chat

    def test_list_starred_requires_project_id(self):
        url = reverse('chat-starred-list')
        r = self.client.get(url)
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_star_list_unstar_reorder(self):
        c1 = self._private_chat()
        c2 = self._group_chat()
        list_url = reverse('chat-starred-list')

        r = self.client.get(list_url, {'project_id': self.project.id})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data, [])

        r = self.client.post(reverse('chat-starred-list'), {'chat_id': c1.id}, format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['chat']['id'], c1.id)

        r = self.client.post(reverse('chat-starred-list'), {'chat_id': c2.id}, format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

        r = self.client.get(list_url, {'project_id': self.project.id})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(len(r.data), 2)
        self.assertEqual(r.data[0]['chat']['id'], c1.id)
        self.assertEqual(r.data[1]['chat']['id'], c2.id)

        reorder_url = reverse('chat-starred-reorder')
        r = self.client.post(
            reorder_url,
            {'project_id': self.project.id, 'chat_ids': [c2.id, c1.id]},
            format='json',
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)

        r = self.client.get(list_url, {'project_id': self.project.id})
        self.assertEqual(r.data[0]['chat']['id'], c2.id)
        self.assertEqual(r.data[1]['chat']['id'], c1.id)

        r = self.client.delete(reverse('chat-starred-detail', kwargs={'pk': c1.id}))
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        r = self.client.get(list_url, {'project_id': self.project.id})
        self.assertEqual(len(r.data), 1)
        self.assertEqual(r.data[0]['chat']['id'], c2.id)

    def test_star_idempotent(self):
        c = self._private_chat()
        r1 = self.client.post(reverse('chat-starred-list'), {'chat_id': c.id}, format='json')
        self.assertEqual(r1.status_code, status.HTTP_201_CREATED)
        r2 = self.client.post(reverse('chat-starred-list'), {'chat_id': c.id}, format='json')
        self.assertEqual(r2.status_code, status.HTTP_200_OK)
        self.assertEqual(ChatStar.objects.filter(user=self.user1, chat=c).count(), 1)

    def test_star_not_participant_forbidden(self):
        c = self._private_chat()
        client3 = APIClient()
        client3.force_authenticate(user=self.user3)
        r = client3.post(reverse('chat-starred-list'), {'chat_id': c.id}, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reorder_rejects_incomplete_list(self):
        c1 = self._private_chat()
        c2 = self._private_chat()
        self.client.post(reverse('chat-starred-list'), {'chat_id': c1.id}, format='json')
        self.client.post(reverse('chat-starred-list'), {'chat_id': c2.id}, format='json')
        r = self.client.post(
            reverse('chat-starred-reorder'),
            {'project_id': self.project.id, 'chat_ids': [c1.id]},
            format='json',
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
