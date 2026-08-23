from rest_framework_simplejwt.tokens import RefreshToken


def build_user_refresh_token(user):
    refresh = RefreshToken.for_user(user)
    refresh["auth_token_version"] = getattr(user, "auth_token_version", 0)
    return refresh
