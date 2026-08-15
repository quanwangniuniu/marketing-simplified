import { test, expect, type Page } from '@playwright/test';
import {
	waitForLayoutMain,
	seedAuthenticatedUser,
	mockAuthenticatedUserApis,
	mockProjectShellApis,
	seedActiveProject,
} from './messages-helpers';

const PROJECT = { id: 901, name: 'Message Actions E2E Project', member_count: 2 };
const CURRENT_USER = {
	id: 1,
	email: 'e2e@example.com',
	username: 'e2e-user',
	is_verified: true,
	is_staff: false,
	roles: [],
};
const TEAMMATE = { id: 2, email: 'teammate@example.com', username: 'teammate' };
const CHAT_ID = 9901;
const CREATED_AT = '2026-05-28T10:00:00.000Z';

type MockMessage = Record<string, any>;
type SetupMessagesPageOptions = {
	attachmentUploadHandler?: (requestIndex: number) => Promise<Record<string, any>>;
};

function buildChat() {
	return {
		id: CHAT_ID,
		name: 'actions-lab',
		type: 'group',
		project_id: PROJECT.id,
		topic: 'Testing message actions',
		description: 'A channel for exercising the message toolbar.',
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
				joined_at: '2026-05-28T10:02:00.000Z',
				is_active: true,
				is_manager: false,
				is_muted: false,
				notification_level: 'all',
			},
		],
		last_message: null,
	};
}

function buildMessage(overrides: Record<string, any>): MockMessage {
	return {
		id: overrides.id,
		chat: CHAT_ID,
		chat_id: CHAT_ID,
		content: '',
		created_at: CREATED_AT,
		updated_at: CREATED_AT,
		sender: TEAMMATE,
		statuses: [] as any[],
		attachments: [] as any[],
		reactions: [] as any[],
		is_edited: false,
		is_deleted: false,
		parent_message_id: null,
		thread_reply_count: 0,
		thread_last_reply_at: null,
		thread_participants: [],
		has_unread_thread_replies: false,
		...overrides,
	};
}

