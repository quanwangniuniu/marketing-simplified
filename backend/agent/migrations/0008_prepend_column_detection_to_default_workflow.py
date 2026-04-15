"""
Migration: prepend column-detection steps to the default system workflow.

New step order for 'Default Analysis Workflow':
  1  detect_columns         — Detect Columns
  2  await_confirmation     — Confirm Column Mapping
  3  normalize_data         — Normalize Data
  4  analyze_data           — Analyze Data           (was 1)
  5  await_confirmation     — Confirm Analysis       (was 2)
  6  create_decision        — Create Decision        (was 3)
  7  await_confirmation     — Confirm Decision       (was 4)
  8  create_tasks           — Create Tasks           (was 5)
"""
from django.db import migrations


def add_column_detection_steps(apps, schema_editor):
    WorkflowDef = apps.get_model('agent', 'AgentWorkflowDefinition')
    WorkflowStep = apps.get_model('agent', 'AgentWorkflowStep')

    wf = WorkflowDef.objects.filter(
        is_system=True, name='Default Analysis Workflow', is_deleted=False,
    ).first()
    if not wf:
        return

    # Shift existing steps up by 3 to make room for the new prefix.
    # Use a large offset (100+) as temporary values to avoid unique_together
    # conflicts while staying above the order > 0 check constraint.
    existing = list(WorkflowStep.objects.filter(
        workflow=wf, is_deleted=False,
    ).order_by('order'))

    for step in existing:
        step.order = step.order + 100
    WorkflowStep.objects.bulk_update(existing, ['order'])

    for step in existing:
        step.order = step.order - 100 + 3
    WorkflowStep.objects.bulk_update(existing, ['order'])

    # Insert the three new prefix steps.
    new_steps = [
        (
            'Detect Columns',
            'detect_columns',
            1,
            {},
            'Identify each column in the uploaded file before running analysis.',
        ),
        (
            'Confirm Column Mapping',
            'await_confirmation',
            2,
            {
                'message': (
                    'Please review the detected column mapping. '
                    'Correct any misidentified columns, then confirm to continue.'
                ),
            },
            'Pause so the user can review and correct the auto-detected column names.',
        ),
        (
            'Normalize Data',
            'normalize_data',
            3,
            {},
            'Rename spreadsheet columns to the confirmed standard names.',
        ),
    ]
    for name, step_type, order, config, description in new_steps:
        WorkflowStep.objects.create(
            workflow=wf,
            name=name,
            step_type=step_type,
            order=order,
            config=config,
            description=description,
        )


def remove_column_detection_steps(apps, schema_editor):
    WorkflowDef = apps.get_model('agent', 'AgentWorkflowDefinition')
    WorkflowStep = apps.get_model('agent', 'AgentWorkflowStep')

    wf = WorkflowDef.objects.filter(
        is_system=True, name='Default Analysis Workflow', is_deleted=False,
    ).first()
    if not wf:
        return

    # Remove the three prefix steps.
    WorkflowStep.objects.filter(
        workflow=wf,
        step_type='detect_columns',
        order=1,
    ).delete()
    WorkflowStep.objects.filter(
        workflow=wf,
        step_type='await_confirmation',
        order=2,
    ).delete()
    WorkflowStep.objects.filter(
        workflow=wf,
        step_type='normalize_data',
        order=3,
    ).delete()

    # Shift remaining steps back down by 3.
    remaining = list(WorkflowStep.objects.filter(
        workflow=wf, is_deleted=False,
    ).order_by('order'))

    for step in remaining:
        step.order = step.order + 100
    WorkflowStep.objects.bulk_update(remaining, ['order'])

    for step in remaining:
        step.order = step.order - 100 - 3
    WorkflowStep.objects.bulk_update(remaining, ['order'])


class Migration(migrations.Migration):

    dependencies = [
        ('agent', '0007_agentworkflowrun_chat_follow_up_started'),
    ]

    operations = [
        migrations.RunPython(
            add_column_detection_steps,
            remove_column_detection_steps,
        ),
    ]
