"""
Migration: insert 'Generate Criteria' step into the default system workflow.

New step order for 'Default Analysis Workflow':
  1  detect_columns         — Detect Columns
  2  await_confirmation     — Confirm Column Mapping
  3  normalize_data         — Normalize Data
  4  generate_criteria      — Generate Criteria        ← NEW
  5  analyze_data           — Analyze Data             (was 4)
  6  await_confirmation     — Confirm Analysis         (was 5)
  7  create_decision        — Create Decision          (was 6)
  8  await_confirmation     — Confirm Decision         (was 7)
  9  create_tasks           — Create Tasks             (was 8)
"""
from django.db import migrations


def insert_generate_criteria_step(apps, schema_editor):
    WorkflowDef = apps.get_model('agent', 'AgentWorkflowDefinition')
    WorkflowStep = apps.get_model('agent', 'AgentWorkflowStep')

    wf = WorkflowDef.objects.filter(
        is_system=True, name='Default Analysis Workflow', is_deleted=False,
    ).first()
    if not wf:
        return

    # Shift all steps at order >= 4 up by 1 to make room.
    # Use a large temporary offset to avoid unique_together conflicts.
    to_shift = list(WorkflowStep.objects.filter(
        workflow=wf, is_deleted=False, order__gte=4,
    ).order_by('-order'))  # descending to avoid conflicts

    for step in to_shift:
        step.order = step.order + 100
    WorkflowStep.objects.bulk_update(to_shift, ['order'])

    for step in to_shift:
        step.order = step.order - 100 + 1
    WorkflowStep.objects.bulk_update(to_shift, ['order'])

    WorkflowStep.objects.create(
        workflow=wf,
        name='Generate Criteria',
        step_type='generate_criteria',
        order=4,
        config={},
        description=(
            'Use the column names to generate success criteria that guide '
            'the downstream analysis workflow.'
        ),
    )


def remove_generate_criteria_step(apps, schema_editor):
    WorkflowDef = apps.get_model('agent', 'AgentWorkflowDefinition')
    WorkflowStep = apps.get_model('agent', 'AgentWorkflowStep')

    wf = WorkflowDef.objects.filter(
        is_system=True, name='Default Analysis Workflow', is_deleted=False,
    ).first()
    if not wf:
        return

    WorkflowStep.objects.filter(
        workflow=wf, step_type='generate_criteria', order=4,
    ).delete()

    # Shift steps that were moved down back to their original positions.
    to_shift = list(WorkflowStep.objects.filter(
        workflow=wf, is_deleted=False, order__gte=5,
    ).order_by('order'))

    for step in to_shift:
        step.order = step.order + 100
    WorkflowStep.objects.bulk_update(to_shift, ['order'])

    for step in to_shift:
        step.order = step.order - 100 - 1
    WorkflowStep.objects.bulk_update(to_shift, ['order'])


class Migration(migrations.Migration):

    dependencies = [
        ('agent', '0010_add_success_criteria_to_workflow_run'),
    ]

    operations = [
        migrations.RunPython(
            insert_generate_criteria_step,
            remove_generate_criteria_step,
        ),
    ]
