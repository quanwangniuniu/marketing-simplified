"""Re-parse `MetaInsightDaily.raw` to populate the action-derived count columns
(`lpv_count`, `video_3sec_count`, `comment_count`) on existing rows.

Idempotent. Skips rows where `raw == {}` (no payload to parse). Use `--dry-run`
to preview row counts without writing.
"""

from django.core.management.base import BaseCommand
from django.utils import timezone

from meta_ads.models import MetaInsightDaily
from meta_ads.services import (
    _parse_comments,
    _parse_landing_page_views,
    _parse_video_3sec,
)


class Command(BaseCommand):
    help = (
        "Backfill lpv_count, video_3sec_count, and comment_count on existing "
        "MetaInsightDaily rows by re-parsing the stored raw JSON payload."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--batch-size",
            type=int,
            default=500,
            help="Number of rows to update per bulk_update call (default 500).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print what would be updated without writing to the DB.",
        )

    def handle(self, *args, **options):
        batch_size = options["batch_size"]
        dry_run = options["dry_run"]

        base_qs = MetaInsightDaily.objects.exclude(raw={})
        pks = list(base_qs.values_list("pk", flat=True).order_by("pk"))
        total_candidates = len(pks)
        if total_candidates == 0:
            self.stdout.write("No rows to backfill (every MetaInsightDaily.raw is empty).")
            return

        started_at = timezone.now()
        updated = 0

        for offset in range(0, total_candidates, batch_size):
            slice_pks = pks[offset : offset + batch_size]
            batch = list(
                MetaInsightDaily.objects.filter(pk__in=slice_pks).only(
                    "pk", "raw", "lpv_count", "video_3sec_count", "comment_count"
                )
            )
            for row in batch:
                actions = (row.raw or {}).get("actions")
                if not isinstance(actions, list):
                    actions = []
                row.lpv_count = _parse_landing_page_views(actions)
                row.video_3sec_count = _parse_video_3sec(actions)
                row.comment_count = _parse_comments(actions)
            if not dry_run:
                MetaInsightDaily.objects.bulk_update(
                    batch, ["lpv_count", "video_3sec_count", "comment_count"]
                )
            updated += len(batch)

        elapsed = (timezone.now() - started_at).total_seconds()
        verb = "Would update" if dry_run else "Updated"
        self.stdout.write(
            f"{verb} {updated} of {total_candidates} candidate rows in {elapsed:.2f}s."
        )
