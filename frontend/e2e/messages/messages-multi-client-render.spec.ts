import { chromium, expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Many real browser clients rendering the same channel at once.
 *
 * Nothing is mocked: each client is a real Chromium context signed in as one
 * of the prepared load-test accounts, sitting in the same channel while
 * messages are posted over the real API. Measures whether the frontend render
 * path (long tasks, rendered message nodes, heap) degrades when many real
 * sessions receive the same traffic simultaneously.
 *
 * Contexts are spread across several browser processes (GROUP_SIZE per
 * launch) so one browser-level crash cannot take down the whole run, and
 * progress is appended to test-results/multi-client-progress.log because the
 * line reporter only prints at the end of the test.
 *
 * Requires `prepare_chat_load_test` to have written test-results/chat-load/users.json.
 * MULTI_CLIENTS (default 100), MULTI_MESSAGES (default 30).
 */

const CREDENTIALS_PATH = path.resolve(
  process.cwd(),
  '..',
  'test-results',
  'chat-load',
  'users.json',
);
const PROGRESS_LOG = path.resolve(
  process.cwd(),
  'test-results',
  'multi-client-progress.log',
);

const CLIENT_COUNT = Number(process.env.MULTI_CLIENTS || 100);
const MESSAGE_COUNT = Number(process.env.MULTI_MESSAGES || 30);
const GROUP_SIZE = 10;
const RAMP_GAP_MS = Number(process.env.MULTI_RAMP_GAP_MS || 10_000);
const OBSERVE_MS = 45_000;

type LoadFixture = {
  chat_id: number;
  chat_slug: string;
  project_id: number;
  users: Array<{ user_id: number; token: string; organization_token?: string }>;
};

type ClientHandle = {
  userId: number;
  browser: Browser;
  context: BrowserContext;
  page: Page;
  navStart: number;
  visibleMs: number;
};

function readFixture(): LoadFixture {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(
      `Missing ${CREDENTIALS_PATH}. Run prepare_chat_load_test first.`,
    );
  }
  return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8')) as LoadFixture;
}

function logProgress(message: string) {
  const line = `${new Date().toISOString()} ${message}\n`;
  fs.mkdirSync(path.dirname(PROGRESS_LOG), { recursive: true });
  fs.appendFileSync(PROGRESS_LOG, line);
}

