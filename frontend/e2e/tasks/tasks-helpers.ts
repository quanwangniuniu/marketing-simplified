import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Wait for any blocking overlay (Guided Onboarding, "Preparing your workspace")
 * to dismiss before interacting with the tasks page.
 * If "Failed to load projects" is shown, clicks "Retry check" and waits for success.
 */
export async function waitForTasksPageReady(page: Page) {
  const retryBtn = page.getByRole('button', { name: 'Retry check' });
  if (await retryBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await retryBtn.click();
  }

  await expect(page.getByText('Guided Onboarding')).not.toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText('Preparing your workspace')).not.toBeVisible({
    timeout: 5_000,
  });
}

/**
 * Navigate to /tasks, select a project by name, and return its ID.
 * Run once before all tests (in beforeAll) to grab the project ID.
 * Uses E2E_PROJECT_NAME env var (default "Q1 E2E Task").
 */
export async function navigateToTasksAndSelectProject(page: Page): Promise<number> {
  await page.goto('/tasks');
  await expect(page.getByText('Preparing your workspace')).not.toBeVisible({ timeout: 30_000 });
  await waitForTasksPageReady(page);

  // Get the active project from the Zustand persisted store in localStorage.
  const projectId: number | null = await page.evaluate(() => {
    try {
      const raw = localStorage.getItem('project-storage');
      if (!raw) return null;
      return (JSON.parse(raw) as any)?.state?.activeProject?.id ?? null;
    } catch {
      return null;
    }
  });

  if (!projectId) throw new Error('No active project found in store — ensure the test user has at least one project');
  return projectId;
}

/**
 * Ensure we are on the tasks page for the given project.
 * Run before each test (in beforeEach) to navigate to /tasks?project_id=X&view=timeline.
 */
export async function ensureOnTasksPage(page: Page, projectId: number): Promise<void> {
  await page.goto(`/tasks?project_id=${projectId}&view=timeline`);
  await waitForTasksPageReady(page);
}

/**
 * Full flow: navigate, select project, wait for ready.
 * Use when you need the full flow in each test (e.g. task-create.spec).
 */
export async function goToTasks(page: Page): Promise<void> {
  await navigateToTasksAndSelectProject(page);
}

/** Alias for goToTasks (same behavior). */
export const goToTasksWithProject = goToTasks;

/**
 * Click the Create button, capture the task ID from the POST response,
 * and wait for the panel to close.
 * @deprecated Use submitNewTaskAndGetId for the /tasks/new page flow.
 */
export async function submitCreateAndGetId(
  page: Page,
  panel: Locator,
): Promise<number | null> {
  const responsePromise = page.waitForResponse((resp) => {
    const path = new URL(resp.url()).pathname;
    return (
      (path === '/api/tasks/' || path === '/api/tasks') &&
      resp.request().method() === 'POST'
    );
  });

  await panel.getByRole('button', { name: 'Create', exact: true }).click();

  const response = await responsePromise;
  let taskId: number | null = null;
  if (response.ok()) {
    const body = await response.json();
    taskId = body.id ?? null;
  }

  await expect(panel).not.toBeVisible({ timeout: 10_000 });
  return taskId;
}

/**
 * Navigate to the /tasks/new page for the given project.
 */
export async function navigateToNewTaskPage(page: Page, projectId: number): Promise<void> {
  await page.goto(`/tasks/new?project_id=${projectId}`);
  await expect(page.getByPlaceholder('Summary of this task')).toBeVisible({ timeout: 15_000 });
}

/**
 * On the /tasks/new page: intercept the task POST, click "Create task", wait for the page to
 * navigate away (which means the linked-object creation + /link/ call have both finished),
 * then return the new task ID.
 *
 * Waiting for navigation is critical: without it, afterEach can delete the Task while the
 * browser is still POSTing the linked object, leaving the object orphaned or the link unset.
 */
export async function submitNewTaskAndGetId(page: Page): Promise<number | null> {
  const responsePromise = page.waitForResponse((resp) => {
    const path = new URL(resp.url()).pathname;
    return (path === '/api/tasks/' || path === '/api/tasks') && resp.request().method() === 'POST';
  });

  // Set up navigation wait BEFORE clicking so we don't miss a fast redirect.
  const navigationPromise = page.waitForURL((url) => !url.pathname.startsWith('/tasks/new'), {
    timeout: 30_000,
  }).catch(() => {});

  await page.getByRole('button', { name: 'Create task', exact: true }).click();

  const response = await responsePromise;
  if (!response.ok()) return null;
  const body = await response.json();
  const taskId = body.id ?? null;

  // Wait for navigation to complete — this means the full create flow (linked object + link)
  // has finished in the browser before afterEach can clean up.
  await navigationPromise;

  return taskId;
}

/**
 * Delete all tasks whose summary starts with "E2E " (left over from interrupted test runs).
 * Fetches up to 100 tasks per page and deletes any E2E ones.
 */
export async function deleteAllE2ETasks(page: Page): Promise<void> {
  const token: string | null = await page.evaluate(() => {
    try {
      const raw = localStorage.getItem('auth-storage');
      if (!raw) return null;
      return (JSON.parse(raw) as any)?.state?.token ?? null;
    } catch {
      return null;
    }
  });
  if (!token) return;

  const origin = new URL(page.url()).origin;
  let nextUrl: string | null = `${origin}/api/tasks/?page_size=100`;
  while (nextUrl) {
    const listRes = await page.request.get(nextUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!listRes.ok()) break;
    const data = await listRes.json();
    const tasks: { id: number; summary: string }[] = data.results ?? data ?? [];
    for (const t of tasks) {
      if (typeof t.summary === 'string' && t.summary.startsWith('E2E ')) {
        await page.request.delete(`${origin}/api/tasks/${t.id}/`, {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }
    }
    nextUrl = typeof data.next === 'string' ? data.next : null;
  }
}

/**
 * Select the first real approver option in the approver dropdown on the new-task page.
 * Must be called after a task type is selected (the select is only visible then).
 * Waits for members to load before selecting. Skips silently if no members available.
 */
export async function selectFirstAvailableApprover(page: Page): Promise<void> {
  const approverSelect = page.locator('select').filter({
    has: page.locator('option', { hasText: /Select an approver|Unassigned/ }),
  });
  await expect(approverSelect).toBeVisible({ timeout: 10_000 });

  // Wait until the first option's text changes from "Loading…" (members have loaded)
  await expect(approverSelect.locator('option').first()).not.toHaveText(/Loading/i, { timeout: 10_000 });

  const options = await approverSelect.locator('option').allTextContents();
  const realOptions = options.filter(
    (o) => !o.includes('Select an approver') && !o.includes('Unassigned') && !o.includes('Loading'),
  );
  if (realOptions.length > 0) {
    await approverSelect.selectOption({ index: 1 });
  }
}

/**
 * Delete a task by ID via the REST API using the auth token from localStorage.
 */
export async function deleteTaskById(page: Page, taskId: number) {
  const token: string | null = await page.evaluate(() => {
    try {
      const raw = localStorage.getItem('auth-storage');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.state?.token ?? null;
    } catch {
      return null;
    }
  });

  if (!token) return;

  const origin = new URL(page.url()).origin;
  await page.request.delete(`${origin}/api/tasks/${taskId}/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
