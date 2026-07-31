"""MED-246: insights date window is request-time + overlap-tolerant."""

import datetime as _dt
from unittest.mock import patch
from zoneinfo import ZoneInfo

from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, TestCase
from freezegun import freeze_time

from facebook_integration.models import FacebookConnection, MetaAdAccount
from meta_ads.models import MetaAd, MetaAdSet, MetaCampaign, MetaInsightDaily
from meta_ads.services import (
    INSIGHTS_WINDOW_OVERLAP_PAD,
    build_insights_date_window,
    sync_insights,
)


class BuildInsightsDateWindowTests(SimpleTestCase):
    def test_adds_overlap_pad_on_top_of_requested_days(self):
        now = _dt.datetime(2026, 7, 31, 0, 5, tzinfo=ZoneInfo("UTC"))
        since, until = build_insights_date_window(days=2, now=now)

        self.assertEqual(until, _dt.date(2026, 7, 31))
        self.assertEqual(since, _dt.date(2026, 7, 28))  # 2 + pad(1)
        self.assertEqual(INSIGHTS_WINDOW_OVERLAP_PAD, 1)

    def test_uses_timezone_now_when_now_not_passed(self):
        with freeze_time("2026-07-30 23:50:00", tz_offset=0):
            since, until = build_insights_date_window(days=2)

        self.assertEqual(until, _dt.date(2026, 7, 30))
        self.assertEqual(since, _dt.date(2026, 7, 27))

    def test_window_moves_when_clock_crosses_utc_midnight(self):
        before = build_insights_date_window(
            days=2,
            now=_dt.datetime(2026, 7, 30, 23, 50, tzinfo=ZoneInfo("UTC")),
        )
        after = build_insights_date_window(
            days=2,
            now=_dt.datetime(2026, 7, 31, 0, 5, tzinfo=ZoneInfo("UTC")),
        )

        self.assertEqual(before, (_dt.date(2026, 7, 27), _dt.date(2026, 7, 30)))
        self.assertEqual(after, (_dt.date(2026, 7, 28), _dt.date(2026, 7, 31)))
        # Rollover day remains covered after the clock flips.
        self.assertIn(_dt.date(2026, 7, 30), _dates_in_window(*after))

    def test_rejects_negative_inputs(self):
        with self.assertRaises(ValueError):
            build_insights_date_window(days=-1)
        with self.assertRaises(ValueError):
            build_insights_date_window(days=2, overlap_pad=-1)


def _dates_in_window(since: _dt.date, until: _dt.date) -> set[_dt.date]:
    days = (until - since).days
    return {since + _dt.timedelta(days=i) for i in range(days + 1)}


class SyncInsightsUsesRequestTimeWindowTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        User = get_user_model()
        user = User.objects.create_user(
            username="med246_window_user",
            email="med246-window@example.com",
            password="x",
        )
        connection = FacebookConnection.objects.create(
            user=user, fb_user_id="fb-med246-window", is_active=True
        )
        cls.ad_account = MetaAdAccount.objects.create(
            connection=connection,
            meta_account_id="med246win",
            name="MED-246 Window Account",
            currency="USD",
        )
        campaign = MetaCampaign.objects.create(
            ad_account=cls.ad_account,
            meta_campaign_id="med246win-c",
            name="Camp",
        )
        adset = MetaAdSet.objects.create(
            campaign=campaign,
            meta_adset_id="med246win-as",
            name="Adset",
        )
        cls.ad = MetaAd.objects.create(
            adset=adset, meta_ad_id="med246win-ad", name="Ad"
        )

    @freeze_time("2026-07-31 00:05:00", tz_offset=0)
    def test_sync_insights_sends_overlap_widened_time_range(self):
        captured: dict = {}

        def fake_graph_paged(path, access_token, params=None):
            captured["path"] = path
            captured["params"] = params or {}
            return iter(
                [
                    {
                        "ad_id": self.ad.meta_ad_id,
                        "date_start": "2026-07-30",
                        "spend": "18.00",
                        "impressions": "200",
                        "reach": "180",
                        "clicks": "9",
                        "frequency": "1.1",
                        "ctr": "4.5",
                        "cpc": "2.0",
                        "cpm": "90.0",
                        "actions": [],
                    }
                ]
            )

        with patch("meta_ads.services.graph_paged", side_effect=fake_graph_paged):
            count = sync_insights(self.ad_account, "fake-token", days=2)

        self.assertEqual(count, 1)
        self.assertEqual(
            captured["params"]["time_range"],
            '{"since":"2026-07-28","until":"2026-07-31"}',
        )
        row = MetaInsightDaily.objects.get(ad=self.ad, date=_dt.date(2026, 7, 30))
        self.assertEqual(str(row.spend), "18.00")
