/**
 * E2E tests for MED-238 — the legal recovery path after rejection:
 *   create → submit → review → REJECT → (approve/lock hidden) → Revise (reopen)
 *   → resubmit → review → APPROVE
 *
 * Also pins the governance rule end-to-end: while a budget task is REJECTED,
 * the UI offers no Approve/Lock action and the lock endpoint refuses with 400.
 *
 * Tests run serially so each step can rely on the task mutated by the previous one.
 */

import { test, expect, type Page } from '@playwright/test';
import { waitForTasksPageReady, deleteTaskById } from '../tasks/tasks-helpers';

// ---------------------------------------------------------------------------
// Helpers (mirrors budget-task-flow.spec.ts)
// ---------------------------------------------------------------------------

/** Get the JWT token stored in localStorage by the auth layer. */
async function getToken(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    try {
      const raw = localStorage.getItem('auth-storage-v1');
      return raw ? (JSON.parse(raw) as any)?.state?.token ?? null : null;
    } catch {
      return null;
    }
  });
}

/** Wait until the task drawer is visible and skeletons settled. */
async function waitForDrawerReady(page: Page) {
  await expect(page.getByTestId('task-drawer')).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(
    () => !document.querySelector('.animate-pulse'),
    { timeout: 15_000 },
  );
}

/** Click an FSM action button (Submit, Start Review, Approve, …). */
async function clickFsmButton(page: Page, label: string) {
  const btn = page.getByRole('button', { name: label, exact: true });
  await expect(btn).toBeVisible({ timeout: 10_000 });
  await expect(btn).toBeEnabled();
  await btn.click();
}

