import { test, expect } from '@playwright/test';
import { navigateToTasksAndSelectProject, waitForTasksPageReady, deleteTaskById } from './tasks-helpers';

test.describe('Quick task create', () => {
  test.describe.configure({ mode: 'serial' });

  let projectId: number;
  let createdTaskId: number | null = null;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
    const page = await context.newPage();
    projectId = await navigateToTasksAndSelectProject(page);
    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    createdTaskId = null;
    await page.goto(`/tasks?project_id=${projectId}`);
    await waitForTasksPageReady(page);
    await page.getByTestId('tab-tasks').click();
    await expect(page.getByTestId('task-list')).toBeVisible({ timeout: 15_000 });
  });

  test.afterEach(async ({ page }) => {
    if (createdTaskId) {
      await deleteTaskById(page, createdTaskId).catch(() => {});
      createdTaskId = null;
    }
  });

  test('"Add a task" row is visible at the bottom of the list', async ({ page }) => {
    await expect(page.getByTestId('inline-add-task-row')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('inline-add-task-row')).toContainText('Add a task');
  });

  test('clicking "Add a task" opens the quick create modal', async ({ page }) => {
    await page.getByTestId('inline-add-task-row').click();
    await expect(page.getByTestId('quick-task-create-modal')).toBeVisible({ timeout: 5_000 });
  });

  test('modal closes with Escape key without creating', async ({ page }) => {
    await page.getByTestId('inline-add-task-row').click();
    await expect(page.getByTestId('quick-task-create-modal')).toBeVisible({ timeout: 5_000 });

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('quick-task-create-modal')).not.toBeVisible({ timeout: 5_000 });
  });

  test('modal closes by clicking the backdrop without creating', async ({ page }) => {
    await page.getByTestId('inline-add-task-row').click();
    await expect(page.getByTestId('quick-task-create-modal')).toBeVisible({ timeout: 5_000 });

    // Click the dark backdrop area (top-left corner, outside the panel)
    await page.mouse.click(10, 10);
    await expect(page.getByTestId('quick-task-create-modal')).not.toBeVisible({ timeout: 5_000 });
  });

  test('submit button is disabled when summary is empty', async ({ page }) => {
    await page.getByTestId('inline-add-task-row').click();
    await expect(page.getByTestId('quick-task-create-modal')).toBeVisible({ timeout: 5_000 });

    await expect(page.getByTestId('quick-task-submit-button')).toBeDisabled();
  });

  test('can create a task by filling summary and clicking Create', async ({ page }) => {
    await page.getByTestId('inline-add-task-row').click();
    await expect(page.getByTestId('quick-task-create-modal')).toBeVisible({ timeout: 5_000 });

    const responsePromise = page.waitForResponse((resp) => {
      const path = new URL(resp.url()).pathname;
      return (path === '/api/tasks/' || path === '/api/tasks') && resp.request().method() === 'POST';
    });

    await page.getByTestId('quick-task-summary-input').fill('E2E Quick create test');
    await page.getByTestId('quick-task-submit-button').click();

    const response = await responsePromise;
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    createdTaskId = body.id ?? null;

    await expect(page.getByTestId('quick-task-create-modal')).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Task created')).toBeVisible({ timeout: 5_000 });
  });

  test('pressing Enter submits the form when summary is filled', async ({ page }) => {
    await page.getByTestId('inline-add-task-row').click();
    await expect(page.getByTestId('quick-task-create-modal')).toBeVisible({ timeout: 5_000 });

    const responsePromise = page.waitForResponse((resp) => {
      const path = new URL(resp.url()).pathname;
      return (path === '/api/tasks/' || path === '/api/tasks') && resp.request().method() === 'POST';
    });

    await page.getByTestId('quick-task-summary-input').fill('E2E Quick create Enter key');
    await page.keyboard.press('Enter');

    const response = await responsePromise;
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    createdTaskId = body.id ?? null;

    await expect(page.getByTestId('quick-task-create-modal')).not.toBeVisible({ timeout: 10_000 });
  });

  test('"Open in drawer after creating" opens the drawer on success', async ({ page }) => {
    await page.getByTestId('inline-add-task-row').click();
    await expect(page.getByTestId('quick-task-create-modal')).toBeVisible({ timeout: 5_000 });

    // Checkbox is checked by default — verify and keep it checked
    const checkbox = page.getByLabel('Open in drawer after creating');
    await expect(checkbox).toBeChecked();

    const responsePromise = page.waitForResponse((resp) => {
      const path = new URL(resp.url()).pathname;
      return (path === '/api/tasks/' || path === '/api/tasks') && resp.request().method() === 'POST';
    });

    await page.getByTestId('quick-task-summary-input').fill('E2E Quick create drawer open');
    await page.getByTestId('quick-task-submit-button').click();

    const response = await responsePromise;
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    createdTaskId = body.id ?? null;

    await expect(page.getByTestId('task-drawer')).toBeVisible({ timeout: 10_000 });
  });

  test('unchecking "Open in drawer" does not open the drawer after creation', async ({ page }) => {
    await page.getByTestId('inline-add-task-row').click();
    await expect(page.getByTestId('quick-task-create-modal')).toBeVisible({ timeout: 5_000 });

    await page.getByLabel('Open in drawer after creating').uncheck();

    const responsePromise = page.waitForResponse((resp) => {
      const path = new URL(resp.url()).pathname;
      return (path === '/api/tasks/' || path === '/api/tasks') && resp.request().method() === 'POST';
    });

    await page.getByTestId('quick-task-summary-input').fill('E2E Quick create no drawer');
    await page.getByTestId('quick-task-submit-button').click();

    const response = await responsePromise;
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    createdTaskId = body.id ?? null;

    await expect(page.getByTestId('quick-task-create-modal')).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('task-drawer')).not.toBeVisible({ timeout: 3_000 });
  });

  test('shows filter warning toast when active status filter would hide the new task', async ({ page }) => {
    // Open the filter panel and select "Approved" status — new tasks are DRAFT so they'll be hidden
    await page.getByTestId('filter-panel-trigger').click();

    // Navigate to the Status filter tab inside the panel
    await page.getByRole('button', { name: 'Status' }).click();

    // Check the Approved checkbox
    await page.getByText('Approved').click();

    // Close the filter panel by clicking outside
    await page.mouse.click(10, 10);

    await page.getByTestId('inline-add-task-row').click();
    await expect(page.getByTestId('quick-task-create-modal')).toBeVisible({ timeout: 5_000 });

    const responsePromise = page.waitForResponse((resp) => {
      const path = new URL(resp.url()).pathname;
      return (path === '/api/tasks/' || path === '/api/tasks') && resp.request().method() === 'POST';
    });

    await page.getByTestId('quick-task-summary-input').fill('E2E Quick create filtered');
    await page.getByTestId('quick-task-submit-button').click();

    const response = await responsePromise;
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    createdTaskId = body.id ?? null;

    await expect(page.getByText(/hidden by your active filters/i)).toBeVisible({ timeout: 5_000 });
  });
});
