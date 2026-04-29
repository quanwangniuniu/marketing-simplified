"""Read-only endpoints for the Meta ads data layer.

Write paths (sync) live in `services.py` and are driven by Celery tasks; an
on-demand sync is exposed through `facebook_integration.FacebookSyncView` and
`MetaSyncRunTriggerView` below.
"""

import datetime as _dt
from collections import defaultdict
from decimal import Decimal

from django.db import models
from django.db.models import Sum
from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from facebook_integration.models import MetaAdAccount

from .meta_client import MetaApiError, graph_get
from .models import (
    MetaAd,
    MetaAdCreative,
    MetaAdSet,
    MetaCampaign,
    MetaInsightDaily,
    MetaSyncRun,
)
from .serializers import (
    MetaAdSerializer,
    MetaCampaignSerializer,
    MetaInsightDailySerializer,
    MetaSyncRunSerializer,
)
from .tasks import sync_single_ad_account


# Helpers ---------------------------------------------------------------------


def _user_ad_account(request, ad_account_id: int) -> MetaAdAccount:
    return get_object_or_404(
        MetaAdAccount,
        pk=ad_account_id,
        connection__user=request.user,
    )


# Views -----------------------------------------------------------------------


class MetaCampaignListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, ad_account_id: int):
        ad_account = _user_ad_account(request, ad_account_id)
        qs = MetaCampaign.objects.filter(ad_account=ad_account).order_by("-updated_at")
        return Response(MetaCampaignSerializer(qs, many=True).data)


class MetaCampaignPerformanceView(APIView):
    """Per-campaign aggregates over a trailing window.

    Returns one row per campaign with totals across its adsets/ads, so the
    frontend can render a leaderboard table without joining on the client.
    """

    permission_classes = [IsAuthenticated]
    ALLOWED_DAYS = {1, 2, 3, 7, 14, 28, 30}

    def get(self, request, ad_account_id: int):
        ad_account = _user_ad_account(request, ad_account_id)
        try:
            days = int(request.query_params.get("days", 28))
        except ValueError:
            days = 28
        if days not in self.ALLOWED_DAYS:
            days = 28

        today = _dt.date.today()
        since = today - _dt.timedelta(days=days - 1)

        qs = MetaCampaign.objects.filter(ad_account=ad_account).annotate(
            total_spend=Sum(
                "adsets__ads__insights_daily__spend",
                filter=models.Q(
                    adsets__ads__insights_daily__date__gte=since,
                    adsets__ads__insights_daily__date__lte=today,
                ),
            ),
            total_impressions=Sum(
                "adsets__ads__insights_daily__impressions",
                filter=models.Q(
                    adsets__ads__insights_daily__date__gte=since,
                    adsets__ads__insights_daily__date__lte=today,
                ),
            ),
            total_clicks=Sum(
                "adsets__ads__insights_daily__clicks",
                filter=models.Q(
                    adsets__ads__insights_daily__date__gte=since,
                    adsets__ads__insights_daily__date__lte=today,
                ),
            ),
            total_leads=Sum(
                "adsets__ads__insights_daily__leads",
                filter=models.Q(
                    adsets__ads__insights_daily__date__gte=since,
                    adsets__ads__insights_daily__date__lte=today,
                ),
            ),
            total_purchases=Sum(
                "adsets__ads__insights_daily__purchases",
                filter=models.Q(
                    adsets__ads__insights_daily__date__gte=since,
                    adsets__ads__insights_daily__date__lte=today,
                ),
            ),
            total_revenue=Sum(
                "adsets__ads__insights_daily__revenue",
                filter=models.Q(
                    adsets__ads__insights_daily__date__gte=since,
                    adsets__ads__insights_daily__date__lte=today,
                ),
            ),
        )

        rows = []
        for camp in qs:
            spend = camp.total_spend or Decimal("0")
            rev = camp.total_revenue or Decimal("0")
            imp = camp.total_impressions or 0
            clicks = camp.total_clicks or 0
            leads = camp.total_leads or 0
            purchases = camp.total_purchases or 0
            rows.append({
                "id": camp.id,
                "meta_campaign_id": camp.meta_campaign_id,
                "name": camp.name,
                "objective": camp.objective,
                "effective_status": camp.effective_status,
                "daily_budget_cents": camp.daily_budget_cents,
                "lifetime_budget_cents": camp.lifetime_budget_cents,
                "spend": str(spend),
                "impressions": imp,
                "clicks": clicks,
                "leads": leads,
                "purchases": purchases,
                "revenue": str(rev),
                "ctr": str(_safe_ratio(clicks, imp) * Decimal("100")),
                "cpc": str(_safe_ratio(spend, clicks)),
                "cpm": str(_safe_ratio(spend, imp) * Decimal("1000")),
                "cpl": str(_safe_ratio(spend, leads)),
                "cpa": str(_safe_ratio(spend, purchases)),
                "roas": str(_safe_ratio(rev, spend)),
            })
        rows.sort(key=lambda r: Decimal(r["spend"]), reverse=True)
        return Response({
            "ad_account_id": ad_account.id,
            "currency": ad_account.currency,
            "days": days,
            "window": {"since": since.isoformat(), "until": today.isoformat()},
            "campaigns": rows,
        })


class MetaAdListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, ad_account_id: int):
        ad_account = _user_ad_account(request, ad_account_id)
        qs = (
            MetaAd.objects.filter(adset__campaign__ad_account=ad_account)
            .select_related("adset", "creative")
            .order_by("-updated_at")
        )
        return Response(MetaAdSerializer(qs, many=True).data)


class MetaInsightListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, ad_account_id: int):
        ad_account = _user_ad_account(request, ad_account_id)
        since = _parse_date(request.query_params.get("since"))
        until = _parse_date(request.query_params.get("until"))
        qs = MetaInsightDaily.objects.filter(
            ad__adset__campaign__ad_account=ad_account
        )
        if since:
            qs = qs.filter(date__gte=since)
        if until:
            qs = qs.filter(date__lte=until)
        qs = qs.order_by("-date", "ad_id")[:10000]
        return Response(MetaInsightDailySerializer(qs, many=True).data)


