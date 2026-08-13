import { expect, test, type Page } from '@playwright/test';

import {
  mockAuthenticatedUserApis,
  mockProjectShellApis,
  seedActiveProject,
  seedAuthenticatedUser,
  waitForLayoutMain,
} from './messages-helpers';

const PROJECT = {
  id: 278,
  slug: 'pinned-messages-e2e-project',
  name: 'Pinned Messages E2E Project',
  is_active: true,
  organization: { id: 278, name: 'Pinned Messages E2E Organization' },
};
const CURRENT_USER = {
  id: 1,
  email: 'manager@example.com',
  username: 'channel-manager',
  is_verified: true,
  is_staff: false,
  roles: [],
};
const TEAMMATE = {
  id: 2,
  email: 'member@example.com',
  username: 'channel-member',
};
const CHAT_ID = 2780;
const CHAT_SLUG = 'med-278-pinned-messages';
const CREATED_AT = '2026-07-30T08:00:00.000Z';

type MockMessage = Record<string, any>;
type MockPin = {
  id: number;
  chat: number;
  pinned_by: typeof CURRENT_USER | null;
  created_at: string;
  message: MockMessage;
};

function buildMessage(id: number, content: string, createdAt = CREATED_AT): MockMessage {
  return {
    id,
    chat: CHAT_ID,
    chat_id: CHAT_ID,
    content,
    created_at: createdAt,
    updated_at: createdAt,
    sender: TEAMMATE,
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

const FIRST_MESSAGE = buildMessage(27801, 'First announcement to pin');
const SECOND_MESSAGE = buildMessage(
  27802,
  'Newest pinned announcement',
  '2026-07-30T08:05:00.000Z',
);
const THREAD_REPLY: MockMessage = {
  ...buildMessage(27803, 'Pinned reply inside the announcement thread'),
  parent_message_id: FIRST_MESSAGE.id,
};
// An old announcement that the timeline has not paged in yet — the case pinning
// exists for. Resolvable through the message detail endpoint, absent from the list.
const ARCHIVED_MESSAGE = buildMessage(
  27800,
  'Archived announcement above the loaded window',
  '2026-07-29T08:00:00.000Z',
);

type SetupOptions = {
  isManager?: boolean;
  initialPins?: MockPin[];
  pinDelayMs?: number;
  pinResponseStatus?: number;
  pinsInitiallyFail?: boolean;
  threadReplies?: MockMessage[];
  /** Fetchable by id but not returned by the timeline list endpoint. */
  unloadedMessages?: MockMessage[];
};

function buildChat(isManager: boolean) {
  return {
    id: CHAT_ID,
    slug: CHAT_SLUG,
    name: 'announcements',
    type: 'group',
    project_id: PROJECT.id,
    topic: 'Important announcements',
    description: 'Pinned messages E2E channel',
    visibility: 'public',
    created_by_id: isManager ? CURRENT_USER.id : TEAMMATE.id,
    created_by: isManager ? CURRENT_USER : TEAMMATE,
    created_at: CREATED_AT,
    updated_at: CREATED_AT,
    unread_count: 0,
    mention_unread_count: 0,
    participants: [
      {
        id: 1,
        user: CURRENT_USER,
        chat_id: CHAT_ID,
        joined_at: CREATED_AT,
        is_active: true,
        is_manager: isManager,
        is_muted: false,
        notification_level: 'all',
      },
      {
        id: 2,
        user: TEAMMATE,
        chat_id: CHAT_ID,
        joined_at: '2026-07-30T08:01:00.000Z',
        is_active: true,
        is_manager: !isManager,
        is_muted: false,
        notification_level: 'all',
      },
    ],
    last_message: SECOND_MESSAGE,
  };
}

async function setupPinnedMessagesPage(
  page: Page,
  options: SetupOptions = {},
) {
  const isManager = options.isManager ?? true;
  const chat = buildChat(isManager);
  const rootMessages = [FIRST_MESSAGE, SECOND_MESSAGE];
  const threadReplies = options.threadReplies ?? [];
  const messages = [...rootMessages, ...threadReplies, ...(options.unloadedMessages ?? [])];
  let pins = [...(options.initialPins ?? [])];
  let pinsUnavailable = options.pinsInitiallyFail ?? false;
  const pinRequests: Array<{ pathname: string; payload: Record<string, unknown> }> = [];
  const unpinRequests: string[] = [];

  await seedAuthenticatedUser(page, CURRENT_USER);
  await mockAuthenticatedUserApis(page, CURRENT_USER);
  await mockProjectShellApis(page);
  await seedActiveProject(page, PROJECT);

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
      body: JSON.stringify({
        results: [
          { id: 1, user: CURRENT_USER, project: PROJECT, role: 'owner', is_active: true },
          { id: 2, user: TEAMMATE, project: PROJECT, role: 'member', is_active: true },
        ],
        next: null,
      }),
    });
  });

  await page.route('**/api/chat/chats/**', async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname.replace(/\/+$/, '');

    if (pathname === '/api/chat/chats' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 1, next: null, previous: null, results: [chat] }),
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

    if (pathname === `/api/chat/chats/${CHAT_SLUG}/pins` && request.method() === 'GET') {
      if (pinsUnavailable) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Temporary pin service failure' }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(pins),
      });
      return;
    }

    if (pathname === `/api/chat/chats/${CHAT_SLUG}/pin` && request.method() === 'POST') {
      const payload = request.postDataJSON() as { message_id: number };
      pinRequests.push({ pathname, payload });
      if (options.pinDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, options.pinDelayMs));
      }
      if (options.pinResponseStatus && options.pinResponseStatus >= 400) {
        await route.fulfill({
          status: options.pinResponseStatus,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Only channel managers can pin messages' }),
        });
        return;
      }
      const message = messages.find((candidate) => candidate.id === payload.message_id);
      const existing = pins.find((candidate) => candidate.message.id === payload.message_id);
      const pin = existing ?? {
        id: 9000 + pins.length,
        chat: CHAT_ID,
        pinned_by: CURRENT_USER,
        created_at: '2026-07-30T09:00:00.000Z',
        message: message ?? FIRST_MESSAGE,
      };
      if (!existing) pins = [pin, ...pins];
      await route.fulfill({
        status: existing ? 200 : 201,
        contentType: 'application/json',
        body: JSON.stringify(pin),
      });
      return;
    }

    const unpinMatch = pathname.match(
      new RegExp(`^/api/chat/chats/${CHAT_SLUG}/pin/(\\d+)$`),
    );
    if (unpinMatch && request.method() === 'DELETE') {
      unpinRequests.push(pathname);
      const messageId = Number(unpinMatch[1]);
      pins = pins.filter((candidate) => candidate.message.id !== messageId);
      await route.fulfill({ status: 204, body: '' });
      return;
    }

    if (/\/mark_as_read$/.test(pathname) && request.method() === 'POST') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
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
          results: rootMessages,
          next_cursor: null,
          prev_cursor: null,
          page_size: 50,
        }),
      });
      return;
    }

    const threadRepliesMatch = pathname.match(/^\/api\/chat\/messages\/(\d+)\/thread_replies$/);
    if (threadRepliesMatch && request.method() === 'GET') {
      const rootMessageId = Number(threadRepliesMatch[1]);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: threadReplies.filter(
            (message) => message.parent_message_id === rootMessageId,
          ),
        }),
      });
      return;
    }

    if (/\/mark_thread_as_read$/.test(pathname) && request.method() === 'POST') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      return;
    }

    const messageDetailMatch = pathname.match(/^\/api\/chat\/messages\/(\d+)$/);
    if (messageDetailMatch && request.method() === 'GET') {
      const message = messages.find((candidate) => candidate.id === Number(messageDetailMatch[1]));
      await route.fulfill({
        status: message ? 200 : 404,
        contentType: 'application/json',
        body: JSON.stringify(message ?? { error: 'Message not found' }),
      });
      return;
    }

    await route.fallback();
  });

  await page.goto(`/messages/${CHAT_SLUG}`);
  await waitForLayoutMain(page);
  await expect(page.getByTestId('messages-chat-window')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(`#message-${FIRST_MESSAGE.id}`)).toBeVisible({ timeout: 15_000 });

  return {
    pinRequests,
    unpinRequests,
    recoverPins: () => {
      pinsUnavailable = false;
    },
  };
}

