from django.db.models import Max, Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.pagination import CursorPagination

from core.models import Project

from .models import AdGroup, AdVariation, VariationPerformance, VariationStatusHistory
from .serializers import (
    AdGroupCreateSerializer,
    AdGroupSerializer,
    AdGroupUpdateSerializer,
    AdGroupVariationAssignmentSerializer,
    AdVariationCreateSerializer,
    AdVariationSerializer,
    AdVariationUpdateSerializer,
    BulkOperationSerializer,
    ComparisonRequestSerializer,
    VariationPerformanceCreateSerializer,
    VariationPerformanceSerializer,
    VariationStatusChangeSerializer,
    VariationStatusHistorySerializer,
)
from .services import BulkOperationService, ComparisonService, VariationService


class LimitCursorPagination(CursorPagination):
    page_size = 50
    page_size_query_param = "limit"
    ordering = "-created_at"


class PerformanceCursorPagination(CursorPagination):
    page_size = 50
    page_size_query_param = "limit"
    ordering = "-recorded_at"


class StatusHistoryCursorPagination(CursorPagination):
    page_size = 50
    page_size_query_param = "limit"
    ordering = "-changed_at"


class CampaignContextMixin:
    permission_classes = [IsAuthenticated]

    def get_campaign(self):
        return get_object_or_404(Project, id=self.kwargs["campaign_id"])

    def get_serializer_context(self):
        if hasattr(super(), "get_serializer_context"):
            context = super().get_serializer_context()
        else:
            context = {
                "request": self.request,
                "format": getattr(self, "format_kwarg", None),
                "view": self,
            }
        fields = self.request.query_params.get("fields")
        if fields:
            context["fields"] = [field.strip() for field in fields.split(",") if field.strip()]
        return context


class AdVariationListCreateView(CampaignContextMixin, generics.ListCreateAPIView):
    serializer_class = AdVariationSerializer
    pagination_class = LimitCursorPagination
    filter_backends = []
    ordering = "-created_at"

    def get_queryset(self):
        campaign = self.get_campaign()
        queryset = AdVariation.objects.filter(campaign=campaign).prefetch_related("copy_elements")

        status_param = self.request.query_params.get("status")
        if status_param:
            statuses = [value.strip() for value in status_param.split(",") if value.strip()]
            queryset = queryset.filter(status__in=statuses)

        creative_param = self.request.query_params.get("creativeType")
        if creative_param:
            creative_types = [value.strip() for value in creative_param.split(",") if value.strip()]
            queryset = queryset.filter(creative_type__in=creative_types)

        tags = self.request.query_params.getlist("tags")
        if len(tags) == 1 and "," in tags[0]:
            tags = [value.strip() for value in tags[0].split(",") if value.strip()]
        for tag in tags:
            queryset = queryset.filter(tags__contains=[tag])

        tags_any = self.request.query_params.get("tagsAny")
        if tags_any:
            any_tags = [value.strip() for value in tags_any.split(",") if value.strip()]
            tag_query = Q()
            for tag in any_tags:
                tag_query |= Q(tags__contains=[tag])
            queryset = queryset.filter(tag_query)

        ad_group_id = self.request.query_params.get("adGroupId")
        if ad_group_id:
            queryset = queryset.filter(ad_group_id=ad_group_id)

        sort_by = self.request.query_params.get("sortBy", "recency")
        order = self.request.query_params.get("order", "desc")
        if sort_by == "performance":
            queryset = queryset.annotate(latest_performance=Max("performance_entries__recorded_at"))
            ordering = "latest_performance"
        elif sort_by == "manual":
            return queryset.order_by("status", "sort_order", "created_at")
        else:
            ordering = "created_at"

        if order == "desc":
            ordering = f"-{ordering}"
        return queryset.order_by(ordering)

    def get_serializer_class(self):
        if self.request.method == "POST":
            return AdVariationCreateSerializer
        return AdVariationSerializer

    def perform_create(self, serializer):
        campaign = self.get_campaign()
        max_order = (
            AdVariation.objects.filter(campaign=campaign).aggregate(Max("sort_order")).get("sort_order__max")
            or 0
        )
        serializer.save(campaign=campaign, sort_order=max_order + 1)


