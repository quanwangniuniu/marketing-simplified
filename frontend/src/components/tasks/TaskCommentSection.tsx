"use client";

import { useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Image from "@tiptap/extension-image";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import RichCommentEditor from "@/components/common/RichCommentEditor";
import { slateToTiptap } from "@/components/common/slateUtils";
import { TaskAPI } from "@/lib/api/taskApi";
import type { TaskComment, SlateNode, SlateElement } from "@/types/task";

interface TaskCommentSectionProps {
  taskId: number;
  currentUserId?: number;
  currentUsername?: string;
  currentUserEmail?: string;
}

function getUserInitials(username?: string, email?: string): string {
  const name = username || email || "";
  if (!name) return "?";
  const parts = name.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function getUserColor(username?: string, email?: string): string {
  const name = username || email || "";
  const colors = [
    "bg-blue-500",
    "bg-purple-500",
    "bg-green-500",
    "bg-orange-500",
    "bg-pink-500",
    "bg-teal-500",
    "bg-red-500",
    "bg-indigo-500",
  ];

  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}

function formatRelativeTimestamp(value?: string): string {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const diffMs = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return "Just now";
  if (diffMs < hour) return `${Math.floor(diffMs / minute)}m ago`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}h ago`;
  if (diffMs < 7 * day) return `${Math.floor(diffMs / day)}d ago`;
  return date.toLocaleDateString();
}

function RichCommentBody({ content, body }: { content: SlateNode[]; body: string }) {
  const tiptapDoc =
    content && content.length
      ? slateToTiptap(content as SlateElement[])
      : null;

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: true }),
      TextStyle,
      Color,
      TaskList,
      TaskItem.configure({ nested: true }),
      Image,
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
    ],
    content: tiptapDoc as any,
    editable: false,
    editorProps: {
      attributes: {
        class: "text-sm text-slate-800",
      },
    },
  });

  if (tiptapDoc && editor) {
    return (
      <EditorContent
        editor={editor}
        className="mt-1.5 text-sm text-slate-800 [&_.ProseMirror]:outline-none [&_.ProseMirror_p]:my-1 [&_.ProseMirror_ul]:my-2 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-5 [&_.ProseMirror_ol]:my-2 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-5 [&_.ProseMirror_blockquote]:my-2 [&_.ProseMirror_blockquote]:border-l-2 [&_.ProseMirror_blockquote]:border-slate-300 [&_.ProseMirror_blockquote]:pl-3 [&_.ProseMirror_blockquote]:text-slate-600 [&_.ProseMirror_ul[data-type=taskList]]:list-none [&_.ProseMirror_ul[data-type=taskList]_li]:flex [&_.ProseMirror_ul[data-type=taskList]_li]:items-start [&_.ProseMirror_ul[data-type=taskList]_li>label]:mr-2 [&_.ProseMirror_table]:my-2 [&_.ProseMirror_table]:w-full [&_.ProseMirror_table]:border-collapse [&_.ProseMirror_td]:border [&_.ProseMirror_td]:border-slate-300 [&_.ProseMirror_td]:px-2 [&_.ProseMirror_td]:py-1 [&_.ProseMirror_th]:border [&_.ProseMirror_th]:border-slate-300 [&_.ProseMirror_th]:bg-slate-50 [&_.ProseMirror_th]:px-2 [&_.ProseMirror_th]:py-1 [&_.ProseMirror_img]:max-w-full [&_.ProseMirror_img]:rounded"
      />
    );
  }

  return (
    <div className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">
      {body}
    </div>
  );
}

function formatAuthor(
  comment: TaskComment,
  currentUserId?: number,
  currentUsername?: string,
  currentUserEmail?: string
): string {
  const author = comment.user;
  if (!author) return `User #${comment.id}`;

  if (currentUserId !== undefined && Number(currentUserId) === Number(author.id)) {
    return currentUsername || currentUserEmail || author.username || author.email || `User #${author.id}`;
  }
  return author.username || author.email || `User #${author.id}`;
}

function CommentItem({
  comment,
  depth = 0,
  currentUserId,
  currentUsername,
  currentUserEmail,
}: {
  comment: TaskComment;
  depth?: number;
  currentUserId?: number;
  currentUsername?: string;
  currentUserEmail?: string;
}) {
  const authorName = formatAuthor(comment, currentUserId, currentUsername, currentUserEmail);
  const avatarColor = getUserColor(comment.user?.username, comment.user?.email);
  const initials = getUserInitials(comment.user?.username, comment.user?.email);
  const relativeTime = formatRelativeTimestamp(comment.created_at);
  const absoluteTime = comment.created_at
    ? new Date(comment.created_at).toLocaleString()
    : "";

  return (
    <div className={depth > 0 ? "ml-11 border-l border-slate-200 pl-4" : ""}>
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${avatarColor} text-xs font-semibold text-white select-none`}
        >
          {initials}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-medium text-slate-900">{authorName}</span>
            {relativeTime && (
              <time title={absoluteTime} className="text-xs text-slate-500">
                {relativeTime}
              </time>
            )}
            {comment.is_edited && (
              <span className="text-xs text-slate-400">edited</span>
            )}
          </div>

          <RichCommentBody content={comment.content} body={comment.body} />

          {comment.replies?.length > 0 && (
            <div className="mt-4 space-y-4">
              {comment.replies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  depth={depth + 1}
                  currentUserId={currentUserId}
                  currentUsername={currentUsername}
                  currentUserEmail={currentUserEmail}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TaskCommentSection({
  taskId,
  currentUserId,
  currentUsername,
  currentUserEmail,
}: TaskCommentSectionProps) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const list = await TaskAPI.getComments(taskId);
        if (!cancelled) setComments(list);
      } catch (err: any) {
        if (!cancelled) {
          setError(
            err?.response?.data?.detail ||
              err?.response?.data?.message ||
              err?.message ||
              "Failed to load comments."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  const handleSubmit = async (content: SlateNode[]) => {
    if (submitting) return;
    try {
      setSubmitting(true);
      setError(null);
      const created = await TaskAPI.createComment(taskId, { content });
      setComments((prev) => [created, ...prev]);
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to add comment."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      data-testid="task-comments-section"
      className="flex flex-col gap-4 border-t border-slate-200 pt-5"
    >
      <h2
        data-testid="task-comments-heading"
        className="text-sm font-semibold text-slate-900"
      >
        Comments
      </h2>

      <RichCommentEditor
        placeholder="Type /ai to Ask Rovo or @ to mention and notify someone."
        onSubmit={handleSubmit}
        submitting={submitting}
        currentUsername={currentUsername}
        currentUserEmail={currentUserEmail}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading && <p className="text-sm text-slate-500">Loading comments...</p>}

      {!loading && !error && comments.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
          No comments yet.
        </div>
      )}

      {!loading && comments.length > 0 && (
        <div className="space-y-5">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUserId={currentUserId}
              currentUsername={currentUsername}
              currentUserEmail={currentUserEmail}
            />
          ))}
        </div>
      )}
    </section>
  );
}
