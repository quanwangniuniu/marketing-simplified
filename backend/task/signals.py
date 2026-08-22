import logging
import threading
from django.db.models.signals import pre_delete, pre_save, post_save, post_delete
from django.dispatch import receiver
from .models import Task, TaskAttachment, TaskFieldHistory, TaskHierarchy, TaskRelation
from .tasks import scan_task_attachment

logger = logging.getLogger(__name__)

# ── Thread-local user tracking (for field history) ────────────────────────────
_current_user = threading.local()
_deleting_task_ids = threading.local()


def set_current_user(user):
    _current_user.value = user


def get_current_user():
    return getattr(_current_user, 'value', None)


def _get_deleting_task_ids():
    ids = getattr(_deleting_task_ids, 'value', None)
    if ids is None:
        ids = set()
        _deleting_task_ids.value = ids
    return ids


def _task_is_being_deleted(task_id):
    return task_id is not None and task_id in _get_deleting_task_ids()


def _get_current_user_safe():
    """Return thread-local user only if it still exists in the current DB."""
    user = get_current_user()
    if user is not None:
        from django.contrib.auth import get_user_model
        _User = get_user_model()
        if not _User.objects.filter(pk=user.pk).exists():
            user = None
    return user


def _owner_display(user_obj):
    """Return a human-readable label for a user, or None."""
    if user_obj is None:
        return None
    return user_obj.get_full_name() or user_obj.username or user_obj.email or str(user_obj.pk)


def _field_value(old_instance, new_instance, field):
    """
    Return (old_str, new_str) for a tracked field.
    Uses the DB-fetched old_instance and the pre-save new_instance.
    FK fields are resolved to display strings here, not raw IDs.
    """
    if field == 'owner':
        # Use select_related-fetched owner on old; on instance use owner_id to
        # look up the new user without relying on the potentially stale FK cache.
        from django.contrib.auth import get_user_model
        User = get_user_model()

        old_val = _owner_display(old_instance.owner)

        new_owner_id = new_instance.__dict__.get('owner_id')  # read raw attname, no descriptor
        if new_owner_id is None:
            new_val = None
        elif old_instance.owner_id == new_owner_id:
            new_val = old_val  # unchanged — skip DB query
        else:
            try:
                new_val = _owner_display(User.objects.get(pk=new_owner_id))
            except User.DoesNotExist:
                new_val = str(new_owner_id)

        return old_val, new_val

    if field == 'tags':
        def _format_tags(value):
            if not value:
                return None
            if isinstance(value, list):
                labels = []
                for item in value:
                    if isinstance(item, dict):
                        name = str(item.get('name', '') or '').strip()
                        if name:
                            labels.append(name)
                    elif isinstance(item, str):
                        label = item.strip()
                        if label:
                            labels.append(label)
                return ', '.join(labels) if labels else None
            return str(value)

        return _format_tags(getattr(old_instance, field, None)), _format_tags(
            new_instance.__dict__.get(field, getattr(new_instance, field, None))
        )

    # Plain scalar field
    old_raw = getattr(old_instance, field, None)
    new_raw = new_instance.__dict__.get(field, getattr(new_instance, field, None))
    old_val = str(old_raw) if old_raw is not None else None
    new_val = str(new_raw) if new_raw is not None else None
    return old_val, new_val


# ── Status/anomaly caches (for notifications) ─────────────────────────────────
# The module-level dicts are a process-global fallback keyed by pk. They are
# clobbered when two threads save the same task concurrently, so the pre-save
# value is also stashed on the instance itself (per-object, thread-safe) and
# preferred when emitting. See _consume_prev_status / _consume_prev_anomaly.
_task_status_cache: dict[int, str] = {}
_task_anomaly_cache: dict[int, str] = {}


