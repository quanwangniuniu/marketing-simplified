from django.urls import path
from .views import CustomerViewSet

customers_list = CustomerViewSet.as_view({'get': 'list', 'post': 'create'})
customers_detail = CustomerViewSet.as_view({
    'get': 'retrieve',
    'patch': 'partial_update',
    'delete': 'destroy',
})

urlpatterns = [
    path('customers/', customers_list, name='customer-list'),
    path('customers/<int:pk>/', customers_detail, name='customer-detail'),
]
