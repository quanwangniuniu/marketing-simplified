from django.urls import path
from . import views

urlpatterns = [
    # BudgetRequest CRUD endpoints
    path('requests/', views.BudgetRequestViewSet.as_view({'get': 'list', 'post': 'create'}), name='budget-request-list'),
    path('requests/<int:pk>/', views.BudgetRequestViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'delete': 'destroy'}), name='budget-request-detail'),

    # BudgetRequest action endpoints
    path('requests/<int:pk>/start-review/', views.BudgetRequestViewSet.as_view({'post': 'start_review'}), name='budget-request-start-review'),

    # BudgetPool CRUD endpoints
    path('pools/', views.BudgetPoolViewSet.as_view({'get': 'list', 'post': 'create'}), name='budget-pool-list'),
    path('pools/<int:pk>/', views.BudgetPoolViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'delete': 'destroy'}), name='budget-pool-detail'),

    # AdChannel endpoints
    path('ad-channels/', views.AdChannelViewSet.as_view({'get': 'list', 'post': 'create'}), name='ad-channel-list'),

    # Custom endpoints
    path('requests/<int:pk>/decision/', views.BudgetRequestDecisionView.as_view(), name='budget-request-decision'),
    path('escalate/', views.BudgetEscalationView.as_view(), name='budget-escalation'),
] 