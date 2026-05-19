from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

User = get_user_model()

CONFIG_URL = reverse('tracking-config') if False else '/api/tracking/config/'

TRACKING_OVERRIDES = {
    'TRACKING_IDLE_SECONDS': 120,
    'TRACKING_HEARTBEAT_SECONDS': 30,
    'TRACKING_SESSION_TIMEOUT_SECONDS': 900,
    'TRACKING_EVENT_FLUSH_SECONDS': 10,
}


@override_settings(**TRACKING_OVERRIDES)
class ConfigViewTest(APITestCase):

    def setUp(self):
        self.user = User.objects.create_user(username='tracker', email='tracker@test.com', password='pass')

    def test_authenticated_user_receives_four_keys(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(CONFIG_URL)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        for key in ('idle_seconds', 'heartbeat_seconds', 'session_timeout_seconds', 'event_flush_seconds'):
            self.assertIn(key, data)

    def test_unauthenticated_returns_401(self):
        response = self.client.get(CONFIG_URL)
        self.assertEqual(response.status_code, 401)

    def test_all_values_are_int(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(CONFIG_URL)
        data = response.json()
        for key, value in data.items():
            self.assertIsInstance(value, int, msg=f"{key} should be int, got {type(value)}")