def _consume_prev_status(instance):
    """Return the pre-save status exactly once, preferring the instance-scoped
    value so concurrent saves of the same task don't emit off a clobbered cache.

    Consuming clears both the instance attribute and the module-level dict, so a
    repeated post_save for the same instance won't re-emit the same transition
    (idempotent emission).
    """
    if hasattr(instance, '_prev_status'):
        old = instance._prev_status
        del instance._prev_status
        _task_status_cache.pop(instance.pk, None)
        return old
    return _task_status_cache.pop(instance.pk, None)


def _consume_prev_anomaly(instance):
    """Anomaly-status counterpart of _consume_prev_status (idempotent, per-instance)."""
    if hasattr(instance, '_prev_anomaly'):
        old = instance._prev_anomaly
        del instance._prev_anomaly
        _task_anomaly_cache.pop(instance.pk, None)
        return old
    return _task_anomaly_cache.pop(instance.pk, None)


@receiver(pre_delete, sender=Task)
def mark_task_deleting(sender, instance, **kwargs):
    _get_deleting_task_ids().add(instance.pk)


@receiver(post_delete, sender=Task)
def unmark_task_deleting(sender, instance, **kwargs):
    _get_deleting_task_ids().discard(instance.pk)


@receiver(pre_save, sender=Task)
def _cache_previous_task_status(sender, instance, **kwargs):
    """Cache previous status and anomaly_status for notification signals.

    The value is stashed on the instance (thread-safe, per-object) and mirrored
    into the module-level dict for consumers that only hold the pk.
    """
    if not instance.pk:
        return
    try:
        prev = Task.objects.get(pk=instance.pk)
        prev_status, prev_anomaly = prev.status, prev.anomaly_status
    except Task.DoesNotExist:
        prev_status, prev_anomaly = None, None
    instance._prev_status = prev_status
    instance._prev_anomaly = prev_anomaly
    _task_status_cache[instance.pk] = prev_status
    _task_anomaly_cache[instance.pk] = prev_anomaly


@receiver(pre_save, sender=Task)
def capture_task_field_changes(
    sender,
    instance,
    update_fields=None,
    **kwargs,
):
    """
    Lock the Task row and capture this accepted save's field transitions.

    Explicitly submitted fields are retained even when their effective value
    is unchanged, allowing a rebased concurrent write such as B -> B to remain
    visible in History.
    """
    if not instance.pk:
        return

    queryset = Task.objects
    using = kwargs.get('using')
    if using:
        queryset = queryset.using(using)

    try:
        old = queryset.select_for_update().get(pk=instance.pk)
    except Task.DoesNotExist:
        return

    tracked_fields = list(TaskFieldHistory.TRACKED_FIELDS)
    explicitly_attempted_fields = set(
        getattr(
            instance,
            '_attempted_task_field_history_fields',
            (),
        )
    )

    if update_fields is not None:
        updated_names = set(update_fields)
        tracked_fields = [
            field
            for field in tracked_fields
            if (
                field in updated_names
                or Task._meta.get_field(field).attname in updated_names
            )
        ]

        explicitly_attempted_fields.update(tracked_fields)

    try:
        transitions = []

        for field in tracked_fields:
            old_val, new_val = _field_value(old, instance, field)

            if (
                old_val != new_val
                or field in explicitly_attempted_fields
            ):
                transitions.append({
                    'field_name': field,
                    'old_value': old_val,
                    'new_value': new_val,
                })

        if not transitions:
            return

        pending_batches = getattr(
            instance,
            '_pending_task_field_history_batches',
            None,
        )
        if pending_batches is None:
            pending_batches = []
            instance._pending_task_field_history_batches = pending_batches

        pending_batches.append({
            'transitions': transitions,
            'changed_by': _get_current_user_safe(),
        })
    except Exception:
        logger.exception(
            'TaskFieldHistory: failed to capture field changes for task %s',
            instance.pk,
        )
        raise


