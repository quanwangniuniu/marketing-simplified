import { test, expect } from '@playwright/test';
import {
  navigateToTasksAndSelectProject,
  navigateToNewTaskPage,
  submitNewTaskAndGetId,
  deleteTaskById,
  selectFirstAvailableApprover,
} from './tasks-helpers';

test.describe('Task creation flow', () => {
  test.describe.configure({ mode: 'serial' });

  let createdTaskId: number | null = null;
  let projectId: number;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
    const page = await context.newPage();
    projectId = await navigateToTasksAndSelectProject(page);
    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    createdTaskId = null;
    await navigateToNewTaskPage(page, projectId);
  });

  test.afterEach(async ({ page }) => {
    if (createdTaskId) {
      try { await deleteTaskById(page, createdTaskId); } catch { /* best-effort */ }
      createdTaskId = null;
    }
  });

  test('user can create a new task', async ({ page }) => {
    // Select work type
    await page.getByRole('button', { name: 'Asset', exact: true }).click();

    // Fill summary
    await page.getByPlaceholder('Summary of this task').fill('E2E Asset Task – create flow');

    // Required type field: tags (text input)
    const tagsInput = page.locator('#task-field-asset-tags');
    if (await tagsInput.isVisible().catch(() => false)) {
      await tagsInput.fill('e2e,test');
    }

    await selectFirstAvailableApprover(page);
    createdTaskId = await submitNewTaskAndGetId(page);

    expect(createdTaskId).toBeTruthy();
    await expect(page.locator('[data-testid="toast-error"]')).not.toBeVisible();
  });
});
