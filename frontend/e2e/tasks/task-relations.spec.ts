import { test, expect } from '@playwright/test';
import { navigateToTasksAndSelectProject } from './tasks-helpers';

// ── API helpers ──────────────────────────────────────────────────────────────

async function getToken(page: any): Promise<string | null> {
  return page.evaluate(() => {
    try {
      const raw = localStorage.getItem('auth-storage');
      if (!raw) return null;
      return (JSON.parse(raw) as any)?.state?.token ?? null;
    } catch { return null; }
  });
}

async function apiPost(page: any, path: string, body: object): Promise<any> {
  const token = await getToken(page);
  const origin = new URL(page.url()).origin;
  // Pass data as object — Playwright auto-sets Content-Type: application/json
  const resp = await page.request.post(`${origin}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: body,
  });
  if (!resp.ok()) {
    const text = await resp.text();
    throw new Error(`POST ${path} → ${resp.status()}: ${text.slice(0, 300)}`);
  }
  const text = await resp.text();
  return text ? JSON.parse(text) : {};
}

async function apiDelete(page: any, path: string): Promise<void> {
  const token = await getToken(page);
  const origin = new URL(page.url()).origin;
  await page.request.delete(`${origin}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function createTask(page: any, projectId: number, summary: string): Promise<number> {
  // Always create as draft — without this the backend auto-submits (DRAFT → SUBMITTED)
  // which can fail FSM validation or require an approver to be set.
  const body = await apiPost(page, '/api/tasks/', {
    summary,
    project_id: projectId,
    type: 'budget',
    create_as_draft: true,
  });
  return body.id;
}

async function addRelation(page: any, sourceId: number, targetId: number, relType: 'blocks' | 'causes' | 'clones' | 'relates_to'): Promise<void> {
  await apiPost(page, `/api/tasks/${sourceId}/relations/`, {
    target_task_id: targetId,
    relationship_type: relType,
  });
}

async function deleteTask(page: any, taskId: number): Promise<void> {
  await apiDelete(page, `/api/tasks/${taskId}/`);
}

// ── Shared setup ─────────────────────────────────────────────────────────────

async function goToTaskDetail(page: any, taskId: number) {
  await page.goto(`/tasks/${taskId}`);
  await expect(page.locator('section').filter({ hasText: 'Linked work items' })).toBeVisible({ timeout: 15_000 });
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe('Task relations — circular dependency detection', () => {
  test.describe.configure({ mode: 'serial' });

  let projectId: number;
  let taskA: number;
  let taskB: number;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
    const page = await context.newPage();
    projectId = await navigateToTasksAndSelectProject(page);

    taskA = await createTask(page, projectId, 'E2E Relations — Task A');
    taskB = await createTask(page, projectId, 'E2E Relations — Task B');

    // Create circular: A blocks B, B blocks A
    await addRelation(page, taskA, taskB, 'blocks');
    await addRelation(page, taskB, taskA, 'blocks');

    await context.close();
  });

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
    const page = await context.newPage();
    await page.goto('/tasks');
    await deleteTask(page, taskA);
    await deleteTask(page, taskB);
    await context.close();
  });

  test('circular warning banner is visible', async ({ page }) => {
    await goToTaskDetail(page, taskA);
    const section = page.locator('section').filter({ hasText: 'Linked work items' });
    await expect(section.getByText(/circular dependency detected/i)).toBeVisible({ timeout: 10_000 });
  });

  test('circular rows have amber warning icon', async ({ page }) => {
    await goToTaskDetail(page, taskA);
    const section = page.locator('section').filter({ hasText: 'Linked work items' });
    await expect(section.locator('[title="Circular dependency"]').first()).toBeVisible({ timeout: 10_000 });
  });

  test('both BLOCKS and IS BLOCKED BY groups appear with the same task', async ({ page }) => {
    await goToTaskDetail(page, taskA);
    const section = page.locator('section').filter({ hasText: 'Linked work items' });
    await expect(section.getByText('Blocks', { exact: false }).first()).toBeVisible({ timeout: 10_000 });
    await expect(section.getByText('Is blocked by', { exact: false })).toBeVisible({ timeout: 10_000 });
  });

  test('status is shown as a colored pill (not plain text)', async ({ page }) => {
    await goToTaskDetail(page, taskA);
    const section = page.locator('section').filter({ hasText: 'Linked work items' });
    // Colored pills have rounded-full and a bg- class — plain text does not
    const pill = section.locator('li').first().locator('span.rounded-full');
    await expect(pill.first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Task relations — dependency explorer tree', () => {
  test.describe.configure({ mode: 'serial' });

  let projectId: number;
  let taskA: number;
  let taskB: number;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
    const page = await context.newPage();
    projectId = await navigateToTasksAndSelectProject(page);

    taskA = await createTask(page, projectId, 'E2E Tree — Task A');
    taskB = await createTask(page, projectId, 'E2E Tree — Task B');
    await addRelation(page, taskA, taskB, 'blocks');

    await context.close();
  });

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
    const page = await context.newPage();
    await page.goto('/tasks');
    await deleteTask(page, taskA);
    await deleteTask(page, taskB);
    await context.close();
  });

  test('Tree button is visible when blocker relations exist', async ({ page }) => {
    await goToTaskDetail(page, taskA);
    const section = page.locator('section').filter({ hasText: 'Linked work items' });
    await expect(section.getByRole('button', { name: /tree/i })).toBeVisible({ timeout: 10_000 });
  });

  test('Tree button is not visible for tasks with only non-blocker relations', async ({ page }) => {
    const newCtx = await (page.context().browser()!).newContext({ storageState: 'e2e/.auth/user.json' });
    const p2 = await newCtx.newPage();
    await p2.goto('/tasks');
    const freshId = await createTask(p2, projectId, 'E2E Tree — No Blockers');
    await addRelation(p2, freshId, taskA, 'relates_to');

    await p2.goto(`/tasks/${freshId}`);
    await expect(p2.locator('section').filter({ hasText: 'Linked work items' })).toBeVisible({ timeout: 15_000 });
    await expect(p2.getByRole('button', { name: /tree/i })).not.toBeVisible({ timeout: 5_000 });

    await deleteTask(p2, freshId);
    await newCtx.close();
  });

  test('clicking Tree button opens the dependency tree panel', async ({ page }) => {
    await goToTaskDetail(page, taskA);
    const section = page.locator('section').filter({ hasText: 'Linked work items' });
    const treeBtn = section.getByRole('button', { name: /tree/i });
    await expect(treeBtn).toBeVisible({ timeout: 10_000 });
    await treeBtn.click();
    await expect(section.getByText('Dependency tree', { exact: false })).toBeVisible({ timeout: 5_000 });
  });

  test('dependency tree panel shows Blocks section with linked task', async ({ page }) => {
    await goToTaskDetail(page, taskA);
    const section = page.locator('section').filter({ hasText: 'Linked work items' });
    const treeBtn = section.getByRole('button', { name: /tree/i });
    await expect(treeBtn).toBeVisible({ timeout: 10_000 });
    await treeBtn.click();
    const treePanel = section.locator('div').filter({ hasText: 'Dependency tree' }).last();
    await expect(treePanel.getByText('E2E Tree — Task B')).toBeVisible({ timeout: 10_000 });
  });

  test('clicking Tree button again closes the panel', async ({ page }) => {
    await goToTaskDetail(page, taskA);
    const section = page.locator('section').filter({ hasText: 'Linked work items' });
    const treeBtn = section.getByRole('button', { name: /tree/i });
    await expect(treeBtn).toBeVisible({ timeout: 10_000 });
    await treeBtn.click();
    await expect(section.getByText('Dependency tree', { exact: false })).toBeVisible({ timeout: 5_000 });
    await treeBtn.click();
    await expect(section.getByText('Dependency tree', { exact: false })).not.toBeVisible({ timeout: 3_000 });
  });
});

