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
    path('tasks/tag-catalog/', TaskViewSet.as_view({'get': 'tag_catalog', 'delete': 'delete_tag'}), name='task-tag-catalog'),
    path('tasks/tag-catalog/delete/', TaskViewSet.as_view({'post': 'delete_tag'}), name='task-tag-catalog-delete'),
    path('tasks/work-cycle/', TaskViewSet.as_view({'get': 'work_cycle'}), name='task-work-cycle'),
    path('tasks/my-actions/', TaskViewSet.as_view({'get': 'my_actions'}), name='task-my-actions'),
    path('tasks/status-report/', TaskViewSet.as_view({'get': 'status_report'}), name='task-status-report'),
    path('tasks/', TaskViewSet.as_view({'get': 'list', 'post': 'create'}), name='task-list'),
    path('tasks/bulk_action/', TaskViewSet.as_view({'post': 'bulk_action'}), name='task-bulk-action'),
    path('tasks/force-create/', TaskViewSet.as_view({'post': 'force_create'}), name='task-force-create'),
    path('tasks/<str:pk>/', TaskViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'delete': 'destroy'}), name='task-detail'),
    path('tasks/<str:pk>/origins/', TaskViewSet.as_view({'get': 'meeting_origins'}), name='task-origins'),
    
    # Task action endpoints
    path('tasks/<str:pk>/link/', TaskViewSet.as_view({'post': 'link'}), name='task-link'),
    path('tasks/<str:pk>/make-approval/', TaskViewSet.as_view({'post': 'make_approval'}), name='task-make-approval'),
    path('tasks/<str:pk>/cancel/', TaskViewSet.as_view({'post': 'cancel'}), name='task-cancel'),
    path('tasks/<str:pk>/approval-history/', TaskViewSet.as_view({'get': 'approval_history'}), name='task-approval-history'),
    path('tasks/<str:pk>/revise/', TaskViewSet.as_view({'post': 'revise'}), name='task-revise'),
    path('tasks/<str:pk>/forward/', TaskViewSet.as_view({'post': 'forward'}), name='task-forward'),
    path('tasks/<str:pk>/submit/', TaskViewSet.as_view({'post': 'submit_task'}), name='task-submit'),
    path('tasks/<str:pk>/start-review/', TaskViewSet.as_view({'post': 'start_review'}), name='task-start-review'),
    path('tasks/<str:pk>/lock/', TaskViewSet.as_view({'post': 'lock'}), name='task-lock'),
    path('tasks/<str:pk>/unlock/', TaskViewSet.as_view({'post': 'unlock'}), name='task-unlock'),
    path('tasks/<str:pk>/pin/', TaskViewSet.as_view({'post': 'pin', 'delete': 'unpin'}), name='task-pin'),
    
    # Task subtasks endpoints
    path('tasks/<str:pk>/subtasks/', TaskViewSet.as_view({'get': 'subtasks', 'post': 'subtasks'}), name='task-subtasks'),
    path('tasks/<str:pk>/subtasks/<str:subtask_id>/', TaskViewSet.as_view({'delete': 'subtask_detail'}), name='task-subtask-detail'),
    path('tasks/<str:pk>/subtasks/<str:subtask_id>/move/', TaskViewSet.as_view({'post': 'move_subtask'}), name='task-move-subtask'),
    
    # Task relations endpoints
    path('tasks/<str:pk>/relations/', TaskViewSet.as_view({'get': 'relations', 'post': 'relations'}), name='task-relations'),
    path('tasks/<str:pk>/relations/<int:relation_id>/', TaskViewSet.as_view({'delete': 'relation_detail'}), name='task-relation-detail'),

    # Task field history
    path('tasks/<str:pk>/field-history/', TaskViewSet.as_view({'get': 'field_history'}), name='task-field-history'),

    # Task comments (task-level, all types)
    path('tasks/<str:task_id>/comments/', TaskCommentListView.as_view(), name='task-comment-list'),
    
    # Task attachments (task-level, all types)
    path('tasks/<str:task_id>/attachments/', TaskAttachmentListView.as_view(), name='task-attachment-list'),
    path('tasks/<str:task_id>/attachments/<int:pk>/', TaskAttachmentDetailView.as_view(), name='task-attachment-detail'),
    path('tasks/<str:task_id>/attachments/<int:pk>/download/', TaskAttachmentDownloadView.as_view(), name='task-attachment-download'),
]
