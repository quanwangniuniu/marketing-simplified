"""Connect Django model signals to Kafka Celery publish tasks."""

from __future__ import annotations

from django.apps import apps
from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

from core.messaging.enqueue import build_payload, schedule_kafka_event
from core.messaging.registry import DOMAIN_CONFIGS, DomainConfig


def _capture_fields(instance, model, fields: tuple[str, ...]) -> None:
    if not instance.pk:
        for field in fields:
            setattr(instance, f'_kafka_prev_{field}', None)
        return
    previous = model.objects.filter(pk=instance.pk).values(*fields).first()
    for field in fields:
        setattr(instance, f'_kafka_prev_{field}', previous[field] if previous else None)


def _prev(instance, field: str):
    return getattr(instance, f'_kafka_prev_{field}', None)


def _connect_pre_save(config: DomainConfig, fields: tuple[str, ...]):
    model = apps.get_model(config.model_label)

    @receiver(pre_save, sender=model)
    def _capture_previous_state(sender, instance, **kwargs):
        _capture_fields(instance, sender, fields)


def _connect_post_save_crud_status_soft_delete(domain_key: str, config: DomainConfig):
    model = apps.get_model(config.model_label)
    status_field = config.status_field

    @receiver(post_save, sender=model)
    def _enqueue(sender, instance, created, **kwargs):
        entity_id = getattr(instance, config.id_field)

        if created:
            schedule_kafka_event(domain_key, 'created', entity_id)
            return

        prev_deleted = _prev(instance, 'is_deleted')
        prev_status = _prev(instance, status_field)

        if instance.is_deleted and not prev_deleted:
            schedule_kafka_event(domain_key, 'deleted', entity_id)
        elif prev_status is not None and prev_status != getattr(instance, status_field):
            schedule_kafka_event(domain_key, 'status_changed', entity_id)
        else:
            schedule_kafka_event(domain_key, 'updated', entity_id)


def _connect_post_save_crud_status(domain_key: str, config: DomainConfig):
    model = apps.get_model(config.model_label)
    status_field = config.status_field

    @receiver(post_save, sender=model)
    def _enqueue(sender, instance, created, **kwargs):
        entity_id = getattr(instance, config.id_field)

        if created:
            schedule_kafka_event(domain_key, 'created', entity_id)
            return

        prev_status = _prev(instance, status_field)
        if prev_status is not None and prev_status != getattr(instance, status_field):
            schedule_kafka_event(domain_key, 'status_changed', entity_id)
        else:
            schedule_kafka_event(domain_key, 'updated', entity_id)


def _connect_post_delete_hard_delete(domain_key: str, config: DomainConfig):
    model = apps.get_model(config.model_label)

    @receiver(post_delete, sender=model)
    def _enqueue_deleted(sender, instance, **kwargs):
        entity_id = getattr(instance, config.id_field)
        payload = build_payload(domain_key, instance, 'deleted')
        schedule_kafka_event(domain_key, 'deleted', entity_id, payload)


def _connect_post_save_project_soft_delete(domain_key: str, config: DomainConfig):
    model = apps.get_model(config.model_label)

    @receiver(post_save, sender=model)
    def _enqueue(sender, instance, created, **kwargs):
        entity_id = getattr(instance, config.id_field)

        if created:
            schedule_kafka_event(domain_key, 'created', entity_id)
            return

        prev_deleted = _prev(instance, 'is_deleted')
        if instance.is_deleted and not prev_deleted:
            schedule_kafka_event(domain_key, 'deleted', entity_id)
        else:
            schedule_kafka_event(domain_key, 'updated', entity_id)


def _connect_post_save_retrospective(domain_key: str, config: DomainConfig):
    from retrospective.models import RetrospectiveStatus

    model = apps.get_model(config.model_label)
    status_field = config.status_field

    @receiver(post_save, sender=model)
    def _enqueue(sender, instance, created, **kwargs):
        entity_id = getattr(instance, config.id_field)

        if created:
            schedule_kafka_event(domain_key, 'created', entity_id)
            return

        prev_status = _prev(instance, status_field)
        current_status = getattr(instance, status_field)
        if (
            prev_status is not None
            and prev_status != current_status
            and current_status == RetrospectiveStatus.COMPLETED
        ):
            schedule_kafka_event(domain_key, 'completed', entity_id)
        else:
            schedule_kafka_event(domain_key, 'updated', entity_id)


