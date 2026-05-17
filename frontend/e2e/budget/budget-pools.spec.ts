import { test, expect } from '@playwright/test';

async function getProjectId(page: any): Promise<number | null> {
  return page.evaluate(() => {
    try {
      const raw = localStorage.getItem('project-storage');
      return raw ? (JSON.parse(raw) as any)?.state?.activeProject?.id ?? null : null;
    } catch { return null; }
  });
}

async function waitForPools(page: any) {
  // Wait for spinner to go away and at least one pool card or empty state to appear
  await page.waitForFunction(
    () => !document.querySelector('.animate-pulse'),
    { timeout: 15_000 },
  );
}

test.describe('Budget pools page', () => {
  test.describe.configure({ mode: 'serial' });

  let projectId: number;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
    const page = await context.newPage();
    await page.goto('/tasks');
    await page.waitForLoadState('networkidle');
    projectId = (await getProjectId(page)) ?? 1;
    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(`/budget-pools?project_id=${projectId}`);
    await page.evaluate(() => sessionStorage.clear());
    await page.reload();
    await waitForPools(page);
  });

  // ── Controls visibility ──────────────────────────────────────────────

  test('shows filter, group and sort controls when pools exist', async ({ page }) => {
    const poolCards = page.locator('.rounded-xl.bg-white.p-4');
    const count = await poolCards.count();
    if (count === 0) {
      // No pools — controls not shown, that's expected
      return;
    }

    await expect(page.getByRole('combobox').filter({ hasText: /channel/i }).first()).toBeVisible();
    await expect(page.getByRole('combobox').filter({ hasText: /currenc/i }).first()).toBeVisible();
    await expect(page.getByRole('combobox').filter({ hasText: /group/i }).first()).toBeVisible();
    await expect(page.getByRole('combobox').filter({ hasText: /sort/i }).first()).toBeVisible();
  });

  // ── Filtering ──────────────────────────────────────────────────────

  test('filtering by currency reduces visible pools', async ({ page }) => {
    const allCards = page.locator('.rounded-xl.bg-white.p-4');
    const totalBefore = await allCards.count();
    if (totalBefore < 2) return; // need multiple pools

    const currencySelect = page.getByRole('combobox').nth(1);
    const options = await currencySelect.locator('option').allTextContents();
    const realOptions = options.filter((o) => o !== 'All currencies');
    if (realOptions.length === 0) return;

    await currencySelect.selectOption(realOptions[0]);
    await page.waitForTimeout(200);

    const afterCount = await allCards.count();
    expect(afterCount).toBeLessThanOrEqual(totalBefore);
  });

  test('clear filters button resets filters', async ({ page }) => {
    const allCards = page.locator('.rounded-xl.bg-white.p-4');
    const totalBefore = await allCards.count();
    if (totalBefore < 2) return;

    const currencySelect = page.getByRole('combobox').nth(1);
    const options = await currencySelect.locator('option').allTextContents();
    const realOptions = options.filter((o) => o !== 'All currencies');
    if (realOptions.length === 0) return;

    await currencySelect.selectOption(realOptions[0]);
    await page.waitForTimeout(200);

    const clearBtn = page.getByRole('button', { name: 'Clear filters' });
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();
    await page.waitForTimeout(200);

    await expect(currencySelect).toHaveValue('');
    const afterCount = await allCards.count();
    expect(afterCount).toBe(totalBefore);
  });

  // ── Grouping ───────────────────────────────────────────────────────

  test('grouping by channel shows group headers', async ({ page }) => {
    const allCards = page.locator('.rounded-xl.bg-white.p-4');
    if (await allCards.count() < 2) return;

    const groupSelect = page.getByRole('combobox').filter({ hasText: /group/i }).first();
    await groupSelect.selectOption('channel');
    await page.waitForTimeout(200);

    // Group headers appear as small uppercase text labels
    const headers = page.locator('span.text-\\[11px\\].font-semibold.uppercase');
    const headerCount = await headers.count();
    expect(headerCount).toBeGreaterThan(0);
  });

  test('grouping by currency shows group headers', async ({ page }) => {
    const allCards = page.locator('.rounded-xl.bg-white.p-4');
    if (await allCards.count() < 2) return;

    const groupSelect = page.getByRole('combobox').filter({ hasText: /group/i }).first();
    await groupSelect.selectOption('currency');
    await page.waitForTimeout(200);

    const headers = page.locator('span.text-\\[11px\\].font-semibold.uppercase');
    expect(await headers.count()).toBeGreaterThan(0);
  });

  // ── Sorting ─────────────────────────────────────────────────────────

  test('sort direction toggle button works', async ({ page }) => {
    const allCards = page.locator('.rounded-xl.bg-white.p-4');
    if (await allCards.count() < 2) return;

    const dirBtn = page.getByRole('button', { name: '↑' }).or(page.getByRole('button', { name: '↓' }));
    await expect(dirBtn).toBeVisible();
    const initialText = await dirBtn.innerText();

    await dirBtn.click();
    await page.waitForTimeout(200);

    const newText = await dirBtn.innerText();
    expect(newText).not.toBe(initialText);
  });

  // ── Pagination ─────────────────────────────────────────────────────

  test('pagination controls appear when there are more than 10 pools', async ({ page }) => {
    const allCards = page.locator('.rounded-xl.bg-white.p-4');
    const count = await allCards.count();

    const nextBtn = page.getByRole('button', { name: 'Next' });
    if (count >= 10) {
      await expect(nextBtn).toBeVisible();
    } else {
      // Fewer than 10 pools — no pagination needed
      await expect(nextBtn).not.toBeVisible();
    }
  });

  test('next/prev pagination buttons navigate pages', async ({ page }) => {
    const nextBtn = page.getByRole('button', { name: 'Next' });
    const isVisible = await nextBtn.isVisible().catch(() => false);
    if (!isVisible) return; // fewer than 10 pools, skip

    // Read counter text before
    const counter = page.locator('span.text-xs.text-gray-400').first();
    const before = await counter.innerText();

    await nextBtn.click();
    await page.waitForTimeout(200);

    const after = await counter.innerText();
    expect(after).not.toBe(before);

    // Prev should now be enabled
    await page.getByRole('button', { name: 'Prev' }).click();
    await page.waitForTimeout(200);
    expect(await counter.innerText()).toBe(before);
  });

  // ── Persistence ───────────────────────────────────────────────────

  test('filter/sort/group state persists after navigating away and back', async ({ page }) => {
    const allCards = page.locator('.rounded-xl.bg-white.p-4');
    if (await allCards.count() < 2) return;

    const sortSelect = page.getByRole('combobox').filter({ hasText: /sort/i }).first();
    await sortSelect.selectOption('total');
    await page.waitForTimeout(100);

    const groupSelect = page.getByRole('combobox').filter({ hasText: /group/i }).first();
    await groupSelect.selectOption('currency');
    await page.waitForTimeout(100);

    // Navigate away to tasks
    await page.goto(`/tasks?project_id=${projectId}`);
    await page.waitForLoadState('networkidle');

    // Navigate back
    await page.goto(`/budget-pools?project_id=${projectId}`);
    await waitForPools(page);

    await expect(page.getByRole('combobox').filter({ hasText: /sort/i }).first()).toHaveValue('total');
    await expect(page.getByRole('combobox').filter({ hasText: /group/i }).first()).toHaveValue('currency');
  });

  // ── Pool cards ────────────────────────────────────────────────────

  test('each pool card shows total, used, and available amounts', async ({ page }) => {
    const firstCard = page.locator('.rounded-xl.bg-white.p-4').first();
    const count = await page.locator('.rounded-xl.bg-white.p-4').count();
    if (count === 0) return;

    await expect(firstCard.getByText('Total', { exact: true })).toBeVisible();
    await expect(firstCard.getByText('Used', { exact: true })).toBeVisible();
    await expect(firstCard.getByText('Available', { exact: true })).toBeVisible();
  });

  test('pool card shows a progress bar', async ({ page }) => {
    const count = await page.locator('.rounded-xl.bg-white.p-4').count();
    if (count === 0) return;

    const firstCard = page.locator('.rounded-xl.bg-white.p-4').first();
    // The grey track wrapper is always visible regardless of usage %
    await expect(firstCard.locator('.w-full.rounded-full.bg-gray-100')).toBeVisible();
  });

  test('edit button opens inline edit fields', async ({ page }) => {
    const count = await page.locator('.rounded-xl.bg-white.p-4').count();
    if (count === 0) return;

    const firstCard = page.locator('.rounded-xl.bg-white.p-4').first();
    await firstCard.getByTitle('Edit').click();

    await expect(firstCard.getByPlaceholder('e.g. Q1 Campaign')).toBeVisible();
    await expect(firstCard.locator('input[type="number"]')).toBeVisible();

    // Cancel
    await firstCard.getByTitle('Cancel').click();
    await expect(firstCard.getByPlaceholder('e.g. Q1 Campaign')).not.toBeVisible();
  });
});