async function openMessageMoreActions(page: Page, messageId: number) {
  const row = page.locator(`#message-${messageId}`);
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.hover();
  await row.getByRole('button', { name: 'More actions' }).click();
}

async function openPinnedMessagesSection(page: Page) {
  await page.getByRole('button', { name: 'Channel details' }).click();
  const drawer = page.getByTestId('channel-details-drawer');
  await expect(drawer).toBeVisible({ timeout: 10_000 });
  await drawer.getByTestId('pinned-messages-section-toggle').click();
  return drawer;
}

test.describe('Pinned messages per channel', () => {
  test.describe.configure({ mode: 'serial', timeout: 60_000 });

  test('manager can pin from the message menu and unpin from the drawer', async ({ page }) => {
    const { pinRequests, unpinRequests } = await setupPinnedMessagesPage(page);

    await openMessageMoreActions(page, FIRST_MESSAGE.id);
    await page.getByRole('menuitem').filter({ hasText: 'Pin to channel' }).click();

    await expect.poll(() => pinRequests.length).toBe(1);
    expect(pinRequests[0]).toEqual({
      pathname: `/api/chat/chats/${CHAT_SLUG}/pin`,
      payload: { message_id: FIRST_MESSAGE.id },
    });
    await expect(page.getByText('Message pinned', { exact: true })).toBeVisible();
    await expect(
      page.locator(`#message-${FIRST_MESSAGE.id}`).getByText('Pinned to channel', { exact: false }),
    ).toBeVisible();

    const drawer = await openPinnedMessagesSection(page);
    const pinnedItem = drawer
      .getByTestId('pinned-message-item')
      .filter({ hasText: FIRST_MESSAGE.content });
    await expect(pinnedItem).toBeVisible();
    await expect(pinnedItem).toContainText(CURRENT_USER.username);
    await expect(pinnedItem.getByTestId('pinned-message-meta')).toContainText('Jul 30, 2026');

    await pinnedItem.getByRole('button', { name: 'Unpin' }).click({ force: true });

    await expect.poll(() => unpinRequests.length).toBe(1);
    expect(unpinRequests[0]).toBe(
      `/api/chat/chats/${CHAT_SLUG}/pin/${FIRST_MESSAGE.id}`,
    );
    await expect(page.getByText('Message unpinned', { exact: true })).toBeVisible();
    await expect(pinnedItem).not.toBeVisible();
    await expect(
      page.locator(`#message-${FIRST_MESSAGE.id}`).getByText('Pinned to channel', { exact: false }),
    ).not.toBeVisible();
  });

  test('drawer shows newest pin first and regular members have read-only access', async ({ page }) => {
    const initialPins: MockPin[] = [
      {
        id: 1,
        chat: CHAT_ID,
        pinned_by: TEAMMATE as typeof CURRENT_USER,
        created_at: '2026-07-30T08:30:00.000Z',
        message: FIRST_MESSAGE,
      },
      {
        id: 2,
        chat: CHAT_ID,
        pinned_by: TEAMMATE as typeof CURRENT_USER,
        created_at: '2026-07-30T08:45:00.000Z',
        message: SECOND_MESSAGE,
      },
    ];
    await setupPinnedMessagesPage(page, { isManager: false, initialPins });

    const banner = page.getByTestId('pinned-message-banner');
    await expect(banner).toBeVisible();
    await expect(banner.getByTestId('pinned-banner-new')).toBeVisible();
    await expect(banner).toContainText(SECOND_MESSAGE.content);

    await page.getByTestId('pinned-messages-button').click();
    const drawer = page.getByTestId('pinned-messages-drawer');
    await expect(drawer).toBeVisible();
    const items = drawer.getByTestId('pinned-drawer-item');
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText(SECOND_MESSAGE.content);
    await expect(items.nth(1)).toContainText(FIRST_MESSAGE.content);
    await expect(drawer.getByRole('button', { name: /Unpin message:/ })).toHaveCount(0);

    await drawer.getByRole('button', { name: 'Close pinned messages' }).click();
    await expect(banner).toContainText(SECOND_MESSAGE.content);
    await expect(banner.getByTestId('pinned-banner-new')).not.toBeVisible();

    await openMessageMoreActions(page, FIRST_MESSAGE.id);
    await expect(
      page.getByRole('menuitem').filter({ hasText: /Pin to channel|Unpin from channel/ }),
    ).toHaveCount(0);
  });

  test('failed pin keeps local state unchanged and shows an error', async ({ page }) => {
    const { pinRequests } = await setupPinnedMessagesPage(page, { pinResponseStatus: 403 });

    await openMessageMoreActions(page, FIRST_MESSAGE.id);
    await page.getByRole('menuitem').filter({ hasText: 'Pin to channel' }).click();

    await expect.poll(() => pinRequests.length).toBe(1);
    await expect(page.getByText('Failed to pin message', { exact: true })).toBeVisible();
    await expect(
      page.locator(`#message-${FIRST_MESSAGE.id}`).getByText('Pinned to channel', { exact: false }),
    ).toHaveCount(0);
  });

  test('pin action ignores duplicate clicks while the request is in flight', async ({ page }) => {
    const { pinRequests } = await setupPinnedMessagesPage(page, { pinDelayMs: 1_000 });

    await openMessageMoreActions(page, FIRST_MESSAGE.id);
    await page
      .getByRole('menuitem')
      .filter({ hasText: 'Pin to channel' })
      .evaluate((element) => {
        const menuItem = element as HTMLElement;
        menuItem.click();
        menuItem.click();
      });

    await expect.poll(() => pinRequests.length).toBe(1);
    await expect(page.getByText('Message pinned', { exact: true })).toBeVisible();
  });

  test('pinned drawer distinguishes load errors and supports retry', async ({ page }) => {
    const { recoverPins } = await setupPinnedMessagesPage(page, { pinsInitiallyFail: true });

    const drawer = await openPinnedMessagesSection(page);
    await expect(drawer.getByRole('alert')).toContainText('Could not load pinned messages.');
    recoverPins();
    await drawer.getByRole('button', { name: 'Try again' }).click();
    await expect(drawer.getByText('No pinned messages yet.')).toBeVisible();
  });

  test('pinned drawer is usable on a mobile viewport', async ({ page }) => {
    await setupPinnedMessagesPage(page);
    await page.setViewportSize({ width: 390, height: 844 });

    await page.getByRole('button', { name: 'Channel details' }).click();
    const drawer = page.getByTestId('channel-details-drawer');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('button', { name: 'Close channel details' })).toBeVisible();
  });

  test('jumping to a pin above the loaded window pages the message in', async ({ page }) => {
    const archivedPin: MockPin = {
      id: 4,
      chat: CHAT_ID,
      pinned_by: CURRENT_USER,
      created_at: '2026-07-30T09:00:00.000Z',
      message: ARCHIVED_MESSAGE,
    };
    await setupPinnedMessagesPage(page, {
      initialPins: [archivedPin],
      unloadedMessages: [ARCHIVED_MESSAGE],
    });

    // The pinned announcement is not in the timeline yet — this is the case the
    // feature exists for, and the one that used to fail silently.
    await expect(page.locator(`#message-${ARCHIVED_MESSAGE.id}`)).toHaveCount(0);

    const drawer = await openPinnedMessagesSection(page);
    await drawer
      .getByTestId('pinned-message-item')
      .filter({ hasText: ARCHIVED_MESSAGE.content })
      .getByRole('button')
      .filter({ hasText: ARCHIVED_MESSAGE.content })
      .click();

    await expect(page.locator(`#message-${ARCHIVED_MESSAGE.id}`)).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/[?&]messageId=27800\b/);
  });

  test('a pinned thread reply opens its thread and highlights the reply', async ({ page }) => {
    const replyPin: MockPin = {
      id: 3,
      chat: CHAT_ID,
      pinned_by: CURRENT_USER,
      created_at: '2026-07-30T09:00:00.000Z',
      message: THREAD_REPLY,
    };
    await setupPinnedMessagesPage(page, {
      initialPins: [replyPin],
      threadReplies: [THREAD_REPLY],
    });

    const drawer = await openPinnedMessagesSection(page);
    await drawer
      .getByTestId('pinned-message-item')
      .filter({ hasText: THREAD_REPLY.content })
      .getByRole('button')
      .filter({ hasText: THREAD_REPLY.content })
      .click();

    const threadPanel = page.getByTestId('thread-panel');
    await expect(threadPanel).toBeVisible();
    await expect(threadPanel.locator(`#message-${THREAD_REPLY.id}`)).toContainText(
      THREAD_REPLY.content,
    );
  });
});
