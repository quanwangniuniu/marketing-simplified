from django.conf import settings
from django.db import models

from core.models import TimeStampedModel
from facebook_integration.models import MetaAdAccount


class MetaCampaign(TimeStampedModel):
    ad_account = models.ForeignKey(
        MetaAdAccount, on_delete=models.CASCADE, related_name="campaigns"
    )
    meta_campaign_id = models.CharField(max_length=64, db_index=True)
    name = models.CharField(max_length=500, blank=True, default="")
    objective = models.CharField(max_length=64, blank=True, default="")
    status = models.CharField(max_length=32, blank=True, default="")
    effective_status = models.CharField(max_length=32, blank=True, default="")
    start_time = models.DateTimeField(null=True, blank=True)
    stop_time = models.DateTimeField(null=True, blank=True)
    daily_budget_cents = models.BigIntegerField(null=True, blank=True)
    lifetime_budget_cents = models.BigIntegerField(null=True, blank=True)
    special_ad_categories = models.JSONField(default=list, blank=True)

    # Optional link to a MediaJira campaign record
    mediajira_campaign = models.ForeignKey(
        "campaign.Campaign",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="meta_campaigns",
    )

    is_deleted_on_meta = models.BooleanField(default=False)

    class Meta:
        unique_together = [("ad_account", "meta_campaign_id")]
        db_table = "meta_campaigns"
        indexes = [
            models.Index(fields=["ad_account", "effective_status"]),
        ]

    def __str__(self) -> str:
        return f"MetaCampaign({self.meta_campaign_id}, {self.name[:40]})"


class MetaAdSet(TimeStampedModel):
    campaign = models.ForeignKey(
        MetaCampaign, on_delete=models.CASCADE, related_name="adsets"
    )
    meta_adset_id = models.CharField(max_length=64, db_index=True)
    name = models.CharField(max_length=500, blank=True, default="")
    status = models.CharField(max_length=32, blank=True, default="")
    effective_status = models.CharField(max_length=32, blank=True, default="")
    billing_event = models.CharField(max_length=64, blank=True, default="")
    optimization_goal = models.CharField(max_length=64, blank=True, default="")
    bid_amount_cents = models.BigIntegerField(null=True, blank=True)
    targeting = models.JSONField(default=dict, blank=True)
    daily_budget_cents = models.BigIntegerField(null=True, blank=True)
    lifetime_budget_cents = models.BigIntegerField(null=True, blank=True)
    is_deleted_on_meta = models.BooleanField(default=False)

    class Meta:
        unique_together = [("campaign", "meta_adset_id")]
        db_table = "meta_adsets"

    def __str__(self) -> str:
        return f"MetaAdSet({self.meta_adset_id}, {self.name[:40]})"


class MetaAdCreative(TimeStampedModel):
    ad_account = models.ForeignKey(
        MetaAdAccount, on_delete=models.CASCADE, related_name="creatives"
    )
    meta_creative_id = models.CharField(max_length=64, db_index=True)
    name = models.CharField(max_length=500, blank=True, default="")
    title = models.TextField(blank=True, default="")
    body = models.TextField(blank=True, default="")
    image_url = models.URLField(max_length=1024, blank=True, default="")
    video_id = models.CharField(max_length=64, blank=True, default="")
    thumbnail_url = models.URLField(max_length=1024, blank=True, default="")
    object_type = models.CharField(max_length=64, blank=True, default="")
    call_to_action_type = models.CharField(max_length=64, blank=True, default="")
    asset_feed_spec = models.JSONField(default=dict, blank=True)

    class Meta:
        unique_together = [("ad_account", "meta_creative_id")]
        db_table = "meta_ad_creatives"

    def __str__(self) -> str:
        return f"MetaAdCreative({self.meta_creative_id}, {self.name[:40]})"


class MetaAd(TimeStampedModel):
    adset = models.ForeignKey(
        MetaAdSet, on_delete=models.CASCADE, related_name="ads"
    )
    creative = models.ForeignKey(
        MetaAdCreative,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ads",
    )
    meta_ad_id = models.CharField(max_length=64, db_index=True)
    name = models.CharField(max_length=500, blank=True, default="")
    status = models.CharField(max_length=32, blank=True, default="")
    effective_status = models.CharField(max_length=32, blank=True, default="")
    is_deleted_on_meta = models.BooleanField(default=False)

    class Meta:
        unique_together = [("adset", "meta_ad_id")]
        db_table = "meta_ads"
        indexes = [models.Index(fields=["adset", "effective_status"])]

    def __str__(self) -> str:
        return f"MetaAd({self.meta_ad_id}, {self.name[:40]})"


class MetaInsightDaily(models.Model):
    """One row per (ad, date). Core time-series table.

    Attribution window is `7d_click,1d_view` per kickoff M5 decision. Change
    by passing a different `action_attribution_windows` to insights sync.
    """

    ad = models.ForeignKey(
        MetaAd, on_delete=models.CASCADE, related_name="insights_daily"
    )
    date = models.DateField(db_index=True)

    spend = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    impressions = models.BigIntegerField(default=0)
    reach = models.BigIntegerField(default=0)
    clicks = models.BigIntegerField(default=0)
    frequency = models.DecimalField(max_digits=8, decimal_places=4, default=0)

    # Derived (returned directly by Graph API)
    ctr = models.DecimalField(max_digits=8, decimal_places=4, default=0)
    cpc = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    cpm = models.DecimalField(max_digits=10, decimal_places=4, default=0)

    # Parsed from `actions` array
    leads = models.IntegerField(default=0)
    calls = models.IntegerField(default=0)
    purchases = models.IntegerField(default=0)
    messages = models.IntegerField(default=0)
    lpv_count = models.IntegerField(default=0)
    video_3sec_count = models.IntegerField(default=0)
    comment_count = models.IntegerField(default=0)

    # Revenue (usually 0 until Meta Pixel has purchase events with value, or Hyros backfill)
    revenue = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    # Video retention (creative fatigue signals)
    video_p25 = models.IntegerField(default=0)
    video_p50 = models.IntegerField(default=0)
    video_p75 = models.IntegerField(default=0)
    video_p100 = models.IntegerField(default=0)
    video_avg_watch_seconds = models.DecimalField(max_digits=8, decimal_places=2, default=0)

    raw = models.JSONField(default=dict, blank=True)
    fetched_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("ad", "date")]
        indexes = [
            models.Index(fields=["ad", "date"]),
            models.Index(fields=["date"]),
        ]
        db_table = "meta_insight_daily"

    def __str__(self) -> str:
        return f"MetaInsightDaily(ad={self.ad_id}, date={self.date}, spend={self.spend})"


class MetaSyncRun(TimeStampedModel):
    ad_account = models.ForeignKey(
        MetaAdAccount, on_delete=models.CASCADE, related_name="sync_runs"
    )
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    kind = models.CharField(max_length=32, default="hourly")  # hourly / 15min / manual
    status = models.CharField(
        max_length=16,
        choices=[
            ("running", "Running"),
            ("ok", "OK"),
            ("partial", "Partial"),
            ("error", "Error"),
        ],
        default="running",
    )
    level_counts = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True, default="")

    # Phase signals updated at each step boundary inside sync_ad_account so
    # callers can poll a running row and render which step is in flight. Both
    # are reset to "" when the sync completes (success or failure).
    current_phase = models.CharField(max_length=32, default="", blank=True)
    current_progress = models.CharField(max_length=120, default="", blank=True)

    class Meta:
        db_table = "meta_sync_runs"
        ordering = ["-started_at"]
