import { expect, type Page } from '@playwright/test';

export async function waitForTaskDrawerReady(page: Page): Promise<void> {
  await expect(page.getByTestId('task-drawer')).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(
    () => !document.querySelector('.animate-pulse'),
    { timeout: 15_000 },
  );
}

export async function openTaskDetail(page: Page, taskSlug: string, projectId: number): Promise<void> {
  await page.goto(`/tasks/${encodeURIComponent(taskSlug)}?project_id=${projectId}`);
  await page.waitForLoadState('networkidle');
}

export async function openTaskDrawer(page: Page, projectId: number, taskId: number): Promise<void> {
  await page.goto(`/tasks?project_id=${projectId}&drawerTaskId=${taskId}`);
  await waitForTaskDrawerReady(page);
}

export async function clickFsmButton(page: Page, label: string): Promise<void> {
  const btn = page.getByRole('button', { name: label, exact: true });
  await expect(btn).toBeVisible({ timeout: 10_000 });
  await expect(btn).toBeEnabled();
  await btn.click();
}

export async function submitBudgetTaskFromDrawer(page: Page): Promise<void> {
  const responsePromise = page.waitForResponse((resp) => {
    const url = new URL(resp.url()).pathname;
    return url.includes('/submit') && resp.request().method() === 'POST';
  });
  await clickFsmButton(page, 'Submit');
  await responsePromise;
  await expect(page.getByText(/submitted/i).first()).toBeVisible({ timeout: 10_000 });
}

export async function startReviewOnDetail(page: Page): Promise<void> {
  const responsePromise = page.waitForResponse((resp) => {
    const url = new URL(resp.url()).pathname;
    return url.includes('/start-review') && resp.request().method() === 'POST';
  });
  await clickFsmButton(page, 'Start Review');
  await responsePromise;
  await expect(page.getByText(/under.?review/i).first()).toBeVisible({ timeout: 10_000 });
}

export async function approveWithComment(page: Page, comment: string): Promise<void> {
  await expect(page.locator('#review-comment')).toBeVisible({ timeout: 15_000 });
  await page.locator('#review-comment').fill(comment);
  const responsePromise = page.waitForResponse((resp) => {
    const url = new URL(resp.url()).pathname;
    return url.includes('/make-approval') && resp.request().method() === 'POST';
  });
  await clickFsmButton(page, 'Approve');
  await responsePromise;
}

export async function rejectWithComment(page: Page, comment: string): Promise<void> {
  await expect(page.locator('#review-comment')).toBeVisible({ timeout: 15_000 });
  await page.locator('#review-comment').fill(comment);
  await clickFsmButton(page, 'Reject');
  await expect(page.getByText(/rejected/i).first()).toBeVisible({ timeout: 10_000 });
}

export async function expectApprovalChainProgress(page: Page, chainName: string): Promise<void> {
  await expect(page.getByText(/approval chain/i)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(chainName)).toBeVisible({ timeout: 10_000 });
}

export async function expectStatusChip(page: Page, pattern: RegExp): Promise<void> {
  await expect(page.getByText(pattern).first()).toBeVisible({ timeout: 10_000 });
}
