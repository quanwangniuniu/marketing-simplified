import {
  buildMessagesPath,
  getLegacyChatIdFromQuery,
  isMessageDeepLinkForChat,
  normalizeProjectKey,
  parseChatSlugFromPathname,
  projectKeysMatch,
  translateLegacyMessagesActionUrl,
} from '@/lib/messages/messagesRoutes';

describe('messagesRoutes', () => {
  it('builds canonical chat path without project query', () => {
    expect(buildMessagesPath('general')).toBe('/messages/general');
    expect(buildMessagesPath('general', { messageId: 42 })).toBe(
      '/messages/general?messageId=42',
    );
  });

  it('parses chat slug from pathname', () => {
    expect(parseChatSlugFromPathname('/messages/general')).toBe('general');
    expect(parseChatSlugFromPathname('/messages')).toBeNull();
  });

  it('does not resolve a stale message deep link against a newly selected chat', () => {
    expect(isMessageDeepLinkForChat('announcements', 'direct-message')).toBe(false);
    expect(isMessageDeepLinkForChat('announcements', 'announcements')).toBe(true);
    expect(isMessageDeepLinkForChat(undefined, 'widget-chat')).toBe(true);
  });

  it('detects legacy chatId query', () => {
    const params = new URLSearchParams('chatId=5&projectId=2');
    expect(getLegacyChatIdFromQuery(params)).toBe(5);
  });

  it('translates slug-based legacy action urls', () => {
    expect(
      translateLegacyMessagesActionUrl('/messages/general?messageId=9&projectId=1'),
    ).toBe('/messages/general?messageId=9');
  });

  it('treats slug and numeric id as the same project', () => {
    const active = { id: 42, slug: 'acme' };
    expect(projectKeysMatch('acme', 42, active)).toBe(true);
    expect(normalizeProjectKey(42, active)).toBe('acme');
  });
});