/** Fetch a task via the REST API and return its JSON. */
async function fetchTask(page: Page, taskId: number): Promise<any> {
  const token = await getToken(page);
  const origin = new URL(page.url()).origin;
  const resp = await page.request.get(`${origin}/api/tasks/${taskId}/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return resp.json();
}

/** Drive a fresh budget task to UNDER_REVIEW through the UI.
 *
 * A budget task created with current_approver_id starts life SUBMITTED, so
 * usually only "Start Review" is needed; the DRAFT branch (fill details,
 * submit) is kept as a fallback.
 */
async function bringTaskUnderReview(page: Page, projectId: number, taskId: number): Promise<boolean> {
  await page.goto(`/tasks?project_id=${projectId}&drawerTaskId=${taskId}`);
  await waitForDrawerReady(page);

  const startReviewBtn = page.getByRole('button', { name: 'Start Review', exact: true });
  if (!(await startReviewBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
    // DRAFT fallback: fill required budget details (pool + amount) and submit
    const section = page.locator('section', { hasText: 'Budget details' });
    await section.getByRole('button', { name: 'Edit' }).click();
    const poolSelect = page.locator('#task-field-budget-budget_pool_composite');
    await expect(poolSelect).toBeVisible({ timeout: 10_000 });

    let chosenPool = '';
    for (const opt of await poolSelect.locator('option').all()) {
      const val = await opt.getAttribute('value');
      if (val && val.trim()) { chosenPool = val; break; }
    }
    if (!chosenPool) return false; // no pools in this environment

    await poolSelect.selectOption(chosenPool);
    await page.locator('#task-field-budget-amount').fill('100');
    await section.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(/details (updated|saved)/i)).toBeVisible({ timeout: 10_000 });

    await clickFsmButton(page, 'Submit');
    await expect(page.getByText(/submitted/i).first()).toBeVisible({ timeout: 10_000 });
  }

  await clickFsmButton(page, 'Start Review');
  await expect(page.getByText(/under.?review/i).first()).toBeVisible({ timeout: 10_000 });
  return true;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe('Budget task reject → reopen → approve (MED-238)', () => {
  test.describe.configure({ mode: 'serial' });

  let projectId: number;
  let taskId: number | null = null;
  let flowReady = false;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
    const pg = await ctx.newPage();
    // Go straight to an app page: the project store auto-selects the first
    // project only once the app shell (OnboardingContext) is mounted, which
    // never happens on the marketing landing page.
    await pg.goto('/tasks');
    await waitForTasksPageReady(pg);
    await pg.waitForFunction(() => {
      try {
        const raw = localStorage.getItem('project-storage-v1');
        return Boolean(raw && (JSON.parse(raw) as any)?.state?.activeProject?.id);
      } catch {
        return false;
      }
    }, { timeout: 30_000 });
    projectId = await pg.evaluate(() => {
      const raw = localStorage.getItem('project-storage-v1');
      return (JSON.parse(raw!) as any).state.activeProject.id as number;
    });
    await ctx.close();
  });

  test.afterAll(async ({ browser }) => {
    if (taskId == null) return;
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
    const pg = await ctx.newPage();
    await pg.goto('/tasks');
    await waitForTasksPageReady(pg);
    await deleteTaskById(pg, taskId).catch(() => {});
    await ctx.close();
  });

  test('1. create a budget task and bring it under review', async ({ page }) => {
    await page.goto(`/tasks?project_id=${projectId}`);
    await waitForTasksPageReady(page);

    const token = await getToken(page);
    const origin = new URL(page.url()).origin;
    const approverId = await page.evaluate(() => {
      try {
        const raw = localStorage.getItem('auth-storage-v1');
        return raw ? (JSON.parse(raw) as any)?.state?.user?.id ?? null : null;
      } catch {
        return null;
      }
    });
    const createResp = await page.request.post(`${origin}/api/tasks/`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: JSON.stringify({
        summary: 'E2E MED-238 Reject Reopen Flow',
        type: 'budget',
        project: projectId,
        current_approver_id: approverId,
      }),
    });
    expect(createResp.ok()).toBeTruthy();
    taskId = (await createResp.json()).id;
    expect(taskId).toBeTruthy();

    flowReady = await bringTaskUnderReview(page, projectId, taskId!);
    if (!flowReady) {
      test.info().annotations.push({ type: 'skip', description: 'No budget pools available in this environment' });
    }
  });

  test('2. reject the task with a comment (UNDER_REVIEW → REJECTED)', async ({ page }) => {
    test.skip(!flowReady, 'Flow prerequisites unavailable');

    // The review section (comment + Approve/Reject) lives on the full task
    // detail page, not in the drawer.
    await page.goto(`/tasks/${taskId}?project_id=${projectId}`);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('#review-comment')).toBeVisible({ timeout: 15_000 });
    await page.locator('#review-comment').fill('E2E: rejecting to test the reopen path');
    await clickFsmButton(page, 'Reject');

    await expect(page.getByText(/rejected/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('3. while REJECTED, the UI hides Approve/Reject/Lock and offers Revise', async ({ page }) => {
    test.skip(!flowReady, 'Flow prerequisites unavailable');

    await page.goto(`/tasks/${taskId}?project_id=${projectId}`);
    await page.waitForLoadState('networkidle');

    const taskData = await fetchTask(page, taskId!);
    expect(taskData.status).toBe('REJECTED');

    // Illegal actions are hidden…
    await expect(page.getByRole('button', { name: 'Approve', exact: true })).not.toBeVisible({ timeout: 3_000 });
    await expect(page.getByRole('button', { name: 'Reject', exact: true })).not.toBeVisible({ timeout: 3_000 });
    await expect(page.getByRole('button', { name: 'Lock', exact: true })).not.toBeVisible({ timeout: 3_000 });

    // …and the only way forward is Revise
    await expect(page.getByRole('button', { name: 'Revise', exact: true })).toBeVisible({ timeout: 10_000 });
  });

  test('4. lock endpoint refuses a REJECTED task with 400 (no pool deduction)', async ({ page }) => {
    test.skip(!flowReady, 'Flow prerequisites unavailable');

    await page.goto(`/tasks/${taskId}?project_id=${projectId}`);
    await page.waitForLoadState('networkidle');

    const token = await getToken(page);
    const origin = new URL(page.url()).origin;
    const lockResp = await page.request.post(`${origin}/api/tasks/${taskId}/lock/`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: '{}',
    });
    expect(lockResp.status()).toBe(400);

    // Status must remain REJECTED — the request never reached LOCKED
    const taskData = await fetchTask(page, taskId!);
    expect(taskData.status).toBe('REJECTED');
  });

  test('5. revise reopens the task as a draft (REJECTED → DRAFT)', async ({ page }) => {
    test.skip(!flowReady, 'Flow prerequisites unavailable');

    await page.goto(`/tasks/${taskId}?project_id=${projectId}`);
    await page.waitForLoadState('networkidle');

    await clickFsmButton(page, 'Revise');
    await expect(page.getByText(/draft/i).first()).toBeVisible({ timeout: 10_000 });

    const taskData = await fetchTask(page, taskId!);
    expect(taskData.status).toBe('DRAFT');
  });

  test('6. resubmit and approve the revised draft (happy path completes)', async ({ page }) => {
    test.skip(!flowReady, 'Flow prerequisites unavailable');

    await page.goto(`/tasks/${taskId}?project_id=${projectId}`);
    await page.waitForLoadState('networkidle');

    await clickFsmButton(page, 'Submit');
    await expect(page.getByText(/submitted/i).first()).toBeVisible({ timeout: 10_000 });

    await clickFsmButton(page, 'Start Review');
    await expect(page.getByText(/under.?review/i).first()).toBeVisible({ timeout: 10_000 });

    await expect(page.locator('#review-comment')).toBeVisible({ timeout: 15_000 });
    await page.locator('#review-comment').fill('E2E: approving the revised request');
    await clickFsmButton(page, 'Approve');
    await expect(page.getByText(/approved/i).first()).toBeVisible({ timeout: 10_000 });

    const taskData = await fetchTask(page, taskId!);
    expect(taskData.status).toBe('APPROVED');
  });
});
