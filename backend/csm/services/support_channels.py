"""Support channel CRUD for CSM-S01-02."""

import logging
import re
import uuid
from zoneinfo import ZoneInfo

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Count
from django.http import Http404
from django.utils import timezone as django_timezone

from csm.models import Queue, SupportChannel, SupportChannelExperienceGroup, TicketForm
from experience_group.models import ExperienceGroup

logger = logging.getLogger(__name__)

WEEKDAYS = (
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
)
TIME_PATTERN = re.compile(r'^([01]\d|2[0-3]):[0-5]\d$')

WRITABLE_SCALAR_FIELDS = (
    'display_name',
    'welcome_message',
    'ticket_confirmation_message',
    'operating_hours',
    'timezone',
    'offline_fallback_message',
    'offline_alternative',
    'offline_alternative_target_id',
    'email_address',
    'sort_order',
    'is_active',
)


def list_channels_for_project(project_id, *, include_inactive=False):
    qs = SupportChannel.objects.filter(project_id=project_id)
    if not include_inactive:
        qs = qs.filter(is_active=True)
    return (
        qs.select_related('default_queue', 'ticket_form')
        .annotate(assignment_count=Count('experience_group_links'))
        .prefetch_related('experience_group_links__experience_group')
        .order_by('sort_order', 'display_name')
    )


def channel_detail_queryset():
    return (
        SupportChannel.objects.select_related('default_queue', 'ticket_form')
        .annotate(assignment_count=Count('experience_group_links'))
        .prefetch_related('experience_group_links__experience_group')
    )


def experience_groups_for_channel(channel):
    return [
        {'id': link.experience_group_id, 'name': link.experience_group.name}
        for link in channel.experience_group_links.all()
    ]


def _parse_time_minutes(value):
    hours, minutes = value.split(':')
    return int(hours) * 60 + int(minutes)


def _validate_operating_hours(hours):
    if not isinstance(hours, dict):
        raise ValidationError({'operating_hours': 'Must be an object.'})

    for day in WEEKDAYS:
        day_cfg = hours.get(day)
        if day_cfg is None:
            raise ValidationError({
                'operating_hours': f'Missing configuration for {day}.',
            })
        if not isinstance(day_cfg, dict):
            raise ValidationError({
                'operating_hours': f'Invalid configuration for {day}.',
            })

        enabled = day_cfg.get('enabled', False)
        if not enabled:
            continue

        start = day_cfg.get('start')
        end = day_cfg.get('end')
        if not start or not end:
            raise ValidationError({
                'operating_hours': f'{day} requires start and end when enabled.',
            })
        if not TIME_PATTERN.match(start) or not TIME_PATTERN.match(end):
            raise ValidationError({
                'operating_hours': f'{day} start/end must use HH:MM format.',
            })
        if _parse_time_minutes(start) >= _parse_time_minutes(end):
            raise ValidationError({
                'operating_hours': f'{day} start must be before end.',
            })


def _validate_default_queue(project_id, queue):
    if queue is None:
        return None
    if queue.project_id != project_id or not queue.is_active:
        raise ValidationError({
            'default_queue': 'Queue must belong to this workspace and be active.',
        })
    return queue


def _validate_ticket_form(project_id, ticket_form):
    if ticket_form is None:
        return None
    if ticket_form.project_id != project_id or not ticket_form.is_active:
        raise ValidationError({
            'ticket_form': 'Ticket form must belong to this workspace and be active.',
        })
    return ticket_form


def _validate_offline_alternative_target(project_id, alternative, target_id):
    if alternative != SupportChannel.OfflineAlternative.CONTACT_FORM:
        return
    if not target_id:
        raise ValidationError({
            'offline_alternative_target_id': (
                'Required when offline alternative is contact_form.'
            ),
        })

    channel_exists = SupportChannel.objects.filter(
        project_id=project_id,
        pk=target_id,
        channel_type=SupportChannel.ChannelType.CONTACT_FORM,
        is_active=True,
    ).exists()
    form_exists = TicketForm.objects.filter(
        project_id=project_id,
        pk=target_id,
        is_active=True,
    ).exists()
    if not channel_exists and not form_exists:
        raise ValidationError({
            'offline_alternative_target_id': (
                'Must reference an active contact form channel or ticket form in this project.'
            ),
        })


