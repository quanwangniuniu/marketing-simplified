/**
 * Canonical browser URLs for /messages.
 */

import type { Chat } from '@/types/chat';

export type MessagesQueryParams = {
  messageId?: number | null;
  threadMessageId?: number | null;
  jumpId?: string | null;
  fileId?: number | null;
};

// Legacy /messages URLs carried chat/project context in the query string; these
// keys are stripped/translated so the slug in the path is the only source of truth.
const LEGACY_CHAT_QUERY_KEYS = ['chatId', 'projectId', 'project_id'] as const;

export function buildMessagesPath(
  chatSlug?: string | null,
  query?: MessagesQueryParams,
): string {
  const base = chatSlug?.trim()
    ? `/messages/${encodeURIComponent(chatSlug.trim())}`
    : '/messages';
  const params = new URLSearchParams();

  if (query?.messageId != null && Number.isFinite(query.messageId) && query.messageId > 0) {
    params.set('messageId', String(query.messageId));
  }
  if (
    query?.threadMessageId != null &&
    Number.isFinite(query.threadMessageId) &&
    query.threadMessageId > 0
  ) {
    params.set('threadMessageId', String(query.threadMessageId));
  }
  if (query?.jumpId?.trim()) {
    params.set('jumpId', query.jumpId.trim());
  }
  if (query?.fileId != null && Number.isFinite(query.fileId) && query.fileId > 0) {
    params.set('fileId', String(query.fileId));
  }

  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export function parseChatSlugFromPathname(pathname: string): string | null {
  const match = pathname.match(/^\/messages\/([^/?#]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]).trim() || null;
  } catch {
    return match[1].trim() || null;
  }
}

/**
 * Whether a message deep link belongs to the chat currently rendered.
 * `routeChatSlug` is optional because the floating chat widget has no chat
 * route of its own; full-page Messages always supplies it.
 */
export function isMessageDeepLinkForChat(
  routeChatSlug: string | null | undefined,
  activeChatSlug: string,
): boolean {
  return routeChatSlug == null || routeChatSlug === activeChatSlug;
}

export function hasLegacyMessagesQuery(searchParams: URLSearchParams): boolean {
  return LEGACY_CHAT_QUERY_KEYS.some((key) => searchParams.has(key));
}

export function getLegacyChatIdFromQuery(searchParams: Pick<URLSearchParams, 'get'>): number | null {
  const raw = searchParams.get('chatId');
  if (!raw) return null;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function stripLegacyMessagesQuery(searchParams: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(searchParams.toString());
  for (const key of LEGACY_CHAT_QUERY_KEYS) {
    next.delete(key);
  }
  return next;
}

export function translateLegacyMessagesActionUrl(actionUrl: string): string | null {
  if (!actionUrl.startsWith('/messages')) return null;
  try {
    const url = new URL(actionUrl, 'http://local');
    const chatId = url.searchParams.get('chatId');
    const messageId = url.searchParams.get('messageId');
    const threadMessageId = url.searchParams.get('threadMessageId');
    const jumpId = url.searchParams.get('jumpId');
    const fileId = url.searchParams.get('fileId');

    // Path already slug-based
    const pathSlug = parseChatSlugFromPathname(url.pathname);
    if (pathSlug) {
      return buildMessagesPath(pathSlug, {
        messageId: messageId ? Number(messageId) : undefined,
        threadMessageId: threadMessageId ? Number(threadMessageId) : undefined,
        jumpId: jumpId ?? undefined,
        fileId: fileId ? Number(fileId) : undefined,
      });
    }

    // Legacy query-only URL — we can't synthesize the path slug here, so signal
    // the caller (which has chat data) to resolve chatId → slug itself.
    if (chatId) return null;

    stripLegacyMessagesQuery(url.searchParams);
    const qs = url.searchParams.toString();
    return qs ? `/messages?${qs}` : '/messages';
  } catch {
    return null;
  }
}

/** Project identity for sidebar / localStorage keys (prefer slug). */
export type ProjectKeySource = {
  id: number | string;
  slug?: string | null;
} | null;

export function preferredProjectKey(source: ProjectKeySource): number | string | null {
  if (!source) return null;
  const slug = source.slug?.trim();
  if (slug) return slug;
  return source.id;
}

/** True when two keys refer to the same project (slug vs numeric id). */
export function projectKeysMatch(
  a: number | string | null | undefined,
  b: number | string | null | undefined,
  activeProject?: ProjectKeySource,
): boolean {
  if (a == null || b == null) return a === b;
  if (String(a) === String(b)) return true;
  if (!activeProject) return false;
  const variants = new Set<string>([String(activeProject.id)]);
  if (activeProject.slug) variants.add(String(activeProject.slug));
  return variants.has(String(a)) && variants.has(String(b));
}

/** Map API/chat project id to the canonical sidebar key for the active project. */
export function normalizeProjectKey(
  raw: number | string | null | undefined,
  activeProject: ProjectKeySource,
): number | string | null {
  if (raw == null) return preferredProjectKey(activeProject);
  if (!activeProject) return raw;
  if (String(raw) === String(activeProject.id) || raw === activeProject.slug) {
    return preferredProjectKey(activeProject) ?? raw;
  }
  return raw;
}

/**
 * Look up a project's chats tolerating slug/id key drift: the store may have been
 * populated under the numeric id while the active project is keyed by slug (or
 * vice versa), so fall back through canonical → id → slug until a non-empty list
 * is found.
 */
export function chatsForProjectKey(
  chatsByProject: Record<number | string, Chat[] | undefined>,
  projectKey: number | string | null,
  activeProject: ProjectKeySource,
): Chat[] {
  if (projectKey == null) return [];
  const direct = chatsByProject[projectKey];
  if (direct?.length) return direct;
  if (!activeProject) return direct ?? [];
  const canonical = preferredProjectKey(activeProject);
  if (canonical != null && canonical !== projectKey) {
    const alt = chatsByProject[canonical];
    if (alt?.length) return alt;
  }
  const numericId = activeProject.id;
  if (numericId !== projectKey && numericId !== canonical) {
    const byId = chatsByProject[numericId];
    if (byId?.length) return byId;
  }
  const slug = activeProject.slug;
  if (slug && slug !== projectKey && slug !== canonical) {
    const bySlug = chatsByProject[slug];
    if (bySlug?.length) return bySlug;
  }
  return direct ?? [];
}
