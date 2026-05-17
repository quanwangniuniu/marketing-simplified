import { type Page, expect } from '@playwright/test';

export type WorkspaceTab = 'Summary' | 'Tasks' | 'Board';
export type TasksViewMode = 'list' | 'timeline';

const tabTestId: Record<WorkspaceTab, string> = {
  Summary: 'tab-summary',
  Tasks: 'tab-tasks',
  Board: 'tab-board',
};

/**
 * Click one of the top-level workspace tabs (Summary / Tasks / Board).
 */
export async function switchTab(page: Page, tab: WorkspaceTab): Promise<void> {
  const btn = page.getByTestId(tabTestId[tab]);
  await btn.click();
  await page.waitForTimeout(500);
}

/**
 * Toggle between List View and Timeline View inside the Tasks tab.
 */
export async function switchView(page: Page, mode: TasksViewMode): Promise<void> {
  const testId = mode === 'list' ? 'view-button-list' : 'view-button-timeline';
  await page.getByTestId(testId).click();
  await page.waitForTimeout(500);
}

/**
 * Click the first task row's summary area to open the quick drawer, then
 * return the summary text for callers that need it.
 */
export async function openFirstTask(page: Page): Promise<string> {
  const taskList = page.getByTestId('task-list');
  await expect(taskList).toBeVisible({ timeout: 10_000 });

  const firstOpen = page.getByTestId('task-row-open').first();
  await expect(firstOpen).toBeVisible({ timeout: 5_000 });

  const summary = ((await firstOpen.innerText()) || '').split('\n')[0].trim();
  await firstOpen.click();
  return summary;
}

/**
 * In Tasks (list) view: click the first task row to open the quick drawer,
 * then click "Open full page" to navigate to the task detail page.
 */
export async function openFirstTaskFromListAndNavigate(page: Page): Promise<void> {
  await openFirstTask(page);
  // Row click now opens the quick drawer — navigate via the "Open full page" button.
  await expect(page.getByTestId('task-drawer')).toBeVisible({ timeout: 10_000 });
  await page.getByTestId('task-drawer-open-full').click();
}

/**
 * In Board view: click the first task card to navigate directly to the
 * task detail page.
 */
export async function openFirstTaskFromBoardAndNavigate(page: Page): Promise<void> {
  const board = page.getByTestId('board-columns');
  await expect(board).toBeVisible({ timeout: 10_000 });
  const firstCard = board.getByRole('button').first();
  await expect(firstCard).toBeVisible({ timeout: 5_000 });
  await firstCard.click();
}
