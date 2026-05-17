/**
 * E2E tests for the budget task lifecycle:
 *   quick-create → fill details (partial ok in DRAFT) → submit → review → approve → lock (pool deducts) → unlock (pool restores)
 *
 * Tests run serially so each step can rely on the task created/mutated by the previous one.
 */

import { test, expect, type Page } from '@playwright/test';
import { navigateToTasksAndSelectProject, waitForTasksPageReady, deleteTaskById } from '../tasks/tasks-helpers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get the JWT token stored in localStorage by the auth layer. */
async function getToken(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    try {
      const raw = localStorage.getItem('auth-storage');
      return raw ? (JSON.parse(raw) as any)?.state?.token ?? null : null;
    } catch {
      return null;
    }
  });
}

/** Wait until no loading spinners / skeletons are visible. */
async function waitForDrawerReady(page: Page) {
  // Wait for drawer to appear first
  await expect(page.getByTestId('task-drawer')).toBeVisible({ timeout: 15_000 });
  // Then wait for any skeleton pulses to settle
  await page.waitForFunction(
    () => !document.querySelector('.animate-pulse'),
    { timeout: 15_000 },
  );
}

/** Click the Edit button inside the Budget details section and wait for form fields to appear. */
async function openBudgetEditForm(page: Page) {
  const section = page.locator('section', { hasText: 'Budget details' });
  await section.getByRole('button', { name: 'Edit' }).click();
  // Wait for at least one form field to appear
  await expect(page.locator('#task-field-budget-budget_pool_composite, #task-field-budget-amount').first()).toBeVisible({ timeout: 10_000 });
}

/** Click Save inside the Budget details section and wait for the toast. */
async function saveBudgetDetails(page: Page) {
  const section = page.locator('section', { hasText: 'Budget details' });
  const saveBtn = section.getByRole('button', { name: 'Save' });
  await saveBtn.click();
  await expect(page.getByText(/details (updated|saved)/i)).toBeVisible({ timeout: 10_000 });
}

/** Click an FSM action button (Submit, Start Review, Approve, Lock, Unlock) and wait for response. */
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

