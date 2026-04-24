"""Smoke tests for the OAuth state signing + token encryption round-trips."""

from django.contrib.auth import get_user_model
from django.core.signing import BadSignature
from django.test import TestCase

from .crypto import decrypt_token, encrypt_token
from .services import build_oauth_state, unpack_oauth_state


class CryptoRoundTripTests(TestCase):
    def test_encrypt_decrypt_roundtrip(self):
        token = "EACGliCoq4iUBRYIfHFujirwZ" + "X" * 200
        ciphertext = encrypt_token(token)
        self.assertNotEqual(ciphertext, token)
        self.assertEqual(decrypt_token(ciphertext), token)

    def test_empty_token(self):
        self.assertIsNone(encrypt_token(None))
        self.assertIsNone(encrypt_token(""))
        self.assertIsNone(decrypt_token(None))


class OAuthStateTests(TestCase):
    def test_state_roundtrip(self):
        state = build_oauth_state(42, project_id=7)
        payload = unpack_oauth_state(state)
        self.assertEqual(payload["user_id"], 42)
        self.assertEqual(payload["project_id"], 7)
        self.assertIn("nonce", payload)

    def test_state_rejects_tamper(self):
        state = build_oauth_state(42)
        tampered = state[:-5] + "XXXXX"
        with self.assertRaises(BadSignature):
            unpack_oauth_state(tampered)


class ConnectionModelTests(TestCase):
    def test_set_get_access_token(self):
        User = get_user_model()
        user = User.objects.create(email="fb@example.com", username="fb")
        from .models import FacebookConnection

        conn = FacebookConnection.objects.create(user=user, fb_user_id="1")
        conn.set_access_token("abc123")
        conn.save()
        conn.refresh_from_db()
        self.assertEqual(conn.get_access_token(), "abc123")