def validate_channel_payload(channel_type, data, *, channel=None):
    """Type-specific validation for create/update payloads."""
    project_id = channel.project_id if channel else data.get('project_id')
    errors = {}

    default_queue = data.get('default_queue', channel.default_queue if channel else None)
    ticket_form = data.get('ticket_form', channel.ticket_form if channel else None)
    email_address = data.get(
        'email_address',
        channel.email_address if channel else '',
    )
    operating_hours = data.get(
        'operating_hours',
        channel.operating_hours if channel else None,
    )
    offline_alternative = data.get(
        'offline_alternative',
        channel.offline_alternative if channel else SupportChannel.OfflineAlternative.MESSAGE_ONLY,
    )
    offline_target_id = data.get(
        'offline_alternative_target_id',
        channel.offline_alternative_target_id if channel else None,
    )

    if channel_type == SupportChannel.ChannelType.LIVE_CHAT:
        if default_queue is None:
            errors['default_queue'] = 'Live chat channels require a default queue.'
    elif channel_type == SupportChannel.ChannelType.CONTACT_FORM:
        if ticket_form is None:
            errors['ticket_form'] = 'Contact form channels require a ticket form.'
    elif channel_type == SupportChannel.ChannelType.EMAIL:
        if not (email_address or '').strip():
            errors['email_address'] = 'Email channels require an email address.'

    if errors:
        raise ValidationError(errors)

    try:
        if default_queue is not None:
            _validate_default_queue(project_id, default_queue)
        if ticket_form is not None:
            _validate_ticket_form(project_id, ticket_form)
        if operating_hours is not None:
            _validate_operating_hours(operating_hours)
        _validate_offline_alternative_target(
            project_id,
            offline_alternative,
            offline_target_id,
        )
    except ValidationError:
        raise


def _apply_writable_fields(channel, data):
    for field in WRITABLE_SCALAR_FIELDS:
        if field in data:
            setattr(channel, field, data[field])

    if 'default_queue' in data:
        channel.default_queue = _validate_default_queue(
            channel.project_id,
            data['default_queue'],
        )
    if 'ticket_form' in data:
        channel.ticket_form = _validate_ticket_form(
            channel.project_id,
            data['ticket_form'],
        )


@transaction.atomic
def create_support_channel(project_id, *, channel_type, display_name, **kwargs):
    channel = SupportChannel(
        project_id=project_id,
        channel_type=channel_type,
        display_name=display_name.strip(),
    )
    if not channel.display_name:
        raise ValidationError({'display_name': 'Display name is required.'})

    payload = {
        'project_id': project_id,
        'default_queue': kwargs.get('default_queue'),
        'ticket_form': kwargs.get('ticket_form'),
        'email_address': kwargs.get('email_address', ''),
        'operating_hours': kwargs.get('operating_hours'),
        'offline_alternative': kwargs.get(
            'offline_alternative',
            SupportChannel.OfflineAlternative.MESSAGE_ONLY,
        ),
        'offline_alternative_target_id': kwargs.get('offline_alternative_target_id'),
    }
    validate_channel_payload(channel_type, payload)
    _apply_writable_fields(channel, kwargs)
    channel.save()
    return channel


