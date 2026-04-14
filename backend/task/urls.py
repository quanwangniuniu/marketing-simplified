from django.urls import path
from task.views import (
    TaskViewSet, TaskCommentListView, TaskCommentDetailView,
    TaskCommentAttachmentListView, TaskCommentAttachmentDetailView,
    TaskAttachmentListView, TaskAttachmentDetailView, TaskAttachmentDownloadView,
    get_task_types,
)

urlpatterns = [
    # Task types endpoint
    path('task-types/', get_task_types, name='task-types'),
    
    # Task CRUD endpoints
    path('tasks/', TaskViewSet.as_view({'get': 'list', 'post': 'create'}), name='task-list'),
    path('tasks/bulk_action/', TaskViewSet.as_view({'post': 'bulk_action'}), name='task-bulk-action'),
    path('tasks/force-create/', TaskViewSet.as_view({'post': 'force_create'}), name='task-force-create'),
    path('tasks/<int:pk>/', TaskViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'delete': 'destroy'}), name='task-detail'),
    path('tasks/<int:pk>/origins/', TaskViewSet.as_view({'get': 'meeting_origins'}), name='task-origins'),
    
    # Task action endpoints
    path('tasks/<int:pk>/link/', TaskViewSet.as_view({'post': 'link'}), name='task-link'),
    path('tasks/<int:pk>/make-approval/', TaskViewSet.as_view({'post': 'make_approval'}), name='task-make-approval'),
    path('tasks/<int:pk>/cancel/', TaskViewSet.as_view({'post': 'cancel'}), name='task-cancel'),
    path('tasks/<int:pk>/approval-history/', TaskViewSet.as_view({'get': 'approval_history'}), name='task-approval-history'),
    path('tasks/<int:pk>/revise/', TaskViewSet.as_view({'post': 'revise'}), name='task-revise'),
    path('tasks/<int:pk>/forward/', TaskViewSet.as_view({'post': 'forward'}), name='task-forward'),
    path('tasks/<int:pk>/submit/', TaskViewSet.as_view({'post': 'submit_task'}), name='task-submit'),
    path('tasks/<int:pk>/start-review/', TaskViewSet.as_view({'post': 'start_review'}), name='task-start-review'),
    path('tasks/<int:pk>/lock/', TaskViewSet.as_view({'post': 'lock'}), name='task-lock'),
    path('tasks/<int:pk>/unlock/', TaskViewSet.as_view({'post': 'unlock'}), name='task-unlock'),
    
    # Task subtasks endpoints
    path('tasks/<int:pk>/subtasks/', TaskViewSet.as_view({'get': 'subtasks', 'post': 'subtasks'}), name='task-subtasks'),
    path('tasks/<int:pk>/subtasks/<int:subtask_id>/', TaskViewSet.as_view({'delete': 'subtask_detail'}), name='task-subtask-detail'),
    
    # Task relations endpoints
    path('tasks/<int:pk>/relations/', TaskViewSet.as_view({'get': 'relations', 'post': 'relations'}), name='task-relations'),
    path('tasks/<int:pk>/relations/<int:relation_id>/', TaskViewSet.as_view({'delete': 'relation_detail'}), name='task-relation-detail'),

    # Task comments (task-level, all types)
    path('tasks/<int:task_id>/comments/', TaskCommentListView.as_view(), name='task-comment-list'),
    path('tasks/<int:task_id>/comments/<int:comment_id>/', TaskCommentDetailView.as_view(), name='task-comment-detail'),

    # Comment attachments
    path('tasks/<int:task_id>/comments/<int:comment_id>/attachments/', TaskCommentAttachmentListView.as_view(), name='task-comment-attachment-list'),
    path('tasks/<int:task_id>/comments/<int:comment_id>/attachments/<int:attachment_id>/', TaskCommentAttachmentDetailView.as_view(), name='task-comment-attachment-detail'),

    # Task attachments (task-level, all types)
    path('tasks/<int:task_id>/attachments/', TaskAttachmentListView.as_view(), name='task-attachment-list'),
    path('tasks/<int:task_id>/attachments/<int:pk>/', TaskAttachmentDetailView.as_view(), name='task-attachment-detail'),
    path('tasks/<int:task_id>/attachments/<int:pk>/download/', TaskAttachmentDownloadView.as_view(), name='task-attachment-download'),
]

