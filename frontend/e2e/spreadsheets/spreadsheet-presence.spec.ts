import {
  test,
  expect,
  type APIRequestContext,
  type BrowserContext,
} from '@playwright/test';
import { waitForSpreadsheetPageReady } from './spreadsheet-helpers';

const apiUrl = (path: string): string => {
  const base = process.env.PLAYWRIGHT_API_BASE_URL?.replace(/\/$/, '');
  return base ? `${base}${path}` : path;
};

/**
 * Two tabs on the same sheet should see each other's presence avatars.
 * Cell edit sync is out of scope for this scaffold.
 *
 * Navigates straight to the flat spreadsheet detail route (slug-based; numeric
 * ids 404 since the slug migration). The token and active project are read
 * from the saved storageState instead of by visiting `/` first: loading the
 * marketing home before an app page triggers a token-refresh race that 401s
 * every request and bounces both tabs to /login.
 */

async function getOrCreateSpreadsheetSlug(
  context: BrowserContext,
  request: APIRequestContext,
): Promise<string> {
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

  // Must use the active project: pages 401→login on cross-project resources.
  const activeProjectId: number | undefined = parseState(
    localStorageOf('project-storage-v1') ?? localStorageOf('project-storage'),
  )?.activeProject?.id;
  expect(activeProjectId, 'no active project in storageState (auth.setup incomplete?)').toBeTruthy();

  const headers = {
    Authorization: `Bearer ${token}`,
    ...(process.env.PLAYWRIGHT_API_HOST
      ? { Host: process.env.PLAYWRIGHT_API_HOST }
      : {}),
    ...(organizationToken
      ? { 'X-Organization-Token': organizationToken }
      : {}),
  };
  const listUrl = `/api/spreadsheet/spreadsheets/?project_id=${activeProjectId}`;

  const listResp = await request.get(apiUrl(listUrl), { headers });
  expect(listResp.ok(), `spreadsheet list API returned ${listResp.status()}`).toBeTruthy();
  const body = await listResp.json();
  const results: Array<{ slug: string }> = body.results ?? body ?? [];
  if (results.length > 0) return results[0].slug;

  const createResp = await request.post(apiUrl(listUrl), {
    headers,
    data: { name: 'Presence E2E' },
  });
  expect(createResp.ok(), `spreadsheet create API returned ${createResp.status()}`).toBeTruthy();
  return (await createResp.json()).slug;
}

test.describe('Spreadsheet presence (two tabs)', () => {
  test.describe.configure({ mode: 'serial' });

  test('second tab sees a presence avatar for the first tab', async ({
    page,
    context,
    request,
  }) => {
    const spreadsheetSlug = await getOrCreateSpreadsheetSlug(context, request);

    await page.goto(`/spreadsheets/${spreadsheetSlug}`);
    await waitForSpreadsheetPageReady(page);
    await expect(page.locator('td[data-row][data-col]').first()).toBeVisible({
      timeout: 30_000,
    });

    const detailUrl = page.url();
    const page2 = await context.newPage();
    await page2.goto(detailUrl);
    await waitForSpreadsheetPageReady(page2);
    await expect(page2.locator('td[data-row][data-col]').first()).toBeVisible({
      timeout: 30_000,
    });
    // Same user, two clients → each tab should see the peer as a remote avatar.
    await expect(page.getByTestId('sheet-presence-avatar').first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page2.getByTestId('sheet-presence-avatar').first()).toBeVisible({
      timeout: 15_000,
    });

    // Cursor/selection presence is visible in the peer grid, not only in the
    // header avatar tooltip.
    await page.locator('td[data-row="2"][data-col="1"]').click();
    await expect(
      page2.locator(
        '[data-testid="sheet-remote-cursor"][data-row="2"][data-col="1"]',
      ),
    ).toBeVisible({ timeout: 5_000 });

    await page2.close();
  });
});
