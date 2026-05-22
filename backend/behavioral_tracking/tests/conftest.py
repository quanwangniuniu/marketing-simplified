"""
Self-contained fixtures for behavioral_tracking tests.

(Using pytest_plugins to pull core.tests.conftest does not reliably register
fixtures when only this app's tests are collected.)
"""

import os
import uuid

import django
import pytest
from django.conf import settings

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
if not settings.configured:
    django.setup()

from django.contrib.auth import get_user_model

from core.models import Organization, Project, ProjectMember
from task.models import Task

User = get_user_model()


@pytest.fixture
@pytest.mark.django_db
def organization():
    suffix = uuid.uuid4().hex[:10]
    return Organization.objects.create(
        name=f"BT Test Organization {suffix}",
        email_domain=f"bt-{suffix}.test",
    )


@pytest.fixture
@pytest.mark.django_db
def user(organization):
    suffix = uuid.uuid4().hex[:10]
    return User.objects.create_user(
        username=f"bt_user_{suffix}",
        email=f"bt_{suffix}@test.com",
        password="testpass123",
        organization=organization,
    )


@pytest.fixture
@pytest.mark.django_db
def project(organization, user):
    suffix = uuid.uuid4().hex[:10]
    project = Project.objects.create(
        name=f"BT Test Project {suffix}",
        organization=organization,
        owner=user,
        objectives=["awareness"],
        kpis={"ctr": {"target": 0.02}},
    )
    ProjectMember.objects.create(
        user=user,
        project=project,
        role="owner",
        is_active=True,
    )
    return project


@pytest.fixture
@pytest.mark.django_db
def task(project, user):
    return Task.objects.create(
        summary="Behavioral tracking test task",
        project=project,
        owner=user,
        type="execution",
    )
