"""
Build read-only ``zoom_post_meeting`` payload for meeting detail API from persisted ``ZoomMeetingData``.

No new Zoom HTTP calls — only shapes already stored by sync (see ``services.py``).
"""

from __future__ import annotations

from typing import Any

from zoom_integration.models import ZoomMeetingData


def _norm_str(v: Any) -> str | None:
    if v is None:
        return None
    s = str(v).strip()
    return s if s else None


def trim_participants_for_api(structured: list | None) -> list[dict[str, str | None]]:
    out: list[dict[str, str | None]] = []
    for row in structured or []:
        if not isinstance(row, dict):
            continue
        out.append(
            {
                "name": _norm_str(row.get("name")),
                "email": _norm_str(row.get("user_email")),
            }
        )
    return out


def trim_recording_files_for_api(urls: list | None) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for f in urls or []:
        if not isinstance(f, dict):
            continue
        out.append(
            {
                "file_type": f.get("file_type"),
                "recording_type": f.get("recording_type"),
                "play_url": f.get("play_url"),
                "download_url": f.get("download_url"),
            }
        )
    return out


def has_transcript_asset_from_recordings(urls: list | None) -> bool:
    for f in urls or []:
        if not isinstance(f, dict):
            continue
        ft = str(f.get("file_type") or "").lower()
        rt = str(f.get("recording_type") or "").lower()
        if "transcript" in ft or "transcript" in rt:
            return True
        if ft == "cc" or "closed_caption" in ft or "caption" in ft:
            return True
    return False


def sync_error_suggests_auth_expired(sync_error: str) -> bool:
    """Match stable substrings from sync failures (no extra credential queries)."""
    msg = (sync_error or "").lower()
    if not msg:
        return False
    needles = (
        "401",
        "403",
        "unauthorized",
        "invalid_grant",
        "invalid token",
        "token expired",
        "access token is expired",
        "expired",
        "revoked",
        "authentication failed",
        "permission denied",
    )
    return any(n in msg for n in needles)


def compute_user_feedback_code(obj: ZoomMeetingData) -> str | None:
    """
    Stable code for product copy. Returns None when no user-facing issue classification applies.
    """
    st = obj.sync_state
    if st == ZoomMeetingData.SyncState.ERROR:
        if sync_error_suggests_auth_expired(obj.sync_error):
            return "auth_expired"
        return "error"

    if st in (ZoomMeetingData.SyncState.NEVER, ZoomMeetingData.SyncState.IN_PROGRESS):
        return "pending"

    if st == ZoomMeetingData.SyncState.PARTIAL:
        return None

    # OK
    if obj.summary_status == ZoomMeetingData.SummaryStatus.NOT_APPLICABLE:
        return "not_applicable"

    if obj.summary_status == ZoomMeetingData.SummaryStatus.PENDING:
        return "pending"

    if obj.summary_status == ZoomMeetingData.SummaryStatus.FAILED:
        return "error"

    if obj.recording_status in (
        ZoomMeetingData.RecordingStatus.NONE,
        ZoomMeetingData.RecordingStatus.PROCESSING,
        ZoomMeetingData.RecordingStatus.UNKNOWN,
    ):
        return "unavailable"

    return None


def build_zoom_post_meeting_payload(obj: ZoomMeetingData) -> dict[str, Any]:
    structured = obj.participant_structured_json or []
    participants = trim_participants_for_api(structured if isinstance(structured, list) else [])
    recording_files = trim_recording_files_for_api(
        obj.recording_urls_json if isinstance(obj.recording_urls_json, list) else []
    )
    has_pb = len(participants) > 0

    code = compute_user_feedback_code(obj)

    return {
        "meeting_status": obj.meeting_status,
        "start_time": obj.actual_start_time,
        "end_time": obj.actual_end_time,
        "duration_minutes": obj.duration_minutes,
        "actual_participants_count": obj.actual_participants_count,
        "recording_status": obj.recording_status,
        "summary_status": obj.summary_status,
        "sync_state": obj.sync_state,
        "sync_error": obj.sync_error,
        "last_sync_at": obj.last_sync_at,
        "has_participant_breakdown": has_pb,
        "participant_breakdown_count": len(participants),
        "has_transcript_asset": has_transcript_asset_from_recordings(
            obj.recording_urls_json if isinstance(obj.recording_urls_json, list) else []
        ),
        "recording_file_count": len(recording_files),
        "summary_text": obj.summary_text or "",
        "participants": participants,
        "recording_files": recording_files,
        "user_feedback_code": code,
    }
