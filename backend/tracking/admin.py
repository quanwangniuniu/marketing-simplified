from django.contrib import admin

from tracking.models import TrackingEvent, TrackingSession


@admin.register(TrackingSession)
class TrackingSessionAdmin(admin.ModelAdmin):
    list_display = ('short_id', 'user', 'started_at', 'ended_at', 'end_reason', 'active_seconds', 'last_heartbeat_at')
    list_filter = ('end_reason',)
    search_fields = ('user__username',)
    readonly_fields = (
        'id', 'user', 'started_at', 'last_heartbeat_at',
        'ended_at', 'end_reason', 'active_seconds', 'user_agent',
    )

    @admin.display(description='ID')
    def short_id(self, obj):
        return str(obj.id)[:8]


@admin.register(TrackingEvent)
class TrackingEventAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'event_type', 'occurred_at', 'content_type', 'object_id', 'session')
    list_filter = ('event_type', 'content_type')
    search_fields = ('user__username', 'client_event_id')
    readonly_fields = (
        'id', 'session', 'user', 'content_type', 'object_id',
        'event_type', 'occurred_at', 'created_at', 'metadata',
        'project_id', 'client_event_id',
    )
