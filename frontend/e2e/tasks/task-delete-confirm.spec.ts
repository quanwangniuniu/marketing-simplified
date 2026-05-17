import { test, expect } from '@playwright/test';
import { navigateToTasksAndSelectProject, waitForTasksPageReady, deleteTaskById } from './tasks-helpers';

test.describe('Task delete confirmation', () => {
  test.describe.configure({ mode: 'serial' });

  let projectId: number;
  let taskId: number | null = null;

  /** Create a throwaway task via API before each test so we have something to delete. */
  async function createTask(page: import('@playwright/test').Page): Promise<number> {
    const token: string | null = await page.evaluate(() => {
      try {
        const raw = localStorage.getItem('auth-storage');
        return raw ? (JSON.parse(raw) as any)?.state?.token ?? null : null;
      } catch { return null; }
    });
    if (!token) throw new Error('No auth token');

    const origin = new URL(page.url()).origin;
    const res = await page.request.post(`${origin}/api/tasks/`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { project_id: projectId, summary: 'E2E Delete confirm test', type: 'budget', create_as_draft: true },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    return body.id as number;
  }

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
    const page = await context.newPage();
    projectId = await navigateToTasksAndSelectProject(page);
    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    taskId = null;
    await page.goto(`/tasks?project_id=${projectId}`);
    await waitForTasksPageReady(page);
    await page.getByTestId('tab-tasks').click();
    await expect(page.getByTestId('task-list')).toBeVisible({ timeout: 15_000 });
    taskId = await createTask(page);
    await page.reload();
    await waitForTasksPageReady(page);
    await page.getByTestId('tab-tasks').click();
    await expect(page.getByTestId('task-list')).toBeVisible({ timeout: 15_000 });
  });

  test.afterEach(async ({ page }) => {
    if (taskId) {
      await deleteTaskById(page, taskId).catch(() => {});
      taskId = null;
    }
  });

  async function openDrawerForTask(page: import('@playwright/test').Page, id: number) {
    await page.locator(`[data-testid="task-row-open"][data-summary-id="${id}"]`).click();
    await expect(page.getByTestId('task-drawer')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('task-drawer').getByText(`Task #${id}`)).toBeVisible({ timeout: 10_000 });
  }

  test('clicking delete button in drawer shows confirmation dialog', async ({ page }) => {
    await openDrawerForTask(page, taskId!);

    await page.getByTestId('delete-task-button').click();

    await expect(page.getByRole('heading', { name: 'Delete task' })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/permanently removed/i)).toBeVisible({ timeout: 5_000 });
  });

  test('cancelling the dialog leaves the task intact and closes the dialog', async ({ page }) => {
    await openDrawerForTask(page, taskId!);

    await page.getByTestId('delete-task-button').click();
    await expect(page.getByRole('heading', { name: 'Delete task' })).toBeVisible({ timeout: 5_000 });

    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(page.getByRole('heading', { name: 'Delete task' })).not.toBeVisible({ timeout: 5_000 });
    // Drawer still open — task not deleted
    await expect(page.getByTestId('task-drawer')).toBeVisible({ timeout: 5_000 });
  });

  test('confirming deletion deletes the task and closes the drawer', async ({ page }) => {
    await openDrawerForTask(page, taskId!);

    await page.getByTestId('delete-task-button').click();
    await expect(page.getByRole('heading', { name: 'Delete task' })).toBeVisible({ timeout: 5_000 });

    const deleteResponsePromise = page.waitForResponse((resp) => {
      const url = new URL(resp.url());
      return url.pathname.includes('/api/tasks/') && resp.request().method() === 'DELETE';
    });

    await page.getByRole('button', { name: 'Delete', exact: true }).click();

    const response = await deleteResponsePromise;
    expect(response.ok()).toBeTruthy();
    taskId = null; // already deleted — skip afterEach cleanup

    await expect(page.getByTestId('task-drawer')).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Task deleted')).toBeVisible({ timeout: 5_000 });
  });

  test('confirm button is disabled while deletion is in progress', async ({ page }) => {
    await openDrawerForTask(page, taskId!);

    await page.getByTestId('delete-task-button').click();
    await expect(page.getByRole('heading', { name: 'Delete task' })).toBeVisible({ timeout: 5_000 });

    // Intercept and delay the DELETE request so we can observe the disabled state
    await page.route('**/api/tasks/**', async (route) => {
      if (route.request().method() === 'DELETE') {
        await new Promise((r) => setTimeout(r, 1_500));
        await route.continue();
      } else {
        await route.continue();
      }
    });

    const confirmBtn = page.getByRole('button', { name: /Delete/i }).last();
    await confirmBtn.click();

    // While the request is in-flight the button should be disabled and say "Deleting…"
    await expect(page.getByRole('button', { name: 'Deleting…' })).toBeDisabled({ timeout: 3_000 });

    taskId = null;
  });

  test('navigating to another task while dialog is open dismisses the dialog', async ({ page }) => {
    const rows = page.getByTestId('task-row-open');
    const count = await rows.count();
    if (count < 2) {
      test.skip();
      return;
    }

    await rows.first().click();
    await expect(page.getByTestId('task-drawer')).toBeVisible({ timeout: 10_000 });

    await page.getByTestId('delete-task-button').click();
    await expect(page.getByRole('heading', { name: 'Delete task' })).toBeVisible({ timeout: 5_000 });

    // Navigate to next task — dialog should reset
    await page.getByTestId('drawer-nav-next').click();

    await expect(page.getByRole('heading', { name: 'Delete task' })).not.toBeVisible({ timeout: 5_000 });
  });
});
