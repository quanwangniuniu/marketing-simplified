import { test, expect, type Page } from '@playwright/test';
import {
  seedAuthenticatedUser,
  mockAuthenticatedUserApis,
  mockProjectShellApis,
  seedActiveProject,
  waitForLayoutMain,
} from './messages-helpers';

const PROJECT = {
  id: 701,
  name: 'Membership Project',
  member_count: 2,
};

const REMOVED_USER = {
  id: 101,
  email: 'removed@example.com',
  username: 'removed-user',
  is_verified: true,
  is_staff: false,
  roles: ['Media Buyer'],
};

const REMAINING_USER = {
  id: 102,
  email: 'remaining@example.com',
  username: 'remaining-user',
  is_verified: true,
  is_staff: false,
  roles: ['Media Buyer'],
};

const CHAT = {
    id: 9001,
    slug: 'team-channel',
    type: 'group',
    name: 'Team Channel',
    project_id: PROJECT.id,
    project: PROJECT.id,
    unread_count: 0,
    mention_unread_count: 0,
    created_at: '2026-07-14T00:00:00Z',
    updated_at: '2026-07-14T00:00:00Z',
    created_by_id: REMAINING_USER.id,
    participants: [
      {
        id: 5001,
        chat_id: 9001,
        joined_at: '2026-07-14T00:00:00Z',
        user: {
          id: REMOVED_USER.id,
          username: REMOVED_USER.username,
          email: REMOVED_USER.email,
        },
        is_active: true,
        is_manager: false,
      },
      {
        id: 5002,
        chat_id: 9001,
        joined_at: '2026-07-14T00:00:00Z',
        user: {
          id: REMAINING_USER.id,
          username: REMAINING_USER.username,
          email: REMAINING_USER.email,
        },
        is_active: true,
        is_manager: true,
      },
    ],
    last_message: null,
};

async function installFakeWebSocket(page: Page) {
    await page.addInitScript(({ closeCode }) => {
      const NativeWebSocket = window.WebSocket;
  
      class FakeChatWebSocket {
        static CONNECTING = 0;
        static OPEN = 1;
        static CLOSING = 2;
        static CLOSED = 3;
  
        url: string;
        readyState = FakeChatWebSocket.CONNECTING;
        onopen: ((event: Event) => void) | null = null;
        onmessage: ((event: MessageEvent) => void) | null = null;
        onclose: ((event: CloseEvent) => void) | null = null;
        onerror: ((event: Event) => void) | null = null;
  
        private listeners: Record<string, Array<(event: any) => void>> = {
          open: [],
          message: [],
          close: [],
          error: [],
        };
  
        constructor(url: string) {
          this.url = url;
          (window as any).__latestChatSocket = this;
  
          setTimeout(() => {
            this.readyState = FakeChatWebSocket.OPEN;
            const event = new Event('open');
            this.onopen?.(event);
            this.emit('open', event);
          }, 0);
        }
  
        addEventListener(type: string, listener: (event: any) => void) {
          if (!this.listeners[type]) {
            this.listeners[type] = [];
          }
          this.listeners[type].push(listener);
        }
  
        removeEventListener(type: string, listener: (event: any) => void) {
          const list = this.listeners[type];
          if (!list) return;
          this.listeners[type] = list.filter((item) => item !== listener);
        }
  
        private emit(type: string, event: any) {
          for (const listener of this.listeners[type] ?? []) {
            listener.call(this, event);
          }
        }
  
        send(_data: string) {}
  
        close(code = 1000, reason = '') {
          this.readyState = FakeChatWebSocket.CLOSED;
          const event = {
            code,
            reason,
            wasClean: true,
            type: 'close',
          } as CloseEvent;
  
          this.onclose?.(event);
          this.emit('close', event);
        }
  
        emitMembershipRevoked(chatId: number) {
          const messageEvent = new MessageEvent('message', {
            data: JSON.stringify({
              type: 'chat_membership_revoked',
              chat_id: chatId,
              reason: 'removed_from_chat',
            }),
          });
  
          this.onmessage?.(messageEvent);
          this.emit('message', messageEvent);
  
          this.readyState = FakeChatWebSocket.CLOSED;
  
          const closeEvent = {
            code: closeCode,
            reason: 'removed_from_chat',
            wasClean: true,
            type: 'close',
          } as CloseEvent;
  
          this.onclose?.(closeEvent);
          this.emit('close', closeEvent);
        }
      }
  
      function PatchedWebSocket(url: string | URL, protocols?: string | string[]) {
        const urlString = String(url);
  
        // 只 fake 聊天 websocket
        if (urlString.includes('/ws/chat/')) {
          return new FakeChatWebSocket(urlString) as any;
        }
  
        // 其他 websocket（比如 Next dev HMR）继续走原生实现
        if (protocols === undefined) {
          return new NativeWebSocket(url);
        }
  
        return new NativeWebSocket(url, protocols);
      }
  
      (PatchedWebSocket as any).CONNECTING = NativeWebSocket.CONNECTING;
      (PatchedWebSocket as any).OPEN = NativeWebSocket.OPEN;
      (PatchedWebSocket as any).CLOSING = NativeWebSocket.CLOSING;
      (PatchedWebSocket as any).CLOSED = NativeWebSocket.CLOSED;
  
      Object.defineProperty(window, 'WebSocket', {
        configurable: true,
        writable: true,
        value: PatchedWebSocket,
      });
  
      (window as any).__emitMembershipRevoked = (chatId: number) => {
        const socket = (window as any).__latestChatSocket;
        if (!socket) {
          throw new Error('No chat websocket instance found');
        }
        socket.emitMembershipRevoked(chatId);
      };
    }, { closeCode: 4404 });
  }
  
