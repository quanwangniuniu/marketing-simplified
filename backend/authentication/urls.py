# authentication/urls.py
from django.urls import path
from .views import (
    RegisterView, 
    VerifyEmailView, 
    LoginView, 
    SsoRedirectView,
    SsoCallbackView,
    GoogleOAuthStartView, 
    GoogleOAuthCallbackView, 
    GoogleSetPasswordView,
    OrganizationTokenRefreshView,
    MeView, 
    UserTeamsView,
    ForgotPasswordView,
    ResetPasswordView,
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('verify/', VerifyEmailView.as_view(), name='verify'),
    path('login/', LoginView.as_view(), name='login'),
    path('organization-token/refresh/', OrganizationTokenRefreshView.as_view(), name='organization-token-refresh'),
    path('me/', MeView.as_view(), name='me'),
    path('me/teams/', UserTeamsView.as_view(), name='user-teams'),
    
    # SSO endpoints (mock implementation for testing)
    path('sso/redirect/', SsoRedirectView.as_view(), name='sso-redirect'),
    path('sso/callback/', SsoCallbackView.as_view(), name='sso-callback'),
    
    # Google OAuth endpoints
    path('google/start/', GoogleOAuthStartView.as_view(), name='google-oauth-start'),
    path('google/callback/', GoogleOAuthCallbackView.as_view(), name='google-oauth-callback'),
    path('google/set-password/', GoogleSetPasswordView.as_view(), name='google-set-password'),

    # Password reset endpoints
    path('forgot-password/', ForgotPasswordView.as_view(), name='forgot-password'),
    path('reset-password/', ResetPasswordView.as_view(), name='reset-password'),
]