@receiver(post_save, sender=Task)
def append_task_field_changes(sender, instance, **kwargs):
    """Append exactly one captured transition batch for this completed save."""
    pending_batches = getattr(
        instance,
        '_pending_task_field_history_batches',
        None,
    )
    if not pending_batches:
        return

    # LIFO is intentional: it also handles a nested save occurring while an
    # outer save is still between pre_save and post_save.
    batch = pending_batches.pop()

    if not pending_batches:
        del instance._pending_task_field_history_batches

    try:
        TaskFieldHistory.append_transitions(
            task=instance,
            transitions=batch['transitions'],
            changed_by=batch['changed_by'],
        )
    except Exception:
        logger.exception(
            'TaskFieldHistory: failed to append field changes for task %s',
            instance.pk,
        )
        # Task.save() wraps the save and post_save signals in transaction.atomic.
        # Raising here prevents a Task write from committing without its history.
        raise


@receiver(post_save, sender=Task)
def record_task_created(sender, instance, created, **kwargs):
    """Backfill created_by and record task creation in field history."""
    if not created:
        return
    user = _get_current_user_safe()
    if user is not None and instance.created_by_id is None:
        Task.objects.filter(pk=instance.pk, created_by__isnull=True).update(created_by=user)
        instance.created_by = user
    try:
        TaskFieldHistory.objects.create(
            task=instance,
            field_name='task_created',
            old_value=None,
            new_value=None,
            changed_by=user,
        )
    except Exception:
        logger.exception('TaskFieldHistory: failed to record task_created for task %s', instance.pk)


@receiver(post_save, sender=Task)
def notify_task_owner_on_status_change(sender, instance, created, **kwargs):
    """Notify task owner when status changes."""
    if created:
        return
    if getattr(instance, '_suppress_status_notification', False):
        _consume_prev_status(instance)
        return
    old = _consume_prev_status(instance)
    if old is None or old == instance.status or not instance.owner_id:
        return
    # Skip while the owner hasn't accepted their assignment yet
    if instance.owner_invite_pending:
        return
    from notifications.models import NotificationCategory, NotificationEventType
    from notifications.services import create_notification
    from notifications.action_urls import task_action_url

    actor = _get_current_user_safe()
    actor_id = actor.pk if actor else None

    create_notification(
        recipient_id=instance.owner_id,
        actor_id=actor_id,
        category=NotificationCategory.TASKS,
        event_type=NotificationEventType.TASK_STATUS_CHANGED,
        title=f"Task status updated: {instance.summary}",
        body=f"Status changed from {old} to {instance.status}.",
        related_object_type="task",
        related_object_id=str(instance.id),
        action_url=task_action_url(instance.slug),
        metadata={
            "task_id": instance.id,
            "project_id": instance.project_id,
            "change_type": "task_status",
            "old_value": old,
            "new_value": instance.status,
            # Legacy keys kept for backward-compat with existing notifications.
            "old_status": old,
            "new_status": instance.status,
        },
    )


@receiver(post_save, sender=Task)
def notify_on_anomaly_status_change(sender, instance, created, **kwargs):
    """Fire TASK_ANOMALY when anomaly_status transitions away from NORMAL."""
    if created:
        _consume_prev_anomaly(instance)
        return
    old_anomaly = _consume_prev_anomaly(instance)
    if old_anomaly is None or old_anomaly == instance.anomaly_status:
        return
    if instance.anomaly_status in (None, "", "NORMAL"):
        return
    if not instance.owner_id:
        return

    from notifications.models import NotificationCategory, NotificationEventType  # noqa: PLC0415
    from notifications.services import create_notification  # noqa: PLC0415
    from notifications.action_urls import task_action_url  # noqa: PLC0415

    create_notification(
        recipient_id=instance.owner_id,
        actor_id=None,
        category=NotificationCategory.TASKS,
        event_type=NotificationEventType.TASK_ANOMALY,
        title=f"Anomaly detected on task: {instance.summary}",
        body=f"Task anomaly status changed to {instance.anomaly_status}.",
        related_object_type="task",
        related_object_id=str(instance.id),
        action_url=task_action_url(instance.slug),
        metadata={
            "task_id": instance.id,
            "project_id": instance.project_id,
            "change_type": "task_anomaly",
            "old_value": old_anomaly or "NORMAL",
            "new_value": instance.anomaly_status,
        },
    )


