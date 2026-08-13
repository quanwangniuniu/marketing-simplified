import { expect, test, type Page } from '@playwright/test';

import {
  mockAuthenticatedUserApis,
  mockProjectShellApis,
  seedActiveProject,
  seedAuthenticatedUser,
  waitForLayoutMain,
} from './messages-helpers';

/**
 * Measures what a burst of inbound chat messages costs the browser main thread.
 *
 * Every participant of a channel receives every message, so one round of "all
 * members post once" arrives at each client as a burst. This spec replaces the
 * WebSocket with a stub, pushes that burst in, and reports main-thread blocking
 * time plus DOM mutations so the client cost can be compared across changes.
 */

const PROJECT = {
  id: 279,
  slug: 'burst-perf-project',
  name: 'Burst Perf Project',
  is_active: true,
  organization: { id: 279, name: 'Burst Perf Organization' },
};
const CURRENT_USER = {
  id: 1,
  email: 'burst-owner@example.com',
  username: 'burst-owner',
  is_verified: true,
  is_staff: false,
  roles: [],
};
const CHAT_ID = 2790;
const CHAT_SLUG = 'burst-perf-channel';
const CREATED_AT = '2026-08-04T08:00:00.000Z';
const MEMBER_COUNT = 100;
const BURST_SIZE = 99;
// Scale knobs: the cost of one inbound message depends on how much state the
// store already holds, not just on the burst size.
const CHAT_COUNT = Number(process.env.BURST_CHATS || 1);
const SEED_MESSAGE_COUNT = Number(process.env.BURST_SEED_MESSAGES || 1);

function member(index: number) {
  return {
    id: 100 + index,
    email: `burst-member-${index}@example.com`,
    username: `burst-member-${index}`,
  };
}

function buildMessage(id: number, senderIndex: number, content: string) {
  return {
    id,
    chat: CHAT_ID,
    chat_id: CHAT_ID,
    content,
    created_at: new Date(Date.parse(CREATED_AT) + id * 1000).toISOString(),
    updated_at: CREATED_AT,
    sender: senderIndex === 0 ? CURRENT_USER : member(senderIndex),
    statuses: [],
    attachments: [],
    reactions: [],
    is_edited: false,
    is_deleted: false,
    is_revoked: false,
    parent_message_id: null,
    thread_reply_count: 0,
    thread_last_reply_at: null,
    thread_participants: [],
    has_unread_thread_replies: false,
  };
}

const SEED_MESSAGES = Array.from({ length: SEED_MESSAGE_COUNT }, (_, index) =>
  buildMessage(279000 + index, (index % (MEMBER_COUNT - 1)) + 1, `history ${index}`));
const SEED_MESSAGE = SEED_MESSAGES[0];

/** Extra channels so the per-message chat-list rebuild has real work to do. */
function buildSiblingChats(primary: Record<string, any>) {
  return Array.from({ length: Math.max(0, CHAT_COUNT - 1) }, (_, index) => ({
    ...primary,
    id: CHAT_ID + index + 1,
    slug: `${CHAT_SLUG}-sibling-${index}`,
    name: `sibling-${index}`,
  }));
}

function buildChat() {
  return {
    id: CHAT_ID,
    slug: CHAT_SLUG,
    name: 'burst-perf',
    type: 'group',
    project_id: PROJECT.id,
    topic: 'Burst perf channel',
    description: 'Inbound burst measurement',
    visibility: 'public',
    created_by_id: CURRENT_USER.id,
    created_by: CURRENT_USER,
    created_at: CREATED_AT,
    updated_at: CREATED_AT,
    unread_count: 0,
    mention_unread_count: 0,
    participants: Array.from({ length: MEMBER_COUNT }, (_, index) => ({
      id: index + 1,
      user: index === 0 ? CURRENT_USER : member(index),
      chat_id: CHAT_ID,
      joined_at: CREATED_AT,
      is_active: true,
      is_manager: index === 0,
      is_muted: false,
      notification_level: 'all',
    })),
    last_message: SEED_MESSAGE,
  };
}

/** Replace WebSocket before app code runs and expose a push hook. */
async function stubWebSocket(page: Page) {
  await page.addInitScript(() => {
    const sockets: any[] = [];

    class StubWebSocket {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;
      readyState = 1;
      onopen: ((ev: any) => void) | null = null;
      onmessage: ((ev: any) => void) | null = null;
      onclose: ((ev: any) => void) | null = null;
      onerror: ((ev: any) => void) | null = null;

      constructor(public url: string) {
        sockets.push(this);
        setTimeout(() => this.onopen?.({}), 0);
      }

      send() {}
      close() {
        this.readyState = 3;
        this.onclose?.({ code: 1000 });
      }
      addEventListener() {}
      removeEventListener() {}
    }

    (window as any).WebSocket = StubWebSocket;
    (window as any).__chatSockets = sockets;
    (window as any).__pushChatEvents = (events: unknown[]) => {
      const socket = sockets[sockets.length - 1];
      if (!socket?.onmessage) return 0;
      for (const event of events) {
        socket.onmessage({ data: JSON.stringify(event) });
      }
      return events.length;
    };

    // Real frames arrive in separate macrotasks, so React cannot batch them.
    // Pushing synchronously would collapse the whole burst into one render and
    // measure something the network never produces.
    (window as any).__pushChatEventsSpread = (events: unknown[]) =>
      new Promise<number>((resolve) => {
        const socket = sockets[sockets.length - 1];
        if (!socket?.onmessage) return resolve(0);
        let index = 0;
        const step = () => {
          if (index >= events.length) return resolve(events.length);
          socket.onmessage({ data: JSON.stringify(events[index++]) });
          setTimeout(step, 0);
        };
        step();
      });
  });
}

