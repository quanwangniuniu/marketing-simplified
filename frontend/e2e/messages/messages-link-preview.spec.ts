import { expect, test, type Page } from '@playwright/test';

import {
  mockAuthenticatedUserApis,
  mockProjectShellApis,
  seedActiveProject,
  seedAuthenticatedUser,
  waitForLayoutMain,
} from './messages-helpers';

/**
 * MED-279 — a URL in a message renders as a rich card on load.
 *
 * The preview is resolved server-side and arrives on the message payload, so this
 * spec asserts the card is drawn from `link_preview` and that the client never
 * fetches the third-party URL itself.
 */

const PROJECT = {
  id: 279,
  slug: 'link-preview-e2e-project',
  name: 'Link Preview E2E Project',
  is_active: true,
  organization: { id: 279, name: 'Link Preview E2E Organization' },
};
const CURRENT_USER = {
  id: 1,
  email: 'manager@example.com',
  username: 'link-manager',
  is_verified: true,
  is_staff: false,
  roles: [],
};
const TEAMMATE = { id: 2, email: 'member@example.com', username: 'link-member' };
const CHAT_ID = 2790;
const CHAT_SLUG = 'med-279-link-previews';
const CREATED_AT = '2026-08-13T08:00:00.000Z';

const ARTICLE_URL = 'https://example.com/story';
const PREVIEW = {
  url: ARTICLE_URL,
  title: 'A great article',
  description: 'Why it matters',
  image_url: 'https://cdn.example.com/cover.jpg',
};

type MockMessage = Record<string, any>;

function buildMessage(id: number, content: string, linkPreview: unknown = null): MockMessage {
  return {
    id,
    chat: CHAT_ID,
    chat_id: CHAT_ID,
    content,
    created_at: CREATED_AT,
    updated_at: CREATED_AT,
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
    link_preview: linkPreview,
  };
}

const MESSAGE_WITH_PREVIEW = buildMessage(27901, `have a look at ${ARTICLE_URL}`, PREVIEW);
const MESSAGE_AWAITING_PREVIEW = buildMessage(27902, `pending link ${ARTICLE_URL}`, null);

function buildChat() {
  return {
    id: CHAT_ID,
    slug: CHAT_SLUG,
    name: 'links',
    type: 'group',
    project_id: PROJECT.id,
    topic: 'Shared links',
    description: 'Link preview E2E channel',
    visibility: 'public',
    created_by_id: CURRENT_USER.id,
    created_by: CURRENT_USER,
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
        is_manager: true,
        is_muted: false,
        notification_level: 'all',
      },
      {
        id: 2,
        user: TEAMMATE,
        chat_id: CHAT_ID,
        joined_at: CREATED_AT,
        is_active: true,
        is_manager: false,
        is_muted: false,
        notification_level: 'all',
      },
    ],
    last_message: MESSAGE_WITH_PREVIEW,
  };
}

async function setupLinkPreviewPage(page: Page, messages: MockMessage[]) {
  const chat = buildChat();
  /** Any call to the on-demand preview endpoint means the client is still fetching. */
  const onDemandPreviewCalls: string[] = [];
  /** Requests the browser made to the third-party host (the og:image hotlink). */
  const thirdPartyCalls: string[] = [];

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

  await page.route('**/api/chat/link-preview/**', async (route) => {
    onDemandPreviewCalls.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ url: ARTICLE_URL, title: 'should not be used' }),
    });
  });

  // The card hotlinks og:image straight from the third party; serve a stub so the
  // test never depends on an external host.
  await page.route('https://cdn.example.com/**', async (route) => {
    thirdPartyCalls.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64',
      ),
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
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      return;
    }

    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
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
          results: messages,
          next_cursor: null,
          prev_cursor: null,
          page_size: 50,
        }),
      });
      return;
    }

    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.goto(`/messages/${CHAT_SLUG}`);
  await waitForLayoutMain(page);
  await expect(page.getByTestId('messages-chat-window')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(`#message-${messages[0].id}`)).toBeVisible({ timeout: 15_000 });

  return { onDemandPreviewCalls, thirdPartyCalls };
}

test.describe('MED-279 link previews', () => {
  test('a message with a resolved preview renders a rich card', async ({ page }) => {
    await setupLinkPreviewPage(page, [MESSAGE_WITH_PREVIEW]);

    const card = page
      .locator(`#message-${MESSAGE_WITH_PREVIEW.id}`)
      .getByRole('link', { name: /Link preview/i });

    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(card).toHaveAttribute('href', ARTICLE_URL);
    await expect(card.getByText('A great article')).toBeVisible();
    await expect(card.getByText('Why it matters')).toBeVisible();
    await expect(card.locator('img')).toHaveAttribute('src', PREVIEW.image_url);
  });

  test('the client does not fetch the URL itself', async ({ page }) => {
    const { onDemandPreviewCalls } = await setupLinkPreviewPage(page, [MESSAGE_WITH_PREVIEW]);

    await expect(
      page.locator(`#message-${MESSAGE_WITH_PREVIEW.id}`).getByRole('link', { name: /Link preview/i }),
    ).toBeVisible({ timeout: 15_000 });

    // The card comes from the message payload; nothing may hit the on-demand endpoint.
    expect(onDemandPreviewCalls).toEqual([]);
  });

  test('a message whose preview is not ready renders as plain text', async ({ page }) => {
    await setupLinkPreviewPage(page, [MESSAGE_AWAITING_PREVIEW]);

    const row = page.locator(`#message-${MESSAGE_AWAITING_PREVIEW.id}`);
    await expect(row).toContainText(ARTICLE_URL);
    // No placeholder while pending — the card simply appears once it is ready.
    await expect(row.getByRole('link', { name: /Link preview/i })).toHaveCount(0);
  });
});
