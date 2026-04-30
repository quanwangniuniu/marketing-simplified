from rest_framework import serializers

from .models import (
    MetaAd,
    MetaAdCreative,
    MetaAdSet,
    MetaCampaign,
    MetaInsightDaily,
    MetaSyncRun,
)


class MetaCampaignSerializer(serializers.ModelSerializer):
    class Meta:
        model = MetaCampaign
        fields = [
            "id",
            "meta_campaign_id",
            "name",
            "objective",
            "status",
            "effective_status",
            "start_time",
            "stop_time",
            "daily_budget_cents",
            "lifetime_budget_cents",
            "is_deleted_on_meta",
        ]


class MetaAdSetSerializer(serializers.ModelSerializer):
    class Meta:
        model = MetaAdSet
        fields = [
            "id",
            "meta_adset_id",
            "campaign",
            "name",
            "status",
            "effective_status",
            "optimization_goal",
            "daily_budget_cents",
            "lifetime_budget_cents",
        ]


class MetaAdCreativeSerializer(serializers.ModelSerializer):
    class Meta:
        model = MetaAdCreative
        fields = [
            "id",
            "meta_creative_id",
            "name",
            "title",
            "body",
            "image_url",
            "thumbnail_url",
            "video_id",
            "object_type",
            "call_to_action_type",
        ]


class MetaAdSerializer(serializers.ModelSerializer):
    creative = MetaAdCreativeSerializer(read_only=True)

    class Meta:
        model = MetaAd
        fields = [
            "id",
            "meta_ad_id",
            "adset",
            "creative",
            "name",
            "status",
            "effective_status",
            "is_deleted_on_meta",
        ]


class MetaInsightDailySerializer(serializers.ModelSerializer):
    class Meta:
        model = MetaInsightDaily
        fields = [
            "ad",
            "date",
            "spend",
            "impressions",
            "reach",
            "clicks",
            "frequency",
            "ctr",
            "cpc",
            "cpm",
            "leads",
            "calls",
            "purchases",
            "messages",
            "revenue",
            "video_p25",
            "video_p50",
            "video_p75",
            "video_p100",
            "video_avg_watch_seconds",
        ]


class MetaSyncRunSerializer(serializers.ModelSerializer):
    class Meta:
        model = MetaSyncRun
        fields = [
            "id",
            "ad_account",
            "kind",
            "status",
            "level_counts",
            "error_message",
            "started_at",
            "finished_at",
            "current_phase",
            "current_progress",
        ]
