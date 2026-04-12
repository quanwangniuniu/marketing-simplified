from django.db import models
from django.db.models import Prefetch


class MeetingQuerySet(models.QuerySet):
    """
    Optimized loading for knowledge discovery (search / filters / graph navigation).
    """

    def for_knowledge_discovery(self):
        # Local import avoids circular import: meetings.models imports this module.
        from meetings.models import MeetingDecisionOrigin, MeetingTaskOrigin

        return (
            self.select_related("project", "type_definition")
            .prefetch_related(
                "participant_links",
                "tag_assignments__tag_definition",
                "artifact_links",
                Prefetch(
                    "decision_origins",
                    queryset=MeetingDecisionOrigin.objects.filter(
                        decision__is_deleted=False,
                    ).select_related("decision"),
                ),
                Prefetch(
                    "task_origins",
                    queryset=MeetingTaskOrigin.objects.select_related(
                        "task",
                        "task__owner",
                    ),
                ),
            )
        )


class MeetingManager(models.Manager.from_queryset(MeetingQuerySet)):
    pass
