import {
  test,
  expect,
  type APIRequestContext,
  type BrowserContext,
} from '@playwright/test';
import { stubOnboardingComplete, waitForSpreadsheetPageReady } from './spreadsheet-helpers';

const apiUrl = (path: string): string => {
  const base = process.env.PLAYWRIGHT_API_BASE_URL?.replace(/\/$/, '');
  return base ? `${base}${path}` : path;
};

/**
 * Two tabs on the same sheet — an edit committed in tab 1 must appear in
 * tab 2 via the cells_updated broadcast, WITHOUT reloading.
 *
 * Same navigation strategy as spreadsheet-presence.spec.ts: go straight to the
 * flat slug route, read token/active project from storageState.
 */

async function readAuth(
  context: BrowserContext,
): Promise<{ token: string; organizationToken?: string; activeProjectId: number }> {
  const state = await context.storageState();
  const localStorageOf = (name: string): string | undefined => {
    for (const origin of state.origins ?? []) {
      const hit = origin.localStorage?.find((item) => item.name === name);
      if (hit) return hit.value;
    }
    return undefined;
  };
  const parseState = (raw: string | undefined) => {
    try {
      return raw ? JSON.parse(raw)?.state : undefined;
    } catch {
      return undefined;
    }
  };

  const authState = parseState(
    localStorageOf('auth-storage-v1') ?? localStorageOf('auth-storage'),
  );
  const token: string | undefined = authState?.token;
  const organizationToken: string | undefined = authState?.organizationAccessToken;
  expect(token, 'auth token missing from storageState (auth.setup failed?)').toBeTruthy();

  const activeProjectId: number | undefined = parseState(
    localStorageOf('project-storage-v1') ?? localStorageOf('project-storage'),
  )?.activeProject?.id;
  expect(activeProjectId, 'no active project in storageState (auth.setup incomplete?)').toBeTruthy();

  return {
    token: token as string,
    organizationToken,
    activeProjectId: activeProjectId as number,
  };
}

function apiHeaders(auth: Awaited<ReturnType<typeof readAuth>>): Record<string, string> {
  return {
    Authorization: `Bearer ${auth.token}`,
    ...(process.env.PLAYWRIGHT_API_HOST
      ? { Host: process.env.PLAYWRIGHT_API_HOST }
      : {}),
    ...(auth.organizationToken
      ? { 'X-Organization-Token': auth.organizationToken }
      : {}),
  };
}

async function getOrCreateSpreadsheetSlug(
  context: BrowserContext,
  request: APIRequestContext,
): Promise<string> {
  const auth = await readAuth(context);
  const { activeProjectId } = auth;
  const headers = apiHeaders(auth);
  const listUrl = `/api/spreadsheet/spreadsheets/?project_id=${activeProjectId}`;

  const listResp = await request.get(apiUrl(listUrl), { headers });
  expect(listResp.ok(), `spreadsheet list API returned ${listResp.status()}`).toBeTruthy();
  const body = await listResp.json();
  const results: Array<{ slug: string }> = body.results ?? body ?? [];
  if (results.length > 0) return results[0].slug;

  const createResp = await request.post(apiUrl(listUrl), {
    headers,
    data: { name: 'Collab Edit E2E' },
  });
  expect(createResp.ok(), `spreadsheet create API returned ${createResp.status()}`).toBeTruthy();
  return (await createResp.json()).slug;
}

