"""Unit tests for org-admin override marker format/parse (no DB)."""
from budget_approval.approver_access import (
    ORG_ADMIN_OVERRIDE_PREFIX,
    format_org_admin_override_marker,
    parse_org_admin_override_marker,
)


class TestOverrideMarkerRoundTrip:
    def test_format_includes_replaced_step_and_timestamp(self):
        line = format_org_admin_override_marker(
            user_id=9,
            decision="approve",
            replaced_step=1,
            timestamp="2026-08-12T11:04:35+00:00",
        )
        assert line.startswith(ORG_ADMIN_OVERRIDE_PREFIX)
        parsed = parse_org_admin_override_marker(line)
        assert parsed == {
            "override_by_user_id": 9,
            "override_type": "org_admin",
            "replaced_step": 1,
            "override_timestamp": "2026-08-12T11:04:35+00:00",
            "final_outcome": "approve",
        }

    def test_legacy_marker_without_replaced_step_still_parses(self):
        legacy = f"{ORG_ADMIN_OVERRIDE_PREFIX} user_id=9 decision=reject"
        parsed = parse_org_admin_override_marker(legacy)
        assert parsed["override_by_user_id"] == 9
        assert parsed["final_outcome"] == "reject"
        assert parsed["replaced_step"] is None
        assert parsed["override_timestamp"] is None

    def test_parses_last_marker_line_in_notes(self):
        notes = "\n".join(
            [
                "Please prioritize",
                f"{ORG_ADMIN_OVERRIDE_PREFIX} user_id=1 decision=approve replaced_step=1",
                f"{ORG_ADMIN_OVERRIDE_PREFIX} user_id=9 decision=reject replaced_step=2",
            ]
        )
        parsed = parse_org_admin_override_marker(notes)
        assert parsed["override_by_user_id"] == 9
        assert parsed["final_outcome"] == "reject"
        assert parsed["replaced_step"] == 2

    def test_returns_none_when_no_marker(self):
        assert parse_org_admin_override_marker("just a note") is None
        assert parse_org_admin_override_marker("") is None
        assert parse_org_admin_override_marker(None) is None
