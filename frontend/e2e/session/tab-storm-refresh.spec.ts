import { test, expect } from '@playwright/test';
import { waitForLayoutMain } from '../navigation/navigation-helpers';

/**
 * MED-255 — tab-storm scenario.
 *
 * AuthProvider (src/components/providers/AuthProvider.tsx) calls
 * initializeAuth() on every mount, unconditionally refreshing whenever a
 * refreshToken is present — regardless of whether the current access token
 * is still valid. Opening several tabs on the same session and navigating
 * them concurrently therefore reproduces concurrent initializeAuth() calls
 * with no need to fake a 401 or mock the network.
 *
 * ROTATE_REFRESH_TOKENS is False on this backend (backend/backend/settings.py),
 * so multiple tabs independently refreshing the same refresh token cannot
 * invalidate each other — there is no cross-tab call-count guarantee to
 * assert on here (that would require cross-tab coordination, out of scope).
 * What this test asserts is the actual acceptance criterion: no tab gets
 * spuriously logged out.
 */
test.describe('Tab-storm token refresh (MED-255)', () => {
  test.describe.configure({ mode: 'serial' });

  test('opening several tabs at once does not spuriously log any of them out', async ({
    context,
  }) => {
    // Informational only — not asserted on, see comment above.
    let refreshCallCount = 0;
    await context.route('**/auth/token/refresh/**', async (route) => {
      refreshCallCount++;
      await route.continue();
    });

    const TAB_COUNT = 3;
    const pages = await Promise.all(
      Array.from({ length: TAB_COUNT }, () => context.newPage()),
    );

    // Navigate concurrently — this is the "storm": each tab's AuthProvider
    // mounts and calls initializeAuth() independently, at (effectively) the
    // same time, all reading the same refreshToken from localStorage.
    // waitUntil: 'domcontentloaded' (not the default 'load') — three tabs
    // hitting a dev server at once can be slow to finish every last
    // resource; waitForLayoutMain below does the real readiness check.
    await Promise.all(
      pages.map((page) => page.goto('/tasks', { waitUntil: 'domcontentloaded' })),
    );

    for (const page of pages) {
      // waitForLayoutMain throws a descriptive error if redirected to
      // /login or /unauthorized — this is the "no spurious logout" check.
      await waitForLayoutMain(page);
      // "Switch project" only renders once the authenticated app shell has
      // mounted — a lightweight second signal alongside the URL check above.
      await expect(
        page.getByRole('button', { name: 'Switch project' }),
      ).toBeVisible({ timeout: 20_000 });
    }

    console.log(
      `/auth/token/refresh/ called ${refreshCallCount} times across ${TAB_COUNT} tabs`,
    );

    await Promise.all(pages.map((p) => p.close()));
  });
});
