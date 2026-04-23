"""Basic tests for meta_ads parsers (actions, revenue, video)."""

from decimal import Decimal

from django.test import SimpleTestCase

from .services import _parse_actions, _parse_revenue, _parse_video


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
