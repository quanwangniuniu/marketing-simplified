import hashlib
import datetime

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model

User = get_user_model()


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


class ForgotPasswordViewTests(APITestCase):
    def setUp(self):
        self.url = reverse('forgot-password')
        self.user = User.objects.create_user(
            email='user@example.com',
            username='resetuser',
            password='OldPassword123!',
            is_verified=True,
            is_active=True,
        )

    def test_unknown_email_returns_200_generic_message(self):
        response = self.client.post(self.url, {'email': 'nobody@example.com'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('message', response.data)

    def test_known_email_returns_200_generic_message(self):
        response = self.client.post(self.url, {'email': self.user.email})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('message', response.data)

    def test_known_email_stores_hashed_token(self):
        self.client.post(self.url, {'email': self.user.email})
        self.user.refresh_from_db()
        self.assertIsNotNone(self.user.password_reset_token)
        # Token in DB must not be a raw urlsafe token (44 chars); it should be a hex digest (64 chars)
        self.assertEqual(len(self.user.password_reset_token), 64)

    def test_missing_email_returns_400(self):
        response = self.client.post(self.url, {})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class ResetPasswordViewTests(APITestCase):
    def setUp(self):
        self.url = reverse('reset-password')
        self.user = User.objects.create_user(
            email='user@example.com',
            username='resetuser',
            password='OldPassword123!',
            is_verified=True,
            is_active=True,
        )
        self.raw_token = 'validtesttoken'
        self.user.password_reset_token = _hash(self.raw_token)
        self.user.password_reset_token_expires_at = timezone.now() + datetime.timedelta(hours=1)
        self.user.save()

    def test_successful_reset_clears_token_and_allows_login(self):
        new_password = 'NewPassword456!'
        response = self.client.post(self.url, {
            'token': self.raw_token,
            'new_password': new_password,
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.user.refresh_from_db()
        self.assertIsNone(self.user.password_reset_token)
        self.assertIsNone(self.user.password_reset_token_expires_at)
        self.assertTrue(self.user.check_password(new_password))

    def test_expired_token_returns_400(self):
        self.user.password_reset_token_expires_at = timezone.now() - datetime.timedelta(seconds=1)
        self.user.save()
        response = self.client.post(self.url, {
            'token': self.raw_token,
            'new_password': 'NewPassword456!',
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)

    def test_invalid_token_returns_400(self):
        response = self.client.post(self.url, {
            'token': 'wrongtoken',
            'new_password': 'NewPassword456!',
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)

    def test_weak_password_returns_400_with_details(self):
        response = self.client.post(self.url, {
            'token': self.raw_token,
            'new_password': '123',
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('details', response.data)

    def test_missing_fields_returns_400(self):
        response = self.client.post(self.url, {'token': self.raw_token})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