test.describe('Spreadsheet realtime edit (two tabs)', () => {
  test.describe.configure({ mode: 'serial' });

  test('edit committed in tab 1 appears in tab 2 without reload', async ({
    page,
    context,
    request,
  }) => {
    const spreadsheetSlug = await getOrCreateSpreadsheetSlug(context, request);

    // The gate would intercept dblclick with a z-[9999] overlay on seeds where
    // devuser lacks an OrganizationMembership row; stub it out for both tabs.
    await stubOnboardingComplete(page);
    await page.goto(`/spreadsheets/${spreadsheetSlug}`);
    await waitForSpreadsheetPageReady(page);
    await expect(page.locator('td[data-row][data-col]').first()).toBeVisible({
      timeout: 30_000,
    });

    const detailUrl = page.url();
    const page2 = await context.newPage();
    await stubOnboardingComplete(page2);
    await page2.goto(detailUrl);
    await waitForSpreadsheetPageReady(page2);
    await expect(page2.locator('td[data-row][data-col]').first()).toBeVisible({
      timeout: 30_000,
    });
    // Both sockets joined (presence avatar of the peer tab visible) before editing,
    // so the broadcast has a live subscriber.
    await expect(page2.getByTestId('sheet-presence-avatar').first()).toBeVisible({
      timeout: 15_000,
    });

    // Unique value so reruns on the same seeded sheet never false-pass.
    const value = `collab-${Date.now()}`;
    // Row 3 / col 2 (0-based): away from the header row used by other suites.
    const cell1 = page.locator('td[data-row="3"][data-col="2"]');
    await cell1.dblclick();
    const editor = cell1.locator('input');
    await expect(editor).toBeVisible({ timeout: 5_000 });
    await editor.fill(value);
    await page2.evaluate(
      ({ expected }) => {
        const peerWindow = window as typeof window & {
          __sheetPropagation?: Promise<number>;
        };
        const cell = document.querySelector('td[data-row="3"][data-col="2"]');
        if (!cell) throw new Error('peer target cell not found');
        const startedAt = performance.now();
        peerWindow.__sheetPropagation = new Promise<number>((resolve) => {
          const finishIfUpdated = () => {
            if (!cell.textContent?.includes(expected)) return false;
            resolve(performance.now() - startedAt);
            return true;
          };
          if (finishIfUpdated()) return;
          const observer = new MutationObserver(() => {
            if (finishIfUpdated()) observer.disconnect();
          });
          observer.observe(cell, { childList: true, characterData: true, subtree: true });
          window.setTimeout(() => {
            observer.disconnect();
            resolve(Number.POSITIVE_INFINITY);
          }, 2_000);
        });
      },
      { expected: value },
    );
    await editor.press('Enter');

    // Tab 2 receives the broadcast and renders it without any navigation,
    // inside the ticket's end-to-end latency budget. The peer page's own
    // MutationObserver measures the DOM update directly, avoiding Playwright's
    // assertion polling interval from inflating the measurement.
    const propagationMs = await page2.evaluate(async () => {
      const peerWindow = window as typeof window & {
        __sheetPropagation?: Promise<number>;
      };
      if (!peerWindow.__sheetPropagation) {
        throw new Error('peer propagation observer was not initialized');
      }
      return peerWindow.__sheetPropagation;
    });
    console.log(
      `[MED-293] playwright_peer_propagation_ms=${propagationMs.toFixed(2)}`,
    );
    expect(
      propagationMs,
      `peer edit propagation took ${propagationMs}ms (expected <300ms)`,
    ).toBeLessThan(300);
    await expect(page2.locator('td[data-row="3"][data-col="2"]')).toContainText(value);

    // Tab 1 keeps its optimistic value and then applies the authoritative response.
    await expect(page.locator('td[data-row="3"][data-col="2"]')).toContainText(value, {
      timeout: 10_000,
    });

    await page2.close();
  });

  test('structure op (insert row) triggers auto-refresh in both tabs', async ({
    page,
    context,
    request,
  }) => {
    const spreadsheetSlug = await getOrCreateSpreadsheetSlug(context, request);
    const headers = apiHeaders(await readAuth(context));

    // Resolve the first sheet id for API-driven mutations.
    const sheetsResp = await request.get(
      apiUrl(`/api/spreadsheet/spreadsheets/${spreadsheetSlug}/sheets/`),
      { headers },
    );
    expect(sheetsResp.ok(), `sheet list API returned ${sheetsResp.status()}`).toBeTruthy();
    const sheetsBody = await sheetsResp.json();
    const sheets: Array<{ id: number }> = sheetsBody.results ?? sheetsBody ?? [];
    expect(sheets.length).toBeGreaterThan(0);
    const sheetId = sheets[0].id;
    const base = `/api/spreadsheet/spreadsheets/${spreadsheetSlug}/sheets/${sheetId}`;

    await stubOnboardingComplete(page);
    await page.goto(`/spreadsheets/${spreadsheetSlug}`);
    await waitForSpreadsheetPageReady(page);
    await expect(page.locator('td[data-row][data-col]').first()).toBeVisible({
      timeout: 30_000,
    });

    const page2 = await context.newPage();
    await stubOnboardingComplete(page2);
    await page2.goto(page.url());
    await waitForSpreadsheetPageReady(page2);
    await expect(page2.locator('td[data-row][data-col]').first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page2.getByTestId('sheet-presence-avatar').first()).toBeVisible({
      timeout: 15_000,
    });

    // Seed a unique marker via the API (no client_id → cells_updated reaches both tabs).
    const marker = `struct-${Date.now()}`;
    const batchResp = await request.post(apiUrl(`${base}/cells/batch/`), {
      headers,
      data: {
        operations: [{ operation: 'set', row: 5, column: 1, raw_input: marker }],
        auto_expand: true,
      },
    });
    expect(batchResp.ok(), `cell batch API returned ${batchResp.status()}`).toBeTruthy();
    await expect(page.locator('td[data-row="5"][data-col="1"]')).toContainText(marker, {
      timeout: 10_000,
    });
    await expect(page2.locator('td[data-row="5"][data-col="1"]')).toContainText(marker, {
      timeout: 10_000,
    });

    // Insert a row above; no X-Sheet-Client-Id header, so BOTH tabs must
    // receive sheet_refresh_required and reload — the marker shifts down one row.
    const insertResp = await request.post(apiUrl(`${base}/rows/insert/`), {
      headers,
      data: { position: 0, count: 1 },
    });
    expect(insertResp.ok(), `row insert API returned ${insertResp.status()}`).toBeTruthy();
    const insertBody = await insertResp.json();

    await expect(page.locator('td[data-row="6"][data-col="1"]')).toContainText(marker, {
      timeout: 10_000,
    });
    await expect(page2.locator('td[data-row="6"][data-col="1"]')).toContainText(marker, {
      timeout: 10_000,
    });

    // A canonical refresh must replace the peer cache, not merge into it. The
    // pre-insert coordinate must be empty rather than retaining a duplicate.
    await expect(
      page.locator('td[data-row="5"][data-col="1"]').filter({ hasText: marker }),
    ).toHaveCount(0);
    await expect(
      page2.locator('td[data-row="5"][data-col="1"]').filter({ hasText: marker }),
    ).toHaveCount(0);

    const revertResp = await request.post(
      apiUrl(`${base}/operations/${insertBody.operation_id}/revert/`),
      { headers },
    );
    expect(revertResp.ok(), `row revert API returned ${revertResp.status()}`).toBeTruthy();

    await expect(page.locator('td[data-row="5"][data-col="1"]')).toContainText(marker, {
      timeout: 10_000,
    });
    await expect(page2.locator('td[data-row="5"][data-col="1"]')).toContainText(marker, {
      timeout: 10_000,
    });
    await expect(
      page.locator('td[data-row="6"][data-col="1"]').filter({ hasText: marker }),
    ).toHaveCount(0);
    await expect(
      page2.locator('td[data-row="6"][data-col="1"]').filter({ hasText: marker }),
    ).toHaveCount(0);

    await page2.close();
  });

  test('column insert and revert replace stale peer coordinates', async ({
    page,
    context,
    request,
  }) => {
    const spreadsheetSlug = await getOrCreateSpreadsheetSlug(context, request);
    const headers = apiHeaders(await readAuth(context));

    const sheetsResp = await request.get(
      apiUrl(`/api/spreadsheet/spreadsheets/${spreadsheetSlug}/sheets/`),
      { headers },
    );
    expect(sheetsResp.ok(), `sheet list API returned ${sheetsResp.status()}`).toBeTruthy();
    const sheetsBody = await sheetsResp.json();
    const sheets: Array<{ id: number }> = sheetsBody.results ?? sheetsBody ?? [];
    expect(sheets.length).toBeGreaterThan(0);
    const sheetId = sheets[0].id;
    const base = `/api/spreadsheet/spreadsheets/${spreadsheetSlug}/sheets/${sheetId}`;

    await stubOnboardingComplete(page);
    await page.goto(`/spreadsheets/${spreadsheetSlug}`);
    await waitForSpreadsheetPageReady(page);
    await expect(page.locator('td[data-row][data-col]').first()).toBeVisible({
      timeout: 30_000,
    });

    const page2 = await context.newPage();
    await stubOnboardingComplete(page2);
    await page2.goto(page.url());
    await waitForSpreadsheetPageReady(page2);
    await expect(page2.locator('td[data-row][data-col]').first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page2.getByTestId('sheet-presence-avatar').first()).toBeVisible({
      timeout: 15_000,
    });

    const marker = `column-struct-${Date.now()}`;
    const batchResp = await request.post(apiUrl(`${base}/cells/batch/`), {
      headers,
      data: {
        operations: [{ operation: 'set', row: 7, column: 3, raw_input: marker }],
        auto_expand: true,
      },
    });
    expect(batchResp.ok(), `cell batch API returned ${batchResp.status()}`).toBeTruthy();
    await expect(page.locator('td[data-row="7"][data-col="3"]')).toContainText(marker, {
      timeout: 10_000,
    });
    await expect(page2.locator('td[data-row="7"][data-col="3"]')).toContainText(marker, {
      timeout: 10_000,
    });

    const insertResp = await request.post(apiUrl(`${base}/columns/insert/`), {
      headers,
      data: { position: 3, count: 1 },
    });
    expect(insertResp.ok(), `column insert API returned ${insertResp.status()}`).toBeTruthy();
    const insertBody = await insertResp.json();

    await expect(page.locator('td[data-row="7"][data-col="4"]')).toContainText(marker, {
      timeout: 10_000,
    });
    await expect(page2.locator('td[data-row="7"][data-col="4"]')).toContainText(marker, {
      timeout: 10_000,
    });
    await expect(
      page.locator('td[data-row="7"][data-col="3"]').filter({ hasText: marker }),
    ).toHaveCount(0);
    await expect(
      page2.locator('td[data-row="7"][data-col="3"]').filter({ hasText: marker }),
    ).toHaveCount(0);

    const revertResp = await request.post(
      apiUrl(`${base}/operations/${insertBody.operation_id}/revert/`),
      { headers },
    );
    expect(revertResp.ok(), `column revert API returned ${revertResp.status()}`).toBeTruthy();

    await expect(page.locator('td[data-row="7"][data-col="3"]')).toContainText(marker, {
      timeout: 10_000,
    });
    await expect(page2.locator('td[data-row="7"][data-col="3"]')).toContainText(marker, {
      timeout: 10_000,
    });
    await expect(
      page.locator('td[data-row="7"][data-col="4"]').filter({ hasText: marker }),
    ).toHaveCount(0);
    await expect(
      page2.locator('td[data-row="7"][data-col="4"]').filter({ hasText: marker }),
    ).toHaveCount(0);

    await page2.close();
  });

  test('sheet create and delete refresh the peer tab list', async ({
    page,
    context,
    request,
  }) => {
    const spreadsheetSlug = await getOrCreateSpreadsheetSlug(context, request);
    const headers = apiHeaders(await readAuth(context));

    await stubOnboardingComplete(page);
    await page.goto(`/spreadsheets/${spreadsheetSlug}`);
    await waitForSpreadsheetPageReady(page);
    await expect(page.locator('td[data-row][data-col]').first()).toBeVisible({
      timeout: 30_000,
    });

    const page2 = await context.newPage();
    await stubOnboardingComplete(page2);
    await page2.goto(page.url());
    await waitForSpreadsheetPageReady(page2);
    await expect(page2.locator('td[data-row][data-col]').first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page2.getByTestId('sheet-presence-avatar').first()).toBeVisible({
      timeout: 15_000,
    });
    const initialSheetsResp = await request.get(
      apiUrl(`/api/spreadsheet/spreadsheets/${spreadsheetSlug}/sheets/`),
      { headers },
    );
    expect(
      initialSheetsResp.ok(),
      `initial sheet list API returned ${initialSheetsResp.status()}`,
    ).toBeTruthy();
    const initialSheetsBody = await initialSheetsResp.json();
    const initialSheets: Array<{ id: number; name: string }> =
      initialSheetsBody.results ?? initialSheetsBody ?? [];
    expect(initialSheets.length).toBeGreaterThan(0);
    const fallbackSheetName = initialSheets[0].name;

    const sheetName = `Realtime Tab ${Date.now()}`;
    let createdSheetId: number | null = null;
    let deleted = false;
    try {
      const createResp = await request.post(
        apiUrl(`/api/spreadsheet/spreadsheets/${spreadsheetSlug}/sheets/`),
        { headers, data: { name: sheetName } },
      );
      expect(createResp.ok(), `sheet create API returned ${createResp.status()}`).toBeTruthy();
      createdSheetId = (await createResp.json()).id;

      const tab1 = page.getByRole('button', { name: sheetName, exact: true });
      const tab2 = page2.getByRole('button', { name: sheetName, exact: true });
      await expect(tab1).toBeVisible({ timeout: 10_000 });
      await expect(tab2).toBeVisible({ timeout: 10_000 });

      await tab1.click();
      await tab2.click();
      await expect(tab1).toHaveAttribute('aria-pressed', 'true');
      await expect(tab2).toHaveAttribute('aria-pressed', 'true');
      // Presence proves both sheet-scoped sockets finished switching rooms.
      await expect(page2.getByTestId('sheet-presence-avatar').first()).toBeVisible({
        timeout: 15_000,
      });

      const deleteResp = await request.delete(
        apiUrl(`/api/spreadsheet/spreadsheets/${spreadsheetSlug}/sheets/${createdSheetId}/`),
        { headers },
      );
      expect(deleteResp.ok(), `sheet delete API returned ${deleteResp.status()}`).toBeTruthy();
      deleted = true;

      await expect(page.getByRole('button', { name: sheetName, exact: true })).toHaveCount(0);
      await expect(page2.getByRole('button', { name: sheetName, exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: fallbackSheetName, exact: true })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await expect(page2.getByRole('button', { name: fallbackSheetName, exact: true })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    } finally {
      if (createdSheetId != null && !deleted) {
        await request.delete(
          apiUrl(`/api/spreadsheet/spreadsheets/${spreadsheetSlug}/sheets/${createdSheetId}/`),
          { headers },
        );
      }
      await page2.close();
    }
  });
});