class MetaSummaryView(APIView):
    """Aggregate KPIs + day-by-day timeseries for a given trailing window.

    Query: ?ad_account=<id>&days=7 (allowed: 1, 2, 3, 7, 14, 28).
    """

    permission_classes = [IsAuthenticated]
    ALLOWED_DAYS = {1, 2, 3, 7, 14, 28, 30}

    def get(self, request):
        ad_account_id = request.query_params.get("ad_account")
        if not ad_account_id:
            return Response({"detail": "ad_account query parameter is required."}, status=400)
        try:
            ad_account = MetaAdAccount.objects.get(
                pk=int(ad_account_id), connection__user=request.user
            )
        except (MetaAdAccount.DoesNotExist, ValueError):
            return Response({"detail": "Ad account not found."}, status=404)

        try:
            days = int(request.query_params.get("days", 7))
        except ValueError:
            days = 7
        if days not in self.ALLOWED_DAYS:
            days = 7

        today = _dt.date.today()
        since = today - _dt.timedelta(days=days - 1)
        qs = MetaInsightDaily.objects.filter(
            ad__adset__campaign__ad_account=ad_account,
            date__gte=since,
            date__lte=today,
        )

        aggregates = qs.aggregate(
            spend=Sum("spend"),
            impressions=Sum("impressions"),
            clicks=Sum("clicks"),
            reach=Sum("reach"),
            leads=Sum("leads"),
            calls=Sum("calls"),
            purchases=Sum("purchases"),
            revenue=Sum("revenue"),
        )
        aggregates = {k: (v if v is not None else 0) for k, v in aggregates.items()}
        aggregates["ctr"] = _safe_ratio(aggregates["clicks"], aggregates["impressions"])
        aggregates["cpc"] = _safe_ratio(aggregates["spend"], aggregates["clicks"])
        aggregates["cpm"] = _safe_ratio(aggregates["spend"], aggregates["impressions"]) * Decimal("1000")
        aggregates["cpl"] = _safe_ratio(aggregates["spend"], aggregates["leads"])
        aggregates["cpcall"] = _safe_ratio(aggregates["spend"], aggregates["calls"])
        aggregates["roas"] = _safe_ratio(aggregates["revenue"], aggregates["spend"])

        timeseries_map: dict[_dt.date, dict[str, Decimal]] = defaultdict(
            lambda: {"spend": Decimal("0"), "impressions": 0, "clicks": 0, "leads": 0, "calls": 0, "purchases": 0, "revenue": Decimal("0")}
        )
        for row in qs.values(
            "date", "spend", "impressions", "clicks", "leads", "calls", "purchases", "revenue"
        ):
            entry = timeseries_map[row["date"]]
            entry["spend"] += row["spend"] or Decimal("0")
            entry["impressions"] += row["impressions"] or 0
            entry["clicks"] += row["clicks"] or 0
            entry["leads"] += row["leads"] or 0
            entry["calls"] += row["calls"] or 0
            entry["purchases"] += row["purchases"] or 0
            entry["revenue"] += row["revenue"] or Decimal("0")

        timeseries = []
        current = since
        while current <= today:
            entry = timeseries_map.get(current, {
                "spend": Decimal("0"), "impressions": 0, "clicks": 0, "leads": 0, "calls": 0, "purchases": 0, "revenue": Decimal("0"),
            })
            timeseries.append({
                "date": current.isoformat(),
                "spend": str(entry["spend"]),
                "impressions": int(entry["impressions"]),
                "clicks": int(entry["clicks"]),
                "leads": int(entry["leads"]),
                "calls": int(entry["calls"]),
                "purchases": int(entry["purchases"]),
                "revenue": str(entry["revenue"]),
            })
            current += _dt.timedelta(days=1)

        return Response({
            "ad_account_id": ad_account.id,
            "currency": ad_account.currency,
            "days": days,
            "window": {"since": since.isoformat(), "until": today.isoformat()},
            "aggregates": {k: (str(v) if isinstance(v, Decimal) else v) for k, v in aggregates.items()},
            "timeseries": timeseries,
        })


