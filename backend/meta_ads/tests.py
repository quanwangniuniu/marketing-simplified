"""Basic tests for meta_ads parsers (actions, revenue, video) and the
ad-performance view's filter / data-quality query params."""

import csv
import datetime as _dt
import io
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from facebook_integration.models import FacebookConnection, MetaAdAccount

from .models import (
    MetaAd,
    MetaAdCreative,
    MetaAdSet,
    MetaCampaign,
    MetaInsightDaily,
)
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


class MetaCreativePerformanceFiltersTests(APITestCase):
    """Cover the creative-leaderboard filter and sharing knobs on
    MetaCreativePerformanceView (orphan exclusion, 1:1 default,
    include_shared_creatives toggle, the four data-quality filters,
    activity gating, and the learning-phase flag).

    Fixture: one ad account, four creatives.
    - Creative A: linked 1:1 to Ad A. 14 daily insight rows, ~10000 imp,
      112 events (5 leads + 2 purchases + 1 call per day x 14 days).
    - Creative B: linked 1:1 to Ad B. No insight rows in the window
      (so total_impressions is NULL and the default activity filter
      excludes it).
    - Creative C: linked N:M to Ad C and Ad D. Both ads have insights.
    - Creative D: orphan (no ad references it).
    """

    @classmethod
    def setUpTestData(cls):
        User = get_user_model()
        cls.user = User.objects.create_user(
            username="creative_filter_user",
            email="creative_filter@example.com",
            password="x",
        )
        cls.connection = FacebookConnection.objects.create(
            user=cls.user, fb_user_id="fb-test-2", is_active=True
        )
        cls.ad_account = MetaAdAccount.objects.create(
            connection=cls.connection,
            meta_account_id="222",
            name="Creative Test Account",
            currency="USD",
        )
        cls.campaign = MetaCampaign.objects.create(
            ad_account=cls.ad_account, meta_campaign_id="cc1", name="Camp"
        )
        cls.adset = MetaAdSet.objects.create(
            campaign=cls.campaign, meta_adset_id="cas1", name="Adset"
        )

        cls.creative_a = MetaAdCreative.objects.create(
            ad_account=cls.ad_account, meta_creative_id="cra", name="Creative A"
        )
        cls.creative_b = MetaAdCreative.objects.create(
            ad_account=cls.ad_account, meta_creative_id="crb", name="Creative B"
        )
        cls.creative_c = MetaAdCreative.objects.create(
            ad_account=cls.ad_account, meta_creative_id="crc", name="Creative C"
        )
        cls.creative_d = MetaAdCreative.objects.create(
            ad_account=cls.ad_account, meta_creative_id="crd", name="Creative D"
        )

        cls.ad_a = MetaAd.objects.create(
            adset=cls.adset, creative=cls.creative_a, meta_ad_id="aa", name="Ad A"
        )
        cls.ad_b = MetaAd.objects.create(
            adset=cls.adset, creative=cls.creative_b, meta_ad_id="ab", name="Ad B"
        )
        cls.ad_c = MetaAd.objects.create(
            adset=cls.adset, creative=cls.creative_c, meta_ad_id="ac", name="Ad C"
        )
        cls.ad_d = MetaAd.objects.create(
            adset=cls.adset, creative=cls.creative_c, meta_ad_id="ad", name="Ad D"
        )

        today = _dt.date.today()
        # Ad A: 14d high traffic
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
        # Ad B: no insight rows in the window (inactive baseline).
        # Ad C and Ad D: shared creative C, both deliver
        for i in range(7):
            MetaInsightDaily.objects.create(
                ad=cls.ad_c,
                date=today - _dt.timedelta(days=i),
                spend=Decimal("5.00"),
                impressions=200,
                clicks=4,
                leads=1,
                purchases=0,
                video_3sec_count=80,
                lpv_count=4,
                comment_count=1,
            )
            MetaInsightDaily.objects.create(
                ad=cls.ad_d,
                date=today - _dt.timedelta(days=i),
                spend=Decimal("4.00"),
                impressions=180,
                clicks=3,
                leads=1,
                purchases=0,
                video_3sec_count=60,
                lpv_count=3,
                comment_count=1,
            )

    def setUp(self):
        self.client.force_authenticate(user=self.user)
        self.url = reverse("meta-creative-performance", args=[self.ad_account.id])

    def _ids(self, response):
        return {row["meta_creative_id"] for row in response.data["creatives"]}

    def test_defaults_returns_only_active_one_to_one(self):
        resp = self.client.get(self.url, {"days": 14})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(self._ids(resp), {"cra"})

    def test_include_shared_creatives_includes_n_to_m(self):
        resp = self.client.get(
            self.url, {"days": 14, "include_shared_creatives": "true"}
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(self._ids(resp), {"cra", "crc"})

    def test_include_inactive_returns_zero_traffic_creative(self):
        resp = self.client.get(
            self.url, {"days": 14, "include_inactive": "true"}
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(self._ids(resp), {"cra", "crb"})

    def test_both_toggles_return_all_non_orphan(self):
        resp = self.client.get(
            self.url,
            {
                "days": 14,
                "include_inactive": "true",
                "include_shared_creatives": "true",
            },
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(self._ids(resp), {"cra", "crb", "crc"})

    def test_orphan_creative_never_returned(self):
        resp = self.client.get(
            self.url,
            {
                "days": 14,
                "include_inactive": "true",
                "include_shared_creatives": "true",
            },
        )
        self.assertNotIn("crd", self._ids(resp))

    def test_min_events_filters_out_low_data(self):
        resp = self.client.get(self.url, {"days": 14, "min_events": 50})
        self.assertEqual(self._ids(resp), {"cra"})

    def test_min_impressions_filters_out_low_traffic(self):
        resp = self.client.get(self.url, {"days": 14, "min_impressions": 1000})
        self.assertEqual(self._ids(resp), {"cra"})

    def test_min_spend_filters_out_low_spend(self):
        resp = self.client.get(self.url, {"days": 14, "min_spend": "10"})
        self.assertEqual(self._ids(resp), {"cra"})

    def test_min_days_with_data_filters_out_thin_history(self):
        resp = self.client.get(
            self.url, {"days": 14, "min_days_with_data": 7}
        )
        self.assertEqual(self._ids(resp), {"cra"})

    def test_allowed_days_includes_30(self):
        resp = self.client.get(self.url, {"days": 30})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["days"], 30)

    def test_new_metric_keys_present(self):
        resp = self.client.get(self.url, {"days": 14})
        cra = next(r for r in resp.data["creatives"] if r["meta_creative_id"] == "cra")
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
            "ad_count",
        ):
            self.assertIn(key, cra)

    def test_filters_echo_block_present(self):
        resp = self.client.get(self.url, {"days": 14})
        for key in (
            "min_impressions",
            "min_spend",
            "min_events",
            "min_days_with_data",
            "include_inactive",
            "include_shared_creatives",
        ):
            self.assertIn(key, resp.data["filters"])

    def test_is_in_learning_set_per_creative(self):
        resp = self.client.get(
            self.url,
            {
                "days": 14,
                "include_inactive": "true",
                "include_shared_creatives": "true",
            },
        )
        rows = {r["meta_creative_id"]: r for r in resp.data["creatives"]}
        # Creative A: 112 events / 14d => events*7 = 784; threshold = 50*14 = 700;
        # 784 < 700 is False, so out of learning.
        self.assertFalse(rows["cra"]["is_in_learning"])
        # Creative B: 0 events => still in learning.
        self.assertTrue(rows["crb"]["is_in_learning"])

    def test_is_in_learning_null_when_window_lt_7(self):
        resp = self.client.get(
            self.url,
            {
                "days": 3,
                "include_inactive": "true",
                "include_shared_creatives": "true",
            },
        )
        for row in resp.data["creatives"]:
            self.assertIsNone(row["is_in_learning"])

    def test_ad_count_reflects_one_to_one_vs_shared(self):
        resp = self.client.get(
            self.url, {"days": 14, "include_shared_creatives": "true"}
        )
        rows = {r["meta_creative_id"]: r for r in resp.data["creatives"]}
        self.assertEqual(rows["cra"]["ad_count"], 1)
        self.assertEqual(rows["crc"]["ad_count"], 2)


class MetaAdComparisonModeTests(APITestCase):
    """Cover the ad-comparison `ids` query param on MetaAdPerformanceView.

    When `ids` is non-empty the view bypasses the activity / min_* filters
    and the default spend-desc sort, returning rows for the requested ads
    in input order (with foreign-account ids silently dropped). When `ids`
    is absent or empty, behavior is unchanged.

    Fixture: one primary ad account with six ads (mix of high traffic, mid
    traffic, low events, and zero-impression). One secondary ad account
    with one ad to exercise the foreign-account drop.
    """

    @classmethod
    def setUpTestData(cls):
        User = get_user_model()
        cls.user = User.objects.create_user(
            username="comparison_user",
            email="comparison@example.com",
            password="x",
        )
        cls.connection = FacebookConnection.objects.create(
            user=cls.user, fb_user_id="fb-test-3", is_active=True
        )
        cls.ad_account = MetaAdAccount.objects.create(
            connection=cls.connection,
            meta_account_id="333",
            name="Comparison Account",
            currency="USD",
        )
        cls.campaign = MetaCampaign.objects.create(
            ad_account=cls.ad_account, meta_campaign_id="cmp1", name="Camp"
        )
        cls.adset = MetaAdSet.objects.create(
            campaign=cls.campaign, meta_adset_id="cmpas1", name="Adset"
        )

        cls.ad_a = MetaAd.objects.create(
            adset=cls.adset, meta_ad_id="cmp_a", name="Ad A"
        )
        cls.ad_b = MetaAd.objects.create(
            adset=cls.adset, meta_ad_id="cmp_b", name="Ad B"
        )
        cls.ad_c = MetaAd.objects.create(
            adset=cls.adset, meta_ad_id="cmp_c", name="Ad C"
        )
        cls.ad_d = MetaAd.objects.create(
            adset=cls.adset, meta_ad_id="cmp_d", name="Ad D"
        )
        cls.ad_e = MetaAd.objects.create(
            adset=cls.adset, meta_ad_id="cmp_e", name="Ad E"
        )
        cls.ad_f = MetaAd.objects.create(
            adset=cls.adset, meta_ad_id="cmp_f", name="Ad F"
        )

        # Foreign account
        cls.foreign_user = User.objects.create_user(
            username="foreign_comparison_user",
            email="foreign_comparison@example.com",
            password="x",
        )
        cls.foreign_connection = FacebookConnection.objects.create(
            user=cls.foreign_user, fb_user_id="fb-foreign-3", is_active=True
        )
        cls.foreign_account = MetaAdAccount.objects.create(
            connection=cls.foreign_connection,
            meta_account_id="444",
            name="Foreign Account",
            currency="USD",
        )
        cls.foreign_campaign = MetaCampaign.objects.create(
            ad_account=cls.foreign_account, meta_campaign_id="fcmp1", name="Foreign Camp"
        )
        cls.foreign_adset = MetaAdSet.objects.create(
            campaign=cls.foreign_campaign, meta_adset_id="fcmpas1", name="Foreign Adset"
        )
        cls.foreign_ad = MetaAd.objects.create(
            adset=cls.foreign_adset, meta_ad_id="cmp_foreign", name="Foreign Ad"
        )

        today = _dt.date.today()
        # Ad A: 14 days high traffic, ~112 events
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
        # Ad B: no insights — exercises activity-bypass when ids given.
        # Ad C: no insights either — same purpose, plus order-preserve test.
        # Ad D: 7 days mid traffic
        for i in range(7):
            MetaInsightDaily.objects.create(
                ad=cls.ad_d,
                date=today - _dt.timedelta(days=i),
                spend=Decimal("8.00"),
                impressions=400,
                clicks=12,
                leads=4,
                purchases=1,
                video_3sec_count=160,
                lpv_count=8,
            )
        # Ad E: 14 days
        for i in range(14):
            MetaInsightDaily.objects.create(
                ad=cls.ad_e,
                date=today - _dt.timedelta(days=i),
                spend=Decimal("6.00"),
                impressions=300,
                clicks=8,
                leads=4,
                purchases=1,
                video_3sec_count=120,
            )
        # Ad F: 14 days low events
        for i in range(14):
            MetaInsightDaily.objects.create(
                ad=cls.ad_f,
                date=today - _dt.timedelta(days=i),
                spend=Decimal("4.00"),
                impressions=200,
                clicks=4,
                leads=2,
                purchases=0,
                video_3sec_count=80,
            )

    def setUp(self):
        self.client.force_authenticate(user=self.user)
        self.url = reverse("meta-ad-performance", args=[self.ad_account.id])

    def _ids(self, response):
        return [row["id"] for row in response.data["ads"]]

    def test_empty_ids_param_falls_back_to_default_behavior(self):
        # ids="" means default M3 path: activity filter on by default.
        # Ad A / D / E / F have impressions; B and C do not.
        resp = self.client.get(self.url, {"days": 14, "ids": ""})
        self.assertEqual(resp.status_code, 200)
        returned = self._ids(resp)
        self.assertIn(self.ad_a.id, returned)
        self.assertIn(self.ad_d.id, returned)
        self.assertNotIn(self.ad_b.id, returned)
        self.assertNotIn(self.ad_c.id, returned)
        # echo carries an empty ids list, not the literal "" param.
        self.assertEqual(resp.data["filters"]["ids"], [])

    def test_nonexistent_id_returns_empty_ads(self):
        resp = self.client.get(self.url, {"days": 14, "ids": "999999"})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["ads"], [])
        self.assertEqual(resp.data["filters"]["ids"], [999999])

    def test_mixed_input_resolved_and_deduped(self):
        spec = f"{self.ad_a.id},{self.ad_b.id},abc,{self.ad_c.id},{self.ad_a.id}"
        resp = self.client.get(self.url, {"days": 14, "ids": spec})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(
            self._ids(resp),
            [self.ad_a.id, self.ad_b.id, self.ad_c.id],
        )
        self.assertEqual(
            resp.data["filters"]["ids"],
            [self.ad_a.id, self.ad_b.id, self.ad_c.id],
        )

    def test_min_events_filter_bypassed_when_ids_present(self):
        # Ad B has 0 events; min_events=50 would normally exclude it.
        resp = self.client.get(
            self.url,
            {"days": 14, "ids": str(self.ad_b.id), "min_events": 50},
        )
        self.assertEqual(self._ids(resp), [self.ad_b.id])

    def test_activity_filter_bypassed_when_ids_present(self):
        # Ad B has zero impressions; default activity filter would normally
        # exclude it. With ids, it must come through.
        resp = self.client.get(
            self.url, {"days": 14, "ids": str(self.ad_b.id)}
        )
        self.assertEqual(self._ids(resp), [self.ad_b.id])

    def test_min_spend_filter_bypassed_when_ids_present(self):
        # Ad B has $0 spend; min_spend=100 would normally exclude it.
        resp = self.client.get(
            self.url,
            {"days": 14, "ids": str(self.ad_b.id), "min_spend": "100"},
        )
        self.assertEqual(self._ids(resp), [self.ad_b.id])

    def test_foreign_ad_account_id_silently_dropped(self):
        spec = f"{self.ad_a.id},{self.foreign_ad.id},{self.ad_b.id}"
        resp = self.client.get(self.url, {"days": 14, "ids": spec})
        self.assertEqual(self._ids(resp), [self.ad_a.id, self.ad_b.id])
        # Echo includes the foreign id (request shape, not resolved shape).
        self.assertEqual(
            resp.data["filters"]["ids"],
            [self.ad_a.id, self.foreign_ad.id, self.ad_b.id],
        )

    def test_input_order_preserved_strict(self):
        spec = f"{self.ad_c.id},{self.ad_a.id},{self.ad_b.id}"
        resp = self.client.get(self.url, {"days": 14, "ids": spec})
        self.assertEqual(
            self._ids(resp),
            [self.ad_c.id, self.ad_a.id, self.ad_b.id],
        )

    def test_six_ids_accepted_no_frontend_cap(self):
        spec = ",".join(
            str(i)
            for i in [
                self.ad_a.id,
                self.ad_b.id,
                self.ad_c.id,
                self.ad_d.id,
                self.ad_e.id,
                self.ad_f.id,
            ]
        )
        resp = self.client.get(self.url, {"days": 14, "ids": spec})
        self.assertEqual(len(resp.data["ads"]), 6)

    def test_filters_echo_includes_ids(self):
        spec = f"{self.ad_a.id},{self.ad_b.id}"
        resp = self.client.get(self.url, {"days": 14, "ids": spec})
        self.assertEqual(
            resp.data["filters"]["ids"], [self.ad_a.id, self.ad_b.id]
        )

    def test_is_in_learning_still_emitted_in_ids_mode(self):
        spec = f"{self.ad_a.id},{self.ad_b.id}"
        resp = self.client.get(self.url, {"days": 14, "ids": spec})
        for row in resp.data["ads"]:
            self.assertIn("is_in_learning", row)

    def test_ids_with_days_lt_7_emits_null_is_in_learning(self):
        resp = self.client.get(
            self.url, {"days": 3, "ids": str(self.ad_a.id)}
        )
        self.assertEqual(len(resp.data["ads"]), 1)
        self.assertIsNone(resp.data["ads"][0]["is_in_learning"])


