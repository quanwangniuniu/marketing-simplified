import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { buildEnglishMarketingBlocks } from './notion-fixture';

type DraftResponse = {
  id: number;
  title: string;
};

const AUTH_STATE_PATH = path.resolve(__dirname, '..', '.auth', 'user.json');

const buildAuthHeadersFromStorageState = (): Record<string, string> => {
  if (!fs.existsSync(AUTH_STATE_PATH)) {
    throw new Error(`Missing auth state file at ${AUTH_STATE_PATH}. Run setup project first.`);
  }

  const storageStateRaw = fs.readFileSync(AUTH_STATE_PATH, 'utf-8');
  const storageState = JSON.parse(storageStateRaw) as {
    origins?: Array<{ origin: string; localStorage: Array<{ name: string; value: string }> }>;
  };

  const authEntry = storageState.origins
    ?.flatMap((origin) => origin.localStorage || [])
    .find((item) => item.name === 'auth-storage');

  if (!authEntry) {
    throw new Error('auth-storage is missing in Playwright storage state.');
  }

  const authStorage = JSON.parse(authEntry.value) as {
    state?: {
      token?: string;
      organizationAccessToken?: string;
      user?: { roles?: string[]; team_id?: number | string };
    };
  };

  const token = authStorage.state?.token;
  if (!token) {
    throw new Error('Bearer token missing in auth-storage.');
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  const organizationToken = authStorage.state?.organizationAccessToken;
  if (organizationToken) {
    headers['X-Organization-Token'] = organizationToken;
  }

  const role = authStorage.state?.user?.roles?.[0];
  if (role) {
    headers['x-user-role'] = role;
  }

  const teamId = authStorage.state?.user?.team_id;
  if (teamId !== undefined && teamId !== null && String(teamId).trim() !== '') {
    headers['x-team-id'] = String(teamId);
  }

  return headers;
};

const createMarketingDraft = async (
  page: Page,
  draftTitle: string,
  authHeaders: Record<string, string>,
): Promise<DraftResponse> => {
  const createResponse = await page.request.post('/api/notion/api/drafts/', {
    headers: authHeaders,
    data: {
      title: draftTitle,
      status: 'draft',
      content_blocks: buildEnglishMarketingBlocks(),
    },
  });

  if (!createResponse.ok()) {
    const errorBody = await createResponse.text();
    throw new Error(
      `Failed to create notion draft. status=${createResponse.status()} body=${errorBody}`,
    );
  }

  return (await createResponse.json()) as DraftResponse;
};

const createSwitchDraft = async (
  page: Page,
  draftTitle: string,
  bodyMarker: string,
  authHeaders: Record<string, string>,
): Promise<DraftResponse> => {
  const createResponse = await page.request.post('/api/notion/api/drafts/', {
    headers: authHeaders,
    data: {
      title: draftTitle,
      status: 'draft',
      content_blocks: [
        {
          id: `Switching ${draftTitle}`,
          type: 'rich_text',
          order: 0,
          content: {
            html: `<p>${bodyMarker}</p>`,
          },
        },
      ],
    },
  });

  if (!createResponse.ok()) {
    const errorBody = await createResponse.text();
    throw new Error(
      `Failed to create switch draft. status=${createResponse.status()} body=${errorBody}`,
    );
  }

  return (await createResponse.json()) as DraftResponse;
};

const safeDeleteDraft = async (
  page: Page,
  draftId: number,
  authHeaders: Record<string, string>,
): Promise<void> => {
  try {
    await page.request.delete(`/api/notion/api/drafts/${draftId}/`, {
      headers: authHeaders,
      timeout: 3_000,
    });
  } catch {
    // Cleanup failure should not fail E2E flow assertions.
  }
};

const parseDraftListPayload = (body: unknown): Array<{ id?: number; title?: string }> => {
  if (Array.isArray(body)) {
    return body;
  }
  if (
    body &&
    typeof body === 'object' &&
    'results' in body &&
    Array.isArray((body as { results: unknown }).results)
  ) {
    return (body as { results: Array<{ id?: number; title?: string }> }).results;
  }
  return [];
};

/** Wait until the draft appears on GET /drafts/ (handles replication / list lag after POST). */
const waitForNotionDraftInApiList = async (
  page: Page,
  draftTitle: string,
  authHeaders: Record<string, string>,
): Promise<void> => {
  await expect(async () => {
    const response = await page.request.get('/api/notion/api/drafts/', { headers: authHeaders });
    expect(response.ok(), `GET /api/notion/api/drafts/ failed: ${response.status()}`).toBeTruthy();
    const rows = parseDraftListPayload(await response.json());
    expect(
      rows.some((r) => r.title === draftTitle),
      `Expected draft title "${draftTitle}" in API list`,
    ).toBeTruthy();
  }).toPass({ timeout: 20_000 });
};

/** Sidebar list row: scoped to aside + ul so we do not match global buttons (Search, New page, etc.). */
const notionDraftSidebarRowButton = (page: Page, draftTitle: string) =>
  page.locator('aside ul li').filter({ hasText: draftTitle }).locator('> div[role="button"]').first();

test.describe('notion test', () => {
  test('editor block test with marketing data', async ({ page }) => {
    const draftTitle = `E2E Marketing Content ${Date.now()}`;
    const authHeaders = buildAuthHeadersFromStorageState();
    const createdDraft = await createMarketingDraft(page, draftTitle, authHeaders);
    const draftId = createdDraft.id;

    try {
      await page.goto('/notion');
      await waitForNotionDraftInApiList(page, draftTitle, authHeaders);

      const draftRowButton = notionDraftSidebarRowButton(page, draftTitle);
      await expect(draftRowButton).toBeVisible({ timeout: 15_000 });
      await draftRowButton.click();

      await expect(page.locator('input[placeholder="Untitled"]')).toHaveValue(draftTitle, { timeout: 10_000 });

      const editor = page.locator('[data-notion-editor-container]');
      await editor.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      await expect(
        editor.locator('img[src*="marketing-simplified-github-screenshot.png"]'),
      ).toBeVisible({ timeout: 15_000 });
      await expect(editor.locator('img[alt="marketing-simplified GitHub repository"]')).toBeVisible();
      await expect(
        editor.locator('a[href="https://github.com/quanwangniuniu/marketing-simplified"]'),
      ).toBeVisible();
      await expect(editor.getByText('GitHub · marketing-simplified')).toBeVisible();
      await expect(
        editor.getByRole('link', { name: 'e2e-sample-attachment.txt', exact: true }),
      ).toBeVisible();
      await expect(
        editor.locator('a[href$="e2e-sample-attachment.txt"]'),
      ).toBeVisible();

      await page.getByRole('button', { name: 'Preview', exact: true }).click();
      const previewModal = page.locator('.fixed.inset-0.z-40').last();
      await expect(previewModal).toBeVisible({ timeout: 10_000 });

      await expect(
        previewModal.getByText(/This note pulls together paid media, lifecycle touchpoints, and web analytics/),
      ).toBeVisible();
      await expect(
        previewModal.locator('h1', { hasText: 'Weekly Growth & Acquisition Review — April 16' }),
      ).toBeVisible();
      await expect(previewModal.locator('h2', { hasText: 'Paid search & brand defense' })).toBeVisible();
      await expect(previewModal.locator('h3', { hasText: 'Geo split & match-type hygiene' })).toBeVisible();
      await expect(previewModal.locator('blockquote', { hasText: 'Leadership wants proof that creative fatigue is real' })).toBeVisible();
      await expect(previewModal.getByText(/FROM ads_search_daily/)).toBeVisible();
      await expect(previewModal.locator('.border-t.border-gray-300').first()).toBeVisible();
      await expect(
        previewModal.locator('ul li', { hasText: 'Pause the underperforming DSA ad group tied to outdated PDP copy.' }),
      ).toBeVisible();
      await expect(
        previewModal.locator('ol li', {
          hasText: 'Ship three net-new UGC scripts from creators A–C by Wednesday noon PT.',
        }),
      ).toBeVisible();
      await expect(previewModal.getByText('Approve the creative matrix spreadsheet and tag owners in Asana.')).toBeVisible();
      await expect(previewModal.locator('table[data-table-block="true"]')).toHaveCount(3);
      await expect(previewModal.locator('table td', { hasText: 'Meta' })).toBeVisible();
      await expect(previewModal.locator('table td', { hasText: 'Pinterest' })).toBeVisible();
      await expect(previewModal.locator('table td', { hasText: 'TikTok' })).toBeVisible();

      await expect(
        previewModal.locator('img[src*="marketing-simplified-github-screenshot.png"]'),
      ).toBeVisible();
      await expect(previewModal.locator('img[alt="marketing-simplified GitHub repository"]')).toBeVisible();
      await expect(
        previewModal.getByRole('link', { name: 'quanwangniuniu/marketing-simplified' }),
      ).toBeVisible();
      await expect(previewModal.getByText('GitHub · marketing-simplified')).toBeVisible();

      const fileAttachmentLink = previewModal.getByRole('link', {
        name: 'e2e-sample-attachment.txt',
        exact: true,
      });
      await expect(fileAttachmentLink).toBeVisible();
      await expect(fileAttachmentLink).toHaveAttribute('href', /e2e-sample-attachment\.txt$/);
    } finally {
      if (draftId) {
        await safeDeleteDraft(page, draftId, authHeaders);
      }
    }
  });

  test('create draft with fixture data and jump via block minimap', async ({ page }) => {
    const draftTitle = `E2E Outline Jump ${Date.now()}`;
    const authHeaders = buildAuthHeadersFromStorageState();
    let draftId: number | null = null;

    /** Labels must match outline buttons (same as rendered heading text; HTML entities are decoded in UI). */
    const minimapTargets = [
      'Weekly Growth & Acquisition Review — April 16',
      'Paid search & brand defense',
      'Geo split & match-type hygiene',
      'Paid social & creative pipeline',
      'Creative rotation & hook testing',
      'Lifecycle, onsite, and instrumentation',
      'Email & in-app prompts',
      'Site performance & experiments',
      'Core Web Vitals snapshot',
      'Risks, dependencies, and next week',
      'Open risks',
      'Appendix — definitions & tags',
      'Glossary',
    ];

    /**
     * Non-monotonic jump order: not document top→bottom. Each index 0..12 appears once (full permutation).
     * Kept fixed so CI is deterministic; still exercises jumping around the outline like real use.
     */
    const minimapJumpOrderByIndex: number[] = [
      7, 2, 11, 4, 9, 12, 3, 8, 1, 5, 0, 10, 6,
    ];

    try {
      const createdDraft = await createMarketingDraft(page, draftTitle, authHeaders);
      draftId = createdDraft.id;

      await page.goto('/notion');
      await waitForNotionDraftInApiList(page, draftTitle, authHeaders);

      const draftRowButton = notionDraftSidebarRowButton(page, draftTitle);
      await expect(draftRowButton).toBeVisible({ timeout: 15_000 });
      await draftRowButton.click();
      await expect(page.locator('input[placeholder="Untitled"]')).toBeEnabled({ timeout: 10_000 });
      await expect(page.locator('input[placeholder="Untitled"]')).toHaveValue(draftTitle, { timeout: 10_000 });

      const editorContainer = page.locator('[data-notion-editor-container]');
      for (const label of minimapTargets) {
        const block = editorContainer.locator('[data-block-id]').filter({ hasText: label }).first();
        await expect(block).toBeVisible({ timeout: 15_000 });
      }

      const firstLabel = minimapTargets[0];
      const firstBlock = editorContainer.locator('[data-block-id]').filter({ hasText: firstLabel }).first();

      const outlineScroll = page.locator('.outline-overlay-scroll');
      const outlineAnchor = page.locator('.outline-overlay-anchor');
      await expect(outlineAnchor).toBeVisible({ timeout: 10_000 });

      expect(new Set(minimapJumpOrderByIndex).size).toBe(minimapTargets.length);
      expect(Math.min(...minimapJumpOrderByIndex)).toBe(0);
      expect(Math.max(...minimapJumpOrderByIndex)).toBe(minimapTargets.length - 1);

      for (const idx of minimapJumpOrderByIndex) {
        const label = minimapTargets[idx];
        const targetBlock = editorContainer.locator('[data-block-id]').filter({ hasText: label }).first();

        if (idx === 0) {
          await editorContainer.evaluate((element) => {
            element.scrollTop = element.scrollHeight;
          });
          await expect(firstBlock).not.toBeInViewport({ timeout: 10_000 });
          const scrollTopBefore = await editorContainer.evaluate((element) => element.scrollTop);

          await outlineAnchor.hover();
          const jumpButton = outlineScroll.getByRole('button', { name: label, exact: true });
          await expect(jumpButton).toBeVisible({ timeout: 10_000 });
          await jumpButton.click();

          const scrollTopAfter = await editorContainer.evaluate((element) => element.scrollTop);
          expect(scrollTopAfter).toBeLessThan(scrollTopBefore);
          await expect(targetBlock).toBeInViewport({ timeout: 10_000 });
          continue;
        }

        await outlineAnchor.hover();
        const jumpButton = outlineScroll.getByRole('button', { name: label, exact: true });
        await expect(jumpButton).toBeVisible({ timeout: 10_000 });
        await jumpButton.click();
        await expect(targetBlock).toBeInViewport({ timeout: 10_000 });
      }
    } finally {
      if (draftId) {
        await safeDeleteDraft(page, draftId, authHeaders);
      }
    }
  });

  test('create->save->reopen->delete with confirm', async ({ page }) => {
    const authHeaders = buildAuthHeadersFromStorageState();
    
    let draftId: number | null = null;
    let deleted = false;
    const newTitle = `edited draft ${Date.now()}`;
    
    const saveButton = page.getByRole('button', { name: 'Save', exact: true});
    const titleInput = page.locator('input[placeholder="Untitled"]');
    const editor = page.locator('[data-notion-editor-container]');

    try {
      await page.goto('/notion');

      const createResponsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url().includes('/api/notion/api/drafts') &&
          response.status() >= 200 &&
          response.status() < 300,
        { timeout: 30_000 },
      );

      await page.getByRole('button', { name: 'New page', exact: true }).click();
      const createResponse = await createResponsePromise;
      const created = (await createResponse.json()) as { id: number; title?: string };
      draftId = created.id;
      const expectedInitialTitle =
        created.title && created.title.trim() !== '' ? created.title : 'Untitled draft';

      await expect(titleInput).toHaveValue(expectedInitialTitle, { timeout: 15_000 });

      await expect(saveButton).toBeDisabled({ timeout: 15_000 });

      await titleInput.fill(newTitle);

      await expect(saveButton).toBeEnabled({ timeout: 10_000 });

      const saveResponsePromise = page.waitForResponse(
        (response) => {
          const url = response.url();
          return (
            response.request().method() === 'PUT' &&
            url.includes(`/api/notion/api/drafts/${draftId}/`) &&
            response.status() >= 200 &&
            response.status() < 300
          );
        },
        { timeout: 30_000 },
      );

      await saveButton.click();
      await saveResponsePromise;

      await expect(page.getByText('Draft saved')).toBeVisible({ timeout: 15_000 });

      await expect(saveButton).toBeDisabled({ timeout: 15_000 });
      await expect(titleInput).toHaveValue(newTitle);

      await page.reload();
      
      const draftRow = page.locator('[role="button"]').filter({ hasText: newTitle }).first();
      await expect(draftRow).toBeVisible({ timeout: 15_000 });
      await draftRow.click();

      await expect(titleInput).toHaveValue(newTitle, { timeout: 20_000 });
      await expect(editor).toBeVisible({ timeout: 15_000 });

      //delete process
      await draftRow.hover();
      const deleteIconButton = draftRow.getByRole('button', { name: 'Delete draft', exact: true });
      await expect(deleteIconButton).toBeVisible({ timeout: 10_000 });
      await deleteIconButton.click();

      await expect(page.getByText('Delete this draft?')).toBeVisible({ timeout: 10_000 });

      const deleteResponsePromise = page.waitForResponse(
        (response) =>
          !!draftId &&
          response.request().method()  === 'DELETE' &&
          response.url().includes(`/api/notion/api/drafts/${draftId}/`) &&
          response.status() >= 200 &&
          response.status() < 300,
        { timeout: 30_000 },
      );

      await page.getByRole('button', { name: 'Delete', exact: true }).click();
      await deleteResponsePromise;
      deleted = true;

      await expect(page.locator('[role="button"]').filter({ hasText: newTitle })).toHaveCount(0, {
        timeout: 20_000,
      });
    } finally {
      if (draftId && !deleted) {
        await safeDeleteDraft(page, draftId, authHeaders);
      }
    }
  });

  test('save draft with body only and fallback title', async ({ page }) => {
    const authHeaders = buildAuthHeadersFromStorageState();

    let draftId: number | null = null;
    const bodyOnlyMarker = `body-only-${Date.now()}`;

    const saveButton = page.getByRole('button', { name: 'Save', exact: true });
    const titleInput = page.locator('input[placeholder="Untitled"]');
    const firstEditorTextbox = page
      .locator('[data-notion-editor-container] [role="textbox"][data-block-id]')
      .first();

    try {
      await page.goto('/notion');

      const createResponsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url().includes('/api/notion/api/drafts/') &&
          response.status() >= 200 &&
          response.status() < 300,
        { timeout: 30_000 },
      );

      await page.getByRole('button', { name: 'New page', exact: true }).click();
      const createResponse = await createResponsePromise;
      const created = (await createResponse.json()) as { id: number; title?: string };
      draftId = created.id;

      await expect(titleInput).toBeEnabled({ timeout: 15_000 });
      await expect(firstEditorTextbox).toBeVisible({ timeout: 15_000 });
      await expect(saveButton).toBeDisabled({ timeout: 15_000 });

      await titleInput.fill('   ');
      await firstEditorTextbox.click();
      await firstEditorTextbox.fill(bodyOnlyMarker);

      await expect(saveButton).toBeEnabled({ timeout: 10_000 });

      const saveResponsePromise = page.waitForResponse(
        (response) =>
          !!draftId &&
          response.request().method() === 'PUT' &&
          response.url().includes(`/api/notion/api/drafts/${draftId}/`) &&
          response.status() >= 200 &&
          response.status() < 300,
        { timeout: 30_000 },
      );

      await saveButton.click();
      const saveResponse = await saveResponsePromise;
      const updated = (await saveResponse.json()) as { title?: string };
      const fallbackTitle = updated.title?.trim() || '';

      expect(['Untitled', 'Untitled draft']).toContain(fallbackTitle);
      await expect(titleInput).toHaveValue(/Untitled(?: draft)?/, { timeout: 15_000 });
      await expect(page.getByText('Draft saved')).toBeVisible({ timeout: 15_000 });

      const detailResponse = await page.request.get(`/api/notion/api/drafts/${draftId}/`, {
        headers: authHeaders,
      });
      expect(detailResponse.ok()).toBeTruthy();
      const detail = (await detailResponse.json()) as { title?: string; content_blocks?: unknown[] };
      const contentBlocks = Array.isArray(detail.content_blocks) ? detail.content_blocks : [];

      expect(['Untitled', 'Untitled draft']).toContain((detail.title || '').trim());
      expect(contentBlocks.length).toBeGreaterThan(0);
    } finally {
      if (draftId) {
        await safeDeleteDraft(page, draftId, authHeaders);
      }
    }
  });

  test('title with leading and trailing spaces is trimmed on save', async ({ page }) => {
    const authHeaders = buildAuthHeadersFromStorageState();
    let draftId: number | null = null;
    const coreTitle = `Trimmed Title ${Date.now()}`;
    const paddedTitle = `   ${coreTitle}   `;

    const saveButton = page.getByRole('button', { name: 'Save', exact: true });
    const titleInput = page.locator('input[placeholder="Untitled"]');

    try {
      await page.goto('/notion');

      const createResponsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url().includes('/api/notion/api/drafts/') &&
          response.status() >= 200 &&
          response.status() < 300,
        { timeout: 30_000 },
      );

      await page.getByRole('button', { name: 'New page', exact: true }).click();
      const createResponse = await createResponsePromise;
      const created = (await createResponse.json()) as { id: number };
      draftId = created.id;

      await expect(titleInput).toBeEnabled({ timeout: 15_000 });
      await expect(saveButton).toBeDisabled({ timeout: 15_000 });

      await titleInput.fill(paddedTitle);
      await expect(titleInput).toHaveValue(paddedTitle);
      await expect(saveButton).toBeEnabled({ timeout: 10_000 });

      const saveResponsePromise = page.waitForResponse(
        (response) =>
          !!draftId &&
          response.request().method() === 'PUT' &&
          response.url().includes(`/api/notion/api/drafts/${draftId}/`) &&
          response.status() >= 200 &&
          response.status() < 300,
        { timeout: 30_000 },
      );

      await saveButton.click();
      const saveResponse = await saveResponsePromise;

      const requestBodyRaw = saveResponse.request().postData();
      expect(requestBodyRaw).toBeTruthy();
      const requestBody = JSON.parse(requestBodyRaw!) as { title?: string };
      expect(requestBody.title).toBe(coreTitle);

      await expect(page.getByText('Draft saved')).toBeVisible({ timeout: 15_000 });
      await expect(titleInput).toHaveValue(coreTitle, { timeout: 15_000 });

      const detailResponse = await page.request.get(`/api/notion/api/drafts/${draftId}/`, {
        headers: authHeaders,
      });
      expect(detailResponse.ok()).toBeTruthy();
      const detail = (await detailResponse.json()) as { title?: string };
      expect((detail.title || '').trim()).toBe(coreTitle);
    } finally {
      if (draftId) {
        await safeDeleteDraft(page, draftId, authHeaders);
      }
    }
  });

  test('draft title supports emoji, special characters, and multilingual text (ZH/EN, Arabic, Japanese)', async ({
    page,
  }) => {
    const authHeaders = buildAuthHeadersFromStorageState();
    let draftId: number | null = null;
    const runId = Date.now();
    /** Intentionally dense: mixed scripts, emoji, and punctuation often used in real titles. */
    const multilingualTitle = `E2E-${runId} 标题·mixed 📝 & '" — # @ % 中文 English · العربية اختبار · 日本語テスト ひらがな`;

    const saveButton = page.getByRole('button', { name: 'Save', exact: true });
    const titleInput = page.locator('input[placeholder="Untitled"]');

    try {
      await page.goto('/notion');

      const createResponsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url().includes('/api/notion/api/drafts/') &&
          response.status() >= 200 &&
          response.status() < 300,
        { timeout: 30_000 },
      );

      await page.getByRole('button', { name: 'New page', exact: true }).click();
      const createResponse = await createResponsePromise;
      const created = (await createResponse.json()) as { id: number };
      draftId = created.id;

      await expect(titleInput).toBeEnabled({ timeout: 15_000 });
      await expect(saveButton).toBeDisabled({ timeout: 15_000 });

      await titleInput.fill(multilingualTitle);
      await expect(saveButton).toBeEnabled({ timeout: 10_000 });

      const saveResponsePromise = page.waitForResponse(
        (response) =>
          !!draftId &&
          response.request().method() === 'PUT' &&
          response.url().includes(`/api/notion/api/drafts/${draftId}/`) &&
          response.status() >= 200 &&
          response.status() < 300,
        { timeout: 30_000 },
      );

      await saveButton.click();
      const saveResponse = await saveResponsePromise;

      const requestBodyRaw = saveResponse.request().postData();
      expect(requestBodyRaw).toBeTruthy();
      const requestBody = JSON.parse(requestBodyRaw!) as { title?: string };
      expect(requestBody.title).toBe(multilingualTitle);

      await expect(page.getByText('Draft saved')).toBeVisible({ timeout: 15_000 });
      await expect(titleInput).toHaveValue(multilingualTitle, { timeout: 15_000 });

      const detailResponse = await page.request.get(`/api/notion/api/drafts/${draftId}/`, {
        headers: authHeaders,
      });
      expect(detailResponse.ok()).toBeTruthy();
      const detail = (await detailResponse.json()) as { title?: string };
      expect(detail.title).toBe(multilingualTitle);

      await page.reload();
      await waitForNotionDraftInApiList(page, multilingualTitle, authHeaders);

      const draftRow = notionDraftSidebarRowButton(page, multilingualTitle);
      await expect(draftRow).toBeVisible({ timeout: 15_000 });
      await draftRow.click();
      await expect(titleInput).toHaveValue(multilingualTitle, { timeout: 15_000 });
    } finally {
      if (draftId) {
        await safeDeleteDraft(page, draftId, authHeaders);
      }
    }
  });

  const createDraftFailureCases = [
    { status: 500, shouldRedirectToLogin: false },
    { status: 401, shouldRedirectToLogin: true },
    { status: 403, shouldRedirectToLogin: false },
    { status: 404, shouldRedirectToLogin: false },
  ] as const;

  for (const failureCase of createDraftFailureCases) {
    test(`create draft handles API ${failureCase.status}`, async ({ page }) => {
      test.setTimeout(90_000);
      const saveButton = page.getByRole('button', { name: 'Save', exact: true });
      const titleInput = page.locator('input[placeholder="Untitled"]');
      const errorDetail = `Create draft failed (${failureCase.status})`;

      await page.route('**/api/notion/api/drafts/', async (route, request) => {
        if (request.method() === 'POST') {
          await route.fulfill({
            status: failureCase.status,
            contentType: 'application/json',
            body: JSON.stringify({ detail: errorDetail }),
          });
          return;
        }
        await route.continue();
      });

      await page.goto('/notion');
      await expect(saveButton).toBeDisabled({ timeout: 15_000 });

      await page.getByRole('button', { name: 'New page', exact: true }).click();

      if (failureCase.shouldRedirectToLogin) {
        await expect(page).toHaveURL(/\/login(?:\/)?(?:\?.*)?$/, { timeout: 15_000 });
        return;
      }

      await expect(page.getByText(errorDetail)).toBeVisible({ timeout: 15_000 });
      await expect(saveButton).toBeDisabled({ timeout: 15_000 });
      await expect(titleInput).toBeVisible({ timeout: 15_000 });
    });
  }

  test('update draft 500 keeps unsaved state and save stays enabled', async ({ page }) => {
    test.setTimeout(90_000);
    const authHeaders = buildAuthHeadersFromStorageState();
    const baseTitle = `Update Fail Base ${Date.now()}`;
    const marker = `UPDATE_FAIL_MARKER_${Date.now()}`;
    const updatedTitle = `${baseTitle} updated`;
    const createdDraft = await createSwitchDraft(page, baseTitle, marker, authHeaders);
    const draftId = createdDraft.id;

    const saveButton = page.getByRole('button', { name: 'Save', exact: true });
    const titleInput = page.locator('input[placeholder="Untitled"]');
    const draftRowButton = notionDraftSidebarRowButton(page, baseTitle);

    try {
      await page.route(`**/api/notion/api/drafts/${draftId}/`, async (route, request) => {
        if (request.method() === 'PUT') {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ detail: 'Update failed (500)' }),
          });
          return;
        }
        await route.continue();
      });

      await page.goto('/notion');
      await waitForNotionDraftInApiList(page, baseTitle, authHeaders);
      await expect(draftRowButton).toBeVisible({ timeout: 15_000 });

      await draftRowButton.click();
      await expect(titleInput).toHaveValue(baseTitle, { timeout: 15_000 });

      await titleInput.fill(updatedTitle);
      await expect(saveButton).toBeEnabled({ timeout: 10_000 });

      await saveButton.click();
      await expect(page.getByText('Failed to save draft')).toBeVisible({ timeout: 15_000 });
      await expect(saveButton).toBeEnabled({ timeout: 15_000 });
      await expect(titleInput).toHaveValue(updatedTitle, { timeout: 15_000 });
    } finally {
      await safeDeleteDraft(page, draftId, authHeaders);
    }
  });

  test('delete draft failure shows error and does not remove row', async ({ page }) => {
    test.setTimeout(90_000);
    const authHeaders = buildAuthHeadersFromStorageState();
    const title = `Delete Fail ${Date.now()}`;
    const marker = `DELETE_FAIL_MARKER_${Date.now()}`;
    const createdDraft = await createSwitchDraft(page, title, marker, authHeaders);
    const draftId = createdDraft.id;

    try {
      await page.route(`**/api/notion/api/drafts/${draftId}/`, async (route, request) => {
        if (request.method() === 'DELETE') {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ detail: 'Delete failed (500)' }),
          });
          return;
        }
        await route.continue();
      });

      await page.goto('/notion');
      await waitForNotionDraftInApiList(page, title, authHeaders);

      const draftRow = page.locator('[role="button"]').filter({ hasText: title }).first();
      await expect(draftRow).toBeVisible({ timeout: 15_000 });

      await draftRow.hover();
      const deleteIconButton = draftRow.getByRole('button', { name: 'Delete draft', exact: true });
      await expect(deleteIconButton).toBeVisible({ timeout: 10_000 });
      await deleteIconButton.click();

      await expect(page.getByText('Delete this draft?')).toBeVisible({ timeout: 10_000 });
      await page.getByRole('button', { name: 'Delete', exact: true }).click();

      await expect(page.getByText('Failed to delete draft')).toBeVisible({ timeout: 15_000 });
      await expect(page.locator('[role="button"]').filter({ hasText: title })).toHaveCount(1, {
        timeout: 15_000,
      });
    } finally {
      await safeDeleteDraft(page, draftId, authHeaders);
    }
  });

  test('switch between two drafts updates title and editor content', async ({page}) => {
    const titleA = `Switch A`;
    const titleB = `Switch B`;
    const markerA = `BODY_MARKER_A`;
    const markerB = `BODY_MARKER_B`;

    const authHeaders = buildAuthHeadersFromStorageState();
    const createA = await createSwitchDraft(page, titleA, markerA, authHeaders);
    const createB = await createSwitchDraft(page, titleB, markerB, authHeaders);
    const draftIdA = createA.id;
    const draftIdB = createB.id;

    const titleInput = page.locator('input[placeholder="Untitled"]');
    const editor = page.locator('[data-notion-editor-container]');

    try {
      await page.goto('/notion/');

      const rowA = page.locator('[role="button"]').filter({ hasText: titleA }).first();
      const rowB = page.locator('[role="button"]').filter({ hasText: titleB }).first();
      await expect(rowA).toBeVisible({ timeout: 15_000 });
      await expect(rowB).toBeVisible({ timeout: 15_000 });

      await rowA.click();
      await expect(titleInput).toHaveValue(titleA, { timeout: 15_000 });
      await expect(editor).toContainText(markerA, { timeout: 15_000 });
      await expect(editor).not.toContainText(markerB);

      await rowB.click();
      await expect(titleInput).toHaveValue(titleB, { timeout: 15_000 });
      await expect(editor).toContainText(markerB, { timeout: 15_000 });
      await expect(editor).not.toContainText(markerA);

      await rowA.click();
      await expect(titleInput).toHaveValue(titleA, { timeout: 15_000 });
      await expect(editor).toContainText(markerA, { timeout: 15_000 });
      await expect(editor).not.toContainText(markerB);
    } finally {
      if (draftIdA) {
        await safeDeleteDraft(page, draftIdA, authHeaders);
      }
      if (draftIdB) {
        await safeDeleteDraft(page, draftIdB, authHeaders);
      }
    }
  });

  test('unsaved changes and reload page', async ({ page }) => {
    const authHeaders = buildAuthHeadersFromStorageState();
    const unsavedTitle = `unsaved draft`;
    let draftId: number | null = null;

    const titleInput = page.locator('input[placeholder="Untitled"]');
    const saveButton = page.getByRole('button', { name: 'Save', exact: true });
    const calendarLink =page.locator('a[href="/calendar"]').first();

    try {
      await page.goto('/notion');

      const createResponsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url().includes('/api/notion/api/drafts/') &&
          response.status() >= 200 &&
          response.status() < 300,
        { timeout: 30_000 },
      );

      await page.getByRole('button', { name: 'New page', exact: true }).click();
      const createResponse = await createResponsePromise;
      const created = (await createResponse.json()) as { id: number; title?: string };
      draftId = created.id;

      await expect(titleInput).toBeEnabled({ timeout: 15_000 });
      await expect(saveButton).toBeDisabled({ timeout: 15_000 });

      await titleInput.fill(unsavedTitle);
      await expect(saveButton).toBeEnabled({ timeout: 10_000 });

      await calendarLink.click();

      await expect(page.getByText('Unsaved changes will be lost').last()).toBeVisible({
        timeout: 10_000
      });
      await expect(page.getByRole('button', { name: 'Stay', exact: true }).last()).
      toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole('button', { name: 'Leave', exact: true }).last()).
      toBeVisible({ timeout: 10_000 });

      await page.getByRole('button', { name: 'Stay', exact: true }).last().click();

      await expect(page).toHaveURL(/\/notion(?:\/)?(?:\?.*)?$/);
      await expect(titleInput).toHaveValue(unsavedTitle);
      await expect(saveButton).toBeEnabled();

      await calendarLink.click();
      await expect(page.getByText('Unsaved changes will be lost').last()).toBeVisible({ timeout: 10_000 });

      await page.getByRole('button', { name: 'Leave', exact: true }).last().click();
      await expect(page).toHaveURL(/\/calendar(?:\/)?(?:\?.*)?$/, { timeout: 20_000 });
    } finally {
      if (draftId) {
        await safeDeleteDraft(page, draftId, authHeaders);
      }
    }
  });

  test('unsaved editor text is lost when switching to another draft withut saving', async ({page,}) =>{
    const runId = Date.now();
    const titleA = `Unsaved A ${runId}`;
    const titleB = `Unsaved B ${runId}`;
    const markerA = `Unsaved_marker_A_${runId}`;
    const markerB = `Unsaved_marker_B_${runId}`;
    const unsavedToken = `LOST_TEXT_${runId}`;

    const authHeaders = buildAuthHeadersFromStorageState();
    const createdA = await createSwitchDraft(page, titleA, markerA, authHeaders);
    const createdB = await createSwitchDraft(page, titleB, markerB, authHeaders);
    const draftIdA = createdA.id;
    const draftIdB = createdB.id;

    const titleInput = page.locator('input[placeholder="Untitled"]');
    const editor = page.locator('[data-notion-editor-container]');
    const saveButton = page.getByRole('button', { name: 'Save', exact: true });

    try {
      await page.goto('/notion/');
      await waitForNotionDraftInApiList(page, titleA, authHeaders);
      await waitForNotionDraftInApiList(page, titleB, authHeaders);

      const rowA = notionDraftSidebarRowButton(page, titleA);
      const rowB = notionDraftSidebarRowButton(page, titleB);
      await expect(rowA).toBeVisible({ timeout: 15_000 });
      await expect(rowB).toBeVisible({ timeout: 15_000 });

      //open draft A
      await rowA.click();
      await expect(titleInput).toHaveValue(titleA, { timeout: 15_000 });
      await expect(editor).toContainText(markerA, { timeout: 15_000 });

      // write word without save — data-block-id and role="textbox" live on the same node (contenteditable)
      const firstBlockEditor = editor.locator('[data-block-id][role="textbox"]').first();
      await firstBlockEditor.click();
      await page.keyboard.press('End');
      await page.keyboard.type(` ${unsavedToken}`);

      await expect(editor).toContainText(unsavedToken);
      await expect(saveButton).toBeEnabled({ timeout: 10_000 });

      //switch draft B
      await rowB.click();
      await expect(titleInput).toHaveValue(titleB, { timeout: 15_000 });
      await expect(editor).toContainText(markerB, { timeout: 15_000 });

      //go back draft A
      await rowA.click();
      await expect(titleInput).toHaveValue(titleA, { timeout: 15_000 });
      await expect(editor).toContainText(markerA, { timeout: 15_000 });
      await expect(editor).not.toContainText(unsavedToken);
      await expect(saveButton).toBeDisabled({ timeout: 15_000 });
    } finally {
      if (draftIdA) {
        await safeDeleteDraft(page, draftIdA, authHeaders);
      }
      if (draftIdB) {
        await safeDeleteDraft(page, draftIdB, authHeaders);
      }
    }
  });
});