class MetaSyncRunTriggerView(APIView):
    """POST endpoint to kick off a manual sync for one ad account.

    Fire-and-forget: the Celery task creates a `MetaSyncRun` row with
    status=running immediately, then fills in counts/status when done.
    Clients poll `/ad_accounts/<id>/sync_runs/` to observe progress.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, ad_account_id: int):
        ad_account = _user_ad_account(request, ad_account_id)
        async_result = sync_single_ad_account.delay(ad_account.id)
        return Response(
            {
                "status": "queued",
                "task_id": async_result.id,
                "ad_account_id": ad_account.id,
                "poll_url": f"/api/meta_ads/ad_accounts/{ad_account.id}/sync_runs/",
            },
            status=202,
        )


class MetaSyncRunListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, ad_account_id: int):
        ad_account = _user_ad_account(request, ad_account_id)
        qs = MetaSyncRun.objects.filter(ad_account=ad_account)[:50]
        return Response(MetaSyncRunSerializer(qs, many=True).data)


class MetaCreativePerformanceView(APIView):
    """Creative-level leaderboard with hook/hold rates + core perf.

    Aggregates insights across every ad linked to the creative, so the
    frontend gets one row per creative with performance already reduced.

    Filters
    -------
    `min_impressions` (int, default 0), `min_spend` (decimal, default 0),
    `min_events` (int, default 0), `min_days_with_data` (int, default 0):
    drop low-data creatives so the leaderboard is not polluted by paused
    or under-delivered ads. `min_spend` is in the ad account's native
    currency. `min_events` sums leads + calls + purchases + messages
    across linked ads. `min_days_with_data` counts linked-ad x date pairs
    where impressions > 0 (so a creative referenced by N ads delivering
    on the same date contributes N to this count, not 1).

    `include_inactive` (bool, default false): when false, creatives with
    zero linked-insight impressions in the window are excluded.

    `include_shared_creatives` (bool, default false): when false, only
    creatives referenced by exactly 1 ad are returned (the 1:1 cohort).
    When true, creatives referenced by >= 1 ad are returned (1:1 + N:M).
    Orphan creatives (0 ad references) are always excluded; there is no
    toggle for them.

    Each row carries `is_in_learning` (events/week < 50) plus the raw
    `total_events`, `days_with_data`, `lpv_count`, `comment_count`,
    `video_3sec_count` so the frontend can grey out low-confidence rows.
    `is_in_learning` is null when `days < 7`.
    """

    permission_classes = [IsAuthenticated]
    ALLOWED_DAYS = {1, 2, 3, 7, 14, 28, 30}

    def get(self, request, ad_account_id: int):
        ad_account = _user_ad_account(request, ad_account_id)
        days = _normalize_days(request.query_params.get("days"), self.ALLOWED_DAYS, default=28)
        today = _dt.date.today()
        since = today - _dt.timedelta(days=days - 1)

        min_impressions = _parse_qp_int(request, "min_impressions")
        min_events = _parse_qp_int(request, "min_events")
        min_days_with_data = _parse_qp_int(request, "min_days_with_data")
        min_spend = _parse_qp_decimal(request, "min_spend")
        include_inactive = _parse_qp_bool(request, "include_inactive", default=False)
        include_shared_creatives = _parse_qp_bool(
            request, "include_shared_creatives", default=False
        )

        qs = MetaAdCreative.objects.filter(ad_account=ad_account).annotate(
            total_spend=Sum(
                "ads__insights_daily__spend",
                filter=models.Q(
                    ads__insights_daily__date__gte=since,
                    ads__insights_daily__date__lte=today,
                ),
            ),
            total_impressions=Sum(
                "ads__insights_daily__impressions",
                filter=models.Q(
                    ads__insights_daily__date__gte=since,
                    ads__insights_daily__date__lte=today,
                ),
            ),
            total_clicks=Sum(
                "ads__insights_daily__clicks",
                filter=models.Q(
                    ads__insights_daily__date__gte=since,
                    ads__insights_daily__date__lte=today,
                ),
            ),
            total_leads=Sum(
                "ads__insights_daily__leads",
                filter=models.Q(
                    ads__insights_daily__date__gte=since,
                    ads__insights_daily__date__lte=today,
                ),
            ),
            total_calls=Sum(
                "ads__insights_daily__calls",
                filter=models.Q(
                    ads__insights_daily__date__gte=since,
                    ads__insights_daily__date__lte=today,
                ),
            ),
            total_purchases=Sum(
                "ads__insights_daily__purchases",
                filter=models.Q(
                    ads__insights_daily__date__gte=since,
                    ads__insights_daily__date__lte=today,
                ),
            ),
            total_messages=Sum(
                "ads__insights_daily__messages",
                filter=models.Q(
                    ads__insights_daily__date__gte=since,
                    ads__insights_daily__date__lte=today,
                ),
            ),
            total_revenue=Sum(
                "ads__insights_daily__revenue",
                filter=models.Q(
                    ads__insights_daily__date__gte=since,
                    ads__insights_daily__date__lte=today,
                ),
            ),
            total_video_p25=Sum(
                "ads__insights_daily__video_p25",
                filter=models.Q(
                    ads__insights_daily__date__gte=since,
                    ads__insights_daily__date__lte=today,
                ),
            ),
            total_video_p50=Sum(
                "ads__insights_daily__video_p50",
                filter=models.Q(
                    ads__insights_daily__date__gte=since,
                    ads__insights_daily__date__lte=today,
                ),
            ),
            total_video_p75=Sum(
                "ads__insights_daily__video_p75",
                filter=models.Q(
                    ads__insights_daily__date__gte=since,
                    ads__insights_daily__date__lte=today,
                ),
            ),
            total_video_p100=Sum(
                "ads__insights_daily__video_p100",
                filter=models.Q(
                    ads__insights_daily__date__gte=since,
                    ads__insights_daily__date__lte=today,
                ),
            ),
            total_video_3sec=Sum(
                "ads__insights_daily__video_3sec_count",
                filter=models.Q(
                    ads__insights_daily__date__gte=since,
                    ads__insights_daily__date__lte=today,
                ),
            ),
            total_lpv=Sum(
                "ads__insights_daily__lpv_count",
                filter=models.Q(
                    ads__insights_daily__date__gte=since,
                    ads__insights_daily__date__lte=today,
                ),
            ),
            total_comments=Sum(
                "ads__insights_daily__comment_count",
                filter=models.Q(
                    ads__insights_daily__date__gte=since,
                    ads__insights_daily__date__lte=today,
                ),
            ),
            n_days_with_data=models.Count(
                "ads__insights_daily",
                filter=models.Q(
                    ads__insights_daily__date__gte=since,
                    ads__insights_daily__date__lte=today,
                    ads__insights_daily__impressions__gt=0,
                ),
            ),
            ad_count=models.Count("ads", distinct=True),
        )

        # Orphan exclusion (always on): creatives with no ad references
        # have no measurable performance and only pollute the leaderboard.
        qs = qs.filter(ad_count__gte=1)
        if not include_shared_creatives:
            qs = qs.filter(ad_count=1)
        if not include_inactive:
            qs = qs.filter(total_impressions__gt=0)
        if min_impressions > 0:
            qs = qs.filter(total_impressions__gte=min_impressions)
        if min_spend > 0:
            qs = qs.filter(total_spend__gte=min_spend)
        if min_days_with_data > 0:
            qs = qs.filter(n_days_with_data__gte=min_days_with_data)

        rows = []
        for cr in qs:
            spend = cr.total_spend or Decimal("0")
            rev = cr.total_revenue or Decimal("0")
            imp = cr.total_impressions or 0
            clicks = cr.total_clicks or 0
            leads = cr.total_leads or 0
            calls = cr.total_calls or 0
            purchases = cr.total_purchases or 0
            messages = cr.total_messages or 0
            p25 = cr.total_video_p25 or 0
            p75 = cr.total_video_p75 or 0
            p100 = cr.total_video_p100 or 0
            v3 = cr.total_video_3sec or 0
            lpv = cr.total_lpv or 0
            comments = cr.total_comments or 0
            days_with_data = cr.n_days_with_data or 0
            total_events = leads + calls + purchases + messages
            if days < 7:
                is_in_learning = None
            else:
                is_in_learning = (total_events * 7) < (50 * days)
            hook_rate = _safe_ratio(p25, imp) * Decimal("100")
            hold_rate = _safe_ratio(p75, p25) * Decimal("100")
            completion_rate = _safe_ratio(p100, p25) * Decimal("100")
            rows.append({
                "id": cr.id,
                "meta_creative_id": cr.meta_creative_id,
                "name": cr.name,
                "title": cr.title,
                "body": cr.body,
                "thumbnail_url": cr.thumbnail_url,
                "image_url": cr.image_url,
                "video_id": cr.video_id,
                "object_type": cr.object_type,
                "call_to_action_type": cr.call_to_action_type,
                "spend": str(spend),
                "impressions": imp,
                "clicks": clicks,
                "leads": leads,
                "calls": calls,
                "purchases": purchases,
                "messages": messages,
                "revenue": str(rev),
                "ctr": str(_safe_ratio(clicks, imp) * Decimal("100")),
                "cpc": str(_safe_ratio(spend, clicks)),
                "cpl": str(_safe_ratio(spend, leads)),
                "cpa": str(_safe_ratio(spend, purchases)),
                "roas": str(_safe_ratio(rev, spend)),
                "video_p25": p25,
                "video_p75": p75,
                "video_p100": p100,
                "hook_rate": str(hook_rate),
                "hook_rate_strict": str(_safe_ratio(v3, imp) * Decimal("100")),
                "hold_rate": str(hold_rate),
                "completion_rate": str(completion_rate),
                "video_3sec_count": v3,
                "lpv_count": lpv,
                "cost_per_lpv": str(_safe_ratio(spend, lpv)),
                "comment_count": comments,
                "cost_per_comment": str(_safe_ratio(spend, comments)),
                "total_events": total_events,
                "days_with_data": days_with_data,
                "is_in_learning": is_in_learning,
                "ad_count": cr.ad_count,
            })
        if min_events > 0:
            rows = [r for r in rows if r["total_events"] >= min_events]
        rows.sort(key=lambda r: Decimal(r["spend"]), reverse=True)
        return Response({
            "ad_account_id": ad_account.id,
            "currency": ad_account.currency,
            "days": days,
            "window": {"since": since.isoformat(), "until": today.isoformat()},
            "filters": {
                "min_impressions": min_impressions,
                "min_spend": str(min_spend),
                "min_events": min_events,
                "min_days_with_data": min_days_with_data,
                "include_inactive": include_inactive,
                "include_shared_creatives": include_shared_creatives,
            },
            "creatives": rows,
        })


class MetaAdSetPerformanceView(APIView):
    """AdSet-level leaderboard — the missing middle layer of the hierarchy.

    Accepts an optional `campaign_id` query param so the frontend can
    narrow the list to just the adsets under a specific campaign (used
    when expanding a campaign row in the Overview table).
    """

    permission_classes = [IsAuthenticated]
    ALLOWED_DAYS = {1, 2, 3, 7, 14, 28, 30}

    def get(self, request, ad_account_id: int):
        ad_account = _user_ad_account(request, ad_account_id)
        days = _normalize_days(request.query_params.get("days"), self.ALLOWED_DAYS, default=28)
        today = _dt.date.today()
        since = today - _dt.timedelta(days=days - 1)

        qs = MetaAdSet.objects.filter(
            campaign__ad_account=ad_account
        ).select_related("campaign").annotate(
            total_spend=Sum(
                "ads__insights_daily__spend",
                filter=models.Q(
                    ads__insights_daily__date__gte=since,
                    ads__insights_daily__date__lte=today,
                ),
            ),
            total_impressions=Sum(
                "ads__insights_daily__impressions",
                filter=models.Q(
                    ads__insights_daily__date__gte=since,
                    ads__insights_daily__date__lte=today,
                ),
            ),
            total_clicks=Sum(
                "ads__insights_daily__clicks",
                filter=models.Q(
                    ads__insights_daily__date__gte=since,
                    ads__insights_daily__date__lte=today,
                ),
            ),
            total_leads=Sum(
                "ads__insights_daily__leads",
                filter=models.Q(
                    ads__insights_daily__date__gte=since,
                    ads__insights_daily__date__lte=today,
                ),
            ),
            total_purchases=Sum(
                "ads__insights_daily__purchases",
                filter=models.Q(
                    ads__insights_daily__date__gte=since,
                    ads__insights_daily__date__lte=today,
                ),
            ),
            total_revenue=Sum(
                "ads__insights_daily__revenue",
                filter=models.Q(
                    ads__insights_daily__date__gte=since,
                    ads__insights_daily__date__lte=today,
                ),
            ),
        )

        campaign_id = request.query_params.get("campaign_id")
        if campaign_id:
            try:
                qs = qs.filter(campaign_id=int(campaign_id))
            except ValueError:
                return Response(
                    {"detail": "campaign_id must be an integer."}, status=400
                )

        rows = []
        for adset in qs:
            spend = adset.total_spend or Decimal("0")
            rev = adset.total_revenue or Decimal("0")
            imp = adset.total_impressions or 0
            clicks = adset.total_clicks or 0
            leads = adset.total_leads or 0
            purchases = adset.total_purchases or 0
            rows.append({
                "id": adset.id,
                "meta_adset_id": adset.meta_adset_id,
                "name": adset.name,
                "effective_status": adset.effective_status,
                "optimization_goal": adset.optimization_goal,
                "daily_budget_cents": adset.daily_budget_cents,
                "lifetime_budget_cents": adset.lifetime_budget_cents,
                "campaign_id": adset.campaign_id,
                "campaign_name": adset.campaign.name if adset.campaign else "",
                "spend": str(spend),
                "impressions": imp,
                "clicks": clicks,
                "leads": leads,
                "purchases": purchases,
                "revenue": str(rev),
                "ctr": str(_safe_ratio(clicks, imp) * Decimal("100")),
                "cpc": str(_safe_ratio(spend, clicks)),
                "cpl": str(_safe_ratio(spend, leads)),
                "cpa": str(_safe_ratio(spend, purchases)),
                "roas": str(_safe_ratio(rev, spend)),
            })
        rows.sort(key=lambda r: Decimal(r["spend"]), reverse=True)
        return Response({
            "ad_account_id": ad_account.id,
            "currency": ad_account.currency,
            "days": days,
            "window": {"since": since.isoformat(), "until": today.isoformat()},
            "campaign_id": int(campaign_id) if campaign_id else None,
            "adsets": rows,
        })


class MetaAdPerformanceView(APIView):
    """Ad-level leaderboard used by the drill-down tab.

    Returns one row per ad with rolling-window metrics plus the attached
    creative summary — so the frontend picker can show thumbnails and
    core perf in a single list without a second round-trip.

    Filters
    -------
    `campaign_id`, `adset_id` (int): narrow the list to ads under a specific
    campaign or ad set.

    `min_impressions` (int, default 0), `min_spend` (decimal, default 0),
    `min_events` (int, default 0), `min_days_with_data` (int, default 0):
    drop low-data rows so ranking isn't polluted by paused / under-delivered
    ads. `min_spend` is in the ad account's native currency — cross-account
    comparisons should normalise on the client. `min_events` is the sum of
    leads + calls + purchases + messages within the window.
    `min_days_with_data` counts days where impressions > 0.

    `include_inactive` (bool, default false): when false, ads with zero
    impressions in the window are excluded so paused ads don't pollute
    rankings. Pass `?include_inactive=true` to return them anyway.

    Each row carries `is_in_learning` (events/week < 50) plus the raw
    `total_events`, `days_with_data`, `lpv_count`, `comment_count`, and
    `video_3sec_count` so the frontend can grey out low-confidence entries.
    `is_in_learning` is null when `days < 7` (window too short to judge).
    """

    permission_classes = [IsAuthenticated]
    ALLOWED_DAYS = {1, 2, 3, 7, 14, 28, 30}

    def get(self, request, ad_account_id: int):
        ad_account = _user_ad_account(request, ad_account_id)
        days = _normalize_days(request.query_params.get("days"), self.ALLOWED_DAYS, default=28)
        today = _dt.date.today()
        since = today - _dt.timedelta(days=days - 1)

        min_impressions = _parse_qp_int(request, "min_impressions")
        min_events = _parse_qp_int(request, "min_events")
        min_days_with_data = _parse_qp_int(request, "min_days_with_data")
        min_spend = _parse_qp_decimal(request, "min_spend")
        include_inactive = _parse_qp_bool(request, "include_inactive", default=False)

        base_qs = MetaAd.objects.filter(adset__campaign__ad_account=ad_account)
        campaign_id = request.query_params.get("campaign_id")
        adset_id = request.query_params.get("adset_id")
        if campaign_id:
            try:
                base_qs = base_qs.filter(adset__campaign_id=int(campaign_id))
            except ValueError:
                return Response(
                    {"detail": "campaign_id must be an integer."}, status=400
                )
        if adset_id:
            try:
                base_qs = base_qs.filter(adset_id=int(adset_id))
            except ValueError:
                return Response(
                    {"detail": "adset_id must be an integer."}, status=400
                )

        window_q = models.Q(
            insights_daily__date__gte=since,
            insights_daily__date__lte=today,
        )

        qs = (
            base_qs
            .select_related("adset", "adset__campaign", "creative")
            .annotate(
                total_spend=Sum("insights_daily__spend", filter=window_q),
                total_impressions=Sum("insights_daily__impressions", filter=window_q),
                total_clicks=Sum("insights_daily__clicks", filter=window_q),
                total_leads=Sum("insights_daily__leads", filter=window_q),
                total_calls=Sum("insights_daily__calls", filter=window_q),
                total_purchases=Sum("insights_daily__purchases", filter=window_q),
                total_messages=Sum("insights_daily__messages", filter=window_q),
                total_revenue=Sum("insights_daily__revenue", filter=window_q),
                total_video_p25=Sum("insights_daily__video_p25", filter=window_q),
                total_video_p75=Sum("insights_daily__video_p75", filter=window_q),
                total_video_p100=Sum("insights_daily__video_p100", filter=window_q),
                total_video_3sec=Sum("insights_daily__video_3sec_count", filter=window_q),
                total_lpv=Sum("insights_daily__lpv_count", filter=window_q),
                total_comments=Sum("insights_daily__comment_count", filter=window_q),
                n_days_with_data=models.Count(
                    "insights_daily",
                    filter=models.Q(
                        insights_daily__date__gte=since,
                        insights_daily__date__lte=today,
                        insights_daily__impressions__gt=0,
                    ),
                ),
            )
        )

        if not include_inactive:
            qs = qs.filter(total_impressions__gt=0)
        if min_impressions > 0:
            qs = qs.filter(total_impressions__gte=min_impressions)
        if min_spend > 0:
            qs = qs.filter(total_spend__gte=min_spend)
        if min_days_with_data > 0:
            qs = qs.filter(n_days_with_data__gte=min_days_with_data)

        rows = []
        for ad in qs:
            spend = ad.total_spend or Decimal("0")
            rev = ad.total_revenue or Decimal("0")
            imp = ad.total_impressions or 0
            clicks = ad.total_clicks or 0
            leads = ad.total_leads or 0
            calls = ad.total_calls or 0
            purchases = ad.total_purchases or 0
            messages = ad.total_messages or 0
            p25 = ad.total_video_p25 or 0
            p75 = ad.total_video_p75 or 0
            p100 = ad.total_video_p100 or 0
            v3 = ad.total_video_3sec or 0
            lpv = ad.total_lpv or 0
            comments = ad.total_comments or 0
            days_with_data = ad.n_days_with_data or 0
            total_events = leads + calls + purchases + messages
            if days < 7:
                is_in_learning = None
            else:
                is_in_learning = (total_events * 7) < (50 * days)
            creative = ad.creative
            rows.append({
                "id": ad.id,
                "meta_ad_id": ad.meta_ad_id,
                "name": ad.name,
                "effective_status": ad.effective_status,
                "adset_id": ad.adset_id,
                "adset_name": ad.adset.name if ad.adset else "",
                "campaign_id": ad.adset.campaign_id if ad.adset else None,
                "campaign_name": ad.adset.campaign.name if ad.adset and ad.adset.campaign else "",
                "creative": (
                    {
                        "id": creative.id,
                        "meta_creative_id": creative.meta_creative_id,
                        "title": creative.title,
                        "thumbnail_url": creative.thumbnail_url,
                        "video_id": creative.video_id,
                        "object_type": creative.object_type,
                    }
                    if creative
                    else None
                ),
                "spend": str(spend),
                "impressions": imp,
                "clicks": clicks,
                "leads": leads,
                "calls": calls,
                "purchases": purchases,
                "messages": messages,
                "revenue": str(rev),
                "ctr": str(_safe_ratio(clicks, imp) * Decimal("100")),
                "cpc": str(_safe_ratio(spend, clicks)),
                "cpl": str(_safe_ratio(spend, leads)),
                "cpa": str(_safe_ratio(spend, purchases)),
                "roas": str(_safe_ratio(rev, spend)),
                "hook_rate": str(_safe_ratio(p25, imp) * Decimal("100")),
                "hook_rate_strict": str(_safe_ratio(v3, imp) * Decimal("100")),
                "hold_rate": str(_safe_ratio(p75, p25) * Decimal("100")),
                "completion_rate": str(_safe_ratio(p100, p25) * Decimal("100")),
                "video_3sec_count": v3,
                "lpv_count": lpv,
                "cost_per_lpv": str(_safe_ratio(spend, lpv)),
                "comment_count": comments,
                "cost_per_comment": str(_safe_ratio(spend, comments)),
                "total_events": total_events,
                "days_with_data": days_with_data,
                "is_in_learning": is_in_learning,
            })
        if min_events > 0:
            rows = [r for r in rows if r["total_events"] >= min_events]
        rows.sort(key=lambda r: Decimal(r["spend"]), reverse=True)
        return Response({
            "ad_account_id": ad_account.id,
            "currency": ad_account.currency,
            "days": days,
            "window": {"since": since.isoformat(), "until": today.isoformat()},
            "filters": {
                "min_impressions": min_impressions,
                "min_spend": str(min_spend),
                "min_events": min_events,
                "min_days_with_data": min_days_with_data,
                "include_inactive": include_inactive,
            },
            "ads": rows,
        })


class MetaCreativeDetailView(APIView):
    """Full metadata for a single creative plus the ads that reference it.

    Used by the creative detail page. Aggregates rolling-window performance
    at the creative level (summed across every linked ad) so the page can
    render KPIs without an extra round-trip.
    """

    permission_classes = [IsAuthenticated]
    ALLOWED_DAYS = {1, 2, 3, 7, 14, 28, 30}

    def get(self, request, creative_id: int):
        creative = get_object_or_404(
            MetaAdCreative,
            pk=creative_id,
            ad_account__connection__user=request.user,
        )
        days = _normalize_days(request.query_params.get("days"), self.ALLOWED_DAYS, default=28)
        today = _dt.date.today()
        since = today - _dt.timedelta(days=days - 1)

        linked_ads = (
            MetaAd.objects.filter(creative=creative)
            .select_related("adset", "adset__campaign")
            .annotate(
                total_spend=Sum(
                    "insights_daily__spend",
                    filter=models.Q(
                        insights_daily__date__gte=since,
                        insights_daily__date__lte=today,
                    ),
                ),
                total_impressions=Sum(
                    "insights_daily__impressions",
                    filter=models.Q(
                        insights_daily__date__gte=since,
                        insights_daily__date__lte=today,
                    ),
                ),
                total_clicks=Sum(
                    "insights_daily__clicks",
                    filter=models.Q(
                        insights_daily__date__gte=since,
                        insights_daily__date__lte=today,
                    ),
                ),
                total_leads=Sum(
                    "insights_daily__leads",
                    filter=models.Q(
                        insights_daily__date__gte=since,
                        insights_daily__date__lte=today,
                    ),
                ),
                total_purchases=Sum(
                    "insights_daily__purchases",
                    filter=models.Q(
                        insights_daily__date__gte=since,
                        insights_daily__date__lte=today,
                    ),
                ),
                total_revenue=Sum(
                    "insights_daily__revenue",
                    filter=models.Q(
                        insights_daily__date__gte=since,
                        insights_daily__date__lte=today,
                    ),
                ),
            )
        )

        agg = MetaInsightDaily.objects.filter(
            ad__creative=creative,
            date__gte=since,
            date__lte=today,
        ).aggregate(
            spend=Sum("spend"),
            impressions=Sum("impressions"),
            clicks=Sum("clicks"),
            reach=Sum("reach"),
            leads=Sum("leads"),
            calls=Sum("calls"),
            purchases=Sum("purchases"),
            revenue=Sum("revenue"),
            video_p25=Sum("video_p25"),
            video_p50=Sum("video_p50"),
            video_p75=Sum("video_p75"),
            video_p100=Sum("video_p100"),
        )
        agg = {k: (v if v is not None else 0) for k, v in agg.items()}
        spend = agg["spend"] or Decimal("0")
        revenue = agg["revenue"] or Decimal("0")
        impressions = agg["impressions"] or 0
        p25 = agg["video_p25"] or 0
        p50 = agg["video_p50"] or 0
        p75 = agg["video_p75"] or 0
        p100 = agg["video_p100"] or 0
        aggregates = {
            "spend": str(spend),
            "impressions": impressions,
            "clicks": agg["clicks"] or 0,
            "reach": agg["reach"] or 0,
            "leads": agg["leads"] or 0,
            "calls": agg["calls"] or 0,
            "purchases": agg["purchases"] or 0,
            "revenue": str(revenue),
            "ctr": str(_safe_ratio(agg["clicks"], impressions) * Decimal("100")),
            "cpc": str(_safe_ratio(spend, agg["clicks"])),
            "cpm": str(_safe_ratio(spend, impressions) * Decimal("1000")),
            "cpl": str(_safe_ratio(spend, agg["leads"])),
            "cpa": str(_safe_ratio(spend, agg["purchases"])),
            "roas": str(_safe_ratio(revenue, spend)),
            "video_p25": p25,
            "video_p50": p50,
            "video_p75": p75,
            "video_p100": p100,
            "hook_rate": str(_safe_ratio(p25, impressions) * Decimal("100")),
            "hold_rate": str(_safe_ratio(p75, p25) * Decimal("100")),
            "completion_rate": str(_safe_ratio(p100, p25) * Decimal("100")),
        }

        linked_ads_payload = []
        for ad in linked_ads:
            ad_spend = ad.total_spend or Decimal("0")
            ad_rev = ad.total_revenue or Decimal("0")
            linked_ads_payload.append({
                "id": ad.id,
                "meta_ad_id": ad.meta_ad_id,
                "name": ad.name,
                "effective_status": ad.effective_status,
                "campaign_name": ad.adset.campaign.name if ad.adset and ad.adset.campaign else "",
                "adset_name": ad.adset.name if ad.adset else "",
                "spend": str(ad_spend),
                "impressions": ad.total_impressions or 0,
                "clicks": ad.total_clicks or 0,
                "leads": ad.total_leads or 0,
                "purchases": ad.total_purchases or 0,
                "revenue": str(ad_rev),
                "roas": str(_safe_ratio(ad_rev, ad_spend)),
            })
        linked_ads_payload.sort(key=lambda r: Decimal(r["spend"]), reverse=True)

        return Response({
            "id": creative.id,
            "meta_creative_id": creative.meta_creative_id,
            "ad_account_id": creative.ad_account_id,
            "currency": creative.ad_account.currency,
            "name": creative.name,
            "title": creative.title,
            "body": creative.body,
            "image_url": creative.image_url,
            "thumbnail_url": creative.thumbnail_url,
            "video_id": creative.video_id,
            "object_type": creative.object_type,
            "call_to_action_type": creative.call_to_action_type,
            "asset_feed_spec": creative.asset_feed_spec or {},
            "created_at": creative.created_at.isoformat(),
            "updated_at": creative.updated_at.isoformat(),
            "days": days,
            "window": {"since": since.isoformat(), "until": today.isoformat()},
            "aggregates": aggregates,
            "linked_ads": linked_ads_payload,
            "linked_ads_count": len(linked_ads_payload),
        })


class MetaCreativeVideoSourceView(APIView):
    """Return a Meta-rendered ad preview iframe URL for the creative.

    Directly fetching `/{video_id}?fields=source` requires `ads_management`
    scope which our app does not have. The Ad Previews API works with the
    `ads_read` scope we do have, and returns an iframe that Meta renders
    (video autoplay + body + CTA) — functionally the same as seeing the ad
    in Ads Manager's preview panel.

    We need *an ad* to ask for a preview of, so we pick the first ad that
    references this creative. Creatives with no linked ad (a known FK gap
    in the sync, G-01) return 400 with a specific detail message.
    """

    permission_classes = [IsAuthenticated]
    VALID_FORMATS = {
        "MOBILE_FEED_STANDARD",
        "DESKTOP_FEED_STANDARD",
        "FACEBOOK_STORY_MOBILE",
        "INSTAGRAM_STANDARD",
        "INSTAGRAM_STORY",
        "FACEBOOK_REELS_MOBILE",
    }

    def get(self, request, creative_id: int):
        creative = get_object_or_404(
            MetaAdCreative,
            pk=creative_id,
            ad_account__connection__user=request.user,
        )
        ad = creative.ads.order_by("-updated_at").first()
        if ad is None:
            return Response(
                {
                    "detail": (
                        "No ad references this creative in the synced data, "
                        "so no preview can be rendered. Try re-running sync."
                    ),
                    "code": "no_linked_ad",
                },
                status=400,
            )
        token = creative.ad_account.connection.get_access_token()
        if not token:
            return Response(
                {"detail": "Meta connection is missing its access token."},
                status=400,
            )

        requested_format = request.query_params.get("ad_format", "MOBILE_FEED_STANDARD")
        if requested_format not in self.VALID_FORMATS:
            requested_format = "MOBILE_FEED_STANDARD"

        try:
            payload = graph_get(
                f"/{ad.meta_ad_id}/previews",
                token,
                params={"ad_format": requested_format},
            )
        except MetaApiError as err:
            return Response(
                {
                    "detail": f"Graph API error: {err}",
                    "status_code": err.status_code,
                },
                status=502,
            )

        previews = payload.get("data") or []
        if not previews:
            return Response(
                {"detail": "Meta returned no preview for this ad."},
                status=502,
            )

        body = previews[0].get("body", "")
        import re as _re
        match = _re.search(r'src="([^"]+)"', body)
        iframe_src = match.group(1).replace("&amp;", "&") if match else ""

        return Response({
            "creative_id": creative.id,
            "video_id": creative.video_id,
            "meta_ad_id": ad.meta_ad_id,
            "ad_name": ad.name,
            "ad_format": requested_format,
            "iframe_src": iframe_src,
            "iframe_html": body,
            "thumbnail_url": creative.thumbnail_url,
            "permalink_url": "",
        })


class MetaCreativeInsightTimeseriesView(APIView):
    """Daily aggregates for a creative — summed across every linked ad."""

    permission_classes = [IsAuthenticated]
    ALLOWED_DAYS = {1, 2, 3, 7, 14, 28, 30}

    def get(self, request, creative_id: int):
        creative = get_object_or_404(
            MetaAdCreative,
            pk=creative_id,
            ad_account__connection__user=request.user,
        )
        days = _normalize_days(request.query_params.get("days"), self.ALLOWED_DAYS, default=28)
        today = _dt.date.today()
        since = today - _dt.timedelta(days=days - 1)

        qs = MetaInsightDaily.objects.filter(
            ad__creative=creative,
            date__gte=since,
            date__lte=today,
        )
        daily = qs.values("date").annotate(
            spend=Sum("spend"),
            impressions=Sum("impressions"),
            clicks=Sum("clicks"),
            leads=Sum("leads"),
            purchases=Sum("purchases"),
            revenue=Sum("revenue"),
            video_p25=Sum("video_p25"),
            video_p75=Sum("video_p75"),
            video_p100=Sum("video_p100"),
        )
        by_date = {row["date"]: row for row in daily}

        points = []
        cur = since
        while cur <= today:
            r = by_date.get(cur)
            imp = (r["impressions"] if r else 0) or 0
            p25 = (r["video_p25"] if r else 0) or 0
            p75 = (r["video_p75"] if r else 0) or 0
            points.append({
                "date": cur.isoformat(),
                "spend": str((r["spend"] if r else Decimal("0")) or Decimal("0")),
                "impressions": imp,
                "clicks": (r["clicks"] if r else 0) or 0,
                "leads": (r["leads"] if r else 0) or 0,
                "purchases": (r["purchases"] if r else 0) or 0,
                "revenue": str((r["revenue"] if r else Decimal("0")) or Decimal("0")),
                "video_p25": p25,
                "video_p75": p75,
                "video_p100": (r["video_p100"] if r else 0) or 0,
                "hook_rate": str(_safe_ratio(p25, imp) * Decimal("100")),
                "hold_rate": str(_safe_ratio(p75, p25) * Decimal("100")),
            })
            cur += _dt.timedelta(days=1)

        return Response({
            "creative_id": creative.id,
            "meta_creative_id": creative.meta_creative_id,
            "currency": creative.ad_account.currency,
            "days": days,
            "window": {"since": since.isoformat(), "until": today.isoformat()},
            "points": points,
        })


class MetaCampaignDetailView(APIView):
    """Full metadata for a single campaign plus its adsets, with window aggregates.

    Used by the campaign detail page. Aggregates rolling-window performance
    at the campaign level (summed across every descendant ad) so the page
    can render KPIs without an extra round-trip.
    """

    permission_classes = [IsAuthenticated]
    ALLOWED_DAYS = {1, 2, 3, 7, 14, 28, 30}

    def get(self, request, campaign_id: int):
        campaign = get_object_or_404(
            MetaCampaign,
            pk=campaign_id,
            ad_account__connection__user=request.user,
        )
        days = _normalize_days(request.query_params.get("days"), self.ALLOWED_DAYS, default=28)
        today = _dt.date.today()
        since = today - _dt.timedelta(days=days - 1)

        agg = MetaInsightDaily.objects.filter(
            ad__adset__campaign=campaign,
            date__gte=since,
            date__lte=today,
        ).aggregate(
            spend=Sum("spend"),
            impressions=Sum("impressions"),
            clicks=Sum("clicks"),
            reach=Sum("reach"),
            leads=Sum("leads"),
            calls=Sum("calls"),
            purchases=Sum("purchases"),
            revenue=Sum("revenue"),
        )
        agg = {k: (v if v is not None else 0) for k, v in agg.items()}
        spend = agg["spend"] or Decimal("0")
        revenue = agg["revenue"] or Decimal("0")
        impressions = agg["impressions"] or 0
        aggregates = {
            "spend": str(spend),
            "impressions": impressions,
            "clicks": agg["clicks"] or 0,
            "reach": agg["reach"] or 0,
            "leads": agg["leads"] or 0,
            "calls": agg["calls"] or 0,
            "purchases": agg["purchases"] or 0,
            "revenue": str(revenue),
            "ctr": str(_safe_ratio(agg["clicks"], impressions) * Decimal("100")),
            "cpc": str(_safe_ratio(spend, agg["clicks"])),
            "cpm": str(_safe_ratio(spend, impressions) * Decimal("1000")),
            "cpl": str(_safe_ratio(spend, agg["leads"])),
            "cpa": str(_safe_ratio(spend, agg["purchases"])),
            "roas": str(_safe_ratio(revenue, spend)),
        }

        linked_adsets = MetaAdSet.objects.filter(campaign=campaign).annotate(
            total_spend=Sum(
                "ads__insights_daily__spend",
                filter=models.Q(
                    ads__insights_daily__date__gte=since,
                    ads__insights_daily__date__lte=today,
                ),
            ),
            total_impressions=Sum(
                "ads__insights_daily__impressions",
                filter=models.Q(
                    ads__insights_daily__date__gte=since,
                    ads__insights_daily__date__lte=today,
                ),
            ),
            total_clicks=Sum(
                "ads__insights_daily__clicks",
                filter=models.Q(
                    ads__insights_daily__date__gte=since,
                    ads__insights_daily__date__lte=today,
                ),
            ),
            total_leads=Sum(
                "ads__insights_daily__leads",
                filter=models.Q(
                    ads__insights_daily__date__gte=since,
                    ads__insights_daily__date__lte=today,
                ),
            ),
            total_purchases=Sum(
                "ads__insights_daily__purchases",
                filter=models.Q(
                    ads__insights_daily__date__gte=since,
                    ads__insights_daily__date__lte=today,
                ),
            ),
            total_revenue=Sum(
                "ads__insights_daily__revenue",
                filter=models.Q(
                    ads__insights_daily__date__gte=since,
                    ads__insights_daily__date__lte=today,
                ),
            ),
        )
        adset_rows = []
        for a in linked_adsets:
            a_spend = a.total_spend or Decimal("0")
            a_rev = a.total_revenue or Decimal("0")
            adset_rows.append({
                "id": a.id,
                "meta_adset_id": a.meta_adset_id,
                "name": a.name,
                "effective_status": a.effective_status,
                "optimization_goal": a.optimization_goal,
                "daily_budget_cents": a.daily_budget_cents,
                "lifetime_budget_cents": a.lifetime_budget_cents,
                "spend": str(a_spend),
                "impressions": a.total_impressions or 0,
                "clicks": a.total_clicks or 0,
                "leads": a.total_leads or 0,
                "purchases": a.total_purchases or 0,
                "revenue": str(a_rev),
                "roas": str(_safe_ratio(a_rev, a_spend)),
            })
        adset_rows.sort(key=lambda r: Decimal(r["spend"]), reverse=True)

        return Response({
            "id": campaign.id,
            "meta_campaign_id": campaign.meta_campaign_id,
            "ad_account_id": campaign.ad_account_id,
            "currency": campaign.ad_account.currency,
            "name": campaign.name,
            "objective": campaign.objective,
            "status": campaign.status,
            "effective_status": campaign.effective_status,
            "start_time": campaign.start_time.isoformat() if campaign.start_time else None,
            "stop_time": campaign.stop_time.isoformat() if campaign.stop_time else None,
            "daily_budget_cents": campaign.daily_budget_cents,
            "lifetime_budget_cents": campaign.lifetime_budget_cents,
            "special_ad_categories": campaign.special_ad_categories or [],
            "created_at": campaign.created_at.isoformat(),
            "updated_at": campaign.updated_at.isoformat(),
            "days": days,
            "window": {"since": since.isoformat(), "until": today.isoformat()},
            "aggregates": aggregates,
            "linked_adsets": adset_rows,
            "linked_adsets_count": len(adset_rows),
        })


class MetaCampaignInsightTimeseriesView(APIView):
    """Daily aggregates for a campaign — summed across every descendant ad."""

    permission_classes = [IsAuthenticated]
    ALLOWED_DAYS = {1, 2, 3, 7, 14, 28, 30}

    def get(self, request, campaign_id: int):
        campaign = get_object_or_404(
            MetaCampaign,
            pk=campaign_id,
            ad_account__connection__user=request.user,
        )
        days = _normalize_days(request.query_params.get("days"), self.ALLOWED_DAYS, default=28)
        today = _dt.date.today()
        since = today - _dt.timedelta(days=days - 1)

        daily = MetaInsightDaily.objects.filter(
            ad__adset__campaign=campaign,
            date__gte=since,
            date__lte=today,
        ).values("date").annotate(
            spend=Sum("spend"),
            impressions=Sum("impressions"),
            clicks=Sum("clicks"),
            leads=Sum("leads"),
            purchases=Sum("purchases"),
            revenue=Sum("revenue"),
        )
        by_date = {row["date"]: row for row in daily}

        points = []
        cur = since
        while cur <= today:
            r = by_date.get(cur)
            points.append({
                "date": cur.isoformat(),
                "spend": str((r["spend"] if r else Decimal("0")) or Decimal("0")),
                "impressions": (r["impressions"] if r else 0) or 0,
                "clicks": (r["clicks"] if r else 0) or 0,
                "leads": (r["leads"] if r else 0) or 0,
                "purchases": (r["purchases"] if r else 0) or 0,
                "revenue": str((r["revenue"] if r else Decimal("0")) or Decimal("0")),
            })
            cur += _dt.timedelta(days=1)

        return Response({
            "campaign_id": campaign.id,
            "meta_campaign_id": campaign.meta_campaign_id,
            "currency": campaign.ad_account.currency,
            "days": days,
            "window": {"since": since.isoformat(), "until": today.isoformat()},
            "points": points,
        })


class MetaAdSetDetailView(APIView):
    """Full metadata for a single adset plus its ads, with window aggregates."""

    permission_classes = [IsAuthenticated]
    ALLOWED_DAYS = {1, 2, 3, 7, 14, 28, 30}

    def get(self, request, adset_id: int):
        adset = get_object_or_404(
            MetaAdSet.objects.select_related("campaign", "campaign__ad_account"),
            pk=adset_id,
            campaign__ad_account__connection__user=request.user,
        )
        days = _normalize_days(request.query_params.get("days"), self.ALLOWED_DAYS, default=28)
        today = _dt.date.today()
        since = today - _dt.timedelta(days=days - 1)

        agg = MetaInsightDaily.objects.filter(
            ad__adset=adset,
            date__gte=since,
            date__lte=today,
        ).aggregate(
            spend=Sum("spend"),
            impressions=Sum("impressions"),
            clicks=Sum("clicks"),
            reach=Sum("reach"),
            leads=Sum("leads"),
            calls=Sum("calls"),
            purchases=Sum("purchases"),
            revenue=Sum("revenue"),
            video_p25=Sum("video_p25"),
            video_p75=Sum("video_p75"),
            video_p100=Sum("video_p100"),
        )
        agg = {k: (v if v is not None else 0) for k, v in agg.items()}
        spend = agg["spend"] or Decimal("0")
        revenue = agg["revenue"] or Decimal("0")
        impressions = agg["impressions"] or 0
        p25 = agg["video_p25"] or 0
        p75 = agg["video_p75"] or 0
        aggregates = {
            "spend": str(spend),
            "impressions": impressions,
            "clicks": agg["clicks"] or 0,
            "reach": agg["reach"] or 0,
            "leads": agg["leads"] or 0,
            "calls": agg["calls"] or 0,
            "purchases": agg["purchases"] or 0,
            "revenue": str(revenue),
            "ctr": str(_safe_ratio(agg["clicks"], impressions) * Decimal("100")),
            "cpc": str(_safe_ratio(spend, agg["clicks"])),
            "cpm": str(_safe_ratio(spend, impressions) * Decimal("1000")),
            "cpl": str(_safe_ratio(spend, agg["leads"])),
            "cpa": str(_safe_ratio(spend, agg["purchases"])),
            "roas": str(_safe_ratio(revenue, spend)),
            "hook_rate": str(_safe_ratio(p25, impressions) * Decimal("100")),
            "hold_rate": str(_safe_ratio(p75, p25) * Decimal("100")),
        }

        linked_ads = MetaAd.objects.filter(adset=adset).select_related("creative").annotate(
            total_spend=Sum(
                "insights_daily__spend",
                filter=models.Q(
                    insights_daily__date__gte=since,
                    insights_daily__date__lte=today,
                ),
            ),
            total_impressions=Sum(
                "insights_daily__impressions",
                filter=models.Q(
                    insights_daily__date__gte=since,
                    insights_daily__date__lte=today,
                ),
            ),
            total_clicks=Sum(
                "insights_daily__clicks",
                filter=models.Q(
                    insights_daily__date__gte=since,
                    insights_daily__date__lte=today,
                ),
            ),
            total_leads=Sum(
                "insights_daily__leads",
                filter=models.Q(
                    insights_daily__date__gte=since,
                    insights_daily__date__lte=today,
                ),
            ),
            total_purchases=Sum(
                "insights_daily__purchases",
                filter=models.Q(
                    insights_daily__date__gte=since,
                    insights_daily__date__lte=today,
                ),
            ),
            total_revenue=Sum(
                "insights_daily__revenue",
                filter=models.Q(
                    insights_daily__date__gte=since,
                    insights_daily__date__lte=today,
                ),
            ),
        )
        ad_rows = []
        for ad in linked_ads:
            a_spend = ad.total_spend or Decimal("0")
            a_rev = ad.total_revenue or Decimal("0")
            ad_rows.append({
                "id": ad.id,
                "meta_ad_id": ad.meta_ad_id,
                "name": ad.name,
                "effective_status": ad.effective_status,
                "creative": (
                    {
                        "id": ad.creative.id,
                        "meta_creative_id": ad.creative.meta_creative_id,
                        "title": ad.creative.title,
                        "thumbnail_url": ad.creative.thumbnail_url,
                    }
                    if ad.creative
                    else None
                ),
                "spend": str(a_spend),
                "impressions": ad.total_impressions or 0,
                "clicks": ad.total_clicks or 0,
                "leads": ad.total_leads or 0,
                "purchases": ad.total_purchases or 0,
                "revenue": str(a_rev),
                "roas": str(_safe_ratio(a_rev, a_spend)),
            })
        ad_rows.sort(key=lambda r: Decimal(r["spend"]), reverse=True)

        return Response({
            "id": adset.id,
            "meta_adset_id": adset.meta_adset_id,
            "ad_account_id": adset.campaign.ad_account_id,
            "currency": adset.campaign.ad_account.currency,
            "name": adset.name,
            "status": adset.status,
            "effective_status": adset.effective_status,
            "optimization_goal": adset.optimization_goal,
            "billing_event": adset.billing_event,
            "bid_amount_cents": adset.bid_amount_cents,
            "daily_budget_cents": adset.daily_budget_cents,
            "lifetime_budget_cents": adset.lifetime_budget_cents,
            "campaign": {
                "id": adset.campaign_id,
                "meta_campaign_id": adset.campaign.meta_campaign_id,
                "name": adset.campaign.name,
            },
            "created_at": adset.created_at.isoformat(),
            "updated_at": adset.updated_at.isoformat(),
            "days": days,
            "window": {"since": since.isoformat(), "until": today.isoformat()},
            "aggregates": aggregates,
            "linked_ads": ad_rows,
            "linked_ads_count": len(ad_rows),
        })


class MetaAdSetInsightTimeseriesView(APIView):
    """Daily aggregates for an adset — summed across every descendant ad."""

    permission_classes = [IsAuthenticated]
    ALLOWED_DAYS = {1, 2, 3, 7, 14, 28, 30}

    def get(self, request, adset_id: int):
        adset = get_object_or_404(
            MetaAdSet,
            pk=adset_id,
            campaign__ad_account__connection__user=request.user,
        )
        days = _normalize_days(request.query_params.get("days"), self.ALLOWED_DAYS, default=28)
        today = _dt.date.today()
        since = today - _dt.timedelta(days=days - 1)

        daily = MetaInsightDaily.objects.filter(
            ad__adset=adset,
            date__gte=since,
            date__lte=today,
        ).values("date").annotate(
            spend=Sum("spend"),
            impressions=Sum("impressions"),
            clicks=Sum("clicks"),
            leads=Sum("leads"),
            purchases=Sum("purchases"),
            revenue=Sum("revenue"),
            video_p25=Sum("video_p25"),
            video_p75=Sum("video_p75"),
            video_p100=Sum("video_p100"),
        )
        by_date = {row["date"]: row for row in daily}

        points = []
        cur = since
        while cur <= today:
            r = by_date.get(cur)
            imp = (r["impressions"] if r else 0) or 0
            p25 = (r["video_p25"] if r else 0) or 0
            p75 = (r["video_p75"] if r else 0) or 0
            points.append({
                "date": cur.isoformat(),
                "spend": str((r["spend"] if r else Decimal("0")) or Decimal("0")),
                "impressions": imp,
                "clicks": (r["clicks"] if r else 0) or 0,
                "leads": (r["leads"] if r else 0) or 0,
                "purchases": (r["purchases"] if r else 0) or 0,
                "revenue": str((r["revenue"] if r else Decimal("0")) or Decimal("0")),
                "video_p25": p25,
                "video_p75": p75,
                "video_p100": (r["video_p100"] if r else 0) or 0,
                "hook_rate": str(_safe_ratio(p25, imp) * Decimal("100")),
                "hold_rate": str(_safe_ratio(p75, p25) * Decimal("100")),
            })
            cur += _dt.timedelta(days=1)

        return Response({
            "adset_id": adset.id,
            "meta_adset_id": adset.meta_adset_id,
            "currency": adset.campaign.ad_account.currency,
            "days": days,
            "window": {"since": since.isoformat(), "until": today.isoformat()},
            "points": points,
        })


class MetaAdInsightTimeseriesView(APIView):
    """Daily insights for a single ad — the "stock chart" data source.

    Returns a dense array of points across the requested window so the
    frontend can draw a brush-enabled time series without gap handling
    on the client side (missing days are emitted as zeroes).
    """

    permission_classes = [IsAuthenticated]
    ALLOWED_DAYS = {1, 2, 3, 7, 14, 28, 30}

    def get(self, request, ad_account_id: int, ad_id: int):
        ad_account = _user_ad_account(request, ad_account_id)
        ad = get_object_or_404(
            MetaAd,
            pk=ad_id,
            adset__campaign__ad_account=ad_account,
        )
        days = _normalize_days(request.query_params.get("days"), self.ALLOWED_DAYS, default=28)
        today = _dt.date.today()
        since = today - _dt.timedelta(days=days - 1)
        rows = MetaInsightDaily.objects.filter(
            ad=ad, date__gte=since, date__lte=today
        ).order_by("date")
        row_map = {r.date: r for r in rows}

        points = []
        cur = since
        while cur <= today:
            r = row_map.get(cur)
            imp = (r.impressions if r else 0) or 0
            p25 = (r.video_p25 if r else 0) or 0
            p75 = (r.video_p75 if r else 0) or 0
            points.append({
                "date": cur.isoformat(),
                "spend": str(r.spend) if r else "0",
                "impressions": imp,
                "clicks": (r.clicks if r else 0) or 0,
                "leads": (r.leads if r else 0) or 0,
                "purchases": (r.purchases if r else 0) or 0,
                "revenue": str(r.revenue) if r else "0",
                "video_p25": p25,
                "video_p75": p75,
                "video_p100": (r.video_p100 if r else 0) or 0,
                "hook_rate": str(_safe_ratio(p25, imp) * Decimal("100")),
                "hold_rate": str(_safe_ratio(p75, p25) * Decimal("100")),
            })
            cur += _dt.timedelta(days=1)

        return Response({
            "ad_account_id": ad_account.id,
            "ad_id": ad.id,
            "meta_ad_id": ad.meta_ad_id,
            "ad_name": ad.name,
            "currency": ad_account.currency,
            "days": days,
            "window": {"since": since.isoformat(), "until": today.isoformat()},
            "points": points,
        })


# Utils -----------------------------------------------------------------------


def _parse_date(value):
    if not value:
        return None
    try:
        return _dt.date.fromisoformat(value)
    except ValueError:
        return None


def _safe_ratio(numerator, denominator) -> Decimal:
    try:
        n = Decimal(str(numerator or 0))
        d = Decimal(str(denominator or 0))
        if d == 0:
            return Decimal("0")
        return n / d
    except Exception:
        return Decimal("0")


def _normalize_days(value, allowed: set[int], default: int) -> int:
    try:
        days = int(value) if value is not None else default
    except (TypeError, ValueError):
        return default
    return days if days in allowed else default


def _parse_qp_int(request, name: str, default: int = 0) -> int:
    raw = request.query_params.get(name)
    if raw is None or raw == "":
        return default
    try:
        return max(int(raw), 0)
    except (TypeError, ValueError):
        return default


def _parse_qp_decimal(request, name: str, default: Decimal = Decimal("0")) -> Decimal:
    raw = request.query_params.get(name)
    if raw is None or raw == "":
        return default
    try:
        value = Decimal(str(raw))
    except Exception:
        return default
    return value if value >= 0 else default


def _parse_qp_bool(request, name: str, default: bool = False) -> bool:
    raw = request.query_params.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}
