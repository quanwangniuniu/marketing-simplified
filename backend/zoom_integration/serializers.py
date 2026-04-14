from rest_framework import serializers


class CreateMeetingSerializer(serializers.Serializer):
    """Validate the request parameters for creating a meeting"""
    topic = serializers.CharField(max_length=200)
    start_time = serializers.DateTimeField()   # automatically validate time format
    duration = serializers.IntegerField(min_value=15, max_value=480, default=60)


class MeetingResponseSerializer(serializers.Serializer):
    """Define the fields returned to the frontend (only expose the needed fields).

    Zoom's create-meeting JSON uses ``id``; the view maps that to ``meeting_id`` before validation.
    (DRF reads incoming keys by *field name*, not ``source``, so ``source="id"`` does not accept Zoom's ``id`` key.)

    ``uuid`` is the Zoom meeting instance id when present; store as-is for past-meeting APIs.
    """
    meeting_id = serializers.CharField()
    uuid = serializers.CharField(allow_blank=True, required=False, default="")
    topic = serializers.CharField()
    join_url = serializers.URLField()      # participant link
    start_url = serializers.URLField()     # host link (contains token, do not expose to regular users)
    start_time = serializers.DateTimeField()
    duration = serializers.IntegerField()


class ZoomMeetingLinkSerializer(serializers.Serializer):
    """Link a MediaJira meeting to Zoom identifiers after create (or reconnect)."""

    project_id = serializers.IntegerField(min_value=1)
    meeting_id = serializers.IntegerField(min_value=1)
    zoom_meeting_id = serializers.CharField(
        max_length=64,
        trim_whitespace=False,
    )
    zoom_uuid = serializers.CharField(
        max_length=128,
        allow_blank=True,
        required=False,
        default="",
        trim_whitespace=False,
    )

    def validate_zoom_meeting_id(self, value: str) -> str:
        if not value:
            raise serializers.ValidationError("This field may not be blank.")
        return value