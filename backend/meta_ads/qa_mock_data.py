"""Schema-aligned mock data for MED-246 QA (UTC rollover sync window).

Builds the full Meta ads FK chain required by migrations/models, plus a
contiguous `MetaInsightDaily` series that spans a UTC midnight boundary so QA
can verify charts/tooltips without a live Ads API key.

Stable Meta IDs make the seed idempotent (safe to re-run).
"""

from __future__ import annotations

import datetime as _dt
from decimal import Decimal
from typing import Any

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from core.models import Organization, OrganizationMembership, Project, ProjectMember
from facebook_integration.models import FacebookConnection, MetaAdAccount

from .models import (
    MetaAd,
    MetaAdCreative,
    MetaAdSet,
    MetaCampaign,
    MetaInsightDaily,
    MetaSyncRun,
)

# Stable identifiers — keep in sync with management command help text.
SEED_MARKER = "med246"
ORG_NAME = "MED-246 QA Org"
ORG_SLUG = "med-246-qa-org"
PROJECT_NAME = "MED-246 QA Project"
DEFAULT_QA_EMAIL = "qa-med246@example.com"
DEFAULT_QA_USERNAME = "qa_med246"
DEFAULT_QA_PASSWORD = "qa-med246-pass"

FB_USER_ID = f"{SEED_MARKER}-fb-user"
META_ACCOUNT_ID = f"{SEED_MARKER}0001"
META_CAMPAIGN_ID = f"{SEED_MARKER}-camp-1"
META_ADSET_ID = f"{SEED_MARKER}-adset-1"
META_CREATIVE_ID = f"{SEED_MARKER}-creative-1"
META_AD_ID = f"{SEED_MARKER}-ad-1"


def _insight_defaults_for_day(day_index: int, date: _dt.date) -> dict[str, Any]:
    """Deterministic metric values that still look realistic in the UI."""
    spend = Decimal("10.00") + Decimal(day_index) * Decimal("2.50")
    impressions = 1000 + day_index * 150
    clicks = 40 + day_index * 3
    reach = max(impressions - 50, 1)
    frequency = (Decimal(impressions) / Decimal(reach)).quantize(Decimal("0.0001"))
    ctr = (Decimal(clicks) * Decimal("100") / Decimal(impressions)).quantize(
        Decimal("0.0001")
    )
    cpc = (spend / Decimal(clicks)).quantize(Decimal("0.0001"))
    cpm = (spend * Decimal("1000") / Decimal(impressions)).quantize(Decimal("0.0001"))
    leads = 2 + (day_index % 3)
    purchases = day_index % 2
    revenue = Decimal(purchases) * Decimal("49.99")
    return {
        "spend": spend,
        "impressions": impressions,
        "reach": reach,
        "clicks": clicks,
        "frequency": frequency,
        "ctr": ctr,
        "cpc": cpc,
        "cpm": cpm,
        "leads": leads,
        "calls": 0,
        "purchases": purchases,
        "messages": 1,
        "lpv_count": 5 + day_index,
        "video_3sec_count": 20 + day_index * 2,
        "comment_count": day_index % 4,
        "revenue": revenue,
        "video_p25": 15 + day_index,
        "video_p50": 10 + day_index,
        "video_p75": 6 + day_index,
        "video_p100": 3 + day_index,
        "video_avg_watch_seconds": Decimal("12.50") + Decimal(day_index),
        "raw": {
            "seed": SEED_MARKER,
            "ticket": "MED-246",
            "date_start": date.isoformat(),
            "note": "qa mock — not from Graph API",
        },
    }


