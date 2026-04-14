from django.test import TestCase
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from unittest.mock import patch
from datetime import timedelta
from django.utils import timezone
from user_preferences.models import UserPreferences, SlackIntegration, NotificationSettings
from user_preferences.conf.permission_mappings import PERMISSION_MAPPINGS

User = get_user_model()

class UserPreferencesViewTest(TestCase):
    """
    Test cases for UserPreferencesView API endpoints
    """
    
    def setUp(self):
        """Set up test data"""
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.other_user = User.objects.create_user(
            username='otheruser',
            email='other@example.com',
            password='testpass123'
        )
        
        # Create preferences for the main user
        self.preferences = UserPreferences.objects.create(
            user=self.user,
            timezone='Asia/Shanghai',
            language='zh-cn'
        )
        
        self.url = reverse('user_preferences:user-preferences')
    
    def test_get_user_preferences_success(self):
        """Test authenticated user can retrieve their preferences"""
        self.client.force_authenticate(user=self.user)
        
        response = self.client.get(self.url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['timezone'], 'Asia/Shanghai')
        self.assertEqual(response.data['language'], 'zh-cn')
    
    def test_get_user_preferences_unauthenticated(self):
        """Test unauthenticated user cannot access preferences"""
        response = self.client.get(self.url)
        print(response.status_code)
        
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])
    
    def test_patch_user_preferences_success(self):
        """Test authenticated user can update their preferences"""
        self.client.force_authenticate(user=self.user)
        
        data = {
            'timezone': 'UTC',
            'language': 'en'
        }
        
        response = self.client.patch(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['timezone'], 'UTC')
        self.assertEqual(response.data['language'], 'en')
        
        # Verify database was updated
        self.preferences.refresh_from_db()
        self.assertEqual(self.preferences.timezone, 'UTC')
        self.assertEqual(self.preferences.language, 'en')
    
    def test_patch_user_preferences_partial_update(self):
        """Test user can update single field (partial update)"""
        self.client.force_authenticate(user=self.user)
        
        data = {'timezone': 'Europe/London'}
        
        response = self.client.patch(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['timezone'], 'Europe/London')
        self.assertEqual(response.data['language'], 'zh-cn')  # Should remain unchanged
    
    def test_patch_user_preferences_unauthenticated(self):
        """Test unauthenticated user cannot update preferences"""
        data = {'timezone': 'UTC'}
        
        response = self.client.patch(self.url, data, format='json')
        print(response.status_code)
        
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])
    
    def test_patch_user_preferences_invalid_data(self):
        """Test updating preferences with invalid data returns validation errors"""
        self.client.force_authenticate(user=self.user)
        
        data = {
            'timezone': 'Invalid/Timezone',
            'language': 'invalid-lang'
        }
        
        response = self.client.patch(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('timezone', response.data)
        self.assertIn('language', response.data)

class SlackIntegrationViewTest(TestCase):
    """
    Test cases for SlackIntegrationView API endpoints
    Tests PROFILE-04 Slack integration functionality
    """
    
    def setUp(self):
        """Set up test data"""
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='slackuser',
            email='slack@example.com',
            password='testpass123'
        )
        self.other_user = User.objects.create_user(
            username='otheruser',
            email='other@example.com',
            password='testpass123'
        )
        
        self.valid_webhook_url = 'https://hooks.slack.com/services/T123456/B123456/abcdefghijklmnop'
        self.url = reverse('user_preferences:slack-integration')
        
        # Create existing integration for some tests
        self.existing_integration = SlackIntegration.objects.create(
            user=self.user,
            webhook_url=self.valid_webhook_url,
            channel_name='Test Channel',
            is_active=True
        )
    
    def test_post_create_slack_integration_success(self):
        """Test creating new Slack integration"""
        self.client.force_authenticate(user=self.other_user)  # User without existing integration
        
        data = {
            'webhook_url': self.valid_webhook_url,
            'channel_name': 'Marketing Team',
            'is_active': True
        }
        
        response = self.client.post(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('message', response.data)
        self.assertIn('integration', response.data)
        self.assertEqual(response.data['integration']['webhook_url'], self.valid_webhook_url)
        self.assertEqual(response.data['integration']['channel_name'], 'Marketing Team')
        
        # Verify database
        integration = SlackIntegration.objects.get(user=self.other_user)
        self.assertEqual(integration.webhook_url, self.valid_webhook_url)
        self.assertEqual(integration.channel_name, 'Marketing Team')
    
    def test_post_update_existing_slack_integration(self):
        """Test updating existing Slack integration"""
        self.client.force_authenticate(user=self.user)  # User with existing integration
        
        data = {
            'webhook_url': 'https://hooks.slack.com/services/T999999/B999999/newtoken123',
            'channel_name': 'Updated Channel',
            'is_active': False
        }
        
        response = self.client.post(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('updated successfully', response.data['message'])
        
        # Verify database update
        self.existing_integration.refresh_from_db()
        self.assertEqual(self.existing_integration.webhook_url, data['webhook_url'])
        self.assertEqual(self.existing_integration.channel_name, 'Updated Channel')
        self.assertFalse(self.existing_integration.is_active)
    
    def test_post_slack_integration_invalid_webhook_url(self):
        """Test creating integration with invalid webhook URL"""
        self.client.force_authenticate(user=self.other_user)
        
        data = {
            'webhook_url': 'https://invalid-url.com/not-slack',
            'channel_name': 'Test Channel'
        }
        
        response = self.client.post(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('webhook_url', response.data)
    
    def test_post_slack_integration_unauthenticated(self):
        """Test unauthenticated user cannot create integration"""
        data = {
            'webhook_url': self.valid_webhook_url,
            'channel_name': 'Test Channel'
        }
        
        response = self.client.post(self.url, data, format='json')
        
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])
    
    def test_get_slack_integration_success(self):
        """Test authenticated user can retrieve their Slack integration"""
        self.client.force_authenticate(user=self.user)
        
        response = self.client.get(self.url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['webhook_url'], self.valid_webhook_url)
        self.assertEqual(response.data['channel_name'], 'Test Channel')
        self.assertTrue(response.data['is_active'])
    
    def test_get_slack_integration_not_found(self):
        """Test getting integration when none exists"""
        self.client.force_authenticate(user=self.other_user)  # User without integration
        
        response = self.client.get(self.url)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertIn('message', response.data)
    
    def test_get_slack_integration_unauthenticated(self):
        """Test unauthenticated user cannot get integration"""
        response = self.client.get(self.url)
        
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])
    
    def test_delete_slack_integration_success(self):
        """Test authenticated user can delete their Slack integration"""
        self.client.force_authenticate(user=self.user)
        
        # Verify integration exists
        self.assertTrue(SlackIntegration.objects.filter(user=self.user).exists())
        
        response = self.client.delete(self.url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('deleted successfully', response.data['message'])
        
        # Verify integration was deleted
        self.assertFalse(SlackIntegration.objects.filter(user=self.user).exists())
    
    def test_delete_slack_integration_not_found(self):
        """Test deleting integration when none exists"""
        self.client.force_authenticate(user=self.other_user)  # User without integration
        
        response = self.client.delete(self.url)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertIn('error', response.data)
    
    def test_delete_slack_integration_unauthenticated(self):
        """Test unauthenticated user cannot delete integration"""
        response = self.client.delete(self.url)
        
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])
    
    def test_post_partial_update_slack_integration(self):
        """Test partial update of existing integration"""
        self.client.force_authenticate(user=self.user)
        
        # Only update channel name and active status
        data = {
            'channel_name': 'Partially Updated Channel',
            'is_active': False
        }
        
        response = self.client.post(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify partial update
        self.existing_integration.refresh_from_db()
        self.assertEqual(self.existing_integration.channel_name, 'Partially Updated Channel')
        self.assertFalse(self.existing_integration.is_active)
        # webhook_url should remain unchanged
        self.assertEqual(self.existing_integration.webhook_url, self.valid_webhook_url)
    
    def test_user_isolation(self):
        """Test that users can only access their own integrations"""
        # Create integration for other_user
        other_integration = SlackIntegration.objects.create(
            user=self.other_user,
            webhook_url='https://hooks.slack.com/services/T777777/B777777/othertoken',
            channel_name='Other User Channel'
        )
        
        self.client.force_authenticate(user=self.user)
        
        # User should only see their own integration
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['channel_name'], 'Test Channel')  # Not the other user's
        
        # User should only be able to delete their own integration
        response = self.client.delete(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Other user's integration should still exist
        self.assertTrue(SlackIntegration.objects.filter(user=self.other_user).exists())
        # User's integration should be deleted
        self.assertFalse(SlackIntegration.objects.filter(user=self.user).exists())

class MockTaskAlertViewTest(TestCase):
    """
    Test cases for PROFILE-05 Mock Notification Endpoint
    """
    
    def setUp(self):
        """Set up test data"""
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        
        # Create user preferences for quiet hours testing
        UserPreferences.objects.create(
            user=self.user,
            timezone='UTC',
        )
        
        self.url = '/notifications/mock-task-alert/'  # Direct URL since it's in main urls.py
    
    def test_mock_notification_endpoint_accepts_required_parameters(self):
        """Business requirement: API should accept user_id, trigger_type, message"""
        data = {
            'user_id': self.user.id,
            'trigger_type': 'task_due',
            'message': 'Test task is due'
        }
        
        response = self.client.post(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('channels_would_notify', response.data)
        self.assertIn('trigger_type', response.data)
    
    def test_mock_notification_validates_required_fields(self):
        """Business requirement: API should validate required parameters"""
        # Test missing user_id
        response = self.client.post(self.url, {
            'trigger_type': 'task_due',
            'message': 'Test message'
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('user_id is required', response.data['error'])
        
        # Test missing trigger_type
        response = self.client.post(self.url, {
            'user_id': self.user.id,
            'message': 'Test message'
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('trigger_type is required', response.data['error'])
        
        # Test missing message
        response = self.client.post(self.url, {
            'user_id': self.user.id,
            'trigger_type': 'task_due'
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('message is required', response.data['error'])
    
    def test_mock_notification_handles_nonexistent_user(self):
        """Business requirement: Handle case when user doesn't exist"""
        data = {
            'user_id': 99999,  # Non-existent user
            'trigger_type': 'task_due',
            'message': 'Test message'
        }
        
        response = self.client.post(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertIn('User not found', response.data['error'])
    
    def test_mock_notification_respects_user_notification_settings(self):
        """Business requirement: Check user's notification channel settings"""
        from user_preferences.models import NotificationSettings
        
        # Create notification setting for user
        NotificationSettings.objects.create(
            user=self.user,
            channel_id=1,
            channel_name='Slack',
            setting_key='task_due',
            module_scope='campaigns',
            enabled=True
        )

        # Create Slack integration
        SlackIntegration.objects.create(
            user=self.user,
            webhook_url='https://hooks.slack.com/services/T123/B456/token',
            is_active=True
        )
        
        data = {
            'user_id': self.user.id,
            'trigger_type': 'task_due',
            'message': 'Task deadline approaching'
        }
        
        response = self.client.post(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('Slack', response.data['channels_would_notify'])
    
    def test_mock_notification_returns_channel_confirmation(self):
        """Business requirement: Return confirmation of which channels would be notified"""
        data = {
            'user_id': self.user.id,
            'trigger_type': 'task_due',
            'message': 'Test notification'
        }
        
        response = self.client.post(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('channels_would_notify', response.data)
        self.assertIsInstance(response.data['channels_would_notify'], list)
        self.assertEqual(response.data['user_id'], self.user.id)
        self.assertEqual(response.data['trigger_type'], 'task_due')

    def test_mock_notification_respects_quiet_hours(self):
        """Business requirement: Check user's quiet hours status logic"""
        
        # Use Django timezone clock to match dispatcher logic (timezone.now()).
        now = timezone.now()

        # Define quiet hours based on current time
        one_hour_ago = (now - timedelta(hours=1)).strftime('%H:%M')
        one_hour_later = (now + timedelta(hours=1)).strftime('%H:%M')

        self.user.preferences.quiet_hours_start = one_hour_ago
        self.user.preferences.quiet_hours_end = one_hour_later
        self.user.preferences.save()
        
        data = {
            'user_id': self.user.id,
            'trigger_type': 'task_due',
            'message': 'Test message'
        }
        
        response = self.client.post(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('quiet_hours_active', response.data)
        self.assertTrue(response.data['quiet_hours_active'])
         # Verify no channels would be notified during quiet hours
        self.assertEqual(response.data['channels_would_notify'], [])

class NotificationSettingsViewTest(TestCase):
    """
    Test NotificationSettingsView: permission-based filtering behavior
    """

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser', email='test@example.com', password='pass'
        )

        # Create 3 settings with different permission requirements
        self.settings = [
            NotificationSettings.objects.create(
                user=self.user,
                setting_key='campaign_failure',
                module_scope='campaigns',
                channel_id=1,
                channel_name='email',
                enabled=True
            ),
            NotificationSettings.objects.create(
                user=self.user,
                setting_key='budget_alert',
                module_scope='budget',
                channel_id=1,
                channel_name='email',
                enabled=True
            ),
            NotificationSettings.objects.create(
                user=self.user,
                setting_key='task_due',
                module_scope='general',
                channel_id=1,
                channel_name='email',
                enabled=True
            )
        ]

        self.url = '/users/me/notifications/settings/'

    @patch('user_preferences.services.permission_service.PermissionService.get_user_permissions')
    def test_returns_only_authorized_notification_settings(self, mock_get_permissions):
        """
        Should return only notification settings that match user permissions or require no permission
        """
        # Only has BUDGET:VIEW, no CAMPAIGN:VIEW
        mock_get_permissions.return_value = ['BUDGET:VIEW']

        self.client.force_authenticate(user=self.user)
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        returned_keys = [s['setting_key'] for s in response.data['notification_settings']]
        
        # task_due is public (None), budget_alert is allowed, campaign_failure should be excluded
        self.assertIn('budget_alert', returned_keys)
        self.assertIn('task_due', returned_keys)
        self.assertNotIn('campaign_failure', returned_keys)

    @patch('user_preferences.services.permission_service.PermissionService.get_user_permissions')
    def test_returns_all_when_user_has_all_permissions(self, mock_get_permissions):
        """
        Should return all settings if user has all permissions
        """
        mock_get_permissions.return_value = ['BUDGET:VIEW', 'CAMPAIGN:VIEW']

        self.client.force_authenticate(user=self.user)
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_keys = [s['setting_key'] for s in response.data['notification_settings']]

        self.assertIn('budget_alert', returned_keys)
        self.assertIn('campaign_failure', returned_keys)
        self.assertIn('task_due', returned_keys)

    @patch('user_preferences.services.permission_service.PermissionService.get_user_permissions')
    def test_returns_only_general_if_user_has_no_permissions(self, mock_get_permissions):
        """
        Should return only settings with no permission required
        """
        mock_get_permissions.return_value = []

        self.client.force_authenticate(user=self.user)
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_keys = [s['setting_key'] for s in response.data['notification_settings']]

        self.assertEqual(returned_keys, ['task_due'])  # Only public one