class MetaAdExportCsvTests(APITestCase):
    """Cover the CSV export endpoint: streaming response shape, headers,
    filter contract, and per-row formatting (numeric escaping, learning
    state, creative reuse count, comma escaping in names).

    Fixture: one primary account with four ads — two share a creative
    (so reuse count == 2), one is zero-impression (activity filter), one
    has a comma in its name (escaping). One foreign account contributes
    one ad to verify cross-tenant id drop.
    """

    EXPECTED_HEADER = (
        "Ad ID,Ad Name,Campaign,Ad Set,Creative ID,Spend (account currency),"
        "Impressions,Reach,Frequency,Days with data,ROAS,CPA,CVR,"
        "Hook Rate (strict),Hold Rate,CTR,Completion Rate,LPV Count,"
        "Comment Count,3-sec Views,Total Events,In Learning,Creative Reuse Count"
    )

    @classmethod
    def setUpTestData(cls):
        User = get_user_model()
        cls.user = User.objects.create_user(
            username="csv_export_user",
            email="csv_export@example.com",
            password="x",
        )
        cls.connection = FacebookConnection.objects.create(
            user=cls.user, fb_user_id="fb-test-csv", is_active=True
        )
        cls.ad_account = MetaAdAccount.objects.create(
            connection=cls.connection,
            meta_account_id="555",
            name="CSV Account",
            currency="USD",
        )
        cls.campaign = MetaCampaign.objects.create(
            ad_account=cls.ad_account,
            meta_campaign_id="csvc1",
            name="CSV Camp",
        )
        cls.adset = MetaAdSet.objects.create(
            campaign=cls.campaign,
            meta_adset_id="csvas1",
            name="CSV Adset",
        )

        cls.shared_creative = MetaAdCreative.objects.create(
            ad_account=cls.ad_account,
            meta_creative_id="shared_42",
            title="Shared",
            thumbnail_url="",
            video_id="",
            object_type="VIDEO",
        )

        cls.ad_a = MetaAd.objects.create(
            adset=cls.adset,
            meta_ad_id="csv_a",
            name="Ad A",
            creative=cls.shared_creative,
        )
        cls.ad_b = MetaAd.objects.create(
            adset=cls.adset,
            meta_ad_id="csv_b",
            name="Ad B",
            creative=cls.shared_creative,
        )
        cls.ad_c = MetaAd.objects.create(
            adset=cls.adset,
            meta_ad_id="csv_c",
            name="Ad C",
        )
        cls.ad_comma = MetaAd.objects.create(
            adset=cls.adset,
            meta_ad_id="csv_comma",
            name="Test, Ad",
        )

        cls.foreign_user = User.objects.create_user(
            username="foreign_csv_user",
            email="foreign_csv@example.com",
            password="x",
        )
        cls.foreign_connection = FacebookConnection.objects.create(
            user=cls.foreign_user, fb_user_id="fb-foreign-csv", is_active=True
        )
        cls.foreign_account = MetaAdAccount.objects.create(
            connection=cls.foreign_connection,
            meta_account_id="666",
            name="Foreign CSV Account",
            currency="USD",
        )
        cls.foreign_campaign = MetaCampaign.objects.create(
            ad_account=cls.foreign_account,
            meta_campaign_id="fcsvc1",
            name="Foreign CSV Camp",
        )
        cls.foreign_adset = MetaAdSet.objects.create(
            campaign=cls.foreign_campaign,
            meta_adset_id="fcsvas1",
            name="Foreign CSV Adset",
        )
        cls.foreign_ad = MetaAd.objects.create(
            adset=cls.foreign_adset,
            meta_ad_id="csv_foreign",
            name="Foreign Ad",
        )

        today = _dt.date.today()

        # Ad A: high volume; mature lifecycle (events well above the
        # learning threshold). Numbers chosen to give clean assertions:
        # totals over 14 days are spend=1400, impressions=1.4M, ROAS=2.
        for i in range(14):
            MetaInsightDaily.objects.create(
                ad=cls.ad_a,
                date=today - _dt.timedelta(days=i),
                spend=Decimal("100.00"),
                impressions=100000,
                reach=50000,
                clicks=300,
                leads=10,
                calls=2,
                purchases=5,
                messages=1,
                revenue=Decimal("200.00"),
                video_3sec_count=80000,
                lpv_count=200,
                comment_count=10,
            )

        # Ad B: no insights — exercises activity-filter bypass and shows
        # creative reuse without contributing to its own row counts.

        # Ad C: low events, learning. 1 event/day for 14 days = 14 events;
        # 14 * 7 = 98 < 50 * 14 = 700 → in learning.
        for i in range(14):
            MetaInsightDaily.objects.create(
                ad=cls.ad_c,
                date=today - _dt.timedelta(days=i),
                spend=Decimal("1.00"),
                impressions=10,
                reach=10,
                clicks=1,
                purchases=1,
            )

        # Ad with a comma in its name; non-zero traffic so it shows up
        # under the default activity filter.
        for i in range(14):
            MetaInsightDaily.objects.create(
                ad=cls.ad_comma,
                date=today - _dt.timedelta(days=i),
                spend=Decimal("5.00"),
                impressions=100,
                reach=80,
                clicks=5,
                purchases=2,
            )

    def setUp(self):
        self.client.force_authenticate(user=self.user)
        self.url = reverse(
            "meta-ad-performance-export-csv", args=[self.ad_account.id]
        )

    def _body(self, response) -> str:
        return b"".join(response.streaming_content).decode("utf-8")

    def _rows(self, response):
        return list(csv.reader(io.StringIO(self._body(response))))

    def test_get_with_explicit_ids_returns_input_order(self):
        spec = f"{self.ad_c.id},{self.ad_a.id},{self.ad_b.id}"
        resp = self.client.get(self.url, {"days": 14, "ids": spec})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp["Content-Type"], "text/csv; charset=utf-8")
        self.assertTrue(
            resp["Content-Disposition"].startswith(
                'attachment; filename="meta-ads-'
            )
        )
        self.assertIn(f"-{self.ad_account.id}-14d-", resp["Content-Disposition"])
        rows = self._rows(resp)
        self.assertEqual(len(rows), 4)
        self.assertEqual(
            [rows[1][0], rows[2][0], rows[3][0]],
            [self.ad_c.meta_ad_id, self.ad_a.meta_ad_id, self.ad_b.meta_ad_id],
        )
        # Creative reuse: ad_a and ad_b share a creative → 2; ad_c has none → 1.
        ids_to_reuse = {row[0]: row[22] for row in rows[1:]}
        self.assertEqual(ids_to_reuse[self.ad_a.meta_ad_id], "2")
        self.assertEqual(ids_to_reuse[self.ad_b.meta_ad_id], "2")
        self.assertEqual(ids_to_reuse[self.ad_c.meta_ad_id], "1")

    def test_header_row_exact_match(self):
        resp = self.client.get(self.url, {"days": 14, "ids": str(self.ad_a.id)})
        body = self._body(resp)
        first_line = body.split("\r\n", 1)[0]
        self.assertEqual(first_line, self.EXPECTED_HEADER)

    def test_numeric_formatting(self):
        resp = self.client.get(self.url, {"days": 14, "ids": str(self.ad_a.id)})
        rows = self._rows(resp)
        data = rows[1]
        # Spend column (index 5): plain decimal, no currency symbol or
        # thousands separator. Totals: 14 * 100.00 = 1400.00.
        self.assertEqual(data[5], "1400.00")
        self.assertNotIn("$", data[5])
        # Impressions column (index 6): plain int, no commas. 14 * 100000.
        self.assertEqual(data[6], "1400000")
        # ROAS column (index 10): rev / spend = 2800 / 1400 = 2 → "2.0000".
        self.assertEqual(data[10], "2.0000")
        # Hook Rate (strict) column (index 13): no percent sign, raw decimal.
        self.assertNotIn("%", data[13])
        self.assertRegex(data[13], r"^\d+(\.\d+)?$")
        # CTR column (index 15): no percent sign, raw decimal.
        self.assertNotIn("%", data[15])

    def test_is_in_learning_yes_no_empty(self):
        resp_a = self.client.get(self.url, {"days": 14, "ids": str(self.ad_a.id)})
        self.assertEqual(self._rows(resp_a)[1][21], "No")

        resp_c = self.client.get(self.url, {"days": 14, "ids": str(self.ad_c.id)})
        self.assertEqual(self._rows(resp_c)[1][21], "Yes")

        resp_short = self.client.get(
            self.url, {"days": 3, "ids": str(self.ad_a.id)}
        )
        self.assertEqual(self._rows(resp_short)[1][21], "")

    def test_csv_escaping_for_comma_in_name(self):
        resp = self.client.get(
            self.url, {"days": 14, "ids": str(self.ad_comma.id)}
        )
        body = self._body(resp)
        self.assertIn('"Test, Ad"', body)
        rows = list(csv.reader(io.StringIO(body)))
        self.assertEqual(rows[1][1], "Test, Ad")

    def test_foreign_id_silently_dropped_in_ids_mode(self):
        spec = f"{self.ad_a.id},{self.foreign_ad.id},{self.ad_b.id}"
        resp = self.client.get(self.url, {"days": 14, "ids": spec})
        rows = self._rows(resp)
        body_ids = [r[0] for r in rows[1:]]
        self.assertEqual(
            body_ids, [self.ad_a.meta_ad_id, self.ad_b.meta_ad_id]
        )

    def test_activity_filter_applies_when_no_ids_bypassed_when_ids(self):
        resp_default = self.client.get(self.url, {"days": 14})
        rows_default = self._rows(resp_default)
        ids_default = [r[0] for r in rows_default[1:]]
        self.assertNotIn(self.ad_b.meta_ad_id, ids_default)
        self.assertIn(self.ad_a.meta_ad_id, ids_default)

        spec = f"{self.ad_a.id},{self.ad_b.id}"
        resp_ids = self.client.get(self.url, {"days": 14, "ids": spec})
        rows_ids = self._rows(resp_ids)
        self.assertEqual(len(rows_ids), 3)

    def test_empty_result_emits_header_only(self):
        resp = self.client.get(
            self.url, {"days": 14, "min_spend": "999999"}
        )
        rows = self._rows(resp)
        self.assertEqual(len(rows), 1)
        self.assertEqual(",".join(rows[0]), self.EXPECTED_HEADER)


