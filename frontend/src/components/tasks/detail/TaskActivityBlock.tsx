'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { TaskAPI, type MentionUser } from '@/lib/api/taskApi';
import type { TaskComment } from '@/types/task';
import { Skeleton } from '@/components/ui/skeleton';
import { useAutoResizeTextarea } from '@/hooks/useAutoResizeTextarea';

function fmtTime(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;

  const diff = (Date.now() - d.getTime()) / 1000;

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;

  return d.toLocaleDateString('en-US');
}

function userName(u: TaskComment['user']): string {
  return u?.username || u?.email || `User ${u?.id ?? '?'}`;
}

function mentionDisplayName(user: MentionUser): string {
  return user.username || user.name || user.email || `User ${user.id}`;
}

function mentionToken(user: MentionUser): string {
  const raw =
    user.username ||
    user.name ||
    user.email?.split('@')[0] ||
    `user${user.id}`;

  const safeName = raw.replace(/\s+/g, '');

  return `@${safeName}`;
}

function mentionTeamName(user: MentionUser): string | null {
  return user.team?.name || user.team_name || null;
}

function initials(name: string): string {
  return name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || '')
    .join('');
}

function Avatar({ name }: { name: string }) {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#3CCED7] to-[#A6E661] text-[11px] font-semibold text-white">
      {initials(name) || 'U'}
    </div>
  );
}

function filterMentionUsers(users: MentionUser[], query: string) {
  const q = query.trim().toLowerCase();

  if (!q) return users;

  return users.filter((user) => {
    const displayName = mentionDisplayName(user).toLowerCase();
    const email = user.email?.toLowerCase() || '';
    const teamName = mentionTeamName(user)?.toLowerCase() || '';

    return (
      displayName.includes(q) ||
      email.includes(q) ||
      teamName.includes(q)
    );
  });
}
const CLARIFY_PREFIX = '🔍 Can you clarify ';

