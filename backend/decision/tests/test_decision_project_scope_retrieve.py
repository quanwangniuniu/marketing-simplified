"""
GET detail must not leak another project's decision (including origin_meeting) when
``project_id`` / ``x-project-id`` does not match ``Decision.project_id``.
"""

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from core.models import Organization, Project, ProjectMember
from decision.models import Decision
from meetings.models import Meeting, MeetingDecisionOrigin, MeetingTypeDefinition

from django.contrib.auth import get_user_model

User = get_user_model()


def _setup_user_two_projects():
    organization = Organization.objects.create(name="Scope Org", email_domain="scope.test")
    user = User.objects.create_user(
        email="scope@test.com",
        username="scopeuser",
        password="password123",
        organization=organization,
        is_verified=True,
        is_active=True,
        password_set=True,
    )
    project_a = Project.objects.create(
        name="Project A",
        organization=organization,
        owner=user,
        objectives=["awareness"],
        kpis={"ctr": {"target": 0.02}},
    )
    project_b = Project.objects.create(
        name="Project B",
        organization=organization,
        owner=user,
        objectives=["awareness"],
        kpis={"ctr": {"target": 0.02}},
    )
    ProjectMember.objects.create(user=user, project=project_a, role="member", is_active=True)
    ProjectMember.objects.create(user=user, project=project_b, role="member", is_active=True)
    return user, project_a, project_b


def _client(user, project):
    c = APIClient()
    c.force_authenticate(user=user)
    c.credentials(HTTP_X_PROJECT_ID=str(project.id))
    return c


@pytest.mark.django_db
def test_draft_retrieve_wrong_project_returns_404_without_origin_meeting():
    user, project_a, project_b = _setup_user_two_projects()
    client_wrong = _client(user, project_b)

    d = Decision.objects.create(
        title="Scoped draft",
        status=Decision.Status.DRAFT,
        author=user,
        project=project_a,
        project_seq=1,
    )
    mtd = MeetingTypeDefinition.objects.create(
        project=project_a,
        label="Planning",
        slug="planning",
    )
    m = Meeting.objects.create(
        project=project_a,
        title="Origin mtg",
        type_definition=mtd,
        objective="o",
    )
    MeetingDecisionOrigin.objects.create(meeting=m, decision=d)

    url = f"/api/decisions/drafts/{d.id}/"
    response = client_wrong.get(url, {"project_id": project_b.id})
    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert "origin_meeting" not in response.data


@pytest.mark.django_db
def test_committed_retrieve_wrong_project_returns_404_without_origin_meeting():
    user, project_a, project_b = _setup_user_two_projects()
    client_a = _client(user, project_a)
    client_wrong = _client(user, project_b)

    create_resp = client_a.post("/api/decisions/drafts/", {"title": "Committed scope"}, format="json")
    assert create_resp.status_code == status.HTTP_201_CREATED
    decision_id = Decision.objects.get(title="Committed scope").id

    patch_payload = {
        "contextSummary": "Context summary for commit",
        "reasoning": "Reasoning for commit",
        "riskLevel": "LOW",
        "confidenceScore": 4,
        "signals": [
            {
                "metric": "ROAS",
                "movement": "SHARP_DECREASE",
                "period": "LAST_7_DAYS",
                "comparison": "PREVIOUS_PERIOD",
            }
        ],
        "options": [
            {"text": "Option A", "isSelected": True, "order": 1},
            {"text": "Option B", "isSelected": False, "order": 2},
        ],
    }
    patch_resp = client_a.patch(
        f"/api/decisions/drafts/{decision_id}/",
        patch_payload,
        format="json",
    )
    assert patch_resp.status_code == status.HTTP_200_OK
    commit_resp = client_a.post(f"/api/decisions/{decision_id}/commit/", {}, format="json")
    assert commit_resp.status_code == status.HTTP_200_OK

    mtd = MeetingTypeDefinition.objects.create(
        project=project_a,
        label="Planning",
        slug="planning-b",
    )
    m = Meeting.objects.create(
        project=project_a,
        title="Origin for committed",
        type_definition=mtd,
        objective="o",
    )
    d = Decision.objects.get(pk=decision_id)
    MeetingDecisionOrigin.objects.create(meeting=m, decision=d)

    url = f"/api/decisions/{decision_id}/"
    response = client_wrong.get(url, {"project_id": project_b.id})
    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert "origin_meeting" not in response.data


@pytest.mark.django_db
def test_draft_retrieve_matching_project_returns_origin_meeting():
    user, project_a, _ = _setup_user_two_projects()
    client = _client(user, project_a)

    d = Decision.objects.create(
        title="Draft with origin",
        status=Decision.Status.DRAFT,
        author=user,
        project=project_a,
        project_seq=1,
    )
    mtd = MeetingTypeDefinition.objects.create(
        project=project_a,
        label="Planning",
        slug="planning-c",
    )
    m = Meeting.objects.create(
        project=project_a,
        title="M",
        type_definition=mtd,
        objective="o",
    )
    MeetingDecisionOrigin.objects.create(meeting=m, decision=d)

    r = client.get(f"/api/decisions/drafts/{d.id}/", {"project_id": project_a.id})
    assert r.status_code == status.HTTP_200_OK
    assert "origin_meeting" in r.data
    assert r.data["origin_meeting"]["id"] == m.id
