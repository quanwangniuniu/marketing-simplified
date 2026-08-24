import { expect, test } from '@playwright/test';

const idleWindowMs = Number(process.env.E2E_SSE_IDLE_WINDOW_MS ?? 65_000);

test.describe('notification SSE keepalive', () => {
  test('stays connected beyond the nginx idle window', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'One real idle-window check is sufficient.');
    test.setTimeout(idleWindowMs + 30_000);

    await page.goto('/overview');

    const token = await page.evaluate(() => {
      const stored = window.localStorage.getItem('auth-storage-v1');
      if (!stored) return null;
      const parsed = JSON.parse(stored) as { state?: { token?: string } };
      return parsed.state?.token ?? null;
    });
    expect(token, 'authenticated storage must contain an access token').toBeTruthy();

    await page.evaluate((accessToken) => {
      const state = { errors: 0, opens: 0, source: null as EventSource | null };
      const params = new URLSearchParams({ token: accessToken! });
      const source = new EventSource(`/api/notifications/stream/?${params.toString()}`);
      state.source = source;
      source.onopen = () => { state.opens += 1; };
      source.onerror = () => { state.errors += 1; };
      (window as typeof window & { __notificationSSEProbe?: typeof state })
        .__notificationSSEProbe = state;
    }, token);

    await expect.poll(
      () => page.evaluate(() => (
        window as typeof window & { __notificationSSEProbe?: { opens: number } }
      ).__notificationSSEProbe?.opens ?? 0),
      { timeout: 10_000 },
    ).toBe(1);

    await page.waitForTimeout(idleWindowMs);

    const result = await page.evaluate(() => {
      const probe = (
        window as typeof window & {
          __notificationSSEProbe?: {
            errors: number;
            opens: number;
            source: EventSource | null;
          };
        }
      ).__notificationSSEProbe;
      const result = {
        errors: probe?.errors ?? -1,
        opens: probe?.opens ?? -1,
        readyState: probe?.source?.readyState ?? EventSource.CLOSED,
      };
      probe?.source?.close();
      return result;
    });

    expect(result.errors).toBe(0);
    expect(result.opens).toBe(1);
    expect(result.readyState).toBe(1); // EventSource.OPEN
  });
});