function median(values: number[]): number {
  if (values.length === 0) return -1;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

test.describe('Many real clients rendering one channel', () => {
  // Skip rather than fail when the prerequisites are absent. This launches up
  // to a hundred real browser contexts against a live backend, so it can only
  // run where the load fixture has been generated — anywhere else (CI, a clean
  // checkout, a full-suite run) it reports as skipped instead of hanging until
  // the timeout.
  //
  // The fixture is not generated here on purpose: it mints a hundred verified
  // accounts and writes valid JWTs to disk, which should never be a side
  // effect of running the test suite.
  test.skip(
    !fs.existsSync(CREDENTIALS_PATH),
    'Load fixture missing. Generate it with: docker exec backend-dev python '
      + 'manage.py prepare_chat_load_test --project-id <id> --users 100',
  );
  test.describe.configure({ timeout: 900_000 });

  test('clients stay responsive while messages arrive', async ({ baseURL }) => {
    const fixture = readFixture();
    const origin = (baseURL || 'http://localhost').replace(/\/$/, '');
    const credentials = fixture.users.slice(
      0,
      Math.min(CLIENT_COUNT, fixture.users.length),
    );
    const runPrefix = `multi-render-${Date.now()}|`;
    const clients: ClientHandle[] = [];
    const browsers: Browser[] = [];

    fs.mkdirSync(path.dirname(PROGRESS_LOG), { recursive: true });
    fs.writeFileSync(PROGRESS_LOG, '');
    logProgress(`start clients=${credentials.length} messages=${MESSAGE_COUNT}`);

    try {
      // Launch clients in groups, one browser process per group, so a
      // browser-level crash only takes out its own group.
      for (let g = 0; g < credentials.length; g += GROUP_SIZE) {
        const group = credentials.slice(g, g + GROUP_SIZE);
        const groupIndex = g / GROUP_SIZE;
        try {
          const browser = await chromium.launch();
          browsers.push(browser);
          await Promise.all(
            group.map(async (credential) => {
              const context = await browser.newContext({
                baseURL: origin,
                viewport: { width: 1280, height: 720 },
              });
              await context.addInitScript((seed) => {
                window.localStorage.setItem(
                  'auth-storage-v1',
                  JSON.stringify({
                    state: {
                      token: seed.token,
                      refreshToken: seed.token,
                      organizationAccessToken: seed.organizationToken,
                      user: {
                        id: seed.userId,
                        email: `load-${seed.userId}@example.test`,
                        username: `load-${seed.userId}@example.test`,
                        is_verified: true,
                      },
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
                const probe = { longTasks: [] as number[] };
                (window as unknown as { __probe: typeof probe }).__probe = probe;
                new PerformanceObserver((list) => {
                  for (const entry of list.getEntries()) {
                    probe.longTasks.push(entry.duration);
                  }
                }).observe({ entryTypes: ['longtask'] });
              }, {
                token: credential.token,
                organizationToken: credential.organization_token ?? null,
                userId: credential.user_id,
              });
              const page = await context.newPage();
              const client: ClientHandle = {
                userId: credential.user_id,
                browser,
                context,
                page,
                navStart: Date.now(),
                visibleMs: -1,
              };
              clients.push(client);
              try {
                await page.goto(`/messages/${fixture.chat_slug}`, {
                  waitUntil: 'domcontentloaded',
                  timeout: 60_000,
                });
              } catch {
                client.visibleMs = -1;
              }
            }),
          );
          logProgress(`group ${groupIndex}: ${group.length} clients navigated (total ${clients.length})`);
        } catch (error) {
          logProgress(`group ${groupIndex} FAILED: ${String(error)}`);
        }
        // Ramp: give the single ASGI process breathing room between groups,
        // like real users arriving over time rather than all at once.
        if (g + GROUP_SIZE < credentials.length) {
          await new Promise((resolve) => setTimeout(resolve, RAMP_GAP_MS));
        }
      }

      // Wait for each client's chat window, all in parallel with one deadline.
      const visibleResults = await Promise.allSettled(
        clients.map((client) =>
          client.page
            .getByTestId('messages-chat-window')
            .waitFor({ timeout: 120_000 })
            .then(() => {
              client.visibleMs = Date.now() - client.navStart;
            }),
        ),
      );
      const visibleCount = visibleResults.filter(
        (result) => result.status === 'fulfilled',
      ).length;
      logProgress(`chat window visible: ${visibleCount}/${clients.length}`);

      // Reset probes so long-task counts cover only the message phase,
      // not the initial app load.
      for (let i = 0; i < clients.length; i += 20) {
        await Promise.all(
          clients.slice(i, i + 20).map((client) =>
            client.page
              .evaluate(() => {
                const probe = (
                  window as unknown as { __probe?: { longTasks: number[] } }
                ).__probe;
                if (probe) probe.longTasks.length = 0;
              })
              .catch(() => undefined),
          ),
        );
      }
      logProgress('probes reset; starting sends');

      // Post real messages over the API as the first account.
      const sender = credentials[0];
      const headers: Record<string, string> = {
        Authorization: `Bearer ${sender.token}`,
        'Content-Type': 'application/json',
      };
      if (sender.organization_token) {
        headers['X-Organization-Token'] = sender.organization_token;
      }
      let sendOk = 0;
      let sendFail = 0;
      const sendStart = Date.now();
      for (let i = 0; i < MESSAGE_COUNT; i += 1) {
        try {
          const response = await fetch(`${origin}/api/chat/messages/`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              chat: fixture.chat_id,
              content: `${runPrefix}${i}`,
              client_message_id: `${runPrefix}${i}`,
            }),
            signal: AbortSignal.timeout(15_000),
          });
          if (response.ok) {
            sendOk += 1;
          } else {
            sendFail += 1;
          }
        } catch {
          sendFail += 1;
        }
        if ((i + 1) % 10 === 0) {
          logProgress(`sent ${i + 1}/${MESSAGE_COUNT} (ok=${sendOk} fail=${sendFail})`);
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      const sendWindowMs = Date.now() - sendStart;

      // Let deliveries settle, then collect per-client probes.
      await new Promise((resolve) => setTimeout(resolve, OBSERVE_MS));
      logProgress('observe window done, collecting probes');

      const collected: Array<{
        longTaskCount: number;
        longTaskTotalMs: number;
        longestTaskMs: number;
        renderedMine: number;
        renderedTotal: number;
        heapMb: number | null;
      } | null> = [];
      for (let i = 0; i < clients.length; i += 20) {
        const chunk = clients.slice(i, i + 20);
        const results = await Promise.all(
          chunk.map(async (client) => {
            try {
              return await client.page.evaluate((prefix) => {
                const probe = (
                  window as unknown as { __probe?: { longTasks: number[] } }
                ).__probe ?? { longTasks: [] };
                const nodes = Array.from(
                  document.querySelectorAll('[id^="message-"]'),
                );
                const mine = nodes.filter((node) =>
                  (node.textContent || '').includes(prefix),
                ).length;
                const total = probe.longTasks.reduce((sum, v) => sum + v, 0);
                return {
                  longTaskCount: probe.longTasks.length,
                  longTaskTotalMs: Math.round(total),
                  longestTaskMs: Math.round(Math.max(0, ...probe.longTasks)),
                  renderedMine: mine,
                  renderedTotal: nodes.length,
                  heapMb: (performance as unknown as { memory?: { usedJSHeapSize: number } })
                    .memory
                    ? Math.round(
                        (performance as unknown as { memory: { usedJSHeapSize: number } })
                          .memory.usedJSHeapSize / 1048576,
                      )
                    : null,
                };
              }, runPrefix);
            } catch {
              return null;
            }
          }),
        );
        collected.push(...results);
      }
      logProgress(`probes collected: ${collected.filter(Boolean).length}/${clients.length}`);

      const ok = collected.filter(
        (result): result is NonNullable<typeof result> => result !== null,
      );
      const visibleTimes = clients
        .map((client) => client.visibleMs)
        .filter((ms) => ms >= 0);

      const summary = {
        clientsLaunched: clients.length,
        chatWindowVisible: visibleCount,
        visibleMsMedian: median(visibleTimes),
        visibleMsMax: visibleTimes.length ? Math.max(...visibleTimes) : -1,
        messagesSentOk: sendOk,
        messagesSentFailed: sendFail,
        sendWindowMs,
        probesCollected: ok.length,
        totalLongTasks: ok.reduce((sum, r) => sum + r.longTaskCount, 0),
        clientsWithLongTasks: ok.filter((r) => r.longTaskCount > 0).length,
        longestTaskMs: ok.reduce((max, r) => Math.max(max, r.longestTaskMs), 0),
        renderedMineMedian: median(ok.map((r) => r.renderedMine)),
        renderedMineMax: ok.reduce((max, r) => Math.max(max, r.renderedMine), 0),
        heapMbMedian: median(
          ok.map((r) => r.heapMb).filter((v): v is number => v !== null),
        ),
      };
      console.log('MULTI_RESULT ' + JSON.stringify(summary));
      logProgress('MULTI_RESULT ' + JSON.stringify(summary));

      expect(visibleCount).toBeGreaterThan(0);
    } finally {
      await Promise.allSettled(browsers.map((browser) => browser.close()));
    }
  });
});