@transaction.atomic
def seed_med246_qa_mock_data(
    *,
    email: str = DEFAULT_QA_EMAIL,
    username: str = DEFAULT_QA_USERNAME,
    password: str = DEFAULT_QA_PASSWORD,
    as_of: _dt.date | None = None,
    insight_days: int = 5,
    reset: bool = False,
) -> dict[str, Any]:
    """Insert or refresh MED-246 QA rows. Returns a summary for CLI/tests.

    `insight_days` counts calendar days ending on `as_of` (inclusive). Default
    5 days gives QA a clear before/on/after UTC-rollover span without needing
    a live sync.
    """
    if insight_days < 2:
        raise ValueError("insight_days must be >= 2 so the series can span a day boundary")

    as_of = as_of or timezone.now().date()
    User = get_user_model()

    if reset:
        _reset_seed_rows()

    org, org_created = Organization.objects.get_or_create(
        slug=ORG_SLUG,
        defaults={"name": ORG_NAME},
    )
    # Name is unique; keep slug as the stable key if an older row used another name.
    if org.name != ORG_NAME and not Organization.objects.filter(name=ORG_NAME).exists():
        org.name = ORG_NAME
        org.save(update_fields=["name", "updated_at"])

    user, user_created = User.objects.get_or_create(
        email=email,
        defaults={
            "username": username,
            "organization": org,
            "current_organization": org,
        },
    )
    if user_created:
        user.set_password(password)
        user.save(update_fields=["password"])
    else:
        user_updates: list[str] = []
        if user.organization_id is None:
            user.organization = org
            user_updates.append("organization")
        if getattr(user, "current_organization_id", None) is None:
            user.current_organization = org
            user_updates.append("current_organization")
        if user_updates:
            user.save(update_fields=user_updates)

    # OnboardingGate keys off OrganizationMembership (not user.organization FK).
    # Without this row the UI shows "Set up your first project" forever.
    OrganizationMembership.objects.get_or_create(
        user=user,
        organization=org,
        defaults={"role": "admin", "is_active": True},
    )

    project, project_created = Project.objects.get_or_create(
        name=PROJECT_NAME,
        organization=org,
        defaults={"owner": user},
    )
    ProjectMember.objects.get_or_create(
        user=user,
        project=project,
        defaults={"role": "owner", "is_active": True},
    )
    if getattr(user, "active_project_id", None) != project.id:
        user.active_project = project
        user.save(update_fields=["active_project"])

    connection, connection_created = FacebookConnection.objects.get_or_create(
        user=user,
        defaults={
            "fb_user_id": FB_USER_ID,
            "fb_user_name": "MED-246 QA User",
            "business_id": f"{SEED_MARKER}-biz",
            "business_name": "MED-246 QA Business",
            "is_active": True,
            "last_synced_at": timezone.now(),
        },
    )
    if not connection_created:
        connection.fb_user_id = FB_USER_ID
        connection.is_active = True
        connection.last_synced_at = timezone.now()
        connection.last_sync_error = ""
        connection.save(
            update_fields=[
                "fb_user_id",
                "is_active",
                "last_synced_at",
                "last_sync_error",
                "updated_at",
            ]
        )

    ad_account, ad_account_created = MetaAdAccount.objects.get_or_create(
        connection=connection,
        meta_account_id=META_ACCOUNT_ID,
        defaults={
            "name": "MED-246 QA Ad Account",
            "currency": "USD",
            "timezone_name": "UTC",
            "account_status": 1,
            "business_id": f"{SEED_MARKER}-biz",
            "is_owned": True,
            "project": project,
        },
    )
    if ad_account.project_id != project.id:
        ad_account.project = project
        ad_account.name = "MED-246 QA Ad Account"
        ad_account.account_status = 1
        ad_account.save(
            update_fields=["project", "name", "account_status", "updated_at"]
        )

    campaign, _ = MetaCampaign.objects.get_or_create(
        ad_account=ad_account,
        meta_campaign_id=META_CAMPAIGN_ID,
        defaults={
            "name": "MED-246 QA Campaign",
            "objective": "OUTCOME_TRAFFIC",
            "status": "ACTIVE",
            "effective_status": "ACTIVE",
        },
    )
    adset, _ = MetaAdSet.objects.get_or_create(
        campaign=campaign,
        meta_adset_id=META_ADSET_ID,
        defaults={
            "name": "MED-246 QA Ad Set",
            "status": "ACTIVE",
            "effective_status": "ACTIVE",
            "billing_event": "IMPRESSIONS",
            "optimization_goal": "LINK_CLICKS",
        },
    )
    creative, _ = MetaAdCreative.objects.get_or_create(
        ad_account=ad_account,
        meta_creative_id=META_CREATIVE_ID,
        defaults={
            "name": "MED-246 QA Creative",
            "title": "QA rollover creative",
            "body": "Schema-aligned mock for MED-246",
            "object_type": "SHARE",
            "call_to_action_type": "LEARN_MORE",
        },
    )
    ad, _ = MetaAd.objects.get_or_create(
        adset=adset,
        meta_ad_id=META_AD_ID,
        defaults={
            "name": "MED-246 QA Ad",
            "status": "ACTIVE",
            "effective_status": "ACTIVE",
            "creative": creative,
        },
    )
    if ad.creative_id is None:
        ad.creative = creative
        ad.save(update_fields=["creative", "updated_at"])

    insight_dates = [
        as_of - _dt.timedelta(days=offset)
        for offset in range(insight_days - 1, -1, -1)
    ]
    insights_created = 0
    insights_updated = 0
    for index, date in enumerate(insight_dates):
        _, created = MetaInsightDaily.objects.update_or_create(
            ad=ad,
            date=date,
            defaults=_insight_defaults_for_day(index, date),
        )
        if created:
            insights_created += 1
        else:
            insights_updated += 1

    sync_run = MetaSyncRun.objects.create(
        ad_account=ad_account,
        kind="manual",
        status="ok",
        finished_at=timezone.now(),
        level_counts={
            "campaigns": 1,
            "adsets": 1,
            "creatives": 1,
            "ads": 1,
            "insights_rows": len(insight_dates),
            "seed": SEED_MARKER,
        },
        current_phase="",
        current_progress="",
    )

    return {
        "org_id": org.id,
        "org_created": org_created,
        "user_id": user.id,
        "user_email": user.email,
        "user_created": user_created,
        "project_id": project.id,
        "project_created": project_created,
        "connection_id": connection.id,
        "connection_created": connection_created,
        "ad_account_id": ad_account.id,
        "ad_account_created": ad_account_created,
        "ad_id": ad.id,
        "insight_dates": [d.isoformat() for d in insight_dates],
        "insights_created": insights_created,
        "insights_updated": insights_updated,
        "sync_run_id": sync_run.id,
        "last_synced_at": connection.last_synced_at.isoformat()
        if connection.last_synced_at
        else None,
        "password_if_created": password if user_created else None,
    }


def _reset_seed_rows() -> None:
    """Remove prior MED-246 seed rows by stable Meta IDs (FK cascade handles children)."""
    MetaAdAccount.objects.filter(meta_account_id=META_ACCOUNT_ID).delete()
    FacebookConnection.objects.filter(fb_user_id=FB_USER_ID).delete()
