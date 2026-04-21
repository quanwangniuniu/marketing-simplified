import unittest

from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model

User = get_user_model()

class LoginViewTests(APITestCase):

    def setUp(self):
        self.login_url = reverse('login')
        self.user = User.objects.create_user(
            email="loginuser@example.com",
            password="securepass",
            username="loginuser",
            is_verified=True,
            is_active=True
        )

    def test_successful_login(self):
        data = {
            "email": "loginuser@example.com",
            "password": "securepass"
        }
        response = self.client.post(self.login_url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("token", response.data)
        self.assertIn("user", response.data)

    def test_invalid_credentials(self):
        data = {
            "email": "loginuser@example.com",
            "password": "wrongpass"
        }
        response = self.client.post(self.login_url, data)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("error", response.data)

    @unittest.skip(
        "Email verification gate is disabled in authentication.views.LoginView "
        "while no SMTP/SES/Mailgun service is wired up. Restore this test when "
        "the verification gate (commented block around line 197) is re-enabled."
    )
    def test_unverified_user(self):
        user = User.objects.create_user(
            email="unverified@example.com",
            password="securepass",
            username="unverified",
            is_verified=False,
            is_active=True
        )
        data = {
            "email": "unverified@example.com",
            "password": "securepass"
        }
        response = self.client.post(self.login_url, data)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("error", response.data)

    def test_inactive_user(self):
        user = User.objects.create_user(
            email="inactive@example.com",
            password="securepass",
            username="inactive",
            is_verified=True,
            is_active=False
        )
        data = {
            "email": "inactive@example.com",
            "password": "securepass"
        }
        response = self.client.post(self.login_url, data)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("error", response.data)

    def test_missing_email(self):
        data = {
            "password": "securepass"
        }
        response = self.client.post(self.login_url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)

    def test_missing_password(self):
        data = {
            "email": "loginuser@example.com"
        }
        response = self.client.post(self.login_url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)