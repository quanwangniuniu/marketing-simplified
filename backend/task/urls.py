from django.urls import path
from task.views import TaskViewSet, TaskCommentListView, TaskAttachmentListView, TaskAttachmentDetailView, TaskAttachmentDownloadView, get_task_types, TaskFormAutosaveView

urlpatterns = [
    # Task types endpoint
    path('task-types/', get_task_types, name='task-types'),

    # Task form autosave endpoint
    path('task-form-autosave/', TaskFormAutosaveView.as_view(), name='task-form-autosave'),
    
    # Task CRUD endpoints (static paths like gantt before generic tasks/ if ever ambiguous)
    path('tasks/gantt/', TaskViewSet.as_view({'get': 'gantt'}), name='task-gantt'),
    path('tasks/intelligence/', TaskViewSet.as_view({'get': 'intelligence'}), name='task-intelligence'),
    path('tasks/work-cycle/', TaskViewSet.as_view({'get': 'work_cycle'}), name='task-work-cycle'),
    path('tasks/my-actions/', TaskViewSet.as_view({'get': 'my_actions'}), name='task-my-actions'),
    path('tasks/status-report/', TaskViewSet.as_view({'get': 'status_report'}), name='task-status-report'),
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
    path('tasks/<int:pk>/track-interaction/', TaskViewSet.as_view({'post': 'track_interaction'}), name='task-track-interaction'),
    path('tasks/<int:pk>/collaboration-events/', TaskViewSet.as_view({'get': 'collaboration_events'}), name='task-collaboration-events'),
    path('tasks/<int:pk>/collaboration-metrics/', TaskViewSet.as_view({'get': 'collaboration_metrics'}), name='task-collaboration-metrics'),
    path('tasks/<int:pk>/revise/', TaskViewSet.as_view({'post': 'revise'}), name='task-revise'),
    path('tasks/<int:pk>/forward/', TaskViewSet.as_view({'post': 'forward'}), name='task-forward'),
    path('tasks/<int:pk>/mention-users/', TaskViewSet.as_view({'get': 'mention_users'}), name='task-mention-users'),
    path('tasks/<int:pk>/submit/', TaskViewSet.as_view({'post': 'submit_task'}), name='task-submit'),
    path('tasks/<int:pk>/start-review/', TaskViewSet.as_view({'post': 'start_review'}), name='task-start-review'),
    path('tasks/<int:pk>/lock/', TaskViewSet.as_view({'post': 'lock'}), name='task-lock'),
    path('tasks/<int:pk>/unlock/', TaskViewSet.as_view({'post': 'unlock'}), name='task-unlock'),
    path('tasks/<int:pk>/pin/', TaskViewSet.as_view({'post': 'pin', 'delete': 'unpin'}), name='task-pin'),
    
    # Task subtasks endpoints
    path('tasks/<int:pk>/subtasks/', TaskViewSet.as_view({'get': 'subtasks', 'post': 'subtasks'}), name='task-subtasks'),
    path('tasks/<int:pk>/subtasks/<int:subtask_id>/', TaskViewSet.as_view({'delete': 'subtask_detail'}), name='task-subtask-detail'),
    
    # Task relations endpoints
    path('tasks/<int:pk>/relations/', TaskViewSet.as_view({'get': 'relations', 'post': 'relations'}), name='task-relations'),
    path('tasks/<int:pk>/relations/<int:relation_id>/', TaskViewSet.as_view({'delete': 'relation_detail'}), name='task-relation-detail'),

    # Task field history
    path('tasks/<int:pk>/field-history/', TaskViewSet.as_view({'get': 'field_history'}), name='task-field-history'),

    # Task comments (task-level, all types)
    path('tasks/<int:task_id>/comments/', TaskCommentListView.as_view(), name='task-comment-list'),
    
    # Task attachments (task-level, all types)
    path('tasks/<int:task_id>/attachments/', TaskAttachmentListView.as_view(), name='task-attachment-list'),
    path('tasks/<int:task_id>/attachments/<int:pk>/', TaskAttachmentDetailView.as_view(), name='task-attachment-detail'),
    path('tasks/<int:task_id>/attachments/<int:pk>/download/', TaskAttachmentDownloadView.as_view(), name='task-attachment-download'),
]