@receiver(post_save, sender=TaskAttachment)
def trigger_virus_scan(sender, instance, created, **kwargs):
    """
    Trigger virus scan when a new task attachment is uploaded
    """
    if created and instance.scan_status == TaskAttachment.PENDING:
        scan_task_attachment.delay(instance.id)


@receiver(post_save, sender=TaskAttachment)
def record_attachment_added(sender, instance, created, **kwargs):
    if not created:
        return
    filename = instance.original_filename or (instance.file.name if instance.file else None)
    if not filename:
        return
    user = _get_current_user_safe()
    try:
        TaskFieldHistory.objects.create(
            task_id=instance.task_id,
            field_name='attachment_added',
            old_value=None,
            new_value=filename,
            changed_by=user,
        )
    except Exception:
        logger.exception('TaskFieldHistory: failed to record attachment_added for task %s', instance.task_id)


@receiver(post_delete, sender=TaskAttachment)
def record_attachment_removed(sender, instance, **kwargs):
    filename = instance.original_filename or (instance.file.name if instance.file else None)
    if not filename:
        return
    if _task_is_being_deleted(instance.task_id) or not Task.objects.filter(pk=instance.task_id).exists():
        return
    user = _get_current_user_safe()
    try:
        TaskFieldHistory.objects.create(
            task_id=instance.task_id,
            field_name='attachment_removed',
            old_value=filename,
            new_value=None,
            changed_by=user,
        )
    except Exception:
        logger.exception('TaskFieldHistory: failed to record attachment_removed for task %s', instance.task_id)


@receiver(post_save, sender=TaskHierarchy)
def record_subtask_added(sender, instance, created, **kwargs):
    if not created:
        return
    user = _get_current_user_safe()
    try:
        child_summary = Task.objects.filter(pk=instance.child_task_id).values_list('summary', flat=True).first()
        TaskFieldHistory.objects.create(
            task_id=instance.parent_task_id,
            field_name='subtask_added',
            old_value=None,
            new_value=child_summary,
            changed_by=user,
        )
    except Exception:
        logger.exception('TaskFieldHistory: failed to record subtask_added for task %s', instance.parent_task_id)


@receiver(post_delete, sender=TaskHierarchy)
def handle_subtask_orphan_check(sender, instance, **kwargs):
    """
    When a TaskHierarchy record is deleted, check if the child_task
    has any remaining parent tasks. If not, delete the orphaned subtask.

    This handles the case when a parent task is deleted (CASCADE deletes
    the TaskHierarchy record). When all parent tasks are deleted, the
    orphaned subtask is automatically deleted.
    """
    child_task_id = instance.child_task_id

    try:
        child_task = Task.objects.get(id=child_task_id)
    except Task.DoesNotExist:
        return

    remaining_parents = TaskHierarchy.objects.filter(child_task=child_task)

    # Record history on parent task only if it still exists (explicit unlink, not cascade)
    if (
        not _task_is_being_deleted(instance.parent_task_id) and
        Task.objects.filter(pk=instance.parent_task_id).exists()
    ):
        user = _get_current_user_safe()
        try:
            TaskFieldHistory.objects.create(
                task_id=instance.parent_task_id,
                field_name='subtask_removed',
                old_value=child_task.summary,
                new_value=None,
                changed_by=user,
            )
        except Exception:
            logger.exception('TaskFieldHistory: failed to record subtask_removed for task %s', instance.parent_task_id)

    if not remaining_parents.exists() and child_task.is_subtask:
        # No remaining parents and still marked as subtask → parent was cascade-deleted;
        # delete the now-orphaned subtask.  If is_subtask is already False the unlink
        # view cleared it intentionally, so we leave the task alone.
        child_task.delete()


