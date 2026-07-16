import { test, expect } from '@playwright/test';
import {
  navigateToTasksAndSelectProject,
  navigateToNewTaskPage,
  submitNewTaskAndGetId,
  deleteTaskById,
  selectFirstAvailableApprover,
  getAuthToken,
  createDraftTaskViaApi,
} from './tasks-helpers';

test.describe('Task approver assignment', () => {
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

  test('create task with approver, verify in list view detail panel', async ({ page }) => {
    await navigateToNewTaskPage(page, projectId);

    // Select Alert work type and fill required fields
    await page.getByRole('button', { name: 'Alert', exact: true }).click();

    await expect(page.locator('#task-field-alert-alert_type')).toBeVisible({ timeout: 10_000 });
    await page.getByPlaceholder('Summary of this task').fill('E2E Approver Test Task');
    await page.locator('#task-field-alert-alert_type').selectOption('performance_drop');
    await page.locator('#task-field-alert-severity').selectOption('medium');

    await selectFirstAvailableApprover(page);
    await page.getByPlaceholder('Summary of this task').fill('E2E Approver Test Task');
    await page.locator('#task-field-alert-alert_type').selectOption('performance_drop');
    await page.locator('#task-field-alert-severity').selectOption('medium');

    createdTaskId = await submitNewTaskAndGetId(page);
    expect(createdTaskId).toBeTruthy();

    // Navigate to tasks list and find the created task
    await page.goto(`/tasks?project_id=${projectId}`);
    await page.getByTestId('tab-tasks').click();
    await expect(page.getByTestId('task-list')).toBeVisible({ timeout: 15_000 });

    const taskEntry = page.getByText('E2E Approver Test Task').first();
    await expect(taskEntry).toBeVisible({ timeout: 10_000 });
  });

  // MED-236: two approvers (here, the same user in two tabs) racing the same
  // approval must serialize — one wins, the loser sees "already decided" and the
  // stale tab refreshes to the winning status instead of double-applying.
  test('two tabs racing an approval: loser sees "already decided" and refreshes', async ({ page, context }) => {
    // Current user is both owner and approver so one session can drive the whole
    // chain and act as the approver in both tabs.
    const userId = await page.evaluate(() => {
      try {
        return JSON.parse(localStorage.getItem('auth-storage') || '{}')?.state?.user?.id ?? null;
      } catch {
        return null;
      }
    });
    expect(userId).toBeTruthy();

    const token = await getAuthToken(page);
    const origin = new URL(page.url()).origin;
    const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    // Create a draft task with the current user as approver, then drive it to
    // UNDER_REVIEW via the API (submit → start-review).
    const fixture = await createDraftTaskViaApi(page, projectId, `E2E Race Task ${Date.now()}`, {
      current_approver_id: userId,
    });
    createdTaskId = fixture.id;

    const submitResp = await page.request.post(`${origin}/api/tasks/${fixture.slug}/submit/`, { headers: authHeaders });
    expect(submitResp.ok()).toBeTruthy();
    const reviewResp = await page.request.post(`${origin}/api/tasks/${fixture.slug}/start-review/`, { headers: authHeaders });
    expect(reviewResp.ok()).toBeTruthy();

    // Open the same task in two tabs.
    const tabA = page;
    const tabB = await context.newPage();
    await tabA.goto(`/tasks/${fixture.slug}`);
    await tabB.goto(`/tasks/${fixture.slug}`);

    const approveA = tabA.getByRole('button', { name: 'Approve', exact: true });
    const approveB = tabB.getByRole('button', { name: 'Approve', exact: true });
    await expect(approveA).toBeVisible({ timeout: 15_000 });
    await expect(approveB).toBeVisible({ timeout: 15_000 });

    // Tab A wins the approval.
    await approveA.click();
    await expect(approveA).toBeHidden({ timeout: 15_000 });

    // Tab B is now stale. Its approval loses the race → 409: the "already
    // decided" message shows and the refresh removes the Approve action.
    await approveB.click();
    await expect(tabB.getByText(/already been decided/i)).toBeVisible({ timeout: 15_000 });
    await expect(approveB).toBeHidden({ timeout: 15_000 });

    await tabB.close();
  });
});
