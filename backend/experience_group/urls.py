 # experience_group/urls.py
from django.urls import path
from .views import ExperienceGroupViewSet
urlpatterns = [
    path(
        'experience-groups/',
        ExperienceGroupViewSet.as_view({'get': 'list', 'post': 'create'}),
        name='experience-group-list',
    ),
    path(
        'experience-groups/<int:pk>/',
        ExperienceGroupViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'delete': 'destroy'}),
        name='experience-group-detail',
    ),
    path(
        'experience-groups/<int:pk>/publish/',
        ExperienceGroupViewSet.as_view({'post': 'publish'}),
        name='experience-group-publish',
    ),
    path(
        'experience-groups/<int:pk>/preview/',
        ExperienceGroupViewSet.as_view({'get': 'preview'}),
        name='experience-group-preview',
    ),
]