class SyncInsightsActionCountsRegressionTests(APITestCase):
    """Cover the sync write path when the Graph API row omits the actions array.

    The three NOT-NULL columns lpv_count, video_3sec_count, and comment_count
    must persist as zero when actions is absent, null, or an empty list. A
    prior bug let the parsers' return value leak as NULL into the column,
    breaking the daily sync against any account whose latest day had no
    measured actions.
    """

    @classmethod
    def setUpTestData(cls):
        User = get_user_model()
        cls.user = User.objects.create_user(
            username="sync_regression_user",
            email="sync_regression@example.com",
            password="x",
        )
        cls.connection = FacebookConnection.objects.create(
            user=cls.user, fb_user_id="fb-test-sync", is_active=True
        )
        cls.ad_account = MetaAdAccount.objects.create(
            connection=cls.connection,
            meta_account_id="777",
            name="Sync Regression Account",
            currency="USD",
        )
        cls.campaign = MetaCampaign.objects.create(
            ad_account=cls.ad_account,
            meta_campaign_id="syncc1",
            name="Sync Camp",
        )
        cls.adset = MetaAdSet.objects.create(
            campaign=cls.campaign,
            meta_adset_id="syncas1",
            name="Sync Adset",
        )
        cls.ad = MetaAd.objects.create(
            adset=cls.adset, meta_ad_id="sync_ad_1", name="Sync Ad"
        )

    def _row(self, date_str: str, actions_value):
        """Build a Graph-API-shaped row. Pass a sentinel to omit actions."""
        row: dict = {
            "ad_id": self.ad.meta_ad_id,
            "date_start": date_str,
            "spend": "12.34",
            "impressions": "100",
            "reach": "80",
            "clicks": "5",
            "frequency": "1.25",
            "ctr": "5.0",
            "cpc": "2.47",
            "cpm": "123.40",
        }
        if actions_value is not _OMITTED:
            row["actions"] = actions_value
        return row

    def test_sync_persists_zero_action_counts_when_actions_array_missing(self):
        rows = [
            self._row("2026-04-24", _OMITTED),
            self._row("2026-04-25", None),
            self._row("2026-04-26", []),
        ]
        with patch("meta_ads.services.graph_paged", return_value=iter(rows)):
            from meta_ads.services import sync_insights

            inserted = sync_insights(self.ad_account, "fake-token", days=14)

        self.assertEqual(inserted, 3)
        persisted = MetaInsightDaily.objects.filter(ad=self.ad).order_by("date")
        self.assertEqual(persisted.count(), 3)
        for row in persisted:
            self.assertEqual(row.lpv_count, 0)
            self.assertEqual(row.video_3sec_count, 0)
            self.assertEqual(row.comment_count, 0)
            self.assertEqual(row.impressions, 100)
            self.assertEqual(row.clicks, 5)