async function setupMessagesPage(page: Page, options: SetupMessagesPageOptions = {}) {
	const chat = buildChat();
	const messagesStore = [
		buildMessage({
			id: 9101,
			content: 'Own message for hover actions',
			sender: CURRENT_USER,
			statuses: [{ id: 1, message_id: 9101, user_id: CURRENT_USER.id, status: 'read' }],
		}),
		buildMessage({
			id: 9102,
			content: 'Teammate message with a reaction',
			sender: TEAMMATE,
			reactions: [
				{
					emoji: '👍',
					count: 1,
					users: [{ id: TEAMMATE.id, username: TEAMMATE.username }],
					reacted_by_me: false,
				},
			],
			thread_reply_count: 2,
			thread_last_reply_at: '2026-05-28T10:20:00.000Z',
			thread_participants: [TEAMMATE],
			has_unread_thread_replies: true,
		}),
	];
	const threadReplies = [
		buildMessage({
			id: 9201,
			content: 'Thread reply body',
			sender: TEAMMATE,
			parent_message_id: 9102,
			created_at: '2026-05-28T10:12:00.000Z',
			updated_at: '2026-05-28T10:12:00.000Z',
		}),
	];

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
		const req = route.request();
		const pathname = new URL(req.url()).pathname.replace(/\/+$/, '');

		if (pathname === '/api/chat/chats' && req.method() === 'GET') {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ count: 1, next: null, previous: null, results: [chat] }),
			});
			return;
		}

		if (pathname === `/api/chat/chats/${CHAT_ID}/mark_as_read` && req.method() === 'POST') {
			await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
			return;
		}

		if (/\/pins$/.test(pathname)) {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify([]),
			});
			return;
		}

		if (/\/files$/.test(pathname) || /\/scheduled$/.test(pathname)) {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ count: 0, next: null, previous: null, results: [] }),
			});
			return;
		}

		await route.fallback();
	});

	await page.route('**/api/chat/messages/**', async (route) => {
		const req = route.request();
		const method = req.method();
		const pathname = new URL(req.url()).pathname.replace(/\/+$/, '');

		if (pathname === '/api/chat/messages/unread_count') {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ unread_count: 0 }),
			});
			return;
		}

		if (pathname === '/api/chat/messages' && method === 'GET') {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					results: messagesStore.filter((message) => !message.parent_message_id),
					next_cursor: null,
					prev_cursor: null,
					page_size: 50,
				}),
			});
			return;
		}

		const threadMatch = pathname.match(/\/api\/chat\/messages\/(\d+)\/thread_replies$/);
		if (threadMatch && method === 'GET') {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ results: threadReplies }),
			});
			return;
		}

		if (/\/mark_thread_as_read$/.test(pathname) && method === 'POST') {
			await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
			return;
		}

		const reactMatch = pathname.match(/\/api\/chat\/messages\/(\d+)\/react(?:\/(.+))?$/);
		if (reactMatch && method === 'POST') {
			const messageId = Number(reactMatch[1]);
			const { emoji } = req.postDataJSON() as { emoji: string };
			const message = messagesStore.find((item) => item.id === messageId);
			if (message) {
				const existing = message.reactions.find((reaction: any) => reaction.emoji === emoji);
				if (existing) {
					existing.count += existing.reacted_by_me ? 0 : 1;
					existing.reacted_by_me = true;
					if (!existing.users.some((user: any) => user.id === CURRENT_USER.id)) {
						existing.users.push({ id: CURRENT_USER.id, username: CURRENT_USER.username });
					}
				} else {
					message.reactions = [
						...message.reactions,
						{
							emoji,
							count: 1,
							users: [{ id: CURRENT_USER.id, username: CURRENT_USER.username }],
							reacted_by_me: true,
						},
					];
				}
			}
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ status: 'added', message }),
			});
			return;
		}

		if (reactMatch && method === 'DELETE') {
			const messageId = Number(reactMatch[1]);
			const emoji = decodeURIComponent(reactMatch[2] ?? '');
			const message = messagesStore.find((item) => item.id === messageId);
			if (message) {
				message.reactions = message.reactions
					.map((reaction: any) => {
						if (reaction.emoji !== emoji) return reaction;
						return {
							...reaction,
							count: Math.max(0, reaction.count - 1),
							users: reaction.users.filter((user: any) => user.id !== CURRENT_USER.id),
							reacted_by_me: false,
						};
					})
					.filter((reaction: any) => reaction.count > 0);
			}
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ status: 'removed', message }),
			});
			return;
		}

		const messageMatch = pathname.match(/\/api\/chat\/messages\/(\d+)$/);
		if (messageMatch && method === 'PATCH') {
			const messageId = Number(messageMatch[1]);
			const payload = req.postDataJSON() as { content?: string };
			const message = messagesStore.find((item) => item.id === messageId);
			if (message) {
				message.content = payload.content ?? message.content;
				message.rich_body = null;
				message.is_edited = true;
				message.updated_at = new Date().toISOString();
			}
			await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(message) });
			return;
		}

		if (messageMatch && method === 'DELETE') {
			const messageId = Number(messageMatch[1]);
			const message = messagesStore.find((item) => item.id === messageId);
			if (message) {
				message.content = '';
				message.rich_body = null;
				message.is_deleted = true;
				message.deleted_at = new Date().toISOString();
				message.attachments = [];
				message.reactions = [];
			}
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ status: 'deleted', message }),
			});
			return;
		}

		await route.fallback();
	});

	let attachmentUploadRequestCount = 0;
	await page.route('**/api/chat/attachments/**', async (route) => {
		const req = route.request();
		const pathname = new URL(req.url()).pathname.replace(/\/+$/, '');

		if (pathname === '/api/chat/attachments' && req.method() === 'POST') {
			attachmentUploadRequestCount += 1;
			const attachment = options.attachmentUploadHandler
				? await options.attachmentUploadHandler(attachmentUploadRequestCount)
				: {
					id: 7000 + attachmentUploadRequestCount,
					message: null,
					file_type: 'document',
					file_url: `/media/e2e-upload-${attachmentUploadRequestCount}.pdf`,
					thumbnail_url: null,
					file_size: 20,
					file_size_display: '20 B',
					original_filename: `e2e-upload-${attachmentUploadRequestCount}.pdf`,
					mime_type: 'application/pdf',
				};
			await route.fulfill({
				status: 201,
				contentType: 'application/json',
				body: JSON.stringify(attachment),
			});
			return;
		}

		if (/\/api\/chat\/attachments\/\d+$/.test(pathname) && req.method() === 'DELETE') {
			await route.fulfill({ status: 204, body: '' });
			return;
		}

		await route.fallback();
	});

	await page.goto(`/messages?projectId=${PROJECT.id}&chatId=${CHAT_ID}`);
	await waitForLayoutMain(page);
	await expect(page.getByTestId('messages-chat-window')).toBeVisible({ timeout: 15_000 });

	return { messagesStore };
}

async function openMessageMoreActions(page: Page, messageId: number) {
	const row = page.locator(`#message-${messageId}`);
	await expect(row).toBeVisible({ timeout: 15_000 });
	await row.hover();
	await row.getByRole('button', { name: 'More actions' }).click();
}

