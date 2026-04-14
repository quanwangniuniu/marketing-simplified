"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { useEditor, useEditorState, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Image from "@tiptap/extension-image";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import EmojiPicker, { type EmojiClickData } from "emoji-picker-react";
import {
  Bold,
  ChevronDown,
  Code2,
  Eraser,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  ListTodo,
  Paintbrush,
  Plus,
  Quote,
  Redo2,
  SmilePlus,
  Strikethrough,
  Subscript,
  Superscript,
  Underline,
  Undo2,
} from "lucide-react";
import type { SlateElement } from "@/components/common/slateUtils";
import { tiptapToSlate, slateToTiptap } from "@/components/common/slateUtils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface RichCommentEditorProps {
  placeholder?: string;
  initialContent?: SlateElement[];
  onSubmit: (content: SlateElement[]) => void;
  onCancel?: () => void;
  submitLabel?: string;
  submitting?: boolean;
  autoFocus?: boolean;
  currentUsername?: string;
  currentUserEmail?: string;
  collapsible?: boolean;
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

function useClickOutside(ref: RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ref, onClose]);
}

function EmojiButton({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));

  const onEmojiClick = useCallback(
    (emojiData: EmojiClickData) => {
      editor.chain().focus().insertContent(emojiData.emoji).run();
      setOpen(false);
    },
    [editor]
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          setOpen((prev) => !prev);
        }}
        className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
        title="Emoji"
      >
        <SmilePlus className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
          <EmojiPicker onEmojiClick={onEmojiClick} lazyLoadEmojis />
        </div>
      )}
    </div>
  );
}

function ToolbarIconButton({
  onClick,
  active,
  title,
  disabled = false,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        if (disabled) return;
        onClick();
      }}
      title={title}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 min-w-8 items-center justify-center rounded-sm px-2 text-sm transition-colors",
        active
          ? "bg-[#E9F2FF] text-[#0C66E4]"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
        disabled && "cursor-not-allowed opacity-40 hover:bg-transparent hover:text-slate-600"
      )}
    >
      {children}
    </button>
  );
}

function ToolbarMenuItem({
  icon,
  label,
  shortcut,
  onSelect,
  disabled = false,
}: {
  icon: ReactNode;
  label: string;
  shortcut?: string;
  onSelect?: () => void;
  disabled?: boolean;
}) {
  return (
    <DropdownMenuItem
      disabled={disabled}
      onSelect={(event) => {
        if (disabled || !onSelect) return;
        event.preventDefault();
        onSelect();
      }}
      className="gap-3 rounded-sm px-3 py-2 text-sm text-slate-700"
    >
      <span className="flex h-4 w-4 items-center justify-center text-slate-500">{icon}</span>
      <span>{label}</span>
      {shortcut ? <DropdownMenuShortcut className="text-[11px] tracking-normal text-slate-400">{shortcut}</DropdownMenuShortcut> : null}
    </DropdownMenuItem>
  );
}

function ToolbarDivider() {
  return <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden="true" />;
}

