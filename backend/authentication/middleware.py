from django.http import JsonResponse

from authentication.password_rotation import (
    PASSWORD_ROTATION_REQUIRED,
    get_password_rotation_status,
    password_rotation_response_payload,
)


class PasswordRotationMiddleware:
    """Warn/enforce password rotation for elevated users."""

    EXEMPT_PREFIXES = (
        "/auth/login/",
        "/auth/logout/",
        "/auth/token/refresh/",
        "/auth/organization-token/refresh/",
        "/auth/me/",
        "/auth/change-password/",
        "/auth/google/set-password/",
        "/auth/reset-password/",
        "/auth/forgot-password/",
        "/health/",
        "/metrics",
        "/admin/",
        "/static/",
        "/media/",
    )

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if self._is_exempt(request.path):
            return self.get_response(request)

        user = getattr(request, "user", None)
        if user and getattr(user, "is_authenticated", False):
            status = get_password_rotation_status(user)
            if status.required:
                from core.services.audit_events import safe_emit_audit_event

                safe_emit_audit_event(
                    event_type="authentication.password_rotation.enforced",
                    actor=user,
                    organization=getattr(user, "current_organization", None),
                    project=getattr(user, "active_project", None),
                    target_type="user",
                    target_id=getattr(user, "id", ""),
                    after=status.as_dict(),
                    context={"reason": "password_rotation_required"},
                    request=request,
                )
                return JsonResponse(
                    password_rotation_response_payload(user),
                    status=403,
                )

        response = self.get_response(request)
        if user and getattr(user, "is_authenticated", False):
            status = get_password_rotation_status(user)
            if status.warning:
                response["X-Password-Rotation-Warning"] = PASSWORD_ROTATION_REQUIRED
        return response

    def _is_exempt(self, path: str) -> bool:
        return any(path.startswith(prefix) for prefix in self.EXEMPT_PREFIXES)
