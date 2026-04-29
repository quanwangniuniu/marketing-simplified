"""Basic tests for meta_ads parsers (actions, revenue, video) and the
ad-performance view's filter / data-quality query params."""

import datetime as _dt
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import SimpleTestCase
from django.urls import reverse
from rest_framework.test import APITestCase

from facebook_integration.models import FacebookConnection, MetaAdAccount

from .models import MetaAd, MetaAdSet, MetaCampaign, MetaInsightDaily
from .services import (
    _parse_actions,
    _parse_comments,
    _parse_landing_page_views,
    _parse_revenue,
    _parse_video,
    _parse_video_3sec,
)


class ParseActionsTests(SimpleTestCase):
    def test_picks_highest_priority_action_per_category(self):
        # Meta often reports the same event under multiple action_types
        # (e.g. "lead" and "onsite_conversion.lead_grouped"). Summing would
        # double-count — _parse_actions instead picks the first priority-list
        # match per category.
        actions = [
            {"action_type": "lead", "value": "5"},
            {"action_type": "onsite_conversion.lead_grouped", "value": "3"},
            {"action_type": "phone_call", "value": "2"},
            {"action_type": "offsite_conversion.fb_pixel_purchase", "value": "7"},
            {"action_type": "unrelated", "value": "99"},
        ]
        result = _parse_actions(actions)
        self.assertEqual(result["leads"], 5)
        self.assertEqual(result["calls"], 2)
        self.assertEqual(result["purchases"], 7)
        self.assertEqual(result["messages"], 0)


class ParseRevenueTests(SimpleTestCase):
    def test_picks_highest_priority_purchase_value(self):
        # Same priority logic as _parse_actions: when multiple purchase-family
        # action_types show up, return the value of the highest-priority match
        # rather than summing.
        values = [
            {"action_type": "purchase", "value": "12.50"},
            {"action_type": "offsite_conversion.fb_pixel_purchase", "value": "3.00"},
            {"action_type": "lead", "value": "50"},
        ]
        self.assertEqual(_parse_revenue(values), Decimal("12.50"))


class ParseVideoTests(SimpleTestCase):
    def test_sums_video_views(self):
        row = {
            "video_p25_watched_actions": [{"value": "10"}, {"value": "5"}],
            "video_p50_watched_actions": [{"value": "7"}],
            "video_p75_watched_actions": [],
            "video_p100_watched_actions": [{"value": "2"}],
            "video_avg_time_watched_actions": [{"value": "15.5"}, {"value": "20.5"}],
        }
        video = _parse_video(row)
        self.assertEqual(video["p25"], 15)
        self.assertEqual(video["p50"], 7)
        self.assertEqual(video["p75"], 0)
        self.assertEqual(video["p100"], 2)
        self.assertEqual(video["avg_seconds"], Decimal("18.0"))


class ParseLandingPageViewsTests(SimpleTestCase):
    def test_omni_takes_priority_over_plain(self):
        actions = [
            {"action_type": "landing_page_view", "value": "10"},
            {"action_type": "omni_landing_page_view", "value": "42"},
        ]
        self.assertEqual(_parse_landing_page_views(actions), 42)

    def test_falls_back_to_plain_when_no_omni(self):
        actions = [{"action_type": "landing_page_view", "value": "7"}]
        self.assertEqual(_parse_landing_page_views(actions), 7)

    def test_returns_zero_when_neither_present(self):
        actions = [{"action_type": "lead", "value": "5"}]
        self.assertEqual(_parse_landing_page_views(actions), 0)


class ParseVideoViewsTests(SimpleTestCase):
    def test_extracts_video_view_action_type(self):
        actions = [
            {"action_type": "video_view", "value": "120"},
            {"action_type": "lead", "value": "9"},
        ]
        self.assertEqual(_parse_video_3sec(actions), 120)

    def test_returns_zero_when_no_video_view(self):
        actions = [{"action_type": "post_engagement", "value": "5"}]
        self.assertEqual(_parse_video_3sec(actions), 0)

    def test_ignores_unrelated_action_types(self):
        actions = [
            {"action_type": "post_reaction", "value": "99"},
            {"action_type": "comment", "value": "3"},
        ]
        self.assertEqual(_parse_video_3sec(actions), 0)


class ParseCommentsTests(SimpleTestCase):
    def test_comment_takes_priority_over_post_net_comment(self):
        actions = [
            {"action_type": "onsite_conversion.post_net_comment", "value": "4"},
            {"action_type": "comment", "value": "11"},
        ]
        self.assertEqual(_parse_comments(actions), 11)

    def test_falls_back_to_post_net_comment(self):
        actions = [
            {"action_type": "onsite_conversion.post_net_comment", "value": "4"},
        ]
        self.assertEqual(_parse_comments(actions), 4)

    def test_returns_zero_when_neither_present(self):
        actions = [{"action_type": "post_reaction", "value": "20"}]
        self.assertEqual(_parse_comments(actions), 0)


