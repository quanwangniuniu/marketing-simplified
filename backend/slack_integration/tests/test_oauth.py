from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from unittest.mock import patch
from core.models import Organization, CustomUser, Project, ProjectMember
from slack_integration.models import SlackWorkspaceConnection
from slack_integration.views import SLACK_OAUTH_STATE_SALT
from django.core.exceptions import ValidationError
from django.core import signing


class TestSlackOAuth(APITestCase):
    def setUp(self):
        self.organization = Organization.objects.create(name="Test Org", slug="test-org")
        self.user = CustomUser.objects.create_user(
            email="test@example.com",
            username="testuser",
            password="password123",
            organization=self.organization,
        )
        self.project = Project.objects.create(
            name="Alpha Project",
            organization=self.organization,
            owner=self.user,
        )

    def _create_role_user(self, email, username, role):
        user = CustomUser.objects.create_user(
            email=email,
            username=username,
            password="password123",
            organization=self.organization,
        )
        project = Project.objects.create(
            name=f"{username}-project",
            organization=self.organization,
        )
        ProjectMember.objects.create(
            user=user,
            project=project,
            role=role,
            is_active=True,
        )
        return user, project

    def test_oauth_init_url(self):
        """
        Test generating the Slack OAuth URL.
        """
        self.client.force_authenticate(user=self.user)
        url = reverse('slack-oauth-init')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('url', response.data)
        self.assertIn('state', response.data)
        self.assertIn('client_id=', response.data['url'])
        self.assertIn('scope=', response.data['url'])
        self.assertIn('state=', response.data['url'])
        payload = signing.loads(response.data['state'], salt=SLACK_OAUTH_STATE_SALT, max_age=600)
        self.assertEqual(payload['user_id'], self.user.id)
        self.assertEqual(payload['organization_id'], self.organization.id)

    def test_oauth_init_allows_owner_and_privileged_membership_roles(self):
        url = reverse('slack-oauth-init')
        allowed_cases = [
            ("owner@example.com", "owneruser", "owner"),
            ("super@example.com", "superuser", "Super Administrator"),
            ("orgadmin@example.com", "orgadmin", "Organization Admin"),
            ("leader@example.com", "leaderuser", "Team Leader"),
            ("campaign@example.com", "campaignuser", "Campaign Manager"),
        ]

        for email, username, role in allowed_cases:
            user, _project = self._create_role_user(email, username, role)
            self.client.force_authenticate(user=user)

            with self.subTest(role=role):
                response = self.client.get(url)
                self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_oauth_init_forbidden_for_non_privileged_membership(self):
        user, _project = self._create_role_user(
            "member@example.com",
            "memberuser",
            "member",
        )
        self.client.force_authenticate(user=user)

        response = self.client.get(reverse('slack-oauth-init'))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @patch('slack_integration.views.exchange_oauth_code')
    def test_oauth_callback_success(self, mock_exchange):
        """
        Test successful OAuth callback handling.
        """
        self.client.force_authenticate(user=self.user)
        
        # Mock Slack response
        mock_exchange.return_value = {
            "ok": True,
            "access_token": "xoxb-new-token",
            "team": {"id": "T_NEW", "name": "New Team"},
            "authed_user": {"id": "U_INSTALLER"},
            "incoming_webhook": {
                "channel": "#general",
                "channel_id": "C_GENERAL",
                "configuration_url": "https://..."
            }
        }
        
        state = signing.dumps(
            {
                "user_id": self.user.id,
                "organization_id": self.organization.id,
                "nonce": "nonce",
            },
            salt=SLACK_OAUTH_STATE_SALT,
        )
        url = reverse('slack-oauth-callback')
        data = {'code': 'valid_code', 'state': state}
        response = self.client.post(url, data)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        
        # Verify DB
        connection = SlackWorkspaceConnection.objects.get(organization=self.organization)
        self.assertEqual(connection.slack_team_id, "T_NEW")
        self.assertEqual(connection.default_channel_id, "C_GENERAL")
        # Token should be encrypted, but decrypted value matches
        self.assertEqual(connection.get_access_token(), "xoxb-new-token")

    @patch('slack_integration.views.exchange_oauth_code')
    def test_oauth_callback_failure(self, mock_exchange):
        """
        Test OAuth callback failure from Slack.
        """
        self.client.force_authenticate(user=self.user)
        
        # Mock validation error from service
        # Mock validation error from service
        mock_exchange.side_effect = ValidationError("Slack OAuth failed")
        
        state = signing.dumps(
            {
                "user_id": self.user.id,
                "organization_id": self.organization.id,
                "nonce": "nonce",
            },
            salt=SLACK_OAUTH_STATE_SALT,
        )
        url = reverse('slack-oauth-callback')
        data = {'code': 'invalid_code', 'state': state}
        response = self.client.post(url, data)
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)

    def test_oauth_callback_rejects_invalid_state(self):
        """
        Test OAuth callback rejects an invalid state payload.
        """
        self.client.force_authenticate(user=self.user)

        url = reverse('slack-oauth-callback')
        data = {'code': 'valid_code', 'state': 'invalid-state'}
        response = self.client.post(url, data)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['error'], 'Invalid Slack OAuth state.')

    def test_connection_status_disconnected_shape(self):
        """
        Test disconnected status returns the same field names as the connected serializer.
        """
        self.client.force_authenticate(user=self.user)

        url = reverse('slack-connection-status')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data,
            {
                'is_connected': False,
                'slack_team_id': None,
                'slack_team_name': None,
                'default_channel_id': None,
                'default_channel_name': None,
                'is_active': False,
                'can_manage_slack': True,
                'manageable_projects': [
                    {
                        'id': self.project.id,
                        'name': self.project.name,
                    }
                ],
            }
        )

    def test_connection_status_masks_workspace_details_without_permission(self):
        SlackWorkspaceConnection.objects.create(
            organization=self.organization,
            slack_team_id="T_LOCKED",
            slack_team_name="Private Workspace",
            encrypted_access_token="encrypted",
            default_channel_id="C_PRIVATE",
            default_channel_name="private-channel",
            is_active=True,
        )
        unauthorized_user = CustomUser.objects.create_user(
            email="readonly@example.com",
            username="readonlyuser",
            password="password123",
            organization=self.organization,
        )
        ProjectMember.objects.create(
            user=unauthorized_user,
            project=self.project,
            role="member",
            is_active=True,
        )
        self.client.force_authenticate(user=unauthorized_user)

        response = self.client.get(reverse("slack-connection-status"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["can_manage_slack"], False)
        self.assertEqual(response.data["manageable_projects"], [])
        self.assertEqual(response.data["is_connected"], False)
        self.assertIsNone(response.data["slack_team_id"])
        self.assertIsNone(response.data["slack_team_name"])
        self.assertIsNone(response.data["default_channel_id"])
        self.assertIsNone(response.data["default_channel_name"])
        self.assertEqual(response.data["is_active"], False)

    def test_connection_status_uses_project_context_across_organizations(self):
        other_org = Organization.objects.create(name="Other Org", slug="other-org")
        cross_org_user = CustomUser.objects.create_user(
            email="crossorg@example.com",
            username="crossorg",
            password="password123",
            organization=other_org,
        )
        other_project = Project.objects.create(
            name="Other Project",
            organization=other_org,
            owner=cross_org_user,
        )
        ProjectMember.objects.create(
            user=cross_org_user,
            project=self.project,
            role="Organization Admin",
            is_active=True,
        )
        cross_org_user.active_project = other_project
        cross_org_user.save(update_fields=["active_project"])

        SlackWorkspaceConnection.objects.create(
            organization=self.organization,
            slack_team_id="T_SHARED",
            slack_team_name="Shared Workspace",
            encrypted_access_token="encrypted-shared",
            default_channel_id="C_SHARED",
            default_channel_name="shared-general",
            is_active=True,
        )
        SlackWorkspaceConnection.objects.create(
            organization=other_org,
            slack_team_id="T_OTHER",
            slack_team_name="Other Workspace",
            encrypted_access_token="encrypted-other",
            default_channel_id="C_OTHER",
            default_channel_name="other-general",
            is_active=True,
        )

        self.client.force_authenticate(user=cross_org_user)
        response = self.client.get(
            reverse("slack-connection-status"),
            {"project_id": self.project.id},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["slack_team_id"], "T_SHARED")
        self.assertEqual(response.data["slack_team_name"], "Shared Workspace")
        self.assertEqual(
            response.data["manageable_projects"],
            [{"id": self.project.id, "name": self.project.name}],
        )

    def test_revoke_connection(self):
        """
        Test revoking (disconnecting) the Slack integration.
        """
        self.client.force_authenticate(user=self.user)
        
        # Ensure connection exists first
        SlackWorkspaceConnection.objects.create(
            organization=self.organization,
            slack_team_id="T_REVOKE",
            slack_team_name="Revoke Team",
            encrypted_access_token="encrypted",
            is_active=True
        )
        
        url = reverse('slack-disconnect')
        
        response = self.client.post(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify it's inactive
        conn = SlackWorkspaceConnection.objects.get(slack_team_id="T_REVOKE")
        self.assertFalse(conn.is_active)