@receiver(post_save, sender=TaskRelation)
def record_relation_added(sender, instance, created, **kwargs):
    if not created:
        return
    user = _get_current_user_safe()
    rel_type = instance.relationship_type
    try:
        source_summary = Task.objects.filter(pk=instance.source_task_id).values_list('summary', flat=True).first()
        target_summary = Task.objects.filter(pk=instance.target_task_id).values_list('summary', flat=True).first()
        records = []
        if instance.source_task_id:
            records.append(TaskFieldHistory(
                task_id=instance.source_task_id,
                field_name=f'relation_{rel_type}_added',
                old_value=None,
                new_value=target_summary,
                changed_by=user,
            ))
        if instance.target_task_id:
            records.append(TaskFieldHistory(
                task_id=instance.target_task_id,
                field_name=f'relation_{rel_type}_added',
                old_value=None,
                new_value=source_summary,
                changed_by=user,
            ))
        if records:
            TaskFieldHistory.objects.bulk_create(records)
    except Exception:
        logger.exception('TaskFieldHistory: failed to record relation_added for TaskRelation %s', instance.pk)


@receiver(post_delete, sender=TaskRelation)
def record_relation_removed(sender, instance, **kwargs):
    user = _get_current_user_safe()
    rel_type = instance.relationship_type
    try:
        source_exists = (
            instance.source_task_id is not None and
            not _task_is_being_deleted(instance.source_task_id) and
            Task.objects.filter(pk=instance.source_task_id).exists()
        )
        target_exists = (
            instance.target_task_id is not None and
            not _task_is_being_deleted(instance.target_task_id) and
            Task.objects.filter(pk=instance.target_task_id).exists()
        )
        source_summary = Task.objects.filter(pk=instance.source_task_id).values_list('summary', flat=True).first()
        target_summary = Task.objects.filter(pk=instance.target_task_id).values_list('summary', flat=True).first()
        records = []
        if source_exists:
            records.append(TaskFieldHistory(
                task_id=instance.source_task_id,
                field_name=f'relation_{rel_type}_removed',
                old_value=target_summary,
                new_value=None,
                changed_by=user,
            ))
        if target_exists:
            records.append(TaskFieldHistory(
                task_id=instance.target_task_id,
                field_name=f'relation_{rel_type}_removed',
                old_value=source_summary,
                new_value=None,
                changed_by=user,
            ))
        if records:
            TaskFieldHistory.objects.bulk_create(records)
    except Exception:
        logger.exception('TaskFieldHistory: failed to record relation_removed for TaskRelation %s', instance.pk)


# ── Agent Workflow Triggers ───────────────────────────────────────────────────

@receiver(post_save, sender=Task)
def trigger_instant_workflows_on_task_change(sender, instance, created, **kwargs):
    """
    Trigger instant agent workflows when a task is created or its status changes.
    """
    try:
        from agent.trigger_handlers import InstantHandler

        if created:
            # Task created event
            InstantHandler.handle_internal_event('task.created', {
                'task_id': instance.id,
                'project_id': instance.project_id,
                'status': instance.status,
                'summary': instance.summary,
            })
            logger.info(f"Triggered instant workflows for task creation: {instance.id}")
        else:
            # Task status changed event
            old_status = _task_status_cache.get(instance.pk)
            if old_status and old_status != instance.status:
                InstantHandler.handle_internal_event('task.status_changed', {
                    'task_id': instance.id,
                    'project_id': instance.project_id,
                    'old_status': old_status,
                    'new_status': instance.status,
                    'summary': instance.summary,
                })
                logger.info(f"Triggered instant workflows for task status change: {instance.id}")
    except Exception:
        logger.exception(f"Error triggering workflows for task {instance.id}")