_OMITTED = object()


class MetaSyncRunPhaseFieldsTests(APITestCase):
    """Cover the phase signal fields on MetaSyncRun and the phase boundary
    updates inside sync_ad_account.
    """

    @classmethod
    def setUpTestData(cls):
        User = get_user_model()
        cls.user = User.objects.create_user(
            username="phase_test_user",
            email="phase_test@example.com",
            password="x",
        )
        cls.connection = FacebookConnection.objects.create(
            user=cls.user, fb_user_id="fb-test-phase", is_active=True
        )
        cls.ad_account = MetaAdAccount.objects.create(
            connection=cls.connection,
            meta_account_id="888",
            name="Phase Test Account",
            currency="USD",
        )

    def test_phase_fields_default_to_empty_string(self):
        from meta_ads.models import MetaSyncRun

        run = MetaSyncRun.objects.create(
            ad_account=self.ad_account, kind="manual", status="running"
        )
        self.assertEqual(run.current_phase, "")
        self.assertEqual(run.current_progress, "")

    def test_sync_ad_account_updates_phase_through_boundaries(self):
        """Patch each per-level syncer with a wrapper that captures the row's
        current_phase at entry. Assert the captured sequence matches the six
        boundaries in order, then assert the row resets to empty at the end.
        """
        from meta_ads import services
        from meta_ads.models import MetaSyncRun

        captured: list[str] = []

        def make_capture(label: str, return_value):
            def _capture(ad_account, access_token, *args, **kwargs):
                row = MetaSyncRun.objects.filter(
                    ad_account=ad_account, status="running"
                ).order_by("-started_at").first()
                if row is not None:
                    captured.append(row.current_phase)
                return return_value

            return _capture

        with patch.object(
            services, "sync_campaigns", side_effect=make_capture("campaigns", 0)
        ), patch.object(
            services, "sync_adsets", side_effect=make_capture("adsets", 0)
        ), patch.object(
            services, "sync_creatives", side_effect=make_capture("creatives", 0)
        ), patch.object(
            services, "sync_ads", side_effect=make_capture("ads", 0)
        ), patch.object(
            services,
            "backfill_missing_creative_fks",
            side_effect=make_capture("creative_fk_backfill", 0),
        ), patch.object(
            services, "sync_insights", side_effect=make_capture("insights", 0)
        ):
            run = services.sync_ad_account(
                self.ad_account, "fake-token", days=14, kind="manual"
            )

        self.assertEqual(
            captured,
            [
                "campaigns",
                "adsets",
                "creatives",
                "ads",
                "creative_fk_backfill",
                "insights",
            ],
        )
        # Final reset: status flips to ok and the phase signals clear.
        self.assertEqual(run.status, "ok")
        self.assertEqual(run.current_phase, "")
        self.assertEqual(run.current_progress, "")


