from datetime import timedelta

import pytest
from django.db import DatabaseError, connection
from django.test import RequestFactory, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from authentication.middleware import PasswordRotationMiddleware
from authentication.password_rotation import (
    PASSWORD_ROTATION_REQUIRED,
    get_password_rotation_status,
)
from core.models import AuditEvent, CustomUser, Organization, OrganizationMembership


pytestmark = pytest.mark.django_db


def make_user(email="user@example.com", **extra):
    return CustomUser.objects.create_user(
        username=email.split("@")[0],
        email=email,
        password="CurrentPassword123!",
        is_verified=True,
        **extra,
    )


@override_settings(
    PASSWORD_ROTATION_ENABLED=True,
    PASSWORD_ROTATION_MAX_AGE_DAYS=90,
    PASSWORD_ROTATION_WARNING_DAYS=7,
)
def test_elevated_user_warns_seven_days_before_expiry():
    user = make_user(is_superuser=True)
    now = timezone.now()
    user.password_last_changed_at = now - timedelta(days=83)

    status = get_password_rotation_status(user, now=now)

    assert status.elevated is True
    assert status.warning is True
    assert status.required is False
    assert status.days_until_expiry == 7


@override_settings(
    PASSWORD_ROTATION_ENABLED=True,
    PASSWORD_ROTATION_MAX_AGE_DAYS=90,
    PASSWORD_ROTATION_WARNING_DAYS=7,
)
def test_elevated_user_requires_rotation_after_policy_age():
    user = make_user(is_superuser=True)
    now = timezone.now()
    user.password_last_changed_at = now - timedelta(days=91)

    status = get_password_rotation_status(user, now=now)

    assert status.warning is False
    assert status.required is True
    assert status.days_until_expiry == 0


@override_settings(
    PASSWORD_ROTATION_ENABLED=True,
    PASSWORD_ROTATION_MAX_AGE_DAYS=9999,
    PASSWORD_ROTATION_MAX_ALLOWED_AGE_DAYS=180,
    PASSWORD_ROTATION_WARNING_DAYS=7,
)
def test_rotation_max_age_is_capped_to_customer_security_limit():
    user = make_user(is_superuser=True)
    now = timezone.now()
    user.password_last_changed_at = now - timedelta(days=181)

    status = get_password_rotation_status(user, now=now)

    assert status.max_age_days == 180
    assert status.required is True


@override_settings(
    PASSWORD_ROTATION_ENABLED=True,
    PASSWORD_ROTATION_MAX_AGE_DAYS=90,
    PASSWORD_ROTATION_WARNING_DAYS=7,
)
def test_future_password_last_changed_is_treated_as_rotation_required():
    user = make_user(is_superuser=True)
    now = timezone.now()
    user.password_last_changed_at = now + timedelta(days=365)

    status = get_password_rotation_status(user, now=now)

    assert status.required is True
    assert status.warning is False
    assert status.days_until_expiry == 0


@override_settings(
    PASSWORD_ROTATION_ENABLED=True,
    PASSWORD_ROTATION_MAX_AGE_DAYS=90,
    PASSWORD_ROTATION_WARNING_DAYS=7,
)
def test_regular_user_is_not_subject_to_elevated_rotation():
    user = make_user()
    user.password_last_changed_at = timezone.now() - timedelta(days=365)

    status = get_password_rotation_status(user)

    assert status.elevated is False
    assert status.warning is False
    assert status.required is False


@override_settings(
    PASSWORD_ROTATION_ENABLED=True,
    PASSWORD_ROTATION_MAX_AGE_DAYS=90,
    PASSWORD_ROTATION_WARNING_DAYS=7,
)
def test_org_admin_is_subject_to_password_rotation():
    organization = Organization.objects.create(name="Rotation Org", email_domain="rotation.example")
    user = make_user(email="admin@rotation.example", organization=organization, current_organization=organization)
    OrganizationMembership.objects.create(user=user, organization=organization, role="admin", is_active=True)
    user.password_last_changed_at = timezone.now() - timedelta(days=91)

    status = get_password_rotation_status(user)

    assert status.elevated is True
    assert status.required is True


@override_settings(
    PASSWORD_ROTATION_ENABLED=True,
    PASSWORD_ROTATION_MAX_AGE_DAYS=90,
    PASSWORD_ROTATION_WARNING_DAYS=7,
)
def test_middleware_blocks_expired_elevated_user_and_allows_change_password():
    user = make_user(is_superuser=True)
    user.password_last_changed_at = timezone.now() - timedelta(days=91)
    user.save(update_fields=["password_last_changed_at"])

    request = RequestFactory().get("/api/core/projects/")
    request.user = user
    middleware = PasswordRotationMiddleware(lambda req: None)

    response = middleware(request)

    assert response.status_code == 403
    assert response.headers["Content-Type"] == "application/json"
    assert PASSWORD_ROTATION_REQUIRED.encode() in response.content
    assert AuditEvent.objects.filter(
        event_type="authentication.password_rotation.enforced",
        actor=user,
        target_type="user",
        target_id=str(user.id),
    ).exists()

    client = APIClient()
    client.force_authenticate(user=user)
    change_response = client.post(
        "/auth/change-password/",
        {
            "current_password": "CurrentPassword123!",
            "new_password": "ChangedPassword123!",
        },
        format="json",
    )

    assert change_response.status_code == 200
    user.refresh_from_db()
    assert user.check_password("ChangedPassword123!")
    assert get_password_rotation_status(user).required is False
    assert AuditEvent.objects.filter(
        event_type="authentication.password_rotation.password_changed",
        actor=user,
        target_type="user",
        target_id=str(user.id),
    ).exists()


@pytest.mark.django_db(transaction=True)
def test_database_rejects_future_password_last_changed_at():
    if connection.vendor != "postgresql":
        pytest.skip("Password rotation timestamp guard is PostgreSQL-specific.")

    user = make_user(is_superuser=True)
    future = timezone.now() + timedelta(days=365)

    with pytest.raises(DatabaseError):
        with connection.cursor() as cursor:
            cursor.execute(
                "UPDATE core_customuser SET password_last_changed_at = %s WHERE id = %s",
                [future, user.id],
            )
