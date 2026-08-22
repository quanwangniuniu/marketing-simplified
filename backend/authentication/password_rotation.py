from __future__ import annotations

from dataclasses import dataclass

from django.conf import settings
from django.utils import timezone


PASSWORD_ROTATION_REQUIRED = "PASSWORD_ROTATION_REQUIRED"
PASSWORD_ROTATION_WARNING = "PASSWORD_ROTATION_WARNING"
PASSWORD_ROTATION_MAX_ALLOWED_AGE_DAYS = 180


@dataclass(frozen=True)
class PasswordRotationStatus:
    required: bool
    warning: bool
    elevated: bool
    expires_at: object | None
    days_until_expiry: int | None
    max_age_days: int
    warning_days: int

    def as_dict(self) -> dict:
        return {
            "required": self.required,
            "warning": self.warning,
            "elevated": self.elevated,
            "expires_at": self.expires_at,
            "days_until_expiry": self.days_until_expiry,
            "max_age_days": self.max_age_days,
            "warning_days": self.warning_days,
        }


def password_rotation_enabled() -> bool:
    return bool(getattr(settings, "PASSWORD_ROTATION_ENABLED", True))


def password_rotation_max_age_days() -> int:
    configured = int(getattr(settings, "PASSWORD_ROTATION_MAX_AGE_DAYS", 90))
    allowed = int(getattr(settings, "PASSWORD_ROTATION_MAX_ALLOWED_AGE_DAYS", PASSWORD_ROTATION_MAX_ALLOWED_AGE_DAYS))
    return min(configured, allowed)


def password_rotation_warning_days() -> int:
    configured = int(getattr(settings, "PASSWORD_ROTATION_WARNING_DAYS", 7))
    return min(configured, password_rotation_max_age_days())


def is_elevated_user(user) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "is_superuser", False):
        return True
    try:
        from core.admin_utils import is_org_admin

        return is_org_admin(user)
    except Exception:
        return False


def get_password_rotation_status(user, now=None) -> PasswordRotationStatus:
    now = now or timezone.now()
    max_age_days = password_rotation_max_age_days()
    warning_days = password_rotation_warning_days()
    elevated = is_elevated_user(user)

    if not password_rotation_enabled() or not elevated:
        return PasswordRotationStatus(
            required=False,
            warning=False,
            elevated=elevated,
            expires_at=None,
            days_until_expiry=None,
            max_age_days=max_age_days,
            warning_days=warning_days,
        )

    last_changed = getattr(user, "password_last_changed_at", None)
    if last_changed is None:
        return PasswordRotationStatus(
            required=True,
            warning=False,
            elevated=True,
            expires_at=None,
            days_until_expiry=0,
            max_age_days=max_age_days,
            warning_days=warning_days,
        )
    if last_changed > now:
        return PasswordRotationStatus(
            required=True,
            warning=False,
            elevated=True,
            expires_at=now,
            days_until_expiry=0,
            max_age_days=max_age_days,
            warning_days=warning_days,
        )

    expires_at = last_changed + timezone.timedelta(days=max_age_days)
    remaining = expires_at - now
    required = remaining.total_seconds() <= 0
    days_until_expiry = max(0, remaining.days)
    warning = not required and remaining <= timezone.timedelta(days=warning_days)

    return PasswordRotationStatus(
        required=required,
        warning=warning,
        elevated=True,
        expires_at=expires_at,
        days_until_expiry=days_until_expiry,
        max_age_days=max_age_days,
        warning_days=warning_days,
    )


def password_rotation_response_payload(user) -> dict:
    status = get_password_rotation_status(user)
    return {
        "error": "Password rotation required.",
        "errorCode": PASSWORD_ROTATION_REQUIRED,
        "password_rotation": status.as_dict(),
    }
