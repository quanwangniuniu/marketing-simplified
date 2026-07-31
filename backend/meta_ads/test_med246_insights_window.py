"""MED-246: insights date window is request-time + overlap-tolerant upsert."""

import datetime as _dt
from decimal import Decimal
from unittest.mock import patch
from zoneinfo import ZoneInfo

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
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


def _graph_insight_row(meta_ad_id: str, date_str: str, *, spend: str, impressions: str):
    return {
        "ad_id": meta_ad_id,
        "date_start": date_str,
        "spend": spend,
        "impressions": impressions,
        "reach": "180",
        "clicks": "9",
        "frequency": "1.1",
        "ctr": "4.5",
        "cpc": "2.0",
        "cpm": "90.0",
        "actions": [],
    }


class SyncInsightsOverlapUpsertTests(TestCase):
    """Overlap may re-fetch the same (ad, date); upsert must refresh, not duplicate."""

    @classmethod
    def setUpTestData(cls):
        User = get_user_model()
        user = User.objects.create_user(
            username="med246_upsert_user",
            email="med246-upsert@example.com",
            password="x",
        )
        connection = FacebookConnection.objects.create(
            user=user, fb_user_id="fb-med246-upsert", is_active=True
        )
        cls.ad_account = MetaAdAccount.objects.create(
            connection=connection,
            meta_account_id="med246upsert",
            name="MED-246 Upsert Account",
            currency="USD",
        )
        campaign = MetaCampaign.objects.create(
            ad_account=cls.ad_account,
            meta_campaign_id="med246upsert-c",
            name="Camp",
        )
        adset = MetaAdSet.objects.create(
            campaign=campaign,
            meta_adset_id="med246upsert-as",
            name="Adset",
        )
        cls.ad = MetaAd.objects.create(
            adset=adset, meta_ad_id="med246upsert-ad", name="Ad"
        )

    def test_schema_rejects_duplicate_ad_date_rows(self):
        MetaInsightDaily.objects.create(
            ad=self.ad,
            date=_dt.date(2026, 7, 30),
            spend=Decimal("10.00"),
            impressions=100,
        )
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                MetaInsightDaily.objects.create(
                    ad=self.ad,
                    date=_dt.date(2026, 7, 30),
                    spend=Decimal("99.00"),
                    impressions=1,
                )

    @freeze_time("2026-07-30 23:50:00", tz_offset=0)
    def test_first_sync_creates_row_for_rollover_day(self):
        rows = [
            _graph_insight_row(
                self.ad.meta_ad_id, "2026-07-30", spend="10.00", impressions="100"
            )
        ]
        with patch("meta_ads.services.graph_paged", return_value=iter(rows)):
            created_count = sync_insights(self.ad_account, "fake-token", days=2)

        self.assertEqual(created_count, 1)
        self.assertEqual(MetaInsightDaily.objects.filter(ad=self.ad).count(), 1)
        row = MetaInsightDaily.objects.get(ad=self.ad, date=_dt.date(2026, 7, 30))
        self.assertEqual(row.spend, Decimal("10.00"))
        self.assertEqual(row.impressions, 100)

    def test_overlap_resync_updates_same_ad_date_without_duplicate(self):
        """Simulate pre-midnight then post-midnight syncs that both include 7/30."""
        first_rows = [
            _graph_insight_row(
                self.ad.meta_ad_id, "2026-07-30", spend="10.00", impressions="100"
            )
        ]
        with freeze_time("2026-07-30 23:50:00", tz_offset=0):
            with patch(
                "meta_ads.services.graph_paged", return_value=iter(first_rows)
            ):
                sync_insights(self.ad_account, "fake-token", days=2)

        # After UTC rollover the widened window still includes 7/30; Meta may
        # return a fresher spend/impression total for that same calendar day.
        second_rows = [
            _graph_insight_row(
                self.ad.meta_ad_id, "2026-07-30", spend="12.50", impressions="130"
            ),
            _graph_insight_row(
                self.ad.meta_ad_id, "2026-07-31", spend="1.00", impressions="20"
            ),
        ]
        with freeze_time("2026-07-31 00:05:00", tz_offset=0):
            with patch(
                "meta_ads.services.graph_paged", return_value=iter(second_rows)
            ):
                sync_insights(self.ad_account, "fake-token", days=2)

        qs = MetaInsightDaily.objects.filter(ad=self.ad).order_by("date")
        self.assertEqual(qs.count(), 2)
        day_30 = qs.get(date=_dt.date(2026, 7, 30))
        day_31 = qs.get(date=_dt.date(2026, 7, 31))
        self.assertEqual(day_30.spend, Decimal("12.50"))
        self.assertEqual(day_30.impressions, 130)
        self.assertEqual(day_31.spend, Decimal("1.00"))
        self.assertEqual(
            MetaInsightDaily.objects.filter(
                ad=self.ad, date=_dt.date(2026, 7, 30)
            ).count(),
            1,
        )