def _connect_post_save_budget_request(domain_key: str, config: DomainConfig):
    from budget_approval.models import BudgetRequestStatus

    model = apps.get_model(config.model_label)
    status_field = config.status_field

    @receiver(post_save, sender=model)
    def _enqueue(sender, instance, created, **kwargs):
        entity_id = getattr(instance, config.id_field)

        if created:
            schedule_kafka_event(domain_key, 'request_created', entity_id)
            return

        prev_status = _prev(instance, status_field)
        current_status = getattr(instance, status_field)
        if prev_status is not None and prev_status != current_status:
            if current_status == BudgetRequestStatus.APPROVED:
                schedule_kafka_event(domain_key, 'request_approved', entity_id)
            elif current_status == BudgetRequestStatus.REJECTED:
                schedule_kafka_event(domain_key, 'request_rejected', entity_id)


def _connect_post_save_metric_upload(domain_key: str, config: DomainConfig):
    from metric_upload.models import MetricFile

    model = apps.get_model(config.model_label)
    status_field = config.status_field

    @receiver(post_save, sender=model)
    def _enqueue(sender, instance, created, **kwargs):
        entity_id = getattr(instance, config.id_field)

        if created:
            schedule_kafka_event(domain_key, 'uploaded', entity_id)
            return

        prev_status = _prev(instance, status_field)
        current_status = getattr(instance, status_field)
        if (
            prev_status is not None
            and prev_status != current_status
            and current_status == MetricFile.READY
        ):
            schedule_kafka_event(domain_key, 'processed', entity_id)


def _connect_post_save_optimization(domain_key: str, config: DomainConfig):
    from optimization.models import OptimizationExperiment

    model = apps.get_model(config.model_label)
    status_field = config.status_field

    @receiver(post_save, sender=model)
    def _enqueue(sender, instance, created, **kwargs):
        entity_id = getattr(instance, config.id_field)

        if created:
            schedule_kafka_event(domain_key, 'experiment_created', entity_id)
            return

        prev_status = _prev(instance, status_field)
        current_status = getattr(instance, status_field)
        if (
            prev_status is not None
            and prev_status != current_status
            and current_status == OptimizationExperiment.ExperimentStatus.COMPLETED
        ):
            schedule_kafka_event(domain_key, 'experiment_completed', entity_id)


def _connect_post_save_workflow_run(domain_key: str, config: DomainConfig):
    model = apps.get_model(config.model_label)
    status_field = config.status_field

    @receiver(post_save, sender=model)
    def _enqueue(sender, instance, created, **kwargs):
        entity_id = getattr(instance, config.id_field)

        if created:
            schedule_kafka_event(domain_key, 'workflow_triggered', entity_id)
            return

        prev_status = _prev(instance, status_field)
        current_status = getattr(instance, status_field)
        if (
            prev_status is not None
            and prev_status != current_status
            and current_status == 'completed'
        ):
            schedule_kafka_event(domain_key, 'workflow_completed', entity_id)


_PROFILE_CONNECTORS = {
    'crud_status_soft_delete': lambda dk, cfg: (
        _connect_pre_save(cfg, ('status', 'is_deleted')),
        _connect_post_save_crud_status_soft_delete(dk, cfg),
    ),
    'crud_status': lambda dk, cfg: (
        _connect_pre_save(cfg, (cfg.status_field,)),
        _connect_post_save_crud_status(dk, cfg),
        _connect_post_delete_hard_delete(dk, cfg),
    ),
    'crud_status_hard_delete': lambda dk, cfg: (
        _connect_pre_save(cfg, (cfg.status_field,)),
        _connect_post_save_crud_status(dk, cfg),
        _connect_post_delete_hard_delete(dk, cfg),
    ),
    'project_soft_delete': lambda dk, cfg: (
        _connect_pre_save(cfg, ('is_deleted',)),
        _connect_post_save_project_soft_delete(dk, cfg),
    ),
    'retrospective': lambda dk, cfg: (
        _connect_pre_save(cfg, (cfg.status_field,)),
        _connect_post_save_retrospective(dk, cfg),
    ),
    'budget_request': lambda dk, cfg: (
        _connect_pre_save(cfg, (cfg.status_field,)),
        _connect_post_save_budget_request(dk, cfg),
    ),
    'metric_upload': lambda dk, cfg: (
        _connect_pre_save(cfg, (cfg.status_field,)),
        _connect_post_save_metric_upload(dk, cfg),
    ),
    'optimization': lambda dk, cfg: (
        _connect_pre_save(cfg, (cfg.status_field,)),
        _connect_post_save_optimization(dk, cfg),
    ),
    'workflow_run': lambda dk, cfg: (
        _connect_pre_save(cfg, (cfg.status_field,)),
        _connect_post_save_workflow_run(dk, cfg),
    ),
}


def connect_kafka_signals() -> None:
    """Register signal receivers for every domain in the registry."""
    for domain_key, config in DOMAIN_CONFIGS.items():
        connector = _PROFILE_CONNECTORS[config.signal_profile]
        connector(domain_key, config)