class SyncAllActiveAdAccountsTests(APITestCase):
    """Cover the daily fan-out task: active-account selection, Meta-disabled
    skipping, and the lock that prevents duplicate runs while a sync is
    still in flight for the same account.
    """

    @classmethod
    def setUpTestData(cls):
        User = get_user_model()

        # Active connection with two ad accounts: one healthy, one Meta-disabled.
        cls.active_user = User.objects.create_user(
            username="fanout_active_user",
            email="fanout_active@example.com",
            password="x",
        )
        cls.active_connection = FacebookConnection.objects.create(
            user=cls.active_user, fb_user_id="fb-active", is_active=True
        )
        cls.healthy_account = MetaAdAccount.objects.create(
            connection=cls.active_connection,
            meta_account_id="active-1",
            name="Healthy",
            currency="USD",
            account_status=1,
        )
        cls.disabled_account = MetaAdAccount.objects.create(
            connection=cls.active_connection,
            meta_account_id="active-2",
            name="Disabled on Meta",
            currency="USD",
            account_status=2,
        )

        # Inactive connection — its accounts must be skipped regardless of
        # account_status because the parent connection is off.
        cls.inactive_user = User.objects.create_user(
            username="fanout_inactive_user",
            email="fanout_inactive@example.com",
            password="x",
        )
        cls.inactive_connection = FacebookConnection.objects.create(
            user=cls.inactive_user, fb_user_id="fb-inactive", is_active=False
        )
        cls.dormant_account = MetaAdAccount.objects.create(
            connection=cls.inactive_connection,
            meta_account_id="inactive-1",
            name="Inactive",
            currency="USD",
            account_status=1,
        )

        # Active connection, account_status null (legacy / unknown) — should
        # be treated as active.
        cls.legacy_user = User.objects.create_user(
            username="fanout_legacy_user",
            email="fanout_legacy@example.com",
            password="x",
        )
        cls.legacy_connection = FacebookConnection.objects.create(
            user=cls.legacy_user, fb_user_id="fb-legacy", is_active=True
        )
        cls.legacy_account = MetaAdAccount.objects.create(
            connection=cls.legacy_connection,
            meta_account_id="legacy-1",
            name="Legacy",
            currency="USD",
            account_status=None,
        )

    @patch("meta_ads.tasks.sync_single_ad_account.delay")
    def test_dispatches_only_for_active_connections(self, mock_delay):
        from meta_ads.tasks import sync_all_active_ad_accounts

        result = sync_all_active_ad_accounts()

        dispatched_ids = sorted(
            call.kwargs["ad_account_id"] for call in mock_delay.call_args_list
        )
        self.assertEqual(
            dispatched_ids,
            sorted([self.healthy_account.id, self.legacy_account.id]),
        )
        self.assertNotIn(self.dormant_account.id, dispatched_ids)
        self.assertEqual(result["dispatched"], 2)
        self.assertEqual(result["skipped_locked"], 0)

    @patch("meta_ads.tasks.sync_single_ad_account.delay")
    def test_skips_accounts_disabled_on_meta(self, mock_delay):
        from meta_ads.tasks import sync_all_active_ad_accounts

        sync_all_active_ad_accounts()

        dispatched_ids = [
            call.kwargs["ad_account_id"] for call in mock_delay.call_args_list
        ]
        self.assertNotIn(self.disabled_account.id, dispatched_ids)

    @patch("meta_ads.tasks.sync_single_ad_account.delay")
    def test_lock_skips_in_flight_and_releases_after_window(self, mock_delay):
        from meta_ads.models import MetaSyncRun
        from meta_ads.tasks import sync_all_active_ad_accounts, LOCK_WINDOW_MINUTES

        # Fresh running row → lock holds, fan-out skips this account.
        recent_run = MetaSyncRun.objects.create(
            ad_account=self.healthy_account, kind="manual", status="running"
        )

        result = sync_all_active_ad_accounts()
        dispatched_ids = [
            call.kwargs["ad_account_id"] for call in mock_delay.call_args_list
        ]
        self.assertNotIn(self.healthy_account.id, dispatched_ids)
        self.assertIn(self.legacy_account.id, dispatched_ids)
        self.assertEqual(result["dispatched"], 1)
        self.assertEqual(result["skipped_locked"], 1)

        # Same row aged past the lock window → next call dispatches normally.
        mock_delay.reset_mock()
        MetaSyncRun.objects.filter(pk=recent_run.pk).update(
            started_at=timezone.now()
            - _dt.timedelta(minutes=LOCK_WINDOW_MINUTES + 1)
        )
        result = sync_all_active_ad_accounts()
        dispatched_ids = sorted(
            call.kwargs["ad_account_id"] for call in mock_delay.call_args_list
        )
        self.assertEqual(
            dispatched_ids,
            sorted([self.healthy_account.id, self.legacy_account.id]),
        )
        self.assertEqual(result["dispatched"], 2)
        self.assertEqual(result["skipped_locked"], 0)