function ToolbarSplitButton({
  title,
  active,
  onPrimaryClick,
  primaryIcon,
  children,
}: {
  title: string;
  active?: boolean;
  onPrimaryClick: () => void;
  primaryIcon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "inline-flex overflow-hidden rounded-sm border border-transparent",
        active && "bg-[#E9F2FF] text-[#0C66E4]"
      )}
    >
      <ToolbarIconButton onClick={onPrimaryClick} active={active} title={title}>
        {primaryIcon}
      </ToolbarIconButton>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex h-8 w-6 items-center justify-center rounded-r-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none",
              active && "bg-[#E9F2FF] text-[#0C66E4] hover:bg-[#CCE0FF]"
            )}
            title={`${title} options`}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        {children}
      </DropdownMenu>
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  useEditorState({ editor, selector: (ctx) => ctx.editor.state.doc });
  const [isLinkOpen, setIsLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [savedSelection, setSavedSelection] = useState<{ from: number; to: number } | null>(null);

  const handleImage = () => {
    const url = window.prompt("Enter image URL:", "https://");
    if (!url) return;
    editor.chain().focus().setImage({ src: url }).run();
  };

  const clearFormatting = () => {
    editor.chain().focus().clearNodes().unsetAllMarks().run();
  };

  const openLinkPopover = () => {
    const { from, to } = editor.state.selection;
    const selectedText = from === to ? "" : editor.state.doc.textBetween(from, to, " ");
    setSavedSelection({ from, to });
    setLinkText(selectedText);
    setLinkUrl(editor.getAttributes("link").href || "https://");
    setIsLinkOpen(true);
  };

  const submitLink = () => {
    const href = linkUrl.trim();
    if (!href) return;

    const selection = savedSelection ?? {
      from: editor.state.selection.from,
      to: editor.state.selection.to,
    };

    const chain = editor.chain().focus().setTextSelection(selection);
    if (linkText.trim()) {
      chain
        .insertContent({
          type: "text",
          text: linkText.trim(),
          marks: [{ type: "link", attrs: { href } }],
        })
        .run();
    } else if (selection.from !== selection.to) {
      chain.setLink({ href }).run();
    } else {
      chain
        .insertContent({
          type: "text",
          text: href,
          marks: [{ type: "link", attrs: { href } }],
        })
        .run();
    }

    setIsLinkOpen(false);
    setLinkUrl("");
    setLinkText("");
    setSavedSelection(null);
  };

  const removeLink = () => {
    if (savedSelection) {
      editor.chain().focus().setTextSelection(savedSelection).unsetLink().run();
    } else {
      editor.chain().focus().unsetLink().run();
    }
    setIsLinkOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-white px-3 py-2">
      <ToolbarSplitButton
        title="Bold"
        active={editor.isActive("bold")}
        onPrimaryClick={() => editor.chain().focus().toggleBold().run()}
        primaryIcon={<Bold className="h-4 w-4" />}
      >
        <DropdownMenuContent align="start" className="w-[310px] rounded-md border-slate-200 p-1.5 shadow-lg">
          <ToolbarMenuItem
            icon={<Bold className="h-4 w-4" />}
            label="Bold"
            shortcut="Ctrl+B"
            onSelect={() => editor.chain().focus().toggleBold().run()}
          />
          <ToolbarMenuItem
            icon={<Italic className="h-4 w-4" />}
            label="Italic"
            shortcut="Ctrl+I"
            onSelect={() => editor.chain().focus().toggleItalic().run()}
          />
          <ToolbarMenuItem
            icon={<Underline className="h-4 w-4" />}
            label="Underline"
            shortcut="Ctrl+U"
            disabled
          />
          <ToolbarMenuItem
            icon={<Strikethrough className="h-4 w-4" />}
            label="Strikethrough"
            shortcut="Ctrl+Shift+S"
            onSelect={() => editor.chain().focus().toggleStrike().run()}
          />
          <ToolbarMenuItem
            icon={<Code2 className="h-4 w-4" />}
            label="Code"
            shortcut="Ctrl+Shift+M"
            onSelect={() => editor.chain().focus().toggleCode().run()}
          />
          <ToolbarMenuItem
            icon={<Subscript className="h-4 w-4" />}
            label="Subscript"
            shortcut="Ctrl+Shift+,"
            disabled
          />
          <ToolbarMenuItem
            icon={<Superscript className="h-4 w-4" />}
            label="Superscript"
            shortcut="Ctrl+Shift+."
            disabled
          />
          <DropdownMenuSeparator />
          <ToolbarMenuItem
            icon={<Eraser className="h-4 w-4" />}
            label="Clear formatting"
            shortcut="Ctrl+\\"
            onSelect={clearFormatting}
          />
        </DropdownMenuContent>
      </ToolbarSplitButton>

      <ToolbarSplitButton
        title="Bullet list"
        active={
          editor.isActive("bulletList") ||
          editor.isActive("orderedList") ||
          editor.isActive("taskList")
        }
        onPrimaryClick={() => editor.chain().focus().toggleBulletList().run()}
        primaryIcon={<List className="h-4 w-4" />}
      >
        <DropdownMenuContent align="start" className="w-[310px] rounded-md border-slate-200 p-1.5 shadow-lg">
          <ToolbarMenuItem
            icon={<List className="h-4 w-4" />}
            label="Bulleted list"
            shortcut="Ctrl+Shift+8"
            onSelect={() => editor.chain().focus().toggleBulletList().run()}
          />
          <ToolbarMenuItem
            icon={<ListOrdered className="h-4 w-4" />}
            label="Numbered list"
            shortcut="Ctrl+Shift+7"
            onSelect={() => editor.chain().focus().toggleOrderedList().run()}
          />
          <ToolbarMenuItem
            icon={<ListTodo className="h-4 w-4" />}
            label="Task list"
            shortcut="Ctrl+Shift+6"
            onSelect={() => editor.chain().focus().toggleTaskList().run()}
          />
        </DropdownMenuContent>
      </ToolbarSplitButton>

      <ToolbarDivider />

      <ToolbarIconButton onClick={() => {}} title="Text color" disabled>
        <Paintbrush className="h-4 w-4" />
      </ToolbarIconButton>
      <ToolbarIconButton onClick={handleImage} title="Insert image">
        <ImageIcon className="h-4 w-4" />
      </ToolbarIconButton>
      <ToolbarIconButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        active={editor.isActive("code")}
        title="Inline code"
      >
        <Code2 className="h-4 w-4" />
      </ToolbarIconButton>
      <EmojiButton editor={editor} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            title="Insert"
          >
            <Plus className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56 rounded-md border-slate-200 p-1.5 shadow-lg">
          <ToolbarMenuItem
            icon={<Quote className="h-4 w-4" />}
            label="Quote"
            onSelect={() => editor.chain().focus().toggleBlockquote().run()}
          />
          <ToolbarMenuItem
            icon={<ImageIcon className="h-4 w-4" />}
            label="Image"
            onSelect={handleImage}
          />
          <ToolbarMenuItem
            icon={<Eraser className="h-4 w-4" />}
            label="Clear formatting"
            onSelect={clearFormatting}
          />
        </DropdownMenuContent>
      </DropdownMenu>
      <Popover open={isLinkOpen} onOpenChange={setIsLinkOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            onMouseDown={(event) => {
              event.preventDefault();
              openLinkPopover();
            }}
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-sm transition-colors",
              editor.isActive("link")
                ? "bg-[#E9F2FF] text-[#0C66E4]"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            )}
            title="Link"
          >
            <Link2 className="h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" sideOffset={4} className="w-[320px] rounded-md border-slate-200 p-0 shadow-lg">
          <div className="space-y-3 p-3">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-500">Paste or search for link</label>
              <Input
                value={linkUrl}
                onChange={(event) => setLinkUrl(event.target.value)}
                placeholder="https://"
                className="h-8 border-slate-300 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-500">Display text (optional)</label>
              <Input
                value={linkText}
                onChange={(event) => setLinkText(event.target.value)}
                placeholder="Link text"
                className="h-8 border-slate-300 text-sm"
              />
            </div>
          </div>
          <div className="border-t border-slate-200 bg-slate-50 px-3 py-2">
            <button
              type="button"
              onClick={submitLink}
              className="rounded-sm bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Insert link
            </button>
            {editor.isActive("link") && (
              <button
                type="button"
                onClick={removeLink}
                className="ml-2 rounded-sm px-3 py-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                Remove
              </button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <ToolbarDivider />
      <ToolbarIconButton
        onClick={() => editor.chain().focus().undo().run()}
        title="Undo"
        disabled={!editor.can().chain().focus().undo().run()}
      >
        <Undo2 className="h-4 w-4" />
      </ToolbarIconButton>
      <ToolbarIconButton
        onClick={() => editor.chain().focus().redo().run()}
        title="Redo"
        disabled={!editor.can().chain().focus().redo().run()}
      >
        <Redo2 className="h-4 w-4" />
      </ToolbarIconButton>
    </div>
  );
}

export default function RichCommentEditor({
  placeholder = "Add a comment…",
  initialContent,
  onSubmit,
  onCancel,
  submitLabel = "Save",
  submitting = false,
  autoFocus = false,
  currentUsername,
  currentUserEmail,
  collapsible = true,
}: RichCommentEditorProps) {
  const initialDoc = initialContent?.length ? slateToTiptap(initialContent) : undefined;
  const [hasContent, setHasContent] = useState(!!initialContent?.length);
  const [isExpanded, setIsExpanded] = useState(
    autoFocus || !collapsible || !!initialContent?.length
  );
  const containerRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
      Link.configure({ openOnClick: false }),
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
    content: initialDoc as any,
    autofocus: autoFocus,
    onFocus: () => setIsExpanded(true),
    onUpdate: ({ editor: currentEditor }) => setHasContent(!currentEditor.isEmpty),
    editorProps: {
      attributes: {
        class: "text-sm text-slate-900 focus:outline-none",
      },
    },
  });

  useClickOutside(containerRef, () => {
    if (!collapsible || !editor || submitting) return;
    if (editor.isEmpty) setIsExpanded(false);
  });

  const isEmpty = !editor || !hasContent;

  const expandEditor = useCallback(() => {
    setIsExpanded(true);
    requestAnimationFrame(() => {
      editor?.chain().focus("end").run();
    });
  }, [editor]);

  const resetComposer = useCallback(() => {
    if (!editor) return;
    editor.commands.clearContent();
    setHasContent(false);
    if (collapsible) {
      setIsExpanded(false);
    }
  }, [collapsible, editor]);

  const handleCancel = () => {
    if (submitting) return;
    if (onCancel) {
      onCancel();
      return;
    }
    resetComposer();
  };

  const handleSubmit = () => {
    if (!editor || isEmpty || submitting) return;
    const tiptapDoc = editor.getJSON();
    const slateContent = tiptapToSlate(tiptapDoc as Record<string, unknown>);
    onSubmit(slateContent);
    resetComposer();
  };

  if (!editor) return null;

  const initials = getUserInitials(currentUsername, currentUserEmail);
  const avatarColor = getUserColor(currentUsername, currentUserEmail);
  const showCancel = Boolean(onCancel) || collapsible;

  return (
    <div className="flex items-start gap-3">
      <div
        className={`mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${avatarColor} text-xs font-semibold text-white select-none`}
      >
        {initials}
      </div>

      <div
        ref={containerRef}
        onClick={() => {
          if (!isExpanded) {
            expandEditor();
          }
        }}
        className={`relative flex-1 overflow-hidden rounded-md border bg-white transition-all ${
          isExpanded
            ? "border-blue-500 ring-1 ring-blue-200"
            : "border-slate-300 hover:border-slate-400"
        }`}
      >
        {isExpanded && <Toolbar editor={editor} />}

        <EditorContent
          editor={editor}
          className={`cursor-text bg-white [&_.ProseMirror]:outline-none [&_.ProseMirror]:px-4 [&_.ProseMirror]:py-3 [&_.ProseMirror]:text-sm [&_.ProseMirror]:leading-6 [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-slate-400 [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_p]:my-1 [&_.ProseMirror_ul]:my-2 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-5 [&_.ProseMirror_ol]:my-2 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-5 [&_.ProseMirror_blockquote]:my-2 [&_.ProseMirror_blockquote]:border-l-2 [&_.ProseMirror_blockquote]:border-slate-300 [&_.ProseMirror_blockquote]:pl-3 [&_.ProseMirror_blockquote]:text-slate-600 [&_.ProseMirror_ul[data-type=taskList]]:my-2 [&_.ProseMirror_ul[data-type=taskList]]:ml-0 [&_.ProseMirror_ul[data-type=taskList]]:list-none [&_.ProseMirror_ul[data-type=taskList]]:pl-0 [&_.ProseMirror_ul[data-type=taskList]_li]:my-1 [&_.ProseMirror_ul[data-type=taskList]_li]:flex [&_.ProseMirror_ul[data-type=taskList]_li]:items-start [&_.ProseMirror_ul[data-type=taskList]_li]:gap-2 [&_.ProseMirror_ul[data-type=taskList]_li>div]:min-w-0 [&_.ProseMirror_ul[data-type=taskList]_li>div]:flex-1 [&_.ProseMirror_ul[data-type=taskList]_li>label]:mr-0 [&_.ProseMirror_ul[data-type=taskList]_li>label]:mt-1 [&_.ProseMirror_ul[data-type=taskList]_li[data-checked=true]>div]:text-slate-400 [&_.ProseMirror_ul[data-type=taskList]_li[data-checked=true]>div]:line-through [&_.ProseMirror_table]:my-2 [&_.ProseMirror_table]:w-full [&_.ProseMirror_table]:border-collapse [&_.ProseMirror_td]:border [&_.ProseMirror_td]:border-slate-300 [&_.ProseMirror_td]:px-2 [&_.ProseMirror_td]:py-1 [&_.ProseMirror_th]:border [&_.ProseMirror_th]:border-slate-300 [&_.ProseMirror_th]:bg-slate-50 [&_.ProseMirror_th]:px-2 [&_.ProseMirror_th]:py-1 [&_.ProseMirror_img]:max-w-full [&_.ProseMirror_img]:rounded ${
            isExpanded
              ? "[&_.ProseMirror]:min-h-[124px]"
              : "[&_.ProseMirror]:min-h-[52px]"
          }`}
        />

        {isExpanded && (
          <div className="flex items-center gap-2 border-t border-slate-200 bg-white px-4 py-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isEmpty || submitting}
              className={`rounded-sm px-3 py-1.5 text-sm font-medium text-white transition-colors ${
                isEmpty || submitting
                  ? "cursor-not-allowed bg-blue-300"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {submitting ? "Saving..." : submitLabel}
            </button>
            {showCancel && (
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-sm px-3 py-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                Cancel
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
