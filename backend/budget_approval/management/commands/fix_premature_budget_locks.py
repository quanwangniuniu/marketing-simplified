"""
One-time fix: reverse pool deductions for BudgetRequests that were prematurely
locked when their task was only APPROVED (not LOCKED).

Old bug: process_approval() called br.lock() immediately on approval, deducting
the pool. The correct behaviour is that the pool is only deducted when the task
is explicitly locked.

This command finds every BudgetRequest that is LOCKED while its associated task
is still in APPROVED state, reverses the pool deduction, and resets the BR back
to APPROVED so the normal lock flow can proceed.

Usage:
    python manage.py fix_premature_budget_locks [--dry-run]
"""
from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = 'Reverse pool deductions for BudgetRequests locked prematurely at task APPROVED state'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Print what would be changed without making any DB changes',
        )

    def handle(self, *args, **options):
        from budget_approval.models import BudgetRequest, BudgetRequestStatus
        from task.models import Task

        dry_run = options['dry_run']

        # Find BudgetRequests that are LOCKED but whose task is still APPROVED
        bad_brs = BudgetRequest.objects.filter(
            status=BudgetRequestStatus.LOCKED,
            task__status=Task.Status.APPROVED,
        ).select_related('budget_pool', 'task')

        count = bad_brs.count()
        if count == 0:
            self.stdout.write(self.style.SUCCESS('No premature locks found — nothing to fix.'))
            return

        self.stdout.write(f'Found {count} prematurely locked BudgetRequest(s):')

        with transaction.atomic():
            for br in bad_brs:
                pool = br.budget_pool
                self.stdout.write(
                    f'  BR id={br.id} task_id={br.task_id} amount={br.amount} '
                    f'pool={pool.id} pool.used_amount={pool.used_amount} → {pool.used_amount - br.amount}'
                )

                if not dry_run:
                    # Reverse the pool deduction
                    from decimal import Decimal
                    pool.used_amount = max(Decimal('0'), pool.used_amount - br.amount)
                    pool.save(update_fields=['used_amount'])

                    # Reset BR status to APPROVED (bypass FSM protected field via queryset update)
                    BudgetRequest.objects.filter(pk=br.pk).update(status=BudgetRequestStatus.APPROVED)

            if dry_run:
                self.stdout.write(self.style.WARNING('Dry run — no changes made.'))
            else:
                self.stdout.write(self.style.SUCCESS(f'Fixed {count} BudgetRequest(s) and reversed their pool deductions.'))