@transaction.atomic
def update_support_channel(channel, **kwargs):
    channel_type = kwargs.get('channel_type', channel.channel_type)
    if 'display_name' in kwargs:
        name = (kwargs['display_name'] or '').strip()
        if not name:
            raise ValidationError({'display_name': 'Display name is required.'})
        kwargs['display_name'] = name

    payload = {
        'project_id': channel.project_id,
        'default_queue': kwargs.get('default_queue', channel.default_queue),
        'ticket_form': kwargs.get('ticket_form', channel.ticket_form),
        'email_address': kwargs.get('email_address', channel.email_address),
        'operating_hours': kwargs.get('operating_hours', channel.operating_hours),
        'offline_alternative': kwargs.get(
            'offline_alternative',
            channel.offline_alternative,
        ),
        'offline_alternative_target_id': kwargs.get(
            'offline_alternative_target_id',
            channel.offline_alternative_target_id,
        ),
    }
    validate_channel_payload(channel_type, payload, channel=channel)

    if 'channel_type' in kwargs:
        channel.channel_type = kwargs['channel_type']
    _apply_writable_fields(channel, kwargs)
    channel.save()
    return channel


@transaction.atomic
def deactivate_support_channel(channel):
    if not channel.is_active:
        return channel
    channel.is_active = False
    channel.save(update_fields=['is_active', 'updated_at'])
    return channel


@transaction.atomic
def replace_experience_group_assignments(channel, eg_ids):
    unique_ids = list(dict.fromkeys(eg_ids or []))

    if unique_ids:
        groups = list(
            ExperienceGroup.objects.filter(pk__in=unique_ids).only('id', 'project_id', 'name'),
        )
        found_ids = {group.id for group in groups}
        missing = [eg_id for eg_id in unique_ids if eg_id not in found_ids]
        if missing:
            raise ValidationError({
                'experience_group_ids': f'Unknown experience group id(s): {missing}',
            })

        for group in groups:
            if group.project_id != channel.project_id:
                raise ValidationError({
                    'experience_group_ids': (
                        f'Experience group {group.id} is not in this project.'
                    ),
                })

    channel.experience_group_links.all().delete()
    SupportChannelExperienceGroup.objects.bulk_create([
        SupportChannelExperienceGroup(channel=channel, experience_group_id=eg_id)
        for eg_id in unique_ids
    ])

    return experience_groups_for_channel(
        channel_detail_queryset().get(pk=channel.pk),
    )


def build_embed_snippet(channel, *, base_url):
    base = base_url.rstrip('/')
    return (
        f'<script\n'
        f'  src="{base}/static/csm/widget.js"\n'
        f'  data-channel="{channel.embed_key}"\n'
        f'  async\n'
        f'></script>'
    )


def evaluate_channel_availability(channel, at=None):
    """
    Returns:
        { "is_online": bool, "reason": str | None }
    """
    if not channel.is_active:
        return {'is_online': False, 'reason': 'inactive'}

    at = at or django_timezone.now()
    if django_timezone.is_naive(at):
        at = django_timezone.make_aware(at, django_timezone.utc)

    tz_name = channel.timezone or 'UTC'
    try:
        local_tz = ZoneInfo(tz_name)
    except Exception:
        logger.warning('Invalid timezone %s on channel %s', tz_name, channel.pk)
        return {'is_online': False, 'reason': 'invalid_timezone'}

    local_dt = at.astimezone(local_tz)
    day_key = WEEKDAYS[local_dt.weekday()]
    hours = channel.operating_hours

    if not isinstance(hours, dict):
        logger.warning('Malformed operating_hours on channel %s', channel.pk)
        return {'is_online': False, 'reason': 'malformed_hours'}

    day_cfg = hours.get(day_key)
    if not isinstance(day_cfg, dict):
        return {'is_online': False, 'reason': 'closed_day'}

    if not day_cfg.get('enabled', False):
        return {'is_online': False, 'reason': 'closed_day'}

    start = day_cfg.get('start')
    end = day_cfg.get('end')
    if not start or not end or not TIME_PATTERN.match(start) or not TIME_PATTERN.match(end):
        return {'is_online': False, 'reason': 'malformed_hours'}

    now_minutes = local_dt.hour * 60 + local_dt.minute
    start_minutes = _parse_time_minutes(start)
    end_minutes = _parse_time_minutes(end)
    if not (start_minutes <= now_minutes < end_minutes):
        return {'is_online': False, 'reason': 'outside_hours'}

    return {'is_online': True, 'reason': None}