function CommentItem({
  comment,
  readOnly,
  onReply,
  replyingToTargetId,
}: {
  comment: TaskComment;
  readOnly: boolean;
  onReply: (parentId: number, name: string, targetId?: number) => void;
  replyingToTargetId: number | null;
}) {
  const name = userName(comment.user);
  const isReplyingParent = replyingToTargetId === comment.id;

  return (
    <li className="flex gap-3">
      <Avatar name={name} />

      <div className="min-w-0 flex-1">
        <p className="text-xs">
          <span className="font-semibold text-gray-900">{name}</span>
          <span className="ml-2 text-gray-400">{fmtTime(comment.created_at)}</span>

          {comment.is_clarification && (
            <span className="ml-2 rounded bg-yellow-100 px-1.5 py-0.5 text-[10px] font-medium text-yellow-700">
              Question
            </span>
          )}
        </p>

        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-800">
          {comment.body}
        </p>

        {!readOnly && (
          <button
            type="button"
            className={`mt-1 text-[11px] hover:text-[#3CCED7] ${
              isReplyingParent ? 'text-[#3CCED7]' : 'text-gray-400'
            }`}
            onClick={() => onReply(comment.id, name, comment.id)}
          >
            {isReplyingParent ? 'Replying…' : 'Reply'}
          </button>
        )}

        {comment.replies && comment.replies.length > 0 && (
          <ul className="mt-3 space-y-3 border-l-2 border-gray-100 pl-4">
            {comment.replies.map((reply) => {
              const rName = userName(reply.user);
              const isReplying = replyingToTargetId === reply.id;

              return (
                <li key={reply.id} className="flex gap-2">
                  <Avatar name={rName} />

                  <div className="min-w-0 flex-1">
                    <p className="text-xs">
                      <span className="font-semibold text-gray-900">{rName}</span>
                      <span className="ml-2 text-gray-400">
                        {fmtTime(reply.created_at)}
                      </span>
                    </p>

                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-800">
                      {reply.body}
                    </p>

                    {!readOnly && (
                      <button
                        type="button"
                        className={`mt-1 text-[11px] hover:text-[#3CCED7] ${
                          isReplying ? 'text-[#3CCED7]' : 'text-gray-400'
                        }`}
                        onClick={() => onReply(comment.id, rName, reply.id)}
                      >
                        {isReplying ? 'Replying…' : 'Reply'}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </li>
  );
}

export default function TaskActivityBlock({
  taskId,
  readOnly,
  refreshKey,
  loading = false,
}: {
  taskId: number;
  readOnly: boolean;
  refreshKey: number;
  loading?: boolean;
}) {
  const [items, setItems] = useState<TaskComment[] | null>(null);
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [localKey, setLocalKey] = useState(0);
  const [isClarification, setIsClarification] = useState(false);

  const [replyingTo, setReplyingTo] = useState<{
    parentId: number;
    targetId: number;
    name: string;
  } | null>(null);

  const [mentionUsers, setMentionUsers] = useState<MentionUser[]>([]);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionLoading, setMentionLoading] = useState(false);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [selectedMentions, setSelectedMentions] = useState<MentionUser[]>([]);

  const mentionMenuRef = useRef<HTMLDivElement | null>(null);

  const { textareaRef, resizeTextarea } = useAutoResizeTextarea(body, {
    minHeight: 168,
  });

  const localMentionUsers = useMemo(() => {
    if (!items) return [];

    const map = new Map<number, MentionUser>();

    items.forEach((comment) => {
      if (comment.user?.id != null) {
        map.set(Number(comment.user.id), {
          id: Number(comment.user.id),
          username: comment.user.username,
          email: comment.user.email,
        });
      }

      comment.replies?.forEach((reply) => {
        if (reply.user?.id != null) {
          map.set(Number(reply.user.id), {
            id: Number(reply.user.id),
            username: reply.user.username,
            email: reply.user.email,
          });
        }
      });
    });

    return Array.from(map.values());
  }, [items]);

  useEffect(() => {
    let cancelled = false;

    if (loading) return;

    TaskAPI.getComments(taskId)
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });

    return () => {
      cancelled = true;
    };
  }, [loading, taskId, refreshKey, localKey]);

  useEffect(() => {
  if (!showMentionMenu) return;

  const query = mentionQuery.trim();

  if (query.length < 1) {
    setMentionUsers([]);
    setMentionLoading(false);
    return;
  }

  let cancelled = false;

  const timer = window.setTimeout(async () => {
    setMentionLoading(true);

    try {
      const rows = await TaskAPI.getMentionUsers(taskId, query);

      if (!cancelled) {
        setMentionUsers(rows);
      }
    } catch {
      if (!cancelled) {
        setMentionUsers(filterMentionUsers(localMentionUsers, query));
      }
    } finally {
      if (!cancelled) {
        setMentionLoading(false);
      }
    }
  }, 300);

  return () => {
    cancelled = true;
    window.clearTimeout(timer);
  };
}, [showMentionMenu, mentionQuery, taskId, localMentionUsers]);

  useEffect(() => {
    if (!showMentionMenu) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowMentionMenu(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [showMentionMenu]);

  const handleReply = (parentId: number, name: string, targetId = parentId) => {
    if (replyingTo?.targetId === targetId) {
      setReplyingTo(null);
    } else {
      setReplyingTo({
        parentId,
        targetId,
        name,
      });

      textareaRef.current?.focus();
    }
  };

  const insertMention = (user: MentionUser) => {
    const textarea = textareaRef.current;
    const token = `${mentionToken(user)} `;

    const start = textarea?.selectionStart ?? body.length;
    const end = textarea?.selectionEnd ?? body.length;

    const nextBody = `${body.slice(0, start)}${token}${body.slice(end)}`;

    setBody(nextBody);

    setSelectedMentions((current) => {
      if (current.some((item) => item.id === user.id)) return current;
      return [...current, user];
    });

    setShowMentionMenu(false);
    setMentionQuery('');

    requestAnimationFrame(() => {
      if (!textarea) return;

      const nextPosition = start + token.length;

      textarea.focus();
      textarea.selectionStart = nextPosition;
      textarea.selectionEnd = nextPosition;

      resizeTextarea();
    });
  };

  const openMentionMenu = () => {
    setShowMentionMenu((current) => !current);
    setMentionQuery('');
  };

  const handleClarifyClick = () => {
    const currentBody = body;
    const trimmedStart = currentBody.trimStart();
    const hasPrefix = trimmedStart.startsWith(CLARIFY_PREFIX);

    if (isClarification) {
      setIsClarification(false);

      if (hasPrefix) {
        const leadingSpaces = currentBody.length - trimmedStart.length;
        const beforePrefix = currentBody.slice(0, leadingSpaces);
        const afterPrefix = trimmedStart.slice(CLARIFY_PREFIX.length);
        const nextBody = `${beforePrefix}${afterPrefix}`;

        setBody(nextBody);

        requestAnimationFrame(() => {
          const textarea = textareaRef.current;
          if (!textarea) return;

          textarea.focus();
          textarea.selectionStart = Math.max(0, beforePrefix.length);
          textarea.selectionEnd = Math.max(0, beforePrefix.length);
          resizeTextarea();
        });
      }

      return;
    }

    setIsClarification(true);

    if (!hasPrefix) {
      const nextBody = currentBody.trim()
        ? `${CLARIFY_PREFIX}${currentBody}`
        : CLARIFY_PREFIX;

      setBody(nextBody);

      requestAnimationFrame(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        textarea.focus();
        textarea.selectionStart = nextBody.length;
        textarea.selectionEnd = nextBody.length;
        resizeTextarea();
      });
    }
  };

  const submit = async () => {
    const text = body.trim();
    if (!text) return;

    const activeMentionIds = selectedMentions
      .filter((user) => text.includes(mentionToken(user)))
      .map((user) => user.id);

    setPosting(true);

    try {
      if (replyingTo) {
        await TaskAPI.createReply(taskId, {
          body: text,
          parent: replyingTo.parentId,
          mentions: activeMentionIds,
          is_clarification: isClarification && body.trimStart().startsWith(CLARIFY_PREFIX),
        });

        setReplyingTo(null);
      } else {
        await TaskAPI.createComment(taskId, {
          body: text,
          mentions: activeMentionIds,
          is_clarification: isClarification && body.trimStart().startsWith(CLARIFY_PREFIX),
        });
      }

      setBody('');
      setIsClarification(false);
      setSelectedMentions([]);
      setShowMentionMenu(false);
      setMentionQuery('');
      setLocalKey((k) => k + 1);
    } catch (e) {
      toast.error((e as any)?.response?.data?.detail || 'Comment failed');
    } finally {
      setPosting(false);
    }
  };

  const visibleMentionUsers = mentionUsers;
  const hasMentionUsers = visibleMentionUsers.length > 0;

  return (
    <section className="min-w-0 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100 sm:p-5">
      <h2 data-testid="task-comments-heading" className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-gray-900">
        Activity
      </h2>

      {(loading || items === null) && (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />

              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            </div>
          ))}
        </div>
      )}

      {items && items.length === 0 && (
        <p className="text-xs text-gray-400">No comments yet.</p>
      )}

      {items && items.length > 0 && (
        <ul className="space-y-4">
          {items.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              readOnly={readOnly}
              onReply={handleReply}
              replyingToTargetId={replyingTo?.targetId ?? null}
            />
          ))}
        </ul>
      )}

      {!readOnly && !loading && (
        <div className="mt-4 rounded-lg bg-gray-50 p-3 ring-1 ring-gray-100">
          {replyingTo && (
            <div className="mb-2 flex items-center justify-between rounded bg-gray-100 px-2 py-1">
              <span className="text-[11px] text-gray-500">
                Replying to{' '}
                <span className="font-semibold">{replyingTo.name}</span>
              </span>

              <button
                type="button"
                className="text-[11px] text-gray-400 hover:text-gray-600"
                onClick={() => setReplyingTo(null)}
              >
                Cancel
              </button>
            </div>
          )}

          <div className="relative rounded-md border border-gray-200 bg-white transition focus-within:border-[#3CCED7]">
            <textarea
              ref={textareaRef}
              className="min-h-[168px] w-full resize-none overflow-hidden rounded-md bg-transparent px-3 pb-12 pt-2 text-sm text-gray-900 outline-none"
              rows={1}
              placeholder={replyingTo ? `Reply to ${replyingTo.name}…` : 'Add a comment…'}
              value={body}
              onChange={(e) => {
                const nextValue = e.target.value;
                setBody(nextValue);
                resizeTextarea();

                if (!nextValue.trim()) {
                  setSelectedMentions([]);
                  setIsClarification(false);
                  return;
                }

                if (isClarification && !nextValue.trimStart().startsWith(CLARIFY_PREFIX)) {
                  setIsClarification(false);
                }
              }}
              onInput={resizeTextarea}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  submit();
                }
              }}
              disabled={posting}
            />

            <div className="absolute bottom-2 left-2">
              <button
                type="button"
                className={`inline-flex h-8 items-center rounded-lg border px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  isClarification
                    ? 'border-yellow-300 bg-yellow-100 text-yellow-700'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-yellow-300 hover:text-yellow-700'
                }`}
                onClick={handleClarifyClick}
                disabled={posting}
                aria-pressed={isClarification}
                title="Mark as clarification request"
              >
                Clarify
              </button>
            </div>
          </div>

          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative" ref={mentionMenuRef}>
              {showMentionMenu && (
                <div className="absolute bottom-10 left-0 z-20 w-72 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
                  <div className="border-b border-gray-100 p-2">
                    <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-gray-400">
                      Mention someone
                    </p>

                    <input
                      type="text"
                      className="h-8 w-full rounded-md border border-gray-200 px-2 text-xs text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#3CCED7]"
                      placeholder="Search users..."
                      value={mentionQuery}
                      onChange={(e) => setMentionQuery(e.target.value)}
                      autoFocus
                    />
                  </div>

                  <div className="max-h-56 overflow-y-auto py-1">
                    {mentionLoading && (
                      <p className="px-3 py-2 text-xs text-gray-400">
                        Loading users...
                      </p>
                    )}

                    {!mentionLoading && mentionQuery.trim().length < 1 && (
                      <p className="px-3 py-2 text-xs text-gray-400">
                        Type a name or email to search users.
                      </p>
                    )}

                    {!mentionLoading && mentionQuery.trim().length >= 1 && !hasMentionUsers && (
                      <p className="px-3 py-2 text-xs text-gray-400">
                        No users found.
                      </p>
                    )}

                    {!mentionLoading &&
                      visibleMentionUsers.map((user) => {
                        const displayName = mentionDisplayName(user);
                        const teamName = mentionTeamName(user);
                        const token = mentionToken(user);

                        return (
                          <button
                            key={user.id}
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-gray-50"
                            onClick={() => insertMention(user)}
                          >
                            <Avatar name={displayName} />

                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-semibold text-gray-900">
                                {displayName}
                              </span>

                              <span className="block truncate text-[11px] text-gray-400">
                                {teamName ? `${teamName} · ${token}` : token}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}

              <button
                type="button"
                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border bg-white text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  showMentionMenu
                    ? 'border-[#3CCED7] text-[#3CCED7]'
                    : 'border-gray-200 text-gray-500 hover:border-[#3CCED7] hover:text-[#3CCED7]'
                }`}
                onClick={openMentionMenu}
                disabled={posting}
                aria-label="Mention someone"
                title="Mention someone"
              >
                @
              </button>
            </div>

            <div className="flex items-center justify-end gap-2">
              <span className="text-[11px] text-gray-400">⌘ + Enter to send</span>

              <button
                type="button"
                className="inline-flex min-h-8 items-center justify-center rounded-lg bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-4 py-2 text-xs font-semibold leading-none text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={submit}
                disabled={posting || !body.trim()}
              >
                {posting ? 'Posting…' : replyingTo ? 'Reply' : 'Comment'}
              </button>
            </div>

          </div>
        </div>
      )}
    </section>
  );
}