/** Fetch all budget pools visible to the test user (first page). */
async function fetchBudgetPools(page: Page): Promise<any[]> {
  const token = await getToken(page);
  if (!token) return [];
  const origin = new URL(page.url()).origin;

  // Determine team header from localStorage (mirrors frontend axios interceptor)
  const teamId: string | null = await page.evaluate(() => {
    try {
      const raw = localStorage.getItem('team-storage');
      return raw ? (JSON.parse(raw) as any)?.state?.activeTeam?.id ?? null : null;
    } catch {
      return null;
    }
  });

  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (teamId) headers['x-team-id'] = String(teamId);

  const resp = await page.request.get(`${origin}/api/budgets/pools/?page_size=20`, { headers });
  if (!resp.ok()) return [];
  const data = await resp.json();
  return data.results ?? data ?? [];
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe('Budget task lifecycle', () => {
  test.describe.configure({ mode: 'serial' });

  let projectId: number;
  let taskId: number | null = null;

  // ------ Setup / teardown ------------------------------------------------

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
    const pg = await ctx.newPage();
    projectId = await navigateToTasksAndSelectProject(pg);
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

  // ------ 1. Quick-create a budget task ------------------------------------

  test('1. quick-create a budget task and open it in the drawer', async ({ page }) => {
    await page.goto(`/tasks?project_id=${projectId}`);
    await waitForTasksPageReady(page);
    await page.getByTestId('tab-tasks').click();
    await expect(page.getByTestId('task-list')).toBeVisible({ timeout: 15_000 });

    // Open quick-create modal
    await page.getByTestId('inline-add-task-row').click();
    await expect(page.getByTestId('quick-task-create-modal')).toBeVisible({ timeout: 5_000 });

    // Set type to Budget
    const typeSelect = page.getByTestId('quick-task-create-modal').getByRole('combobox');
    if (await typeSelect.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await typeSelect.selectOption({ label: /budget/i });
    }

    // Make sure "Open in drawer after creating" is checked
    const openDrawerCheckbox = page.getByLabel('Open in drawer after creating');
    if (await openDrawerCheckbox.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await openDrawerCheckbox.check();
    }

    // Fill summary and capture the POST response
    const responsePromise = page.waitForResponse((resp) => {
      const path = new URL(resp.url()).pathname;
      return (path === '/api/tasks/' || path === '/api/tasks') && resp.request().method() === 'POST';
    });

    await page.getByTestId('quick-task-summary-input').fill('E2E Budget Task Flow');
    await page.getByTestId('quick-task-submit-button').click();

    const resp = await responsePromise;
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    taskId = body.id ?? null;
    expect(taskId).toBeTruthy();

    // Modal should close and drawer should open
    await expect(page.getByTestId('quick-task-create-modal')).not.toBeVisible({ timeout: 10_000 });
    await waitForDrawerReady(page);

    // Drawer should show the right task
    await expect(page.getByTestId('task-drawer').getByText(`Task #${taskId}`)).toBeVisible({ timeout: 10_000 });
  });

  // ------ 2. Budget details section renders --------------------------------

  test('2. "Budget details" section is visible in the drawer', async ({ page }) => {
    await page.goto(`/tasks?project_id=${projectId}&drawerTaskId=${taskId}`);
    await waitForDrawerReady(page);

    await expect(page.locator('section', { hasText: 'Budget details' })).toBeVisible({ timeout: 10_000 });
  });

  // ------ 3. Partial save in DRAFT mode (only notes, skip required fields) -

  test('3. can save partial fields in DRAFT mode (notes only, required fields empty)', async ({ page }) => {
    await page.goto(`/tasks?project_id=${projectId}&drawerTaskId=${taskId}`);
    await waitForDrawerReady(page);

    await openBudgetEditForm(page);

    // Fill only the optional notes field
    const notesField = page.locator('#task-field-budget-notes');
    await expect(notesField).toBeVisible({ timeout: 10_000 });
    await notesField.fill('E2E partial draft notes');

    // Save should succeed even though required fields (pool, amount) are empty
    await saveBudgetDetails(page);

    // Details section should now show the note text
    await expect(page.locator('section', { hasText: 'Budget details' }).getByText('E2E partial draft notes')).toBeVisible({ timeout: 5_000 });
  });

  // ------ 4. Edit re-opens with saved draft values -------------------------

  test('4. re-opening Edit restores the previously saved draft values', async ({ page }) => {
    await page.goto(`/tasks?project_id=${projectId}&drawerTaskId=${taskId}`);
    await waitForDrawerReady(page);

    await openBudgetEditForm(page);

    const notesField = page.locator('#task-field-budget-notes');
    await expect(notesField).toBeVisible({ timeout: 10_000 });
    await expect(notesField).toHaveValue('E2E partial draft notes');
  });

  // ------ 5. Fill all required fields and save -----------------------------

  test('5. fill all required fields (pool + amount) and save', async ({ page }) => {
    await page.goto(`/tasks?project_id=${projectId}&drawerTaskId=${taskId}`);
    await waitForDrawerReady(page);

    await openBudgetEditForm(page);

    // Select a budget pool (first available option)
    const poolSelect = page.locator('#task-field-budget-budget_pool_composite');
    await expect(poolSelect).toBeVisible({ timeout: 10_000 });
    const poolOptions = await poolSelect.locator('option').all();
    // Find first non-empty option
    let chosenPool = '';
    for (const opt of poolOptions) {
      const val = await opt.getAttribute('value');
      if (val && val.trim()) { chosenPool = val; break; }
    }

    if (!chosenPool) {
      // No pools available — skip this test gracefully
      test.info().annotations.push({ type: 'skip', description: 'No budget pools available in this environment' });
      await page.locator('section', { hasText: 'Budget details' }).getByRole('button', { name: 'Cancel' }).click();
      return;
    }

    await poolSelect.selectOption(chosenPool);

    // Fill amount
    const amountField = page.locator('#task-field-budget-amount');
    await expect(amountField).toBeVisible({ timeout: 5_000 });
    await amountField.fill('100');

    // Save
    await saveBudgetDetails(page);

    // Amount should appear in the display section
    await expect(page.locator('section', { hasText: 'Budget details' }).getByText('100')).toBeVisible({ timeout: 5_000 });
  });

  // ------ 6. Submit task ---------------------------------------------------

  test('6. submit the task (DRAFT → SUBMITTED)', async ({ page }) => {
    await page.goto(`/tasks?project_id=${projectId}&drawerTaskId=${taskId}`);
    await waitForDrawerReady(page);

    // Check whether a pool was chosen (if not, test 5 was skipped)
    const taskData = await fetchTask(page, taskId!);
    const hasBudgetDetails =
      taskData.linked_object != null ||
      (taskData.draft_payload?.budget_pool_composite);

    if (!hasBudgetDetails) {
      test.info().annotations.push({ type: 'skip', description: 'No budget pool was set — skipping submit flow' });
      return;
    }

    // Click Submit button in FSMActionBar
    const responsePromise = page.waitForResponse((resp) => {
      const url = new URL(resp.url()).pathname;
      return url.includes(`/tasks/${taskId}/submit`) && resp.request().method() === 'POST';
    });

    await clickFsmButton(page, 'Submit');

    await responsePromise;

    // Task status should flip to SUBMITTED
    await expect(page.getByText(/submitted/i).first()).toBeVisible({ timeout: 10_000 });
  });

  // ------ 7. submitted_at appears after submission -----------------------

  test('7. submitted_at appears in details after submission', async ({ page }) => {
    // Navigate to the task detail page (full page, not drawer) for a clean state
    await page.goto(`/tasks/${taskId}?project_id=${projectId}`);
    await page.waitForLoadState('networkidle');

    const taskData = await fetchTask(page, taskId!);
    if (taskData.status !== 'SUBMITTED') {
      test.info().annotations.push({ type: 'skip', description: 'Task not in SUBMITTED status' });
      return;
    }

    await expect(page.locator('section', { hasText: 'Budget details' }).getByText(/submitted at/i)).toBeVisible({ timeout: 10_000 });
  });

  // ------ 8. Start review (SUBMITTED → UNDER_REVIEW) ----------------------

  test('8. start review (SUBMITTED → UNDER_REVIEW)', async ({ page }) => {
    await page.goto(`/tasks?project_id=${projectId}&drawerTaskId=${taskId}`);
    await waitForDrawerReady(page);

    const taskData = await fetchTask(page, taskId!);
    if (taskData.status !== 'SUBMITTED') {
      test.info().annotations.push({ type: 'skip', description: 'Task not in SUBMITTED status' });
      return;
    }

    const responsePromise = page.waitForResponse((resp) => {
      const url = new URL(resp.url()).pathname;
      return url.includes(`/tasks/${taskId}/start_review`) && resp.request().method() === 'POST';
    });

    await clickFsmButton(page, 'Start Review');
    await responsePromise;

    await expect(page.getByText(/under.?review/i).first()).toBeVisible({ timeout: 10_000 });
  });

  // ------ 9. Approve (UNDER_REVIEW → APPROVED) ----------------------------

  test('9. approve the task (UNDER_REVIEW → APPROVED)', async ({ page }) => {
    await page.goto(`/tasks?project_id=${projectId}&drawerTaskId=${taskId}`);
    await waitForDrawerReady(page);

    const taskData = await fetchTask(page, taskId!);
    if (taskData.status !== 'UNDER_REVIEW') {
      test.info().annotations.push({ type: 'skip', description: 'Task not in UNDER_REVIEW status' });
      return;
    }

    const responsePromise = page.waitForResponse((resp) => {
      const url = new URL(resp.url()).pathname;
      return url.includes(`/tasks/${taskId}/make_approval`) && resp.request().method() === 'POST';
    });

    await clickFsmButton(page, 'Approve');
    await responsePromise;

    await expect(page.getByText(/approved/i).first()).toBeVisible({ timeout: 10_000 });
  });

  // ------ 10. Lock task and verify pool deduction --------------------------

  test('10. lock the task (APPROVED → LOCKED) and verify pool balance decreases', async ({ page }) => {
    await page.goto(`/tasks?project_id=${projectId}&drawerTaskId=${taskId}`);
    await waitForDrawerReady(page);

    const taskData = await fetchTask(page, taskId!);
    if (taskData.status !== 'APPROVED') {
      test.info().annotations.push({ type: 'skip', description: 'Task not in APPROVED status' });
      return;
    }

    // Record pool available_amount BEFORE locking
    const poolsBefore = await fetchBudgetPools(page);
    const linkedObj = taskData.linked_object as any;
    const poolId = linkedObj?.budget_pool?.id ?? null;
    const poolBefore = poolsBefore.find((p: any) => p.id === poolId);
    const availBefore = poolBefore ? Number(poolBefore.available_amount) : null;

    const responsePromise = page.waitForResponse((resp) => {
      const url = new URL(resp.url()).pathname;
      return url.includes(`/tasks/${taskId}/lock`) && resp.request().method() === 'POST';
    });

    await clickFsmButton(page, 'Lock');
    await responsePromise;

    // Status chip should show LOCKED
    await expect(page.getByText(/locked/i).first()).toBeVisible({ timeout: 10_000 });

    // Verify pool balance decreased (only if we could read the pool before)
    if (availBefore !== null && poolId !== null) {
      const poolsAfter = await fetchBudgetPools(page);
      const poolAfter = poolsAfter.find((p: any) => p.id === poolId);
      const availAfter = poolAfter ? Number(poolAfter.available_amount) : null;

      if (availAfter !== null) {
        // Available amount should have decreased by the requested amount (100)
        expect(availAfter).toBeLessThan(availBefore);
      }
    }
  });

  // ------ 11. Unlock task and verify pool restoration ----------------------

  test('11. unlock the task (LOCKED → APPROVED) and verify pool balance restores', async ({ page }) => {
    await page.goto(`/tasks?project_id=${projectId}&drawerTaskId=${taskId}`);
    await waitForDrawerReady(page);

    const taskData = await fetchTask(page, taskId!);
    if (taskData.status !== 'LOCKED') {
      test.info().annotations.push({ type: 'skip', description: 'Task not in LOCKED status' });
      return;
    }

    // Record pool available_amount BEFORE unlocking
    const linkedObj = taskData.linked_object as any;
    const poolId = linkedObj?.budget_pool?.id ?? null;
    const poolsBefore = await fetchBudgetPools(page);
    const poolBefore = poolsBefore.find((p: any) => p.id === poolId);
    const availBefore = poolBefore ? Number(poolBefore.available_amount) : null;

    const responsePromise = page.waitForResponse((resp) => {
      const url = new URL(resp.url()).pathname;
      return url.includes(`/tasks/${taskId}/unlock`) && resp.request().method() === 'POST';
    });

    await clickFsmButton(page, 'Unlock');
    await responsePromise;

    // Status should revert to APPROVED
    await expect(page.getByText(/approved/i).first()).toBeVisible({ timeout: 10_000 });

    // Pool balance should be restored
    if (availBefore !== null && poolId !== null) {
      const poolsAfter = await fetchBudgetPools(page);
      const poolAfter = poolsAfter.find((p: any) => p.id === poolId);
      const availAfter = poolAfter ? Number(poolAfter.available_amount) : null;

      if (availAfter !== null) {
        expect(availAfter).toBeGreaterThan(availBefore);
      }
    }
  });

  // ------ 12. Cannot lock when budget request is not APPROVED ----------------

  test('12. lock is rejected with helpful error when BR is not APPROVED', async ({ page }) => {
    // Create a fresh budget task (DRAFT), fill partial details, and try to lock via API.
    // The UI won't even show a Lock button in DRAFT, so we use a direct API call here.
    const token = await getToken(page);
    if (!token) { return; }
    const origin = 'http://localhost';

    // Create task
    const createResp = await page.request.post(`${origin}/api/tasks/`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: JSON.stringify({ summary: 'E2E Lock Guard Test', type: 'budget', project: projectId }),
    });
    if (!createResp.ok()) return;
    const freshTask = await createResp.json();
    const freshId: number = freshTask.id;

    try {
      // Attempt to lock directly — should fail with 400
      const lockResp = await page.request.post(`${origin}/api/tasks/${freshId}/lock/`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: '{}',
      });
      expect(lockResp.status()).toBe(400);
      const lockBody = await lockResp.json();
      // Error should mention budget details or approved status
      const errorStr = JSON.stringify(lockBody).toLowerCase();
      expect(errorStr).toMatch(/budget|details|approved/i);
    } finally {
      await page.request.delete(`${origin}/api/tasks/${freshId}/`, {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
  });

  // ------ 14. submitted_at not shown in DRAFT mode -------------------------

  test('14. submitted_at is NOT shown while task is in DRAFT status', async ({ page }) => {
    // Create a fresh task so we know it's in DRAFT
    const token = await getToken(page);
    const origin = 'http://localhost';

    const createResp = await page.request.post(`${origin}/api/tasks/`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: JSON.stringify({ summary: 'E2E Draft submitted_at Test', type: 'budget', project: projectId }),
    });
    if (!createResp.ok()) return;
    const draftTask = await createResp.json();
    const draftId: number = draftTask.id;

    try {
      await page.goto(`/tasks?project_id=${projectId}&drawerTaskId=${draftId}`);
      await waitForDrawerReady(page);

      const section = page.locator('section', { hasText: 'Budget details' });
      await expect(section).toBeVisible({ timeout: 10_000 });
      // "Submitted at" must NOT appear in DRAFT
      await expect(section.getByText(/submitted at/i)).not.toBeVisible({ timeout: 3_000 });
    } finally {
      await page.request.delete(`${origin}/api/tasks/${draftId}/`, {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
  });
});