def resolve_channel_for_conversation(*, support_channel_id=None, embed_key=None):
    """
    Resolve an active support channel from conversation create payload fields.
    Returns None when no channel identifier is provided (legacy create path).
    """
    if support_channel_id is None and embed_key is None:
        return None

    if support_channel_id is not None and embed_key is not None:
        by_id = resolve_active_channel(support_channel_id)
        by_key = resolve_active_channel(embed_key)
        if by_id.pk != by_key.pk:
            raise ValidationError(
                'support_channel_id and embed_key refer to different channels.',
            )
        return by_id

    if support_channel_id is not None:
        return resolve_active_channel(support_channel_id)
    return resolve_active_channel(embed_key)


def resolve_active_channel(lookup):
    """Resolve an active channel by embed_key UUID or numeric primary key."""
    qs = SupportChannel.objects.filter(is_active=True).select_related(
        'default_queue', 'ticket_form',
    )

    try:
        embed_uuid = uuid.UUID(str(lookup))
        return qs.get(embed_key=embed_uuid)
    except (ValueError, AttributeError, SupportChannel.DoesNotExist):
        pass

    lookup_str = str(lookup).strip()
    if lookup_str.isdigit():
        try:
            return qs.get(pk=int(lookup_str))
        except SupportChannel.DoesNotExist:
            pass

    raise Http404


def list_active_channels_for_experience_group(eg_id):
    return (
        SupportChannel.objects.filter(
            is_active=True,
            experience_group_links__experience_group_id=eg_id,
        )
        .select_related('default_queue', 'ticket_form')
        .distinct()
        .order_by('sort_order', 'display_name')
    )


def _build_alternative_path(channel, alternative, target_id):
    if alternative == SupportChannel.OfflineAlternative.MESSAGE_ONLY:
        return None

    if alternative == SupportChannel.OfflineAlternative.CONTACT_FORM:
        if not target_id:
            return None
        if SupportChannel.objects.filter(
            pk=target_id,
            project_id=channel.project_id,
            channel_type=SupportChannel.ChannelType.CONTACT_FORM,
            is_active=True,
        ).exists():
            return f'/portal/request?channel={target_id}'
        if TicketForm.objects.filter(
            pk=target_id,
            project_id=channel.project_id,
            is_active=True,
        ).exists():
            return f'/portal/request?form={target_id}'
        return None

    if alternative == SupportChannel.OfflineAlternative.KNOWLEDGE_BASE:
        if target_id:
            return f'/portal/kb/{target_id}'
        return None

    return None


def _absolute_url(request, path):
    if not path:
        return None
    if request is not None:
        return request.build_absolute_uri(path)
    return path


def build_offline_payload(channel, request=None):
    alternative_path = _build_alternative_path(
        channel,
        channel.offline_alternative,
        channel.offline_alternative_target_id,
    )
    return {
        'message': channel.offline_fallback_message,
        'alternative': channel.offline_alternative,
        'alternative_url': _absolute_url(request, alternative_path),
        'alternative_target_id': channel.offline_alternative_target_id,
    }


def build_channel_runtime_config(channel, request=None, *, at=None):
    availability = evaluate_channel_availability(channel, at=at)
    is_online = availability['is_online']

    config = {
        'channel_id': channel.id,
        'channel_type': channel.channel_type,
        'display_name': channel.display_name,
        'is_online': is_online,
        'embed_key': str(channel.embed_key),
    }

    if is_online:
        config.update({
            'welcome_message': channel.welcome_message,
            'default_queue_id': channel.default_queue_id,
            'ticket_form_id': channel.ticket_form_id,
            'email_address': channel.email_address or None,
            'offline': None,
        })
        return config

    config.update({
        'welcome_message': None,
        'default_queue_id': None,
        'ticket_form_id': None,
        'email_address': channel.email_address or None,
        'offline': build_offline_payload(channel, request),
    })
    return config
