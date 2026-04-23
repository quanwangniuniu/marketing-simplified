from django.urls import path

from .views import (
    MetaAdInsightTimeseriesView,
    MetaAdListView,
    MetaAdPerformanceView,
    MetaCampaignListView,
    MetaCampaignPerformanceView,
    MetaCreativePerformanceView,
    MetaInsightListView,
    MetaSummaryView,
    MetaSyncRunListView,
    MetaSyncRunTriggerView,
)


urlpatterns = [
    path(
        "ad_accounts/<int:ad_account_id>/campaigns/",
        MetaCampaignListView.as_view(),
        name="meta-campaigns",
    ),
    path(
        "ad_accounts/<int:ad_account_id>/campaign_performance/",
        MetaCampaignPerformanceView.as_view(),
        name="meta-campaign-performance",
    ),
    path(
        "ad_accounts/<int:ad_account_id>/creative_performance/",
        MetaCreativePerformanceView.as_view(),
        name="meta-creative-performance",
    ),
    path(
        "ad_accounts/<int:ad_account_id>/ad_performance/",
        MetaAdPerformanceView.as_view(),
        name="meta-ad-performance",
    ),
    path(
        "ad_accounts/<int:ad_account_id>/ads/",
        MetaAdListView.as_view(),
        name="meta-ads",
    ),
    path(
        "ad_accounts/<int:ad_account_id>/ads/<int:ad_id>/insights_timeseries/",
        MetaAdInsightTimeseriesView.as_view(),
        name="meta-ad-insights-timeseries",
    ),
    path(
        "ad_accounts/<int:ad_account_id>/insights/",
        MetaInsightListView.as_view(),
        name="meta-insights",
    ),
    path(
        "ad_accounts/<int:ad_account_id>/sync/",
        MetaSyncRunTriggerView.as_view(),
        name="meta-sync-trigger",
    ),
    path(
        "ad_accounts/<int:ad_account_id>/sync_runs/",
        MetaSyncRunListView.as_view(),
        name="meta-sync-runs",
    ),
    path(
        "summary/",
        MetaSummaryView.as_view(),
        name="meta-summary",
    ),
]
