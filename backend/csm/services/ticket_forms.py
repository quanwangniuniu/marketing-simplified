"""Business logic for ticket form admin operations."""

import json

from django.core.exceptions import ValidationError
from django.db import transaction

from experience_group.models import ExperienceGroup

from csm.models import (
    Ticket, TicketForm, TicketFormField, TicketFormAssignment,
    TicketFormSubmission, TicketAttachment, SupportProject,
)
from csm.services.ticket_form_validation import validate_bulk_fields_payload
from csm.services.ticket_options import resolve_queue_for_submission

SYSTEM_FIELD_SEED = [
    ('summary', 'Summary', TicketFormField.FieldType.SYSTEM_SUMMARY, True, 0),
    ('description', 'Description', TicketFormField.FieldType.SYSTEM_DESCRIPTION, True, 1),
    ('project', 'Project', TicketFormField.FieldType.SYSTEM_PROJECT, True, 2),
    ('work_type', 'Work Type', TicketFormField.FieldType.SYSTEM_WORK_TYPE, True, 3),
]


def ensure_system_fields(form):
    """Idempotent: create the four system fields if missing."""
    existing = set(
        form.fields.filter(
            field_key__in=TicketFormField.SYSTEM_FIELD_KEYS,
        ).values_list('field_key', flat=True)
    )
    to_create = []
    for key, label, field_type, is_required, sort_order in SYSTEM_FIELD_SEED:
        if key in existing:
            continue
        to_create.append(TicketFormField(
            form=form,
            field_key=key,
            label=label,
            field_type=field_type,
            is_required=is_required,
            sort_order=sort_order,
        ))
    if to_create:
        TicketFormField.objects.bulk_create(to_create)


@transaction.atomic
def set_default_form(form):
    """Mark form as project default; unset others on the same project."""
    TicketForm.objects.filter(
        project_id=form.project_id,
        is_default=True,
    ).exclude(pk=form.pk).update(is_default=False)
    if not form.is_default:
        form.is_default = True
        form.save(update_fields=['is_default', 'updated_at'])
    return form


@transaction.atomic
def bulk_update_fields(form, fields_payload):
    """Replace custom fields and update system field metadata atomically."""
    normalized = validate_bulk_fields_payload(fields_payload)

    system_keys = set(TicketFormField.SYSTEM_FIELD_KEYS)
    custom_keys = [item['field_key'] for item in normalized if item['field_key'] not in system_keys]

    form.fields.exclude(field_key__in=system_keys).exclude(
        field_key__in=custom_keys,
    ).delete()

    for item in normalized:
        defaults = {
            'label': item['label'],
            'field_type': item['field_type'],
            'is_required': item['is_required'],
            'sort_order': item['sort_order'],
            'options': item['options'],
            'field_config': item.get('field_config', {}),
            'help_text': item['help_text'],
            'max_files': item['max_files'],
            'max_file_size_mb': item['max_file_size_mb'],
        }
        TicketFormField.objects.update_or_create(
            form=form,
            field_key=item['field_key'],
            defaults=defaults,
        )

    return form


@transaction.atomic
def replace_assignments(form, experience_group_ids=None, support_project_ids=None):
    """
    Replace all assignments for this form.
    Clears conflicting EG / support-project mappings on other forms first.
    """
    experience_group_ids = experience_group_ids or []
    support_project_ids = support_project_ids or []
    project_id = form.project_id

    if experience_group_ids:
        qs = ExperienceGroup.objects.filter(id__in=experience_group_ids)
        if qs.exclude(project_id=project_id).exists():
            raise ValidationError({
                'experience_group_ids': 'All experience groups must belong to the same project as the form.',
            })
        TicketFormAssignment.objects.filter(
            experience_group_id__in=experience_group_ids,
        ).delete()

    if support_project_ids:
        qs = SupportProject.objects.filter(id__in=support_project_ids)
        if qs.exclude(project_id=project_id).exists():
            raise ValidationError({
                'support_project_ids': 'All support projects must belong to the same project as the form.',
            })
        TicketFormAssignment.objects.filter(
            support_project_id__in=support_project_ids,
        ).delete()

    form.assignments.all().delete()

    TicketFormAssignment.objects.bulk_create([
        TicketFormAssignment(form=form, experience_group_id=eg_id)
        for eg_id in experience_group_ids
    ] + [
        TicketFormAssignment(form=form, support_project_id=sp_id)
        for sp_id in support_project_ids
    ])

    return form


