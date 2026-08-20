import { test, expect } from '@playwright/test';
import {
  seedAuthenticatedUser,
  mockAuthenticatedUserApis,
  mockProjectShellApis,
  seedActiveProject,
  waitForLayoutMain,
  isChatListEndpoint,
} from './messages-helpers';

const PROJECT = { id: 901, name: 'Reconnect Attachments Project', member_count: 1 };
const CHAT_ID = 501;
const CLIENT_MESSAGE_ID = 'e2e-outbox-client-001';

test.beforeEach(async ({ page }) => {
  await seedAuthenticatedUser(page);
  await mockAuthenticatedUserApis(page);
  await mockProjectShellApis(page);
  await seedActiveProject(page, PROJECT);

  await page.addInitScript(() => {
    class MockWebSocket {
      static OPEN = 1;
      readyState = MockWebSocket.OPEN;
      onopen: (() => void) | null = null;
      onclose: (() => void) | null = null;
      onmessage: ((event: { data: string }) => void) | null = null;
      onerror: (() => void) | null = null;

      constructor(_url: string) {
        queueMicrotask(() => {
          this.onopen?.();
        });
      }

      send() {}

      close() {
        this.onclose?.();
      }
    }

    // @ts-expect-error test shim
    window.WebSocket = MockWebSocket;
  });

  await page.route('**/api/core/projects**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([PROJECT]),
    });
  });

  await page.route(`**/api/core/projects/${PROJECT.id}/members/**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results: [], next: null }),
    });
  });

  await page.route('**/api/chat/starred/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route('**/api/chat/chats/**', async (route) => {
    if (!isChatListEndpoint(route.request().url()) || route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        count: 1,
        next: null,
        previous: null,
        results: [
          {
            id: CHAT_ID,
            slug: 'reconnect-chat',
            project_id: PROJECT.id,
            type: 'private',
            name: 'Reconnect Chat',
            participants: [
              { id: 1, user: { id: 1, username: 'e2e-user', email: 'e2e@example.com' } },
            ],
            last_message: null,
            unread_count: 0,
          },
        ],
      }),
    });
  });

  await page.route(`**/api/chat/chats/${CHAT_ID}/mark_as_read/**`, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
  });

  await page.route('**/api/chat/messages/**', async (route) => {
    const method = route.request().method();
    const url = route.request().url();

    if (method === 'GET' && url.includes('chat_id=')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: [], next_cursor: null, prev_cursor: null, page_size: 50 }),
      });
      return;
    }

    if (method === 'POST' && url.endsWith('/api/chat/messages/')) {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      expect(body.client_message_id).toBe(CLIENT_MESSAGE_ID);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 9001,
          chat: CHAT_ID,
          chat_id: CHAT_ID,
          sender: {
            id: 1,
            email: 'e2e@example.com',
            username: 'e2e-user',
          },
          content: 'Photo attached',
          created_at: '2026-05-27T00:00:00.000Z',
          updated_at: '2026-05-27T00:00:00.000Z',
          attachments: [
            {
              id: 8801,
              message: 9001,
              file_type: 'image',
              file_url: 'https://example.com/photo.png',
              thumbnail_url: null,
              file_size: 1024,
              file_size_display: '1 KB',
              original_filename: 'photo.png',
              mime_type: 'image/png',
              created_at: '2026-05-27T00:00:00.000Z',
            },
          ],
        }),
      });
      return;
    }

    await route.fallback();
  });

  await page.addInitScript(
    ({ chatId, clientMessageId }) => {
      window.localStorage.setItem(
        'chat-storage',
        JSON.stringify({
          state: {
            isWidgetOpen: false,
            outbox: [
              {
                clientMessageId,
                chatId,
                content: 'Photo attached',
                attachmentIds: [8801],
                status: 'pending',
                enqueuedAt: '2026-05-27T00:00:00.000Z',
              },
            ],
          },
          version: 0,
        }),
      );
    },
    { chatId: CHAT_ID, clientMessageId: CLIENT_MESSAGE_ID },
  );
});

test('reconnect flushes outbox and renders attachment after retry', async ({ page }) => {
  await page.goto(`/messages?projectId=${PROJECT.id}`);
  await waitForLayoutMain(page);

  await page.getByTestId('messages-layout').waitFor({ state: 'visible', timeout: 15_000 });
  await page.getByText('Reconnect Chat').click();

  await expect(page.getByText('Photo attached')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('photo.png')).toBeVisible({ timeout: 15_000 });
});
