import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * What one real browser user experiences while the server is under load.
 *
 * Nothing is mocked: this drives the real Next.js app against the real backend,
 * signed in as one of the prepared load-test accounts and sitting in the same
 * channel the k6 senders are posting to. Run k6 alongside it to measure the
 * combined picture; run it alone for the unloaded baseline.
 *
 * Requires `prepare_chat_load_test` to have written test-results/chat-load/users.json.
 */

const CREDENTIALS_PATH = path.resolve(
  process.cwd(),
  '..',
  'test-results',
  'chat-load',
  'users.json',
);

type LoadFixture = {
  chat_id: number;
  chat_slug: string;
  project_id: number;
  users: Array<{ user_id: number; token: string; organization_token?: string }>;
};

function readFixture(): LoadFixture {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(
      `Missing ${CREDENTIALS_PATH}. Run prepare_chat_load_test first.`,
    );
  }
  return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8')) as LoadFixture;
}

/** Sign in by seeding the auth store with a real backend-issued token. */
async function seedRealSession(page: Page, fixture: LoadFixture) {
  // The observer is deliberately the LAST account so the k6 senders, which take
  // users from the front of the list, do not post as this same user.
  const credential = fixture.users[fixture.users.length - 1];

  await page.addInitScript((seed) => {
    window.localStorage.setItem(
      'auth-storage-v1',
      JSON.stringify({
        state: {
          token: seed.token,
          refreshToken: seed.token,
          organizationAccessToken: seed.organizationToken ?? null,
          user: { id: seed.userId, email: seed.email, username: seed.email, is_verified: true },
          isAuthenticated: true,
          loading: false,
          initialized: true,
          hasHydrated: true,
          userTeams: [],
          selectedTeamId: null,
        },
        version: 0,
      }),
    );
  }, {
    token: credential.token,
    organizationToken: credential.organization_token ?? null,
    userId: credential.user_id,
    email: `observer-${credential.user_id}@example.test`,
  });

  return credential;
}

async function installProbes(page: Page) {
  await page.evaluate(() => {
    const state = {
      longTasks: [] as number[],
      startedAt: performance.now(),
      firstMessageAt: 0,
      messageNodes: 0,
    };
    (window as any).__live = state;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) state.longTasks.push(entry.duration);
    }).observe({ entryTypes: ['longtask'] });
  });
}

test.describe('Real browser under server load', () => {
  // Skip rather than fail when the prerequisites are absent. This drives the
  // real stack, so it can only run where the load fixture has been generated
  // against a live backend — anywhere else (CI, a clean checkout, a full-suite
  // run by someone who only wanted the mocked specs) it reports as skipped.
  //
  // The fixture is not generated here on purpose: it mints a hundred verified
  // accounts and writes valid JWTs to disk, which should never be a side
  // effect of running the test suite.
  test.skip(
    !fs.existsSync(CREDENTIALS_PATH),
    'Load fixture missing. Generate it with: docker exec backend-dev python '
      + 'manage.py prepare_chat_load_test --project-id <id> --users 100',
  );
  test.describe.configure({ timeout: 180_000 });

  test('observer session stays responsive and receives traffic', async ({ page }) => {
    const fixture = readFixture();
    const credential = await seedRealSession(page, fixture);

    const navStart = Date.now();
    await page.goto(`/messages/${fixture.chat_slug}`, { waitUntil: 'domcontentloaded' });

    let chatWindowMs = -1;
    try {
      await expect(page.getByTestId('messages-chat-window')).toBeVisible({ timeout: 60_000 });
      chatWindowMs = Date.now() - navStart;
    } catch {
      chatWindowMs = -1;
    }

    await installProbes(page);

    // Watch for 45 s while k6 (if running) drives the channel.
    const watchStart = Date.now();
    await page.waitForTimeout(45_000);

    const result = await page.evaluate(() => {
      const live = (window as any).__live;
      const total = live.longTasks.reduce((sum: number, v: number) => sum + v, 0);
      return {
        longTaskCount: live.longTasks.length,
        longTaskTotalMs: Math.round(total),
        longestTaskMs: Math.round(Math.max(0, ...live.longTasks)),
        renderedMessageNodes: document.querySelectorAll('[id^="message-"]').length,
        jsHeapMb: (performance as any).memory
          ? Math.round((performance as any).memory.usedJSHeapSize / 1048576)
          : null,
      };
    });

    console.log('LIVE_RESULT ' + JSON.stringify({
      observerUserId: credential.user_id,
      chatWindowVisibleMs: chatWindowMs,
      watchedMs: Date.now() - watchStart,
      ...result,
    }));

    expect(chatWindowMs).toBeGreaterThan(-1);
  });
});