def assert_can_delete_form(form):
    """Raise ValidationError if this is the sole default form for the project."""
    if not form.is_default:
        return
    other_active = TicketForm.objects.filter(
        project_id=form.project_id,
        is_active=True,
    ).exclude(pk=form.pk).exists()
    if not other_active:
        raise ValidationError({
            'detail': 'Cannot delete the only active form. Create another form or unset default first.',
        })


class TicketFormNotConfigured(Exception):
    """Raised when no form can be resolved for an experience group."""


def resolve_form_for_experience_group(eg_id):
    """
    TM-010 resolution order:
    1. EG-specific assignment
    2. Project default form
    3. TicketFormNotConfigured (404)
    """
    eg = ExperienceGroup.objects.select_related('project').filter(pk=eg_id).first()
    if not eg or not eg.project_id:
        raise TicketFormNotConfigured('Experience group or project not found.')

    assignment = (
        TicketFormAssignment.objects.filter(
            experience_group_id=eg_id,
            form__is_active=True,
        )
        .select_related('form')
        .order_by('-created_at')
        .first()
    )
    if assignment:
        return assignment.form

    default = TicketForm.objects.filter(
        project_id=eg.project_id,
        is_default=True,
        is_active=True,
    ).first()
    if default:
        return default

    raise TicketFormNotConfigured('Configure a default ticket form.')


def parse_multipart_submission(request, form):
    """Parse POST submit-request multipart body. Returns (answers, files_by_field)."""
    raw_answers = request.data.get('answers') or request.POST.get('answers', '{}')
    if isinstance(raw_answers, (bytes, bytearray)):
        raw_answers = raw_answers.decode('utf-8')
    try:
        answers = json.loads(raw_answers) if isinstance(raw_answers, str) else raw_answers
    except json.JSONDecodeError as exc:
        raise ValidationError({'answers': 'Invalid JSON in answers field.'}) from exc

    if not isinstance(answers, dict):
        raise ValidationError({'answers': 'answers must be a JSON object.'})

    file_field_keys = set(
        form.fields.filter(
            field_type=TicketFormField.FieldType.FILE,
        ).values_list('field_key', flat=True)
    )
    files_by_field = {}
    for key in file_field_keys:
        uploads = request.FILES.getlist(key)
        if uploads:
            files_by_field[key] = uploads

    return answers, files_by_field


@transaction.atomic
def create_ticket_from_submission(
    *,
    form,
    experience_group,
    submitted_by,
    cleaned_data,
    files_by_field,
):
    """Create Ticket + TicketFormSubmission + TicketAttachment rows."""
    queue = resolve_queue_for_submission(
        experience_group.project_id,
        support_project_id=cleaned_data.get('project'),
    )

    ticket = Ticket.objects.create(
        queue=queue,
        title=cleaned_data['summary'],
        description=cleaned_data.get('description', ''),
        form=form,
        experience_group=experience_group,
        support_project_id=cleaned_data.get('project'),
        work_type_id=cleaned_data.get('work_type'),
        custom_field_values=cleaned_data.get('custom_field_values', {}),
        customer_email=getattr(submitted_by, 'email', '') or '',
    )

    payload = {
        'answers': {
            'summary': cleaned_data['summary'],
            'description': cleaned_data.get('description', ''),
            'project': cleaned_data.get('project'),
            'work_type': cleaned_data.get('work_type'),
            **cleaned_data.get('custom_field_values', {}),
        },
        'file_field_keys': list(files_by_field.keys()),
    }

    submission = TicketFormSubmission.objects.create(
        form=form,
        experience_group=experience_group,
        submitted_by=submitted_by,
        payload=payload,
    )

    for field_key, uploads in files_by_field.items():
        for upload in uploads:
            attachment = TicketAttachment(
                ticket=ticket,
                submission=submission,
                original_name=upload.name,
                size_bytes=upload.size,
                content_type=getattr(upload, 'content_type', '') or '',
            )
            attachment.file = upload
            attachment.save()

    from csm.services.automation import fire_trigger
    fire_trigger(ticket, 'ticket_created')

    return ticket, submission