class MetaAdPerformanceFiltersTests(APITestCase):
    """Cover the new filter / data-quality query params on MetaAdPerformanceView.

    Fixture: 3 ads under one ad account, one ad set.
    - Ad A: 14 daily insight rows, ~10000 impressions, 112 events
      (5 leads + 2 purchases + 1 call per day for 14 days), $200 spend.
      Out of learning at 14d (112 events / 2 weeks = 56 >= 50).
    - Ad B: 1 insight row, 5 impressions, 0 events, $0.50 spend.
      In learning.
    - Ad C: no insight rows in the window (inactive).
    """

    @classmethod
    def setUpTestData(cls):
        User = get_user_model()
        cls.user = User.objects.create_user(
            username="filter_user", email="filter_user@example.com", password="x"
        )
        cls.connection = FacebookConnection.objects.create(
            user=cls.user, fb_user_id="fb-test-1", is_active=True
        )
        cls.ad_account = MetaAdAccount.objects.create(
            connection=cls.connection,
            meta_account_id="111",
            name="Test Account",
            currency="USD",
        )
        cls.campaign = MetaCampaign.objects.create(
            ad_account=cls.ad_account, meta_campaign_id="c1", name="Camp 1"
        )
        cls.adset = MetaAdSet.objects.create(
            campaign=cls.campaign, meta_adset_id="as1", name="Adset 1"
        )
        cls.ad_a = MetaAd.objects.create(
            adset=cls.adset, meta_ad_id="a", name="Ad A"
        )
        cls.ad_b = MetaAd.objects.create(
            adset=cls.adset, meta_ad_id="b", name="Ad B"
        )
        cls.ad_c = MetaAd.objects.create(
            adset=cls.adset, meta_ad_id="c", name="Ad C"
        )

        today = _dt.date.today()
        # Ad A: 14 days of insights, ~10000 imp / 112 events / ~$200 spend total
        for i in range(14):
            MetaInsightDaily.objects.create(
                ad=cls.ad_a,
                date=today - _dt.timedelta(days=i),
                spend=Decimal("14.2857"),
                impressions=715,
                clicks=20,
                leads=5,
                calls=1,
                purchases=2,
                video_3sec_count=300,
                lpv_count=15,
                comment_count=2,
            )
        # Ad B: 1 day, low data
        MetaInsightDaily.objects.create(
            ad=cls.ad_b,
            date=today,
            spend=Decimal("0.50"),
            impressions=5,
            clicks=0,
            leads=0,
            purchases=0,
        )
        # Ad C: no insights in window — inactive

    def setUp(self):
        self.client.force_authenticate(user=self.user)
        self.url = reverse("meta-ad-performance", args=[self.ad_account.id])

    def _ad_ids(self, response):
        return {row["meta_ad_id"] for row in response.data["ads"]}

    def test_default_excludes_inactive_ad(self):
        resp = self.client.get(self.url, {"days": 14})
        self.assertEqual(resp.status_code, 200)
        ids = self._ad_ids(resp)
        self.assertIn("a", ids)
        self.assertIn("b", ids)
        self.assertNotIn("c", ids)

    def test_include_inactive_returns_inactive_ad(self):
        resp = self.client.get(self.url, {"days": 14, "include_inactive": "true"})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(self._ad_ids(resp), {"a", "b", "c"})

    def test_min_impressions_filters_out_low_traffic(self):
        resp = self.client.get(self.url, {"days": 14, "min_impressions": 1000})
        self.assertEqual(self._ad_ids(resp), {"a"})

    def test_min_events_filters_out_learning_phase(self):
        resp = self.client.get(self.url, {"days": 14, "min_events": 50})
        self.assertEqual(self._ad_ids(resp), {"a"})

    def test_min_spend_filters_out_low_spend(self):
        resp = self.client.get(self.url, {"days": 14, "min_spend": "10"})
        self.assertEqual(self._ad_ids(resp), {"a"})

    def test_min_days_with_data_filters_out_thin_history(self):
        resp = self.client.get(self.url, {"days": 14, "min_days_with_data": 7})
        self.assertEqual(self._ad_ids(resp), {"a"})

    def test_is_in_learning_set_per_ad(self):
        resp = self.client.get(self.url, {"days": 14, "include_inactive": "true"})
        rows = {row["meta_ad_id"]: row for row in resp.data["ads"]}
        # Ad A: 112 events / 14d => events*7 = 784; threshold = 50*14 = 700 => 784 < 700 is False.
        self.assertFalse(rows["a"]["is_in_learning"])
        # Ad B: 0 events => still in learning.
        self.assertTrue(rows["b"]["is_in_learning"])

    def test_is_in_learning_null_when_window_lt_7(self):
        resp = self.client.get(self.url, {"days": 3, "include_inactive": "true"})
        for row in resp.data["ads"]:
            self.assertIsNone(row["is_in_learning"])

    def test_allowed_days_includes_30(self):
        resp = self.client.get(self.url, {"days": 30})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["days"], 30)

    def test_new_metric_keys_present(self):
        resp = self.client.get(self.url, {"days": 14})
        ad_a = next(r for r in resp.data["ads"] if r["meta_ad_id"] == "a")
        for key in (
            "hook_rate_strict",
            "cost_per_lpv",
            "cost_per_comment",
            "completion_rate",
            "video_3sec_count",
            "lpv_count",
            "comment_count",
            "total_events",
            "days_with_data",
            "is_in_learning",
        ):
            self.assertIn(key, ad_a)
