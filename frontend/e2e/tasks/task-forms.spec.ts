import { test, expect } from '@playwright/test';
import {
  navigateToTasksAndSelectProject,
  navigateToNewTaskPage,
  submitNewTaskAndGetId,
  deleteTaskById,
  deleteAllE2ETasks,
  selectFirstAvailableApprover,
} from './tasks-helpers';

const tomorrow = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const nextWeek = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

test.describe('Task-type specific forms', () => {
  test.describe.configure({ mode: 'serial' });

  let createdTaskId: number | null = null;
  let projectId: number;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
    const page = await context.newPage();
    projectId = await navigateToTasksAndSelectProject(page);
    // Clean up any E2E tasks left over from interrupted prior runs.
    await deleteAllE2ETasks(page);
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

  test('user can fill a Report task-type form', async ({ page }) => {
    await page.getByRole('button', { name: 'Report', exact: true }).click();
    await page.getByPlaceholder('Summary of this task').fill('E2E Report Task');

    // required: audience_type
    await expect(page.locator('#task-field-report-audience_type')).toBeVisible({ timeout: 10_000 });
    await page.locator('#task-field-report-audience_type').selectOption('client');
    await selectFirstAvailableApprover(page);

    createdTaskId = await submitNewTaskAndGetId(page);
    expect(createdTaskId).toBeTruthy();
  });

  test('user can fill a Scaling task-type form', async ({ page }) => {
    await page.getByRole('button', { name: 'Scaling', exact: true }).click();
    await page.getByPlaceholder('Summary of this task').fill('E2E Scaling Task');

    // required: scaling_target
    await expect(page.locator('#task-field-scaling-scaling_target')).toBeVisible({ timeout: 10_000 });
    await page.locator('#task-field-scaling-scaling_target').fill('Scale Meta campaigns by 20%');
    await selectFirstAvailableApprover(page);

    createdTaskId = await submitNewTaskAndGetId(page);
    expect(createdTaskId).toBeTruthy();
  });

  test('user can fill an Alert task-type form', async ({ page }) => {
    await page.getByRole('button', { name: 'Alert', exact: true }).click();
    await page.getByPlaceholder('Summary of this task').fill('E2E Alert Task');

    // required: alert_type, severity
    await expect(page.locator('#task-field-alert-alert_type')).toBeVisible({ timeout: 10_000 });
    await page.locator('#task-field-alert-alert_type').selectOption('performance_drop');
    await page.locator('#task-field-alert-severity').selectOption('medium');
    await selectFirstAvailableApprover(page);

    createdTaskId = await submitNewTaskAndGetId(page);
    expect(createdTaskId).toBeTruthy();
  });

  test('user can fill an Experiment task-type form', async ({ page }) => {
    await page.getByRole('button', { name: 'Experiment', exact: true }).click();
    await page.getByPlaceholder('Summary of this task').fill('E2E Experiment Task');

    // required: hypothesis
    await expect(page.locator('#task-field-experiment-hypothesis')).toBeVisible({ timeout: 10_000 });
    await page.locator('#task-field-experiment-hypothesis').fill('Test if increasing budget improves ROAS');

    // set start + due dates so experiment date validation passes
    const dateInputs = page.locator('input[type="date"]');
    const count = await dateInputs.count();
    if (count >= 2) {
      await dateInputs.nth(count - 2).fill(tomorrow());
      await dateInputs.nth(count - 1).fill(nextWeek());
    }
    await selectFirstAvailableApprover(page);

    createdTaskId = await submitNewTaskAndGetId(page);
    expect(createdTaskId).toBeTruthy();
  });

  test('user can fill an Optimization task-type form', async ({ page }) => {
    await page.getByRole('button', { name: 'Optimization', exact: true }).click();
    await page.getByPlaceholder('Summary of this task').fill('E2E Optimization Task');

    // required: action_type
    await expect(page.locator('#task-field-optimization-action_type')).toBeVisible({ timeout: 10_000 });
    await page.locator('#task-field-optimization-action_type').selectOption('edit');
    await selectFirstAvailableApprover(page);

    createdTaskId = await submitNewTaskAndGetId(page);
    expect(createdTaskId).toBeTruthy();
  });

  test('user can fill a Client Communication task-type form', async ({ page }) => {
    await page.getByRole('button', { name: 'Client Communication', exact: true }).click();
    await page.getByPlaceholder('Summary of this task').fill('E2E Client Communication Task');

    // required: communication_type
    await expect(page.locator('#task-field-communication-communication_type')).toBeVisible({ timeout: 10_000 });
    await page.locator('#task-field-communication-communication_type').selectOption('budget_change');

    // required: impacted_areas (tags field — plain text input)
    await page.locator('#task-field-communication-impacted_areas').fill('budget, creative');
    await selectFirstAvailableApprover(page);

    createdTaskId = await submitNewTaskAndGetId(page);
    expect(createdTaskId).toBeTruthy();
  });

  test('user can fill a Retrospective task-type form', async ({ page }) => {
    await page.getByRole('button', { name: 'Retrospective', exact: true }).click();
    await page.getByPlaceholder('Summary of this task').fill('E2E Retrospective Task');

    // Select approver (required for all task types); do this before the button check
    await selectFirstAvailableApprover(page);
    await expect(page.getByRole('button', { name: 'Create task', exact: true })).not.toBeDisabled({ timeout: 5_000 });

    createdTaskId = await submitNewTaskAndGetId(page);
    expect(createdTaskId).toBeTruthy();
  });

  test('user can fill a Platform Policy Update task-type form', async ({ page }) => {
    await page.getByRole('button', { name: 'Platform Policy Update', exact: true }).click();
    await page.getByPlaceholder('Summary of this task').fill('E2E Platform Policy Update Task');

    // required: platform, policy_change_type, policy_description, immediate_actions_required
    await expect(page.locator('#task-field-platform_policy_update-platform')).not.toBeDisabled({ timeout: 10_000 });
    await page.locator('#task-field-platform_policy_update-platform').selectOption({ index: 1 });

    await expect(page.locator('#task-field-platform_policy_update-policy_change_type')).not.toBeDisabled({ timeout: 10_000 });
    await page.locator('#task-field-platform_policy_update-policy_change_type').selectOption({ index: 1 });

    await page.locator('#task-field-platform_policy_update-policy_description').fill('New targeting restrictions on paid social.');
    await page.locator('#task-field-platform_policy_update-immediate_actions_required').fill('Audit active campaigns for compliance.');
    await selectFirstAvailableApprover(page);

    createdTaskId = await submitNewTaskAndGetId(page);
    expect(createdTaskId).toBeTruthy();
  });
});
