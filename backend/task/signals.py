import logging
import threading
from django.db.models.signals import pre_delete, pre_save, post_save, post_delete
from django.dispatch import receiver
from .models import Task, TaskAttachment, TaskFieldHistory, TaskHierarchy, TaskRelation
from .tasks import scan_task_attachment

logger = logging.getLogger(__name__)

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

    # Plain scalar field
    old_raw = getattr(old_instance, field, None)
    new_raw = new_instance.__dict__.get(field, getattr(new_instance, field, None))
    old_val = str(old_raw) if old_raw is not None else None
    new_val = str(new_raw) if new_raw is not None else None
    return old_val, new_val


@receiver(pre_delete, sender=Task)
def mark_task_deleting(sender, instance, **kwargs):
    _get_deleting_task_ids().add(instance.pk)


@receiver(post_delete, sender=Task)
def unmark_task_deleting(sender, instance, **kwargs):
    _get_deleting_task_ids().discard(instance.pk)


@receiver(post_save, sender=Task)
def record_task_created(sender, instance, created, **kwargs):
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


@receiver(pre_save, sender=Task)
def record_task_field_changes(sender, instance, **kwargs):
    if not instance.pk:
        return
    try:
        old = Task.objects.select_related('owner').get(pk=instance.pk)
    except Task.DoesNotExist:
        return

    user = _get_current_user_safe()
    records = []
    try:
        for field in TaskFieldHistory.TRACKED_FIELDS:
            old_val, new_val = _field_value(old, instance, field)
            if old_val != new_val:
                records.append(TaskFieldHistory(
                    task=instance,
                    field_name=field,
                    old_value=old_val,
                    new_value=new_val,
                    changed_by=user,
                ))
        if records:
            TaskFieldHistory.objects.bulk_create(records)
    except Exception:
        logger.exception('TaskFieldHistory: failed to record field changes for task %s', instance.pk)


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
