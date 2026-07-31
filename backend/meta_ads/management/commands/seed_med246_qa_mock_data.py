"""Seed schema-aligned Meta ads mock data for MED-246 QA.

Usage (Docker):

  docker compose -p mediajira-v2 -f docker-compose.dev.yml exec backend \\
    python manage.py seed_med246_qa_mock_data

  docker compose -p mediajira-v2 -f docker-compose.dev.yml exec backend \\
    python manage.py seed_med246_qa_mock_data --reset --as-of 2026-07-31
"""

from __future__ import annotations

import datetime as _dt

from django.core.management.base import BaseCommand, CommandError

from meta_ads.qa_mock_data import (
    DEFAULT_QA_EMAIL,
    DEFAULT_QA_PASSWORD,
    DEFAULT_QA_USERNAME,
    seed_med246_qa_mock_data,
)


class Command(BaseCommand):
    help = (
        "Seed MED-246 QA mock Meta ads rows (connection → account → campaign → "
        "adset → creative → ad → insight_daily) aligned to current migrations."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--email",
            default=DEFAULT_QA_EMAIL,
            help=f"QA login email (default: {DEFAULT_QA_EMAIL})",
        )
        parser.add_argument(
            "--username",
            default=DEFAULT_QA_USERNAME,
            help=f"QA username when creating the user (default: {DEFAULT_QA_USERNAME})",
        )
        parser.add_argument(
            "--password",
            default=DEFAULT_QA_PASSWORD,
            help="Password set only when the QA user is created",
        )
        parser.add_argument(
            "--as-of",
            default=None,
            help="Inclusive end date YYYY-MM-DD for the insight series (default: today UTC)",
        )
        parser.add_argument(
            "--insight-days",
            type=int,
            default=5,
            help="How many contiguous calendar days to seed ending on --as-of (min 2)",
        )
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete prior MED-246 seed ad-account/connection rows before seeding",
        )

    def handle(self, *args, **options):
        as_of = options["as_of"]
        as_of_date = None
        if as_of:
            try:
                as_of_date = _dt.date.fromisoformat(as_of)
            except ValueError as exc:
                raise CommandError("--as-of must be YYYY-MM-DD") from exc

        try:
            summary = seed_med246_qa_mock_data(
                email=options["email"],
                username=options["username"],
                password=options["password"],
                as_of=as_of_date,
                insight_days=options["insight_days"],
                reset=options["reset"],
            )
        except ValueError as exc:
            raise CommandError(str(exc)) from exc

        self.stdout.write(self.style.SUCCESS("MED-246 QA mock data ready."))
        self.stdout.write(f"  user_email:        {summary['user_email']}")
        self.stdout.write(f"  user_id:           {summary['user_id']}")
        self.stdout.write(f"  ad_account_id:     {summary['ad_account_id']}")
        self.stdout.write(f"  ad_id:             {summary['ad_id']}")
        self.stdout.write(f"  insight_dates:     {', '.join(summary['insight_dates'])}")
        self.stdout.write(
            f"  insights:          created={summary['insights_created']} "
            f"updated={summary['insights_updated']}"
        )
        self.stdout.write(f"  last_synced_at:    {summary['last_synced_at']}")
        self.stdout.write(f"  sync_run_id:       {summary['sync_run_id']}")
        if summary.get("password_if_created"):
            self.stdout.write(
                self.style.WARNING(
                    f"  new user password: {summary['password_if_created']}"
                )
            )
        else:
            self.stdout.write("  user already existed — password left unchanged")