async function mockMessagesShell(page: Page, currentUser: typeof REMOVED_USER) {
    await seedAuthenticatedUser(page, currentUser);
    await installFakeWebSocket(page);
    await mockAuthenticatedUserApis(page, currentUser);
    await mockProjectShellApis(page);
    await seedActiveProject(page, PROJECT);
  
    // Remove the generic helper mocks for projects/chats so this spec can provide
    // its own non-empty data.
    await page.unroute('**/api/chat/chats/**');
    await page.unroute('**/api/core/projects**');
  
    await page.route('**/api/core/projects**', async (route) => {
        const pathname = new URL(route.request().url()).pathname.replace(/\/+$/, '');
      
        // Only mock the actual projects list endpoint here.
        // Let /api/core/projects/<id>/members/** fall through to the helper mock.
        if (pathname !== '/api/core/projects') {
          await route.fallback();
          return;
        }
      
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([PROJECT]),
        });
    });
  
    await page.route('**/api/chat/chats/**', async (route) => {
      const url = new URL(route.request().url());
      const pathname = url.pathname;
      const method = route.request().method();
  
      if (/\/api\/chat\/chats\/\d+\/pins\/?$/.test(pathname)) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
        return;
      }
  
      if (method === 'GET' && pathname.replace(/\/+$/, '') === '/api/chat/chats') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            count: 1,
            next: null,
            previous: null,
            results: [CHAT],
          }),
        });
        return;
      }
  
      if (method === 'GET' && pathname === `/api/chat/chats/${CHAT.id}/`) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(CHAT),
        });
        return;
      }
  
      if (method === 'POST' && pathname === `/api/chat/chats/${CHAT.id}/mark_as_read/`) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({}),
        });
        return;
      }
  
      await route.fallback();
    });
  
    await page.route('**/api/chat/messages/**', async (route) => {
      const pathname = new URL(route.request().url()).pathname;
  
      if (pathname.includes('/unread_count/')) {
        await route.fallback();
        return;
      }
  
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }
  
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [],
          next_cursor: null,
          prev_cursor: null,
          page_size: 50,
        }),
      });
    });
  }

const APP_URL = process.env.BASE_URL ?? 'http://localhost:3001';

