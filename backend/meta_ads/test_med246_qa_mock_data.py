"""Tests for MED-246 QA mock seed (schema alignment + idempotency)."""

import datetime as _dt

from django.contrib.auth import get_user_model
from django.test import TestCase
from freezegun import freeze_time

from core.models import OrganizationMembership
from facebook_integration.models import FacebookConnection, MetaAdAccount
from meta_ads.models import MetaAd, MetaInsightDaily, MetaSyncRun
from meta_ads.qa_mock_data import (
    META_ACCOUNT_ID,
    META_AD_ID,
    seed_med246_qa_mock_data,
)


class Med246QaMockDataTests(TestCase):
    @freeze_time("2026-07-31 00:05:00", tz_offset=0)
    def test_seed_builds_full_fk_chain_and_contiguous_insight_days(self):
        summary = seed_med246_qa_mock_data(as_of=_dt.date(2026, 7, 31), insight_days=5)

        self.assertEqual(
            summary["insight_dates"],
            [
                "2026-07-27",
                "2026-07-28",
                "2026-07-29",
                "2026-07-30",
                "2026-07-31",
            ],
        )

        account = MetaAdAccount.objects.get(meta_account_id=META_ACCOUNT_ID)
        self.assertEqual(account.currency, "USD")
        self.assertEqual(account.account_status, 1)
        self.assertIsNotNone(account.project_id)

        connection = FacebookConnection.objects.get(pk=account.connection_id)
        self.assertTrue(connection.is_active)
        self.assertIsNotNone(connection.last_synced_at)

        ad = MetaAd.objects.get(meta_ad_id=META_AD_ID)
        self.assertEqual(ad.adset.campaign.ad_account_id, account.id)
        self.assertIsNotNone(ad.creative_id)

        rows = list(
            MetaInsightDaily.objects.filter(ad=ad).order_by("date").values_list(
                "date", "spend", "impressions"
            )
        )
        self.assertEqual(len(rows), 5)
        self.assertEqual(rows[0][0], _dt.date(2026, 7, 27))
        self.assertEqual(rows[-1][0], _dt.date(2026, 7, 31))
        # Spans the UTC rollover boundary used in MED-246 scenarios.
        self.assertIn(_dt.date(2026, 7, 30), [r[0] for r in rows])
        self.assertIn(_dt.date(2026, 7, 31), [r[0] for r in rows])

        self.assertTrue(
            MetaSyncRun.objects.filter(ad_account=account, status="ok").exists()
        )
        user = get_user_model().objects.get(pk=summary["user_id"])
        self.assertEqual(user.email, summary["user_email"])
        self.assertTrue(
            OrganizationMembership.objects.filter(
                user=user, organization_id=summary["org_id"], is_active=True
            ).exists()
        )
        self.assertEqual(user.current_organization_id, summary["org_id"])
        self.assertEqual(user.active_project_id, summary["project_id"])

    @freeze_time("2026-07-31 00:05:00", tz_offset=0)
    def test_seed_is_idempotent_on_unique_ad_date(self):
        seed_med246_qa_mock_data(as_of=_dt.date(2026, 7, 31), insight_days=3)
        second = seed_med246_qa_mock_data(as_of=_dt.date(2026, 7, 31), insight_days=3)

        ad = MetaAd.objects.get(meta_ad_id=META_AD_ID)
        self.assertEqual(MetaInsightDaily.objects.filter(ad=ad).count(), 3)
        self.assertEqual(second["insights_created"], 0)
        self.assertEqual(second["insights_updated"], 3)
        self.assertEqual(
            MetaAdAccount.objects.filter(meta_account_id=META_ACCOUNT_ID).count(), 1
        )

    def test_rejects_too_short_insight_window(self):
        with self.assertRaises(ValueError):
            seed_med246_qa_mock_data(insight_days=1)
