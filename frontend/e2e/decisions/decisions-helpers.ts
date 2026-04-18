import { type Locator, type Page, expect } from '@playwright/test';

export interface DecisionCleanupRef {
  decisionId: number;
  projectId: number;
}

export async function waitForDecisionsPageReady(page: Page) {
  await expect(page.getByText('Preparing your workspace')).not.toBeVisible({
    timeout: 50_000,
  });
  await expect(page.getByText('Loading decisions...')).not.toBeVisible({
    timeout: 50_000,
  });
}

export async function goToDecisions(page: Page) {
  await page.goto('/decisions');
  await waitForDecisionsPageReady(page);
  await expect(page.getByRole('heading', { name: 'Decisions' })).toBeVisible();
}

export async function resolveFirstProjectSection(
  page: Page,
): Promise<{ projectId: number; header: Locator; section: Locator } | null> {
  const emptyState = page.getByText('No projects found for your account.');
  if (await emptyState.isVisible().catch(() => false)) {
    return null;
  }

  const headers = page.locator('[data-project-header]');
  const count = await headers.count();
  if (count === 0) return null;

  const header = headers.first();
  const rawProjectId = await header.getAttribute('data-project-header');
  const projectId = Number(rawProjectId);
  if (!Number.isFinite(projectId) || projectId <= 0) {
    throw new Error(`Invalid project id: ${rawProjectId}`);
  }

  const section = page.locator(
    `div.rounded-2xl:has([data-project-header="${projectId}"])`,
  );
  await expect(section).toBeVisible();
  return { projectId, header, section };
}

async function getAuthToken(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    try {
      const raw = localStorage.getItem('auth-storage');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.state?.token ?? null;
    } catch {
      return null;
    }
  });
}

export async function createDraftDecisionViaApi(page: Page, projectId: number) {
  const token = await getAuthToken(page);
  if (!token) {
    throw new Error('Missing auth token for draft creation.');
  }

  const baseUrl = new URL(page.url()).origin;
  const response = await page.request.post(
    `${baseUrl}/api/decisions/drafts/?project_id=${projectId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-project-id': String(projectId),
      },
      data: {},
    },
  );

  if (!response.ok()) {
    throw new Error(`Draft creation failed (${response.status()}).`);
  }

  const body = await response.json();
  const decisionId = Number(body?.id);
  if (!Number.isFinite(decisionId) || decisionId <= 0) {
    throw new Error('Draft response did not include a valid id.');
  }

  return decisionId;
}

export async function deleteDecisionViaApi(
  page: Page,
  ref: DecisionCleanupRef,
): Promise<void> {
  const token = await getAuthToken(page);
  if (!token) return;

  const baseUrl = new URL(page.url()).origin;
  await page.request.delete(
    `${baseUrl}/api/decisions/${ref.decisionId}/?project_id=${ref.projectId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-project-id': String(ref.projectId),
      },
    },
  );
}

/**
 * Best-effort delete of a decision created during a test (e.g. via Create Decision button).
 * Call after assertions to clean up. Does not throw.
 */
export async function deleteDecisionAfterCreate(
  page: Page,
  decisionId: number,
  projectId: number,
): Promise<void> {
  try {
    await deleteDecisionViaApi(page, { decisionId, projectId });
  } catch {
    /* best-effort cleanup */
  }
}