/** Collect long tasks and message-container mutations from the page. */
async function installProbes(page: Page) {
  await page.evaluate(() => {
    const state = {
      longTasks: [] as number[],
      mutations: 0,
      firstPushAt: 0,
      lastMutationAt: 0,
    };
    (window as any).__perf = state;

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        state.longTasks.push(entry.duration);
      }
    }).observe({ entryTypes: ['longtask'] });

    const target =
      document.querySelector('[data-testid="messages-chat-window"]') ?? document.body;
    new MutationObserver((records) => {
      state.mutations += records.length;
      state.lastMutationAt = performance.now();
    }).observe(target, { childList: true, subtree: true, characterData: true });
  });
}

async function setupBurstPage(page: Page) {
  const chat = buildChat();
  const allChats = [chat, ...buildSiblingChats(chat)];

  page.on('pageerror', (error) => console.log('PAGEERROR ' + error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') console.log('CONSOLEERR ' + message.text().slice(0, 200));
  });

  if (!process.env.BURST_NO_WS_STUB) await stubWebSocket(page);
  await seedAuthenticatedUser(page, CURRENT_USER);
  await mockAuthenticatedUserApis(page, CURRENT_USER);
  await mockProjectShellApis(page);
  await seedActiveProject(page, PROJECT);

  await page.route('**/api/chat/chats/**', async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname.replace(/\/+$/, '');

    if (pathname === '/api/chat/chats' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          count: allChats.length,
          next: null,
          previous: null,
          results: allChats,
        }),
      });
      return;
    }
    if (
      request.method() === 'GET'
      && (pathname === `/api/chat/chats/${CHAT_SLUG}` || pathname === `/api/chat/chats/${CHAT_ID}`)
    ) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(chat) });
      return;
    }
    if (/\/pins$/.test(pathname)) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      return;
    }
    if (/\/files$/.test(pathname)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: [], total: 0 }),
      });
      return;
    }
    if (/\/mark_as_read$/.test(pathname)) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      return;
    }
    await route.fallback();
  });

  await page.route('**/api/chat/messages/**', async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname.replace(/\/+$/, '');

    if (pathname === '/api/chat/messages/unread_count') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ unread_count: 0 }),
      });
      return;
    }
    if (pathname === '/api/chat/messages' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: SEED_MESSAGES,
          next_cursor: null,
          prev_cursor: null,
          page_size: 50,
        }),
      });
      return;
    }
    await route.fallback();
  });

  await page.goto(`/messages/${CHAT_SLUG}`);
  await waitForLayoutMain(page);
  await expect(page.getByTestId('messages-chat-window')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(`#message-${SEED_MESSAGE.id}`)).toBeVisible({ timeout: 15_000 });
}

test.describe('Inbound message burst cost', () => {
  test.describe.configure({ timeout: 120_000 });

  test('one message per member arrives without saturating the main thread', async ({ page }) => {
    await setupBurstPage(page);
    await installProbes(page);

    const events = Array.from({ length: BURST_SIZE }, (_, index) =>
      ({
        type: 'chat_message',
        message: buildMessage(279100 + index, (index % (MEMBER_COUNT - 1)) + 1, `burst ${index}`),
      }));

    const pushed = await page.evaluate(async (payload) => {
      const perf = (window as any).__perf;
      perf.firstPushAt = performance.now();
      return (window as any).__pushChatEventsSpread(payload);
    }, events);

    // Let React flush and the virtualiser settle. The list is virtualised, so
    // the newest row is not necessarily mounted; wait on quiescence instead.
    await page.waitForTimeout(4000);

    const result = await page.evaluate(() => {
      const perf = (window as any).__perf;
      const total = perf.longTasks.reduce((sum: number, value: number) => sum + value, 0);
      return {
        longTaskCount: perf.longTasks.length,
        longTaskTotalMs: Math.round(total),
        longestTaskMs: Math.round(Math.max(0, ...perf.longTasks)),
        mutations: perf.mutations,
        settleMs: Math.round(perf.lastMutationAt - perf.firstPushAt),
        renderedMessageNodes: document.querySelectorAll('[id^="message-"]').length,
        domNodes: document.querySelectorAll('*').length,
        jsHeapMb: (performance as any).memory
          ? Math.round((performance as any).memory.usedJSHeapSize / 1048576)
          : null,
      };
    });

    console.log('BURST_RESULT ' + JSON.stringify({
      burst: BURST_SIZE,
      chats: CHAT_COUNT,
      seedMessages: SEED_MESSAGE_COUNT,
      pushed,
      ...result,
    }));

    expect(pushed).toBe(BURST_SIZE);
    expect(result.mutations).toBeGreaterThan(0);
  });
});
