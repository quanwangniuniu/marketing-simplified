"""
Meeting lifecycle state machine.

Defines valid transitions and validation rules for each transition.
Validation functions raise rest_framework.exceptions.ValidationError on failure.
"""

from rest_framework.exceptions import ValidationError

from meetings.models import Meeting


# ---------------------------------------------------------------------------
# Transition map: state -> set of reachable next states
# ---------------------------------------------------------------------------

TRANSITIONS: dict[str, list[str]] = {
    Meeting.STATUS_DRAFT: [Meeting.STATUS_PLANNED],
    Meeting.STATUS_PLANNED: [Meeting.STATUS_IN_PROGRESS, Meeting.STATUS_DRAFT],
    Meeting.STATUS_IN_PROGRESS: [Meeting.STATUS_COMPLETED, Meeting.STATUS_PLANNED],
    Meeting.STATUS_COMPLETED: [Meeting.STATUS_ARCHIVED],
    Meeting.STATUS_ARCHIVED: [],  # terminal state
}

TERMINAL_STATES: set[str] = {Meeting.STATUS_ARCHIVED}


# ---------------------------------------------------------------------------
# Validation rules
# ---------------------------------------------------------------------------

def _validate_transition_to_in_progress(meeting: Meeting) -> None:
    """Meeting must have at least one participant before going In Progress."""
    if not meeting.participant_links.exists():
        raise ValidationError(
            {"transition": "Meeting must have at least one participant before moving to In Progress."}
        )


def _validate_transition_to_archived(meeting: Meeting) -> None:
    """All action items must be resolved before archiving."""
    unresolved = meeting.action_items.filter(is_resolved=False).count()
    if unresolved:
        raise ValidationError(
            {"transition": f"Meeting has {unresolved} unresolved action item(s). Resolve them before archiving."}
        )


def _validate_transition_to_completed(meeting: Meeting) -> None:
    """Meeting must have a non-empty objective and at least one agenda item before Completed."""
    errors = []
    if not meeting.objective or not meeting.objective.strip():
        errors.append("Meeting must have an objective before marking as Completed.")
    if not meeting.agenda_items.exists():
        errors.append("Meeting must have at least one agenda item before marking as Completed.")
    if errors:
        raise ValidationError({"transition": errors})


# Map: target state -> validation function (or None if no validation needed)
_TRANSITION_VALIDATORS = {
    Meeting.STATUS_IN_PROGRESS: _validate_transition_to_in_progress,
    Meeting.STATUS_COMPLETED: _validate_transition_to_completed,
    Meeting.STATUS_ARCHIVED: _validate_transition_to_archived,
}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_available_transitions(meeting: Meeting) -> list[str]:
    """Return list of states the meeting can legally move to from its current state."""
    return TRANSITIONS.get(meeting.status, [])


def execute_transition(meeting: Meeting, to_state: str) -> Meeting:
    """
    Attempt to transition meeting to to_state.

    Raises ValidationError if:
    - to_state is not a valid state name
    - the transition is not allowed from current state
    - pre-transition validation fails

    Returns the saved meeting instance on success.
    """
    valid_states = {choice[0] for choice in Meeting.STATUS_CHOICES}
    if to_state not in valid_states:
        raise ValidationError({"to_state": f"'{to_state}' is not a valid meeting state."})

    allowed = get_available_transitions(meeting)
    if not allowed:
        raise ValidationError(
            {"transition": f"Meeting is in a terminal state ('{meeting.status}') and cannot be transitioned."}
        )
    if to_state not in allowed:
        raise ValidationError(
            {
                "transition": (
                    f"Cannot transition from '{meeting.status}' to '{to_state}'. "
                    f"Allowed transitions: {allowed}."
                )
            }
        )

    validator = _TRANSITION_VALIDATORS.get(to_state)
    if validator:
        validator(meeting)

    meeting.status = to_state
    meeting.save(update_fields=["status"])
    return meeting
