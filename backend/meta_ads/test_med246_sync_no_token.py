"""Manual sync must leave a pollable MetaSyncRun even when there is no token."""

from django.contrib.auth import get_user_model
from django.test import TestCase

from facebook_integration.models import FacebookConnection, MetaAdAccount
from meta_ads.models import MetaSyncRun
from meta_ads.tasks import sync_single_ad_account


class SyncSingleAdAccountNoTokenTests(TestCase):
    def setUp(self):
        User = get_user_model()
        user = User.objects.create_user(
            username="med246_notoken",
            email="med246-notoken@example.com",
            password="x",
        )
        self.connection = FacebookConnection.objects.create(
            user=user,
            fb_user_id="fb-med246-notoken",
            is_active=True,
            encrypted_access_token="",
        )
        self.account = MetaAdAccount.objects.create(
            connection=self.connection,
            meta_account_id="med246notoken",
            name="No Token Account",
            currency="USD",
        )

    def test_no_token_creates_error_sync_run(self):
        result = sync_single_ad_account(self.account.id)

        self.assertEqual(result, {"error": "no_token"})
        run = MetaSyncRun.objects.get(ad_account=self.account)
        self.assertEqual(run.status, "error")
        self.assertEqual(run.kind, "manual")
        self.assertIsNotNone(run.finished_at)
        self.assertIn("no_token", run.error_message)