class MetaAdTriggerDailySyncAllTests(APITestCase):
    """Cover the platform-cron endpoint: header-based shared-secret auth,
    fail-closed behavior when the server side is unconfigured, and the
    success path that dispatches sync_all_active_ad_accounts.
    """

    URL = "/api/meta_ads/trigger_daily_sync_all/"

    @override_settings(INTERNAL_CRON_SECRET="match-me")
    @patch("meta_ads.views.sync_all_active_ad_accounts.delay")
    def test_dispatches_when_header_matches(self, mock_delay):
        mock_delay.return_value = SimpleNamespace(id="task-abc")
        resp = self.client.post(
            self.URL, HTTP_X_INTERNAL_CRON_SECRET="match-me"
        )
        self.assertEqual(resp.status_code, 202)
        self.assertEqual(resp.data, {"dispatched_task_id": "task-abc"})
        mock_delay.assert_called_once_with()

    @override_settings(INTERNAL_CRON_SECRET="match-me")
    @patch("meta_ads.views.sync_all_active_ad_accounts.delay")
    def test_rejects_wrong_header(self, mock_delay):
        resp = self.client.post(
            self.URL, HTTP_X_INTERNAL_CRON_SECRET="wrong"
        )
        self.assertEqual(resp.status_code, 401)
        self.assertEqual(resp.data, {"detail": "invalid secret"})
        mock_delay.assert_not_called()

    @override_settings(INTERNAL_CRON_SECRET="")
    @patch("meta_ads.views.sync_all_active_ad_accounts.delay")
    def test_fail_closed_on_empty_settings(self, mock_delay):
        # Even when the request header is also empty, an unconfigured server
        # side must reject so a misconfigured prod cannot accidentally accept
        # any caller.
        resp = self.client.post(
            self.URL, HTTP_X_INTERNAL_CRON_SECRET=""
        )
        self.assertEqual(resp.status_code, 401)
        mock_delay.assert_not_called()