test.describe('Task relations — blocker chain depth badges', () => {
  test.describe.configure({ mode: 'serial' });

  let projectId: number;
  let taskA: number;
  let taskB: number;
  let taskC: number;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
    const page = await context.newPage();
    projectId = await navigateToTasksAndSelectProject(page);

    taskA = await createTask(page, projectId, 'E2E Chain — Task A');
    taskB = await createTask(page, projectId, 'E2E Chain — Task B');
    taskC = await createTask(page, projectId, 'E2E Chain — Task C');

    // A blocks B, B blocks C → depth chain
    await addRelation(page, taskA, taskB, 'blocks');
    await addRelation(page, taskB, taskC, 'blocks');

    await context.close();
  });

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
    const page = await context.newPage();
    await page.goto('/tasks');
    await deleteTask(page, taskA);
    await deleteTask(page, taskB);
    await deleteTask(page, taskC);
    await context.close();
  });

  test('chain depth badge appears on Task B row when viewed from Task A', async ({ page }) => {
    await goToTaskDetail(page, taskA);
    const section = page.locator('section').filter({ hasText: 'Linked work items' });
    // After chain fetch completes, badge "→ 1 blocked" should appear on Task B's row
    await expect(section.getByText(/blocked/i, { exact: false }).filter({ hasText: '→' }).or(
      section.locator('span').filter({ hasText: /→.*blocked/i })
    ).first()).toBeVisible({ timeout: 10_000 });
  });

  test('upstream badge appears on Task B row when viewed from Task C', async ({ page }) => {
    await goToTaskDetail(page, taskC);
    const section = page.locator('section').filter({ hasText: 'Linked work items' });
    // Task C is blocked by Task B; Task B is also blocked by Task A → upstream badge
    await expect(section.locator('span').filter({ hasText: /←.*upstream/i }).first()).toBeVisible({ timeout: 10_000 });
  });
});