class AdVariationDetailView(CampaignContextMixin, generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AdVariationSerializer
    lookup_url_kwarg = "variation_id"

    def get_queryset(self):
        campaign = self.get_campaign()
        return AdVariation.objects.filter(campaign=campaign).prefetch_related("copy_elements")

    def get_serializer_class(self):
        if self.request.method in ["PATCH", "PUT"]:
            return AdVariationUpdateSerializer
        return AdVariationSerializer


class AdVariationDuplicateView(CampaignContextMixin, APIView):
    def post(self, request, campaign_id, variation_id):
        campaign = self.get_campaign()
        variation = get_object_or_404(AdVariation, campaign=campaign, id=variation_id)
        name_override = request.data.get("name")
        duplicate = VariationService.duplicate_variation(variation, name_override=name_override)
        return Response(
            AdVariationSerializer(duplicate, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )


class VariationStatusChangeView(CampaignContextMixin, APIView):
    def post(self, request, campaign_id, variation_id):
        campaign = self.get_campaign()
        variation = get_object_or_404(AdVariation, campaign=campaign, id=variation_id)
        serializer = VariationStatusChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        to_status = serializer.validated_data["toStatus"]
        reason = serializer.validated_data.get("reason")
        history = VariationService.record_status_change(variation, to_status, reason, request.user)
        return Response(
            {
                "variation": AdVariationSerializer(variation, context=self.get_serializer_context()).data,
                "statusHistory": VariationStatusHistorySerializer(history).data,
            }
        )


class VariationStatusHistoryListView(CampaignContextMixin, generics.ListAPIView):
    serializer_class = VariationStatusHistorySerializer
    pagination_class = StatusHistoryCursorPagination
    filter_backends = []

    def get_queryset(self):
        campaign = self.get_campaign()
        variation = AdVariation.objects.filter(
            campaign=campaign, id=self.kwargs["variation_id"]
        ).first()
        if not variation:
            return VariationStatusHistory.objects.none()
        return variation.status_history.all()


class AdGroupListCreateView(CampaignContextMixin, generics.ListCreateAPIView):
    serializer_class = AdGroupSerializer
    pagination_class = LimitCursorPagination
    filter_backends = []
    ordering = "-created_at"

    def get_queryset(self):
        campaign = self.get_campaign()
        return AdGroup.objects.filter(campaign=campaign)

    def get_serializer_class(self):
        if self.request.method == "POST":
            return AdGroupCreateSerializer
        return AdGroupSerializer

    def perform_create(self, serializer):
        campaign = self.get_campaign()
        serializer.save(campaign=campaign)


class AdGroupDetailView(CampaignContextMixin, generics.UpdateAPIView, generics.DestroyAPIView):
    serializer_class = AdGroupUpdateSerializer
    lookup_url_kwarg = "ad_group_id"

    def get_queryset(self):
        campaign = self.get_campaign()
        return AdGroup.objects.filter(campaign=campaign)


class AdGroupVariationAssignmentView(CampaignContextMixin, APIView):
    def post(self, request, campaign_id, ad_group_id):
        serializer = AdGroupVariationAssignmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        variation_ids = serializer.validated_data["variationIds"]
        AdVariation.objects.filter(id__in=variation_ids, campaign_id=campaign_id).update(
            ad_group_id=ad_group_id
        )
        return Response({"assigned": variation_ids})

    def delete(self, request, campaign_id, ad_group_id):
        serializer = AdGroupVariationAssignmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        variation_ids = serializer.validated_data["variationIds"]
        AdVariation.objects.filter(id__in=variation_ids, campaign_id=campaign_id, ad_group_id=ad_group_id).update(
            ad_group=None
        )
        return Response({"removed": variation_ids})


class VariationComparisonView(CampaignContextMixin, APIView):
    def post(self, request, campaign_id):
        serializer = ComparisonRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        variation_ids = serializer.validated_data["variationIds"]
        variations = list(AdVariation.objects.filter(campaign_id=campaign_id, id__in=variation_ids).prefetch_related("copy_elements"))
        comparison = ComparisonService.build_comparison(variations)
        return Response(comparison)


class VariationPerformanceView(CampaignContextMixin, APIView):
    def get(self, request, campaign_id, variation_id):
        queryset = VariationPerformance.objects.filter(variation_id=variation_id, variation__campaign_id=campaign_id)
        paginator = PerformanceCursorPagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = VariationPerformanceSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def post(self, request, campaign_id, variation_id):
        serializer = VariationPerformanceCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        entry = serializer.save(variation_id=variation_id, created_by=request.user)
        return Response(VariationPerformanceSerializer(entry).data, status=status.HTTP_201_CREATED)


class VariationPerformanceLatestView(CampaignContextMixin, APIView):
    def get(self, request, campaign_id, variation_id):
        entry = (
            VariationPerformance.objects.filter(variation_id=variation_id, variation__campaign_id=campaign_id)
            .order_by("-recorded_at")
            .first()
        )
        if not entry:
            return Response(
                {"recordedAt": None, "metrics": {}},
                status=status.HTTP_200_OK,
            )
        return Response(
            {"recordedAt": entry.recorded_at, "metrics": entry.metrics},
            status=status.HTTP_200_OK,
        )


class VariationBulkOperationView(CampaignContextMixin, APIView):
    def post(self, request, campaign_id):
        serializer = BulkOperationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        results = BulkOperationService.apply(
            serializer.validated_data["action"],
            serializer.validated_data["variationIds"],
            serializer.validated_data.get("payload", {}),
            request.user,
        )
        return Response({"results": results})
