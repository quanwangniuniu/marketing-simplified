/**
 * MED-240: Playwright coverage for org-admin override UI.
 *
 * Fully mocked (no real login / backend) so it runs inside the frontend
 * Docker image without DEV_USER credentials. Asserts the Admin override
 * badge contract against TaskTypeBlock / BudgetRequestDetail.
 */

import { test, expect, type Page } from '@playwright/test';
import {
  seedAuthenticatedUser,
  mockAuthenticatedUserApis,
  mockProjectShellApis,
  seedActiveProject,
} from '../messages/messages-helpers';

const PROJECT = {
  id: 2401,
  name: 'MED-240 Override Project',
  slug: 'med-240-override',
  member_count: 1,
};

const TASK = {
  id: 24001,
  slug: 'e2e-med-240-budget-task',
  summary: 'E2E MED-240 budget override',
  type: 'budget',
  status: 'APPROVED',
  project_id: PROJECT.id,
  project: PROJECT,
  current_approver: { id: 99, username: 'chain-approver', email: 'approver@example.com' },
  owner: { id: 1, username: 'e2e-user', email: 'e2e@example.com' },
  blocks: [],
  is_blocked_by: [],
  causes: [],
  is_caused_by: [],
  relations: {
    blocks: [],
    is_blocked_by: [],
    causes: [],
    is_caused_by: [],
  },
  linked_object: {
    id: 8801,
    status: 'APPROVED',
    amount: '100.00',
    currency: 'AUD',
    notes: 'User visible note',
    is_escalated: false,
    is_admin_override: true,
    current_approver_name: 'chain-approver',
    ad_channel_name: 'Meta',
    budget_pool: {
      id: 1,
      name: 'Pool A',
      currency: 'AUD',
      total_amount: '1000.00',
      available_amount: '900.00',
    },
  },
};

test.use({ storageState: { cookies: [], origins: [] } });

async function mockBudgetTaskShell(page: Page, withOverride: boolean) {
  const linked = {
    ...TASK.linked_object,
    is_admin_override: withOverride,
  };
  const taskPayload = { ...TASK, linked_object: linked };

  await page.route('**/api/core/onboarding-status/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ needs_onboarding: false, has_org: true, has_project: true }),
    });
  });

  await page.route('**/api/core/projects**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([PROJECT]),
    });
  });

  await page.route(`**/api/core/projects/${PROJECT.id}/members/**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results: [], next: null }),
    });
  });

  const emptyRelations = {
    causes: [],
    is_caused_by: [],
    blocks: [],
    is_blocked_by: [],
    clones: [],
    is_cloned_by: [],
    relates_to: [],
  };

  await page.route('**/api/tasks/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    if (method !== 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      return;
    }

    // Sub-resources must be matched before task detail (same URL prefix).
    if (url.includes('/relations')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(emptyRelations),
      });
      return;
    }
    if (url.includes('/budget-request') || url.includes('/onboarding-status') || url.includes('/field-history')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(url.includes('/budget-request') ? linked : {}),
      });
      return;
    }

    // Detail by id or slug
    if (url.includes(`/tasks/${TASK.id}`) || url.includes(`/tasks/${TASK.slug}`)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(taskPayload),
      });
      return;
    }

    // List
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ count: 1, next: null, previous: null, results: [taskPayload] }),
    });
  });

  await page.route('**/api/budgets/requests/**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(linked),
    });
  });

  await page.route('**/api/budgets/pools/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ count: 0, results: [] }),
    });
  });
}

test.describe('Budget admin override badge (MED-240)', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthenticatedUser(page);
    await mockAuthenticatedUserApis(page);
    await mockProjectShellApis(page);
    await seedActiveProject(page, PROJECT);
  });

  test('shows Admin override badge when is_admin_override is true', async ({ page }) => {
    await mockBudgetTaskShell(page, true);

    await page.goto(
      `/projects/${encodeURIComponent(PROJECT.slug)}/tasks/${encodeURIComponent(TASK.slug)}`,
    );

    await expect(page.getByTestId('task-drawer')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('admin-override-badge').first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId('admin-override-badge').first()).toHaveText(/admin override/i);
  });

  test('does not show Admin override badge when is_admin_override is false', async ({
    page,
  }) => {
    await mockBudgetTaskShell(page, false);

    await page.goto(
      `/projects/${encodeURIComponent(PROJECT.slug)}/tasks/${encodeURIComponent(TASK.slug)}`,
    );

    await expect(page.getByTestId('task-drawer')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('section', { hasText: /budget details/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId('admin-override-badge')).toHaveCount(0);
  });
});