async function dumpPageState(page: Page, label: string) {
    console.log(`[${label}] url:`, page.url());
    console.log(`[${label}] title:`, await page.title());
    console.log(
      `[${label}] body:`,
      (await page.locator('body').innerText().catch(() => '<<no body>>')).slice(0, 2000)
    );
}

test('removed user is forced out of the chat while remaining user stays connected', async ({ page, browser }) => {
    const removedPage = page;
    const remainingContext = await browser.newContext({ baseURL: APP_URL });
    const remainingPage = await remainingContext.newPage();

  try {
    removedPage.on('pageerror', (error) => {
        console.log('[removedPage pageerror]', error.message);
      });
      
      remainingPage.on('pageerror', (error) => {
        console.log('[remainingPage pageerror]', error.message);
      });
      
      removedPage.on('console', (msg) => {
        if (msg.type() === 'error') {
          console.log('[removedPage console error]', msg.text());
        }
      });
      
      remainingPage.on('console', (msg) => {
        if (msg.type() === 'error') {
          console.log('[remainingPage console error]', msg.text());
        }
      });
    
    await mockMessagesShell(removedPage, REMOVED_USER);
    await mockMessagesShell(remainingPage, REMAINING_USER);

    await removedPage.goto(`${APP_URL}/messages?projectId=${PROJECT.id}`);
    await remainingPage.goto(`${APP_URL}/messages?projectId=${PROJECT.id}`);

    await waitForLayoutMain(removedPage);
    await waitForLayoutMain(remainingPage);

    await dumpPageState(removedPage, 'removed');
    await dumpPageState(remainingPage, 'remaining');

    await removedPage.screenshot({ path: '/tmp/removed-page-debug.png', fullPage: true });
    await remainingPage.screenshot({ path: '/tmp/remaining-page-debug.png', fullPage: true });

    await expect(removedPage.getByTestId('messages-layout')).toBeVisible();
    await expect(remainingPage.getByTestId('messages-layout')).toBeVisible();

    const removedChatRow = removedPage.getByTestId('messages-chat-row').filter({ hasText: CHAT.name });
    const remainingChatRow = remainingPage.getByTestId('messages-chat-row').filter({ hasText: CHAT.name });

    await expect
        .poll(async () => await removedPage.getByTestId('messages-chat-row').count(), {
          timeout: 15000,
        })
        .toBeGreaterThan(0);

    await expect
        .poll(async () => await remainingPage.getByTestId('messages-chat-row').count(), {
            timeout: 15000,
        })
        .toBeGreaterThan(0);

    await expect(removedChatRow).toBeVisible();
    await expect(remainingChatRow).toBeVisible();

    await removedChatRow.click();
    await remainingChatRow.click();

    await expect(removedPage.getByTestId('messages-chat-window')).toBeVisible();
    await expect(remainingPage.getByTestId('messages-chat-window')).toBeVisible();

    await expect(removedPage.getByTestId('chat-composer-input')).toBeVisible();
    await expect(remainingPage.getByTestId('chat-composer-input')).toBeVisible();

    await removedPage.waitForFunction(() => Boolean((window as any).__latestChatSocket));

    await removedPage.evaluate((chatId) => {
      (window as any).__emitMembershipRevoked(chatId);
    }, CHAT.id);

    await expect(
      removedPage.getByText(`You were removed from #${CHAT.name}`)
    ).toBeVisible();

    await expect(
      removedPage.getByRole('heading', { name: 'Select a conversation' })
    ).toBeVisible();
    
    await expect(removedPage.getByTestId('chat-composer-input')).toHaveCount(0);
    
    await expect(
      removedPage.getByTestId('messages-chat-row').filter({ hasText: CHAT.name })
    ).toHaveCount(0);

    await expect(remainingPage.getByTestId('chat-composer-input')).toBeVisible();
    await expect(
      remainingPage.getByTestId('messages-chat-row').filter({ hasText: CHAT.name })
    ).toHaveCount(1);
  } finally {
    await remainingContext.close();
  }
});