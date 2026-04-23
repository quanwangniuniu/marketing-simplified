from django.contrib import admin

from .models import (
    MetaAd,
    MetaAdCreative,
    MetaAdSet,
    MetaCampaign,
    MetaInsightDaily,
    MetaSyncRun,
)


@admin.register(MetaCampaign)
class MetaCampaignAdmin(admin.ModelAdmin):
    list_display = ("meta_campaign_id", "name", "objective", "effective_status", "ad_account", "is_deleted_on_meta")
    search_fields = ("meta_campaign_id", "name")
    list_filter = ("effective_status", "objective", "is_deleted_on_meta")
    raw_id_fields = ("ad_account", "mediajira_campaign")


@admin.register(MetaAdSet)
class MetaAdSetAdmin(admin.ModelAdmin):
    list_display = ("meta_adset_id", "name", "effective_status", "optimization_goal", "campaign")
    search_fields = ("meta_adset_id", "name")


@admin.register(MetaAdCreative)
class MetaAdCreativeAdmin(admin.ModelAdmin):
    list_display = ("meta_creative_id", "name", "object_type", "call_to_action_type")
    search_fields = ("meta_creative_id", "name", "title")


@admin.register(MetaAd)
class MetaAdAdmin(admin.ModelAdmin):
    list_display = ("meta_ad_id", "name", "effective_status", "adset")
    search_fields = ("meta_ad_id", "name")


@admin.register(MetaInsightDaily)
class MetaInsightDailyAdmin(admin.ModelAdmin):
    list_display = ("ad", "date", "spend", "impressions", "clicks", "leads", "calls", "purchases", "revenue")
    list_filter = ("date",)
    date_hierarchy = "date"


@admin.register(MetaSyncRun)
class MetaSyncRunAdmin(admin.ModelAdmin):
    list_display = ("ad_account", "kind", "status", "started_at", "finished_at")
    list_filter = ("kind", "status")
    readonly_fields = ("started_at", "finished_at", "level_counts", "error_message")
