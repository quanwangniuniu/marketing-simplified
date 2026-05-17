import { test, expect } from '@playwright/test';
import {
  navigateToTasksAndSelectProject,
  waitForTasksPageReady,
  deleteTaskById,
} from './tasks-helpers';

/**
 * After a task is submitted (status != DRAFT), owner, approver, planned date,
 * and start date must be read-only in both the header pill row and the
 * Properties panel. Priority and due date remain editable.
 */
test.describe('Task field lock after submit', () => {
  test.describe.configure({ mode: 'serial' });

  let projectId: number;
  let createdTaskId: number | null = null;
  let token: string | null = null;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
    const page = await context.newPage();
    projectId = await navigateToTasksAndSelectProject(page);

    token = await page.evaluate(() => {
      try {
        const raw = localStorage.getItem('auth-storage');
        if (!raw) return null;
        return (JSON.parse(raw) as any)?.state?.token ?? null;
      } catch { return null; }
    });

    // Find a project member to use as approver
    const origin = new URL(page.url()).origin;
    const membersRes = await page.request.get(`${origin}/api/core/projects/${projectId}/members/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const membersData = await membersRes.json();
    const membersList = Array.isArray(membersData) ? membersData : (membersData.results ?? []);
    const approverId = membersList[0]?.user?.id ?? null;

    // Create a task via API (it auto-submits: DRAFT → SUBMITTED)
    const createRes = await page.request.post(`${origin}/api/tasks/`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        summary: 'E2E Field Lock Test',
        type: 'alert',
        project_id: projectId,
        current_approver_id: approverId,
      },
    });
    if (!createRes.ok()) {
      const body = await createRes.text();
      throw new Error(`Task creation failed (${createRes.status()}): ${body}`);
    }
    const task = await createRes.json();
    createdTaskId = task.id;
    expect(task.status).not.toBe('DRAFT');

    await page.close();
    await context.close();
  });

  test.afterAll(async ({ browser }) => {
    if (!createdTaskId) return;
    const context = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
    const page = await context.newPage();
    await page.goto('/tasks');
    await deleteTaskById(page, createdTaskId);
    await page.close();
    await context.close();
  });

  test('full page: owner, approver, planned date, start date are locked; priority and due date remain editable', async ({ page }) => {
    await page.goto(`/tasks/${createdTaskId}`);
    await expect(page.getByTestId('task-id-label')).toBeVisible({ timeout: 15_000 });

    // ── Header pill row ─────────────────────────────────────────────────────

    // Owner chip in header must be disabled
    await expect(page.getByTestId('header-owner-trigger')).toBeDisabled();

    // Priority chip in header must still be enabled
    await expect(page.getByTestId('header-priority-trigger')).toBeEnabled();

    // Due date chip in header must still be enabled
    await expect(page.getByTestId('header-due-date-trigger')).toBeEnabled();

    // ── Properties panel ────────────────────────────────────────────────────

    // Owner select must be disabled
    await expect(page.getByRole('combobox', { name: 'Owner' })).toBeDisabled();

    // Approver select must be disabled
    await expect(page.getByRole('combobox', { name: 'Approver' })).toBeDisabled();

    // Planned date input must be disabled
    await expect(page.getByTestId('properties-planned-date')).toBeDisabled();

    // Start date input must be disabled
    await expect(page.getByTestId('properties-start-date')).toBeDisabled();
  });

  test('drawer: owner, approver, planned date, start date are locked', async ({ page }) => {
    if (!createdTaskId) test.skip();

    await page.goto(`/tasks?project_id=${projectId}`);
    await waitForTasksPageReady(page);
    await page.getByTestId('tab-tasks').click();
    await expect(page.getByTestId('task-list')).toBeVisible({ timeout: 15_000 });

    const taskRow = page.getByTestId('task-row').filter({ hasText: 'E2E Field Lock Test' }).first();
    await expect(taskRow).toBeVisible({ timeout: 10_000 });
    await taskRow.getByTestId('task-row-open').click();

    await expect(page.getByTestId('task-drawer')).toBeVisible({ timeout: 10_000 });

    // Owner and approver selects in drawer Properties panel must be disabled
    await expect(page.getByRole('combobox', { name: 'Owner' })).toBeDisabled();
    await expect(page.getByRole('combobox', { name: 'Approver' })).toBeDisabled();

    // Planned and start date inputs must be disabled
    await expect(page.getByTestId('properties-planned-date')).toBeDisabled();
    await expect(page.getByTestId('properties-start-date')).toBeDisabled();
  });
});