test.describe('Message timeline actions', () => {
	test.describe.configure({ mode: 'serial', timeout: 60_000 });

	test('rich composer exposes formatting, attachment, mention, audio/video, and schedule controls', async ({ page }) => {
		await setupMessagesPage(page);

		const composer = page.getByTestId('chat-composer-input');
		await expect(composer).toBeVisible();
		await expect(page.getByRole('button', { name: /Bold/ })).toBeVisible();
		await expect(page.getByRole('button', { name: /Code block/ })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Add attachment' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Add emoji' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Mention someone' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Record video' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Record audio' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Schedule send' })).toBeVisible();

		await page.getByRole('button', { name: 'Hide formatting' }).click();
		await expect(page.getByRole('button', { name: 'Show formatting' })).toBeVisible();
		await expect(page.getByRole('button', { name: /Bold/ })).not.toBeVisible();
	});

	test('attachment picker rejects unsupported MIME inline and retry with valid file succeeds', async ({ page }) => {
		await setupMessagesPage(page);

		const fileInput = page.locator('input[type="file"][accept*=".pdf"]').first();
		await fileInput.setInputFiles({
			name: 'bad.zip',
			mimeType: 'application/zip',
			buffer: Buffer.from('zip-content'),
		});

		await expect(page.getByText('bad.zip')).toBeVisible();
		await expect(
			page
			.getByTestId('messages-chat-window')
			.getByText('Unsupported file type "application/zip"')
		).toBeVisible();

		await page.getByRole('button', { name: 'Remove attachment' }).click();
		await expect(page.getByText('bad.zip')).not.toBeVisible();

		await fileInput.setInputFiles({
			name: 'approved.pdf',
			mimeType: 'application/pdf',
			buffer: Buffer.from('%PDF-1.4 valid'),
		});

		const approvedAttachment = page.locator('div').filter({ hasText: 'approved.pdf' }).first();
		await expect(approvedAttachment).toContainText('approved.pdf');
		await expect(approvedAttachment).toContainText('✓');
	});

	test('hover toolbar can edit an own message and delete it into a tombstone', async ({ page }) => {
		await setupMessagesPage(page);

		await openMessageMoreActions(page, 9101);
		await page.getByRole('menuitem', { name: 'Edit' }).click();
		const editor = page.locator('#message-9101 textarea');
		await expect(editor).toBeVisible();
		await editor.fill('Edited own message from e2e');
		await page.locator('#message-9101').getByRole('button', { name: 'Save' }).click();
		await expect(page.getByText('Edited own message from e2e')).toBeVisible({ timeout: 5_000 });
		await expect(page.getByText('(edited)')).toBeVisible();

		await openMessageMoreActions(page, 9101);
		await page.getByRole('menuitem', { name: 'Delete' }).click();
		await expect(page.locator('#message-9101').getByText('Message deleted')).toBeVisible({ timeout: 5_000 });
		await expect(page.getByText('Edited own message from e2e')).not.toBeVisible();
	});

	test('reaction pill toggles current user reaction through the reaction API', async ({ page }) => {
		await setupMessagesPage(page);

		const reactionButton = page.locator('#message-9102').getByRole('button').filter({ hasText: '👍' });
		await expect(reactionButton).toContainText('1');
		await reactionButton.click();
		await expect(reactionButton).toContainText('2', { timeout: 5_000 });
		await reactionButton.click();
		await expect(reactionButton).toContainText('1', { timeout: 5_000 });
	});

	test('thread reply count opens the thread panel and loads replies', async ({ page }) => {
		await setupMessagesPage(page);

		await page.locator('#message-9102').getByRole('button', { name: /2 replies/ }).click();
		await expect(page.getByText('Thread', { exact: true })).toBeVisible({ timeout: 10_000 });
		await expect(page.getByText('Thread reply body', { exact: true })).toBeVisible({ timeout: 10_000 });
		await expect(page.getByTestId('chat-composer-input').last()).toBeVisible();
	});

	test('quote reply stays separate from thread replies', async ({ page }) => {
		await setupMessagesPage(page);

		const row = page.locator('#message-9102');
		await row.hover();
		await row.getByRole('button', { name: 'Reply', exact: true }).click();

		const replyPreview = page.getByTestId('chat-composer-reply-preview');
		await expect(replyPreview.getByText('Replying to teammate')).toBeVisible({ timeout: 5_000 });
		await expect(replyPreview.getByText('Teammate message with a reaction')).toBeVisible();
		await expect(page.getByText('Thread', { exact: true })).not.toBeVisible();
	});
});