class MetaAdsExportEndpointsTests(APITestCase):
    """Cover the new creative + campaign CSV exports and the three
    export-to-spreadsheet endpoints. One test per endpoint exercises the
    happy path; the ids-filter behavior is verified inline via a second
    request on the same fixture; the spreadsheet endpoint asserts that a
    Spreadsheet plus a populated Sheet were created.
    """

    @classmethod
    def setUpTestData(cls):
        from core.models import Organization, Project as CoreProject

        User = get_user_model()
        cls.user = User.objects.create_user(
            username="export_user",
            email="export@example.com",
            password="x",
        )
        cls.org = Organization.objects.create(name="Export Test Org")
        cls.project = CoreProject.objects.create(
            name="Export Test Project",
            organization=cls.org,
            owner=cls.user,
        )
        cls.connection = FacebookConnection.objects.create(
            user=cls.user, fb_user_id="fb-test-export", is_active=True
        )
        cls.ad_account = MetaAdAccount.objects.create(
            connection=cls.connection,
            meta_account_id="999",
            name="Export Account",
            currency="USD",
        )
        cls.campaign_a = MetaCampaign.objects.create(
            ad_account=cls.ad_account,
            meta_campaign_id="cmpA",
            name="Camp A",
            objective="OUTCOME_SALES",
            effective_status="ACTIVE",
        )
        cls.campaign_b = MetaCampaign.objects.create(
            ad_account=cls.ad_account,
            meta_campaign_id="cmpB",
            name="Camp B",
            objective="OUTCOME_LEADS",
            effective_status="PAUSED",
        )
        cls.adset_a = MetaAdSet.objects.create(
            campaign=cls.campaign_a, meta_adset_id="asA", name="Adset A"
        )
        cls.adset_b = MetaAdSet.objects.create(
            campaign=cls.campaign_b, meta_adset_id="asB", name="Adset B"
        )
        cls.creative_a = MetaAdCreative.objects.create(
            ad_account=cls.ad_account,
            meta_creative_id="crA",
            name="Creative A",
            title="Headline A",
            body="Body A",
            object_type="VIDEO",
            call_to_action_type="LEARN_MORE",
        )
        cls.creative_b = MetaAdCreative.objects.create(
            ad_account=cls.ad_account,
            meta_creative_id="crB",
            name="Creative B",
            title="Headline B",
            body="Body B",
            object_type="VIDEO",
            call_to_action_type="SHOP_NOW",
        )
        cls.ad_a = MetaAd.objects.create(
            adset=cls.adset_a,
            meta_ad_id="adA",
            name="Ad A",
            creative=cls.creative_a,
        )
        cls.ad_b = MetaAd.objects.create(
            adset=cls.adset_b,
            meta_ad_id="adB",
            name="Ad B",
            creative=cls.creative_b,
        )

        today = _dt.date.today()
        for i in range(14):
            MetaInsightDaily.objects.create(
                ad=cls.ad_a,
                date=today - _dt.timedelta(days=i),
                spend=Decimal("10.00"),
                impressions=1000,
                reach=800,
                clicks=20,
                leads=5,
                purchases=2,
                revenue=Decimal("40.00"),
                video_3sec_count=400,
                lpv_count=20,
                comment_count=2,
            )
            MetaInsightDaily.objects.create(
                ad=cls.ad_b,
                date=today - _dt.timedelta(days=i),
                spend=Decimal("5.00"),
                impressions=500,
                reach=400,
                clicks=10,
                leads=2,
                purchases=1,
                revenue=Decimal("15.00"),
                video_3sec_count=200,
                lpv_count=10,
                comment_count=1,
            )

    def setUp(self):
        self.client.force_authenticate(user=self.user)

    def _body(self, response) -> str:
        return b"".join(response.streaming_content).decode("utf-8")

    def _rows(self, response):
        return list(csv.reader(io.StringIO(self._body(response))))

    # ---- CSV: creative ---------------------------------------------------

    def test_creative_csv_export_streams_expected_columns(self):
        url = reverse(
            "meta-creative-performance-export-csv", args=[self.ad_account.id]
        )
        resp = self.client.get(url, {"days": 14})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp["Content-Type"], "text/csv; charset=utf-8")
        rows = self._rows(resp)
        self.assertEqual(rows[0][0], "Creative ID")
        self.assertEqual(rows[0][-1], "Ad Count")
        self.assertEqual(len(rows[0]), 23)
        creative_ids = {row[0] for row in rows[1:]}
        self.assertIn(self.creative_a.meta_creative_id, creative_ids)

    def test_creative_csv_export_filters_by_ids(self):
        url = reverse(
            "meta-creative-performance-export-csv", args=[self.ad_account.id]
        )
        resp = self.client.get(
            url, {"days": 14, "ids": str(self.creative_b.id)}
        )
        rows = self._rows(resp)
        creative_ids = [row[0] for row in rows[1:]]
        self.assertEqual(creative_ids, [self.creative_b.meta_creative_id])

    # ---- CSV: campaign ---------------------------------------------------

    def test_campaign_csv_export_streams_expected_columns(self):
        url = reverse(
            "meta-campaign-performance-export-csv", args=[self.ad_account.id]
        )
        resp = self.client.get(url, {"days": 14})
        self.assertEqual(resp.status_code, 200)
        rows = self._rows(resp)
        self.assertEqual(rows[0][0], "Campaign ID")
        self.assertEqual(rows[0][-1], "CPM")
        self.assertEqual(len(rows[0]), 16)
        campaign_ids = {row[0] for row in rows[1:]}
        self.assertIn(self.campaign_a.meta_campaign_id, campaign_ids)

    def test_campaign_csv_export_filters_by_ids(self):
        url = reverse(
            "meta-campaign-performance-export-csv", args=[self.ad_account.id]
        )
        resp = self.client.get(
            url, {"days": 14, "ids": str(self.campaign_b.id)}
        )
        rows = self._rows(resp)
        campaign_ids = [row[0] for row in rows[1:]]
        self.assertEqual(campaign_ids, [self.campaign_b.meta_campaign_id])

    # ---- Spreadsheet: ad-level success path -----------------------------

    def test_ad_export_to_spreadsheet_creates_populated_record(self):
        from spreadsheet.models import Cell, Sheet, Spreadsheet

        url = reverse(
            "meta-ad-performance-export-spreadsheet", args=[self.ad_account.id]
        )
        resp = self.client.post(
            f"{url}?project_id={self.project.id}&days=14",
            {"name": "Export Test Sheet"},
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertIn("id", resp.data)
        self.assertEqual(
            resp.data["url"], f"/spreadsheets/{resp.data['id']}"
        )
        sheet_id = resp.data["id"]
        spreadsheet = Spreadsheet.objects.get(pk=sheet_id)
        self.assertEqual(spreadsheet.project_id, self.project.id)
        sheet = Sheet.objects.filter(spreadsheet=spreadsheet).first()
        self.assertIsNotNone(sheet)
        # Header row + data rows persisted as Cell entries.
        self.assertGreater(Cell.objects.filter(sheet=sheet).count(), 0)

    # ---- Spreadsheet: validation path -----------------------------------

    def test_export_to_spreadsheet_requires_project_id(self):
        url = reverse(
            "meta-ad-performance-export-spreadsheet", args=[self.ad_account.id]
        )
        resp = self.client.post(
            f"{url}?days=14",
            {"name": "Should Fail"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("project_id", resp.data["detail"])
