from typing import Dict, List, Optional, Tuple

from django.db import transaction
from django.utils import timezone

from .models import AdVariation, CopyElement, VariationPerformance, VariationStatusHistory


class VariationService:
    @staticmethod
    @transaction.atomic
    def duplicate_variation(variation: AdVariation, name_override: Optional[str] = None) -> AdVariation:
        base_name = name_override or f"{variation.name} Copy"
        duplicate = AdVariation.objects.create(
            campaign=variation.campaign,
            ad_group=variation.ad_group,
            name=base_name,
            creative_type=variation.creative_type,
            status=variation.status,
            tags=variation.tags,
            notes=variation.notes,
            format_payload=variation.format_payload,
            delivery=variation.delivery,
            bid_strategy=variation.bid_strategy,
            budget=variation.budget,
            sort_order=variation.sort_order,
        )
        copy_elements = [
            CopyElement(
                variation=duplicate,
                element_key=elem.element_key,
                value=elem.value,
                locale=elem.locale,
                position=elem.position,
                meta=elem.meta,
            )
            for elem in variation.copy_elements.all()
        ]
        if copy_elements:
            CopyElement.objects.bulk_create(copy_elements)
        return duplicate

    @staticmethod
    @transaction.atomic
    def record_status_change(
        variation: AdVariation, to_status: str, reason: Optional[str], user
    ) -> VariationStatusHistory:
        history = VariationStatusHistory.objects.create(
            variation=variation,
            from_status=variation.status,
            to_status=to_status,
            reason=reason,
            changed_at=timezone.now(),
            changed_by=user,
        )
        variation.status = to_status
        variation.save(update_fields=["status", "updated_at"])
        return history


class ComparisonService:
    @staticmethod
    def build_comparison(variations: List[AdVariation]) -> Dict:
        columns = {"variationIds": [str(v.id) for v in variations]}
        rows = []

        def row(key: str, getter) -> Dict:
            values = {str(v.id): getter(v) for v in variations}
            return {"key": key, "values": values}

        rows.append(row("name", lambda v: v.name))
        rows.append(row("creativeType", lambda v: v.creative_type))
        rows.append(row("status", lambda v: v.status))
        rows.append(row("delivery", lambda v: v.delivery or ""))
        rows.append(row("bidStrategy", lambda v: v.bid_strategy or ""))
        rows.append(row("budget", lambda v: str(v.budget) if v.budget is not None else ""))
        rows.append(row("notes", lambda v: v.notes or ""))
        rows.append(row("tags", lambda v: ", ".join(v.tags or [])))

        aligned_keys: Dict[Tuple[str, Optional[int]], Dict[str, str]] = {}
        for variation in variations:
            for elem in variation.copy_elements.all():
                key = (elem.element_key, elem.position)
                if key not in aligned_keys:
                    aligned_keys[key] = {}
                aligned_keys[key][str(variation.id)] = elem.value
        for (element_key, position), values in aligned_keys.items():
            suffix = f":{position}" if position is not None else ""
            rows.append({"key": f"copy.{element_key}{suffix}", "values": values})

        performance_summary = {}
        for variation in variations:
            latest = (
                VariationPerformance.objects.filter(variation=variation)
                .order_by("-recorded_at")
                .first()
            )
            if latest:
                performance_summary[str(variation.id)] = {
                    "recordedAt": latest.recorded_at,
                    "metrics": latest.metrics,
                }
        return {"columns": columns, "rows": rows, "performanceSummary": performance_summary}


class BulkOperationService:
    @staticmethod
    @transaction.atomic
    def apply(action: str, variation_ids: List[str], payload: Dict, user) -> List[Dict]:
        results = []
        variations = AdVariation.objects.filter(id__in=variation_ids)
        variation_map = {str(v.id): v for v in variations}
        for variation_id in variation_ids:
            variation = variation_map.get(str(variation_id))
            if not variation:
                results.append(
                    {
                        "variationId": str(variation_id),
                        "success": False,
                        "error": {"message": "Variation not found"},
                    }
                )
                continue
            try:
                if action == "updateStatus":
                    VariationService.record_status_change(
                        variation, payload.get("toStatus"), payload.get("reason"), user
                    )
                elif action == "addTags":
                    tags = payload.get("tags", [])
                    variation.tags = list({*(variation.tags or []), *tags})
                    variation.save(update_fields=["tags", "updated_at"])
                elif action == "removeTags":
                    tags = set(payload.get("tags", []))
                    variation.tags = [tag for tag in (variation.tags or []) if tag not in tags]
                    variation.save(update_fields=["tags", "updated_at"])
                elif action == "assignAdGroup":
                    variation.ad_group_id = payload.get("adGroupId") or None
                    variation.save(update_fields=["ad_group", "updated_at"])
                elif action == "unassignAdGroup":
                    variation.ad_group = None
                    variation.save(update_fields=["ad_group", "updated_at"])
                results.append({"variationId": str(variation.id), "success": True})
            except Exception as exc:
                results.append(
                    {
                        "variationId": str(variation.id),
                        "success": False,
                        "error": {"message": str(exc)},
                    }
                )
        return results
