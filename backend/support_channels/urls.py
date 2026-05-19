from django.urls import path
from .views import SupportChannelViewSet

channel_list = SupportChannelViewSet.as_view({'get': 'list', 'post': 'create'})
channel_detail = SupportChannelViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'delete': 'destroy'})
channel_choices = SupportChannelViewSet.as_view({'get': 'choices'})
channel_deactivate = SupportChannelViewSet.as_view({'post': 'deactivate'})
channel_activate = SupportChannelViewSet.as_view({'post': 'activate'})

urlpatterns = [
    path('channels/', channel_list, name='channel-list'),
    path('channels/choices/', channel_choices, name='channel-choices'),
    path('channels/<int:pk>/', channel_detail, name='channel-detail'),
    path('channels/<int:pk>/deactivate/', channel_deactivate, name='channel-deactivate'),
    path('channels/<int:pk>/activate/', channel_activate, name='channel-activate'),
]
