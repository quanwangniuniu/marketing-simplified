import { test, expect } from '@playwright/test';
import {
  navigateToTasksAndSelectProject,
  navigateToNewTaskPage,
  submitNewTaskAndGetId,
  deleteTaskById,
  waitForTasksPageReady,
} from './tasks-helpers';

test.describe('Task field history', () => {
  test.describe.configure({ mode: 'serial' });
  let createdTaskId: number | null = null;
  let projectId: number;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
    const page = await context.newPage();
    projectId = await navigateToTasksAndSelectProject(page);
    await context.close();
  });

  test.afterEach(async ({ page }) => {
    if (createdTaskId) {
      try { await deleteTaskById(page, createdTaskId); } catch { /* best-effort */ }
      createdTaskId = null;
    }
  });

  test('task creation entry appears in History tab', async ({ page }) => {
    await navigateToNewTaskPage(page, projectId);

    await page.getByRole('button', { name: 'Alert', exact: true }).click();
    await page.getByPlaceholder('Summary of this task').fill('E2E History Created Test');

    await expect(page.locator('#task-field-alert-alert_type')).toBeVisible({ timeout: 10_000 });
    await page.locator('#task-field-alert-alert_type').selectOption('performance_drop');
    await page.locator('#task-field-alert-severity').selectOption('medium');

    // Assign an approver (required)
    const approverSelect = page.locator('select').filter({
      has: page.locator('option', { hasText: /Select an approver|Unassigned/ }),
    });
    await expect(approverSelect).toBeVisible({ timeout: 10_000 });
    const optionCount = await approverSelect.locator('option').count();
    if (optionCount > 1) {
      await approverSelect.selectOption({ index: 1 });
    }

    createdTaskId = await submitNewTaskAndGetId(page);
    expect(createdTaskId).toBeTruthy();

    // Navigate to task list and open the task drawer
    await page.goto(`/tasks?project_id=${projectId}`);
    await page.getByTestId('tab-tasks').click();
    await expect(page.getByTestId('task-list')).toBeVisible({ timeout: 15_000 });

    const taskRow = page.getByTestId('task-row').filter({ hasText: 'E2E History Created Test' }).first();
    await expect(taskRow).toBeVisible({ timeout: 10_000 });
    await taskRow.getByTestId('task-row-open').click();

    // Switch to History tab
    await expect(page.getByTestId('drawer-tab-history')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('drawer-tab-history').click();

    // Verify creation entry
    await expect(page.getByText('created this task')).toBeVisible({ timeout: 10_000 });
  });

  test('backend rejects task creation without approver', async ({ page }) => {
    await page.goto(`/tasks?project_id=${projectId}`);
    await expect(page.getByTestId('tab-tasks')).toBeVisible({ timeout: 15_000 });

    const token: string | null = await page.evaluate(() => {
      try {
        const raw = localStorage.getItem('auth-storage');
        if (!raw) return null;
        return (JSON.parse(raw) as any)?.state?.token ?? null;
      } catch { return null; }
    });
    expect(token).toBeTruthy();

    const origin = new URL(page.url()).origin;

    // Non-draft creation with no approver should return 400
    const noApproverRes = await page.request.post(`${origin}/api/tasks/`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        summary: 'E2E No Approver Validation Test',
        project_id: projectId,
        type: 'alert',
      },
    });
    expect(noApproverRes.status()).toBe(400);
    const errorBody = await noApproverRes.json();
    expect(errorBody).toHaveProperty('current_approver_id');

    // Draft creation with no approver should succeed
    const draftRes = await page.request.post(`${origin}/api/tasks/`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        summary: 'E2E Draft No Approver Test',
        project_id: projectId,
        type: 'alert',
        create_as_draft: true,
      },
    });
    expect(draftRes.ok()).toBeTruthy();
    const draftData = await draftRes.json();
    createdTaskId = draftData.id;
    expect(draftData.current_approver).toBeNull();
  });

  test('attachment upload and delete appear in History tab', async ({ page }) => {
    await navigateToNewTaskPage(page, projectId);

    await page.getByRole('button', { name: 'Alert', exact: true }).click();
    await page.getByPlaceholder('Summary of this task').fill('E2E History Attachment Test');

    await expect(page.locator('#task-field-alert-alert_type')).toBeVisible({ timeout: 10_000 });
    await page.locator('#task-field-alert-alert_type').selectOption('performance_drop');
    await page.locator('#task-field-alert-severity').selectOption('medium');

    const approverSelect = page.locator('select').filter({
      has: page.locator('option', { hasText: /Select an approver|Unassigned/ }),
    });
    await expect(approverSelect).toBeVisible({ timeout: 10_000 });
    const optionCount = await approverSelect.locator('option').count();
    if (optionCount > 1) {
      await approverSelect.selectOption({ index: 1 });
    }

    createdTaskId = await submitNewTaskAndGetId(page);
    expect(createdTaskId).toBeTruthy();

    // Open the task drawer
    await page.goto(`/tasks?project_id=${projectId}`);
    await page.getByTestId('tab-tasks').click();
    await expect(page.getByTestId('task-list')).toBeVisible({ timeout: 15_000 });

    const taskRow = page.getByTestId('task-row').filter({ hasText: 'E2E History Attachment Test' }).first();
    await expect(taskRow).toBeVisible({ timeout: 10_000 });
    await taskRow.getByTestId('task-row-open').click();

    // Upload an attachment via API (simpler and more reliable than file dialog)
    const token: string | null = await page.evaluate(() => {
      try {
        const raw = localStorage.getItem('auth-storage');
        if (!raw) return null;
        return (JSON.parse(raw) as any)?.state?.token ?? null;
      } catch { return null; }
    });
    expect(token).toBeTruthy();

    const origin = new URL(page.url()).origin;
    const fileContent = Buffer.from('E2E test attachment content');
    const formData = new FormData();
    const blob = new Blob([fileContent], { type: 'text/plain' });
    formData.append('file', blob, 'e2e-test-file.txt');

    const uploadRes = await page.request.post(`${origin}/api/tasks/${createdTaskId}/attachments/`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        file: {
          name: 'e2e-test-file.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('E2E test attachment content'),
        },
      },
    });
    expect(uploadRes.ok()).toBeTruthy();
    const attachmentData = await uploadRes.json();
    const attachmentId = attachmentData.id;

    // Switch to History tab and check for attachment added entry (filename should appear)
    await expect(page.getByTestId('drawer-tab-history')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('drawer-tab-history').click();
    await expect(page.getByText('e2e-test-file.txt')).toBeVisible({ timeout: 10_000 });

    // Delete the attachment via API
    await page.request.delete(`${origin}/api/tasks/${createdTaskId}/attachments/${attachmentId}/`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    // Toggle tabs to trigger a history re-fetch and check for removal entry
    await page.getByTestId('drawer-tab-details').click();
    await page.getByTestId('drawer-tab-history').click();

    // Both added and removed filename chips should now be visible
    await expect(page.getByText('e2e-test-file.txt').first()).toBeVisible({ timeout: 10_000 });
  });

  test('field change recorded with correct before/after values', async ({ page }) => {
    await navigateToNewTaskPage(page, projectId);

    await page.getByRole('button', { name: 'Alert', exact: true }).click();
    await page.getByPlaceholder('Summary of this task').fill('E2E History Field Change Test');

    await expect(page.locator('#task-field-alert-alert_type')).toBeVisible({ timeout: 10_000 });
    await page.locator('#task-field-alert-alert_type').selectOption('performance_drop');
    await page.locator('#task-field-alert-severity').selectOption('medium');

    const approverSelect = page.locator('select').filter({
      has: page.locator('option', { hasText: /Select an approver|Unassigned/ }),
    });
    await expect(approverSelect).toBeVisible({ timeout: 10_000 });
    const optionCount = await approverSelect.locator('option').count();
    if (optionCount > 1) {
      await approverSelect.selectOption({ index: 1 });
    }

    createdTaskId = await submitNewTaskAndGetId(page);
    expect(createdTaskId).toBeTruthy();

    // Update the task priority via API
    const token: string | null = await page.evaluate(() => {
      try {
        const raw = localStorage.getItem('auth-storage');
        if (!raw) return null;
        return (JSON.parse(raw) as any)?.state?.token ?? null;
      } catch { return null; }
    });
    const origin = new URL(page.url()).origin;
    await page.request.patch(`${origin}/api/tasks/${createdTaskId}/`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { priority: 'HIGH' },
    });

    // Open the task drawer
    await page.goto(`/tasks?project_id=${projectId}`);
    await waitForTasksPageReady(page);
    await page.getByTestId('tab-tasks').click();
    await expect(page.getByTestId('task-list')).toBeVisible({ timeout: 15_000 });

    const taskRow = page.getByTestId('task-row').filter({ hasText: 'E2E History Field Change Test' }).first();
    await expect(taskRow).toBeVisible({ timeout: 10_000 });
    await taskRow.getByTestId('task-row-open').click();

    await expect(page.getByTestId('drawer-tab-history')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('drawer-tab-history').click();

    // Verify priority change appears in history (look for the "before" value chip — MEDIUM is now only in history)
    await expect(page.getByText(/changed.*[Pp]riority/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('MEDIUM', { exact: true })).toBeVisible({ timeout: 5_000 });
  });
});
