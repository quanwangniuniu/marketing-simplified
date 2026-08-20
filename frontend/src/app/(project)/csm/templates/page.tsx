'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { OrganisationAPI } from '@/lib/api/organisationAPI';
import api from '@/lib/api';
import { QuickReplyTemplateAPI, TemplateTagAPI } from '@/lib/api/csmConversationApi';
import type { QuickReplyTemplate, QuickReplyTemplateHistory, TemplateTag } from '@/types/csmConversation';
import FilterDropdown from '@/components/ui/FilterDropdown';
import { useBuildUrl } from '@/lib/buildUrl';

interface TeamOption { id: number; name: string; }
import { Plus, Pencil, Trash2, Tag, Search, X, History, ChevronDown, ChevronUp, Bold, Italic, List, ListOrdered, Building2, LayoutTemplate, Users, Globe, Check, Settings2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// TagInput — chip-style tag editor with suggestions
// ---------------------------------------------------------------------------
function TagInput({
  value,
  onChange,
  suggestions,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions: string[];
}) {
  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = (tag: string) => {
    const trimmed = tag.trim().toLowerCase();
    // Tags are an admin-managed allowlist: only accept entries in the vocabulary.
    if (!trimmed || value.includes(trimmed) || !suggestions.includes(trimmed)) return;
    onChange([...value, trimmed]);
    setInput('');
    setShowSuggestions(false);
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((t) => t !== tag));
  };

  const filteredSuggestions = suggestions.filter(
    (s) => s.includes(input.toLowerCase()) && !value.includes(s)
  );

  return (
    <div className="relative">
      <div
        onClick={() => inputRef.current?.focus()}
        className="min-h-[38px] flex flex-wrap gap-1 p-2 rounded-lg border border-gray-200 bg-white cursor-text focus-within:border-[#3CCED7]"
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-[#3CCED7]/15 text-[#1a9ba3] rounded-full"
          >
            <Tag size={10} />
            {tag}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
              className="text-[#3CCED7] hover:text-[#1a9ba3] leading-none"
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => { setInput(e.target.value); setShowSuggestions(true); }}
          onKeyDown={(e) => {
            // Ignore Enter/comma while an IME composition is in progress (e.g.
            // confirming a pinyin candidate for English text) — otherwise the
            // tag gets committed with the composition's in-progress spacing
            // (e.g. "ye s" instead of "yes").
            if (e.nativeEvent.isComposing) return;
            if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
              e.preventDefault();
              addTag(input);
            } else if (e.key === 'Backspace' && !input && value.length > 0) {
              removeTag(value[value.length - 1]);
            }
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder={value.length === 0 ? 'Add tags… (Enter or comma to add)' : ''}
          className="flex-1 min-w-[80px] text-xs outline-none bg-transparent placeholder-gray-300"
        />
      </div>
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-md max-h-32 overflow-y-auto">
          {filteredSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={() => addTag(s)}
              className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-[#3CCED7]/15 hover:text-[#1a9ba3]"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RichTextEditor — simple Tiptap editor for template body
// ---------------------------------------------------------------------------
function RichTextEditor({
  content,
  onChange,
  placeholder,
}: {
  content: string;
  onChange: (plain: string, json: object) => void;
  placeholder?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: placeholder ?? 'Write template content…' }),
    ],
    content,
    immediatelyRender: false,
    onUpdate({ editor }) {
      onChange(editor.getText(), editor.getJSON());
    },
  });

  if (!mounted) {
    return (
      <div className="rounded-lg border border-gray-200 min-h-[148px] bg-gray-50 animate-pulse" />
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 focus-within:border-[#3CCED7] overflow-hidden">
      {/* Mini toolbar */}
      <div className="flex items-center gap-1 px-2 py-1 border-b border-gray-100 bg-gray-50">
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleBold().run()}
          className={`p-1 rounded text-xs ${editor?.isActive('bold') ? 'bg-[#3CCED7]/25 text-[#1a9ba3]' : 'text-gray-500 hover:bg-gray-100'}`}
          title="Bold"
        >
          <Bold size={13} />
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          className={`p-1 rounded text-xs ${editor?.isActive('italic') ? 'bg-[#3CCED7]/25 text-[#1a9ba3]' : 'text-gray-500 hover:bg-gray-100'}`}
          title="Italic"
        >
          <Italic size={13} />
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          className={`p-1 rounded text-xs ${editor?.isActive('bulletList') ? 'bg-[#3CCED7]/25 text-[#1a9ba3]' : 'text-gray-500 hover:bg-gray-100'}`}
          title="Bullet list"
        >
          <List size={13} />
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          className={`p-1 rounded text-xs ${editor?.isActive('orderedList') ? 'bg-[#3CCED7]/25 text-[#1a9ba3]' : 'text-gray-500 hover:bg-gray-100'}`}
          title="Ordered list"
        >
          <ListOrdered size={13} />
        </button>
      </div>
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none px-3 py-2 text-sm text-gray-900 min-h-[120px] focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[100px]"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// HistoryModal — shows edit history for a template
// ---------------------------------------------------------------------------
function HistoryModal({
  template,
  onClose,
}: {
  template: QuickReplyTemplate;
  onClose: () => void;
}) {
  const [history, setHistory] = useState<QuickReplyTemplateHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    QuickReplyTemplateAPI.history(template.slug)
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [template.slug]);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm animate-in fade-in-0 duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col animate-in fade-in-0 zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="font-semibold text-gray-900">Edit History</h2>
            <p className="text-xs text-gray-400 mt-0.5">#{template.id} · {template.title}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />)}
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-10 text-sm text-gray-400">No edits recorded yet.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {history.map((entry) => (
                <div key={entry.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-800">{entry.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {entry.edited_by_name ?? 'Unknown'} · {fmt(entry.edited_at)}
                      </p>
                    </div>
                    {expandedId === entry.id ? (
                      <ChevronUp size={14} className="text-gray-400 shrink-0" />
                    ) : (
                      <ChevronDown size={14} className="text-gray-400 shrink-0" />
                    )}
                  </button>
                  {expandedId === entry.id && (
                    <div className="px-4 pb-3 border-t border-gray-100">
                      <p className="text-xs font-medium text-gray-500 mt-2 mb-1">Content snapshot:</p>
                      <p className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded p-2">
                        {entry.content}
                      </p>
                      {entry.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {entry.tags.map((tag) => (
                            <span key={tag} className="inline-flex items-center gap-0.5 text-xs px-2 py-0.5 bg-[#3CCED7]/15 text-[#1a9ba3] rounded-full font-medium">
                              <Tag size={8} />
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ---------------------------------------------------------------------------
// TemplateCard
// ---------------------------------------------------------------------------
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

// Wrap occurrences of `query` in <mark> for search-result highlighting.
function highlightMatch(text: string, query: string): React.ReactNode {
  const q = query.trim();
  if (!q) return text;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === q.toLowerCase() ? (
      <mark key={i} className="bg-[#A6E661]/60 text-gray-900 rounded-sm px-0.5">{part}</mark>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );
}

function TemplateCard({
  template,
  teamName,
  query = '',
  onEdit,
  onDelete,
  onHistory,
}: {
  template: QuickReplyTemplate;
  teamName?: string | null;
  query?: string;
  onEdit: (t: QuickReplyTemplate) => void;
  onDelete: (slug: string) => void;
  onHistory: (t: QuickReplyTemplate) => void;
}) {
  return (
    <div className="group bg-white rounded-xl border border-gray-200 p-4 hover:border-[#3CCED7]/50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col gap-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
      {/* Row 1: title + hover actions */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-gray-900 text-sm leading-snug flex-1 min-w-0">{highlightMatch(template.title, query)}</h3>
        <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onHistory(template)}
            className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-violet-500 hover:bg-violet-50 rounded-lg transition-colors"
            title="Edit history"
          >
            <History size={14} />
          </button>
          <button
            onClick={() => onEdit(template)}
            className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-[#1a9ba3] hover:bg-[#3CCED7]/15 rounded-lg transition-colors"
            title="Edit"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => onDelete(template.slug)}
            className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Row 2: content preview */}
      <p className="text-xs text-gray-500 line-clamp-3 leading-relaxed">{highlightMatch(template.content, query)}</p>

      {/* Row 3: tags */}
      {template.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {template.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-[#3CCED7]/15 text-[#1a9ba3] rounded-full font-medium"
            >
              <Tag size={9} />
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Row 4: scope badge + author/date */}
      <div className="flex items-center justify-between gap-2 pt-2 mt-auto border-t border-gray-100">
        <span
          className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
            template.team ? 'bg-amber-50 text-amber-600' : 'bg-[#3CCED7]/15 text-[#1a9ba3]'
          }`}
        >
          {template.team ? <Users size={9} /> : <Globe size={9} />}
          {template.team ? (teamName ? `Team: ${teamName}` : 'Team only') : 'Workspace-wide'}
        </span>
        {template.created_by_name && (
          <span className="text-[10px] text-gray-400 truncate" title={`Created by ${template.created_by_name}`}>
            by {template.created_by_name} · {fmtDate(template.created_at)}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TeamSelect — full-width, non-native dropdown matching the modal's fields
// ---------------------------------------------------------------------------
function TeamSelect({
  value,
  onChange,
  teams,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  teams: TeamOption[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const selected = value !== null ? teams.find((t) => t.id === value) : null;
  const options: { id: number | null; name: string }[] = [
    { id: null, name: 'All agents' },
    ...teams.map((t) => ({ id: t.id as number | null, name: t.name })),
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Visible to team"
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm text-left bg-white outline-none focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/20 transition"
      >
        <span className={selected ? 'text-gray-900' : 'text-gray-500'}>{selected ? selected.name : 'All agents'}</span>
        <ChevronDown size={15} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-full max-h-48 overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg" role="listbox">
          {options.map((opt) => {
            const isSel = opt.id === value;
            return (
              <button
                key={opt.id ?? 'all'}
                type="button"
                role="option"
                aria-selected={isSel}
                onClick={() => { onChange(opt.id); setOpen(false); }}
                className={`w-full flex items-center justify-between px-3 py-1.5 text-sm text-left transition-colors ${
                  isSel ? 'bg-[#3CCED7]/10 text-[#0f757a]' : 'text-gray-700 hover:bg-[#3CCED7]/15'
                }`}
              >
                <span>{opt.name}</span>
                {isSel && <Check size={14} className="text-[#3CCED7]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TemplateModal — create / edit with Tiptap, team selector, chip tags
// ---------------------------------------------------------------------------
interface TemplateFormState {
  title: string;
  content: string;
  rich_body: object | null;
  tags: string[];
  team: number | null;
}

function TemplateModal({
  open,
  initial,
  orgId,
  teams,
  managedTags,
  onClose,
  onSaved,
}: {
  open: boolean;
  initial: QuickReplyTemplate | null;
  orgId: number;
  teams: TeamOption[];
  managedTags: string[];
  onClose: () => void;
  onSaved: (t: QuickReplyTemplate) => void;
}) {
  const [form, setForm] = useState<TemplateFormState>({
    title: '', content: '', rich_body: null, tags: [], team: null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(
        initial
          ? {
              title: initial.title,
              content: initial.content,
              rich_body: initial.rich_body,
              tags: initial.tags,
              team: initial.team,
            }
          : { title: '', content: '', rich_body: null, tags: [], team: null }
      );
      setError(null);
    }
  }, [open, initial]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      setError('Title and content are required.');
      return;
    }
    if (form.tags.length === 0) {
      setError('Please add at least one tag.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let saved: QuickReplyTemplate;
      const payload = {
        title: form.title.trim(),
        content: form.content.trim(),
        rich_body: form.rich_body,
        tags: form.tags,
        team: form.team,
      };
      if (initial) {
        saved = await QuickReplyTemplateAPI.update(initial.slug, payload);
      } else {
        saved = await QuickReplyTemplateAPI.create({ organisation: orgId, ...payload });
      }
      onSaved(saved);
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm animate-in fade-in-0 duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col animate-in fade-in-0 zoom-in-95 duration-200">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="font-semibold text-gray-900">{initial ? 'Edit Template' : 'New Template'}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{initial ? `Editing #${initial.id}` : 'Fill in the details below'}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Modal body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex flex-col gap-5 px-6 py-5 overflow-y-auto flex-1">
            {/* Title */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Title <span className="text-red-400">*</span></label>
              <input
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="e.g. Welcome Greeting, Refund Policy…"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/20 transition"
              />
            </div>

            {/* Rich-text content */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Content <span className="text-red-400">*</span></label>
              <RichTextEditor
                content={form.content}
                onChange={(plain, json) => setForm((p) => ({ ...p, content: plain, rich_body: json }))}
                placeholder="The reply text that will be inserted into the composer…"
              />
            </div>

            {/* Team scoping */}
            {teams.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Visible to team <span className="font-normal text-gray-400 ml-1">(leave blank = all agents)</span>
                </label>
                <TeamSelect
                  value={form.team}
                  onChange={(v) => setForm((p) => ({ ...p, team: v }))}
                  teams={teams}
                />
              </div>
            )}

            {/* Tags */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Tags <span className="text-red-400">*</span>
                <span className="font-normal text-gray-400 ml-1">(at least one, press Enter to confirm)</span>
              </label>
              <TagInput
                value={form.tags}
                onChange={(tags) => setForm((p) => ({ ...p, tags }))}
                suggestions={managedTags}
              />
            </div>

            {error && (
              <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
            )}
          </div>

          {/* Modal footer */}
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium bg-[#1a9ba3] text-white rounded-lg hover:bg-[#15848b] disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : initial ? 'Save Changes' : 'Create Template'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
function TemplatesPageContent() {
  const buildUrl = useBuildUrl();
  const [adminOrgs, setAdminOrgs] = useState<{ id: number; name: string }[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(true);
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  const [templates, setTemplates] = useState<QuickReplyTemplate[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<QuickReplyTemplate | null>(null);
  const [historyTarget, setHistoryTarget] = useState<QuickReplyTemplate | null>(null);
  const [managedTags, setManagedTags] = useState<TemplateTag[]>([]);
  const [showTagManager, setShowTagManager] = useState(false);
  const [newTagName, setNewTagName] = useState('');

  // Load orgs on mount
  useEffect(() => {
    OrganisationAPI.myAdminOrgs()
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : [];
        setAdminOrgs(data);
        if (data.length > 0) setSelectedOrgId(data[0].id);
      })
      .catch(() => {})
      .finally(() => setOrgsLoading(false));
  }, []);

  // Load teams for scoping selector
  useEffect(() => {
    api.get<TeamOption[]>('/api/teams/')
      .then((res) => setTeams(Array.isArray(res.data) ? res.data : (res.data as { results?: TeamOption[] })?.results ?? []))
      .catch(() => setTeams([]));
  }, []);

  // Load templates when org changes
  const loadTemplates = useCallback(async () => {
    if (!selectedOrgId) return;
    setLoading(true);
    try {
      const data = await QuickReplyTemplateAPI.list({ organisation: selectedOrgId });
      setTemplates(data);
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [selectedOrgId]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Load managed tags when org changes
  const loadManagedTags = useCallback(async () => {
    if (!selectedOrgId) return;
    try {
      const data = await TemplateTagAPI.list({ organisation: selectedOrgId });
      setManagedTags(data);
    } catch {
      setManagedTags([]);
    }
  }, [selectedOrgId]);

  useEffect(() => {
    loadManagedTags();
  }, [loadManagedTags]);

  // Collect all tags from loaded templates (for suggestions + filter)
  // Merge managed tags with any free-text tags already on templates
  const managedTagNames = managedTags.map((t) => t.name);
  const allTags = Array.from(new Set([...managedTagNames, ...templates.flatMap((t) => t.tags)])).sort();

  // Client-side filter
  const filtered = templates.filter((t) => {
    const matchesSearch =
      !search ||
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.content.toLowerCase().includes(search.toLowerCase());
    const matchesTag = !filterTag || t.tags.includes(filterTag);
    return matchesSearch && matchesTag;
  });

  const handleEdit = (t: QuickReplyTemplate) => {
    setEditTarget(t);
    setModalOpen(true);
  };

  const handleDelete = async (slug: string) => {
    if (!confirm('Delete this template?')) return;
    try {
      await QuickReplyTemplateAPI.remove(slug);
      setTemplates((prev) => prev.filter((t) => t.slug !== slug));
    } catch {
      alert('Failed to delete.');
    }
  };

  const handleAddTag = async () => {
    if (!newTagName.trim() || !selectedOrgId) return;
    try {
      const tag = await TemplateTagAPI.create({ organisation: selectedOrgId, name: newTagName.trim() });
      setManagedTags((prev) => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)));
      setNewTagName('');
    } catch {
      alert('Tag already exists or could not be created.');
    }
  };

  const handleRemoveTag = async (id: number) => {
    try {
      await TemplateTagAPI.remove(id);
      setManagedTags((prev) => prev.filter((t) => t.id !== id));
    } catch {
      alert('Failed to delete tag.');
    }
  };

  const handleSaved = (saved: QuickReplyTemplate) => {
    setTemplates((prev) => {
      const idx = prev.findIndex((t) => t.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    setModalOpen(false);
    setEditTarget(null);
  };

  return (
    <ProtectedRoute>
      <DashboardLayout hideRightPanel>
        <div className="max-w-4xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-[#3CCED7] to-[#A6E661]">
                <LayoutTemplate className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Quick Reply Templates</h1>
                <p className="text-xs text-gray-400 mt-0.5">Pre-written replies agents can insert into the composer</p>
              </div>
            </div>
            <button
              onClick={() => { setEditTarget(null); setModalOpen(true); }}
              disabled={!selectedOrgId}
              title={!selectedOrgId ? 'You must be an admin of a customer-service organisation to create templates' : undefined}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-[#1a9ba3] text-white rounded-lg hover:bg-[#15848b] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus size={15} />
              New Template
            </button>
            {selectedOrgId && (
              <button
                onClick={() => setShowTagManager((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border rounded-lg transition-colors ${
                  showTagManager
                    ? 'bg-[#3CCED7]/15 text-[#1a9ba3] border-[#3CCED7]'
                    : 'text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                <Settings2 size={15} />
                Manage Tags
              </button>
            )}
          </div>

          {/* Org selector + filters */}
          <div className="flex flex-wrap gap-3 mb-6">
            {adminOrgs.length > 1 && (
              <FilterDropdown
                label="Organisation"
                value={selectedOrgId !== null ? String(selectedOrgId) : ''}
                onChange={(v) => setSelectedOrgId(Number(v))}
                options={adminOrgs.map((o) => ({ id: String(o.id), name: o.name }))}
              />
            )}
            {adminOrgs.length === 1 && (
              <div className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg">
                <Building2 size={14} className="text-gray-400" />
                {adminOrgs[0].name}
              </div>
            )}

            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search templates…"
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#3CCED7]"
              />
            </div>

            {allTags.length > 0 && (
              <FilterDropdown
                label="Tag"
                placeholder="All tags"
                value={filterTag}
                onChange={setFilterTag}
                options={[{ id: '', name: 'All tags' }, ...allTags.map((tag) => ({ id: tag, name: tag }))]}
              />
            )}
          </div>

          {/* Tag management panel */}
          {showTagManager && selectedOrgId && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 animate-in fade-in-0 slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">Tag Management</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Create and manage tags that agents can use when creating templates.</p>
                </div>
                <button onClick={() => setShowTagManager(false)} className="p-1 text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              </div>
              <div className="flex gap-2 mb-3">
                <input
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
                  placeholder="New tag name…"
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-[#3CCED7]"
                />
                <button
                  onClick={handleAddTag}
                  disabled={!newTagName.trim()}
                  className="px-3 py-1.5 text-sm font-medium bg-[#1a9ba3] text-white rounded-lg hover:bg-[#15848b] disabled:opacity-40 transition-colors"
                >
                  Add
                </button>
              </div>
              {managedTags.length === 0 ? (
                <p className="text-xs text-gray-400">No managed tags yet. Add your first tag above.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {managedTags.map((tag) => (
                    <span
                      key={tag.id}
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-[#3CCED7]/15 text-[#1a9ba3] rounded-full font-medium group/tag"
                    >
                      <Tag size={10} />
                      {tag.name}
                      <button
                        onClick={() => handleRemoveTag(tag.id)}
                        className="ml-0.5 text-[#3CCED7] hover:text-red-500 opacity-0 group-hover/tag:opacity-100 transition-opacity"
                        title="Delete tag"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Template grid */}
          {!orgsLoading && adminOrgs.length === 0 ? (
            <div className="flex flex-col items-center text-center py-16 px-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#3CCED7]/15 mb-4">
                <Building2 className="h-6 w-6 text-[#1a9ba3]" />
              </div>
              <h3 className="text-sm font-semibold text-gray-800 mb-1">No customer-service organisation yet</h3>
              <p className="text-sm text-gray-500 max-w-sm mb-5">
                Quick reply templates belong to a customer-service organisation. Create one — or ask an
                administrator to add you to theirs — before you can add templates.
              </p>
              <a
                href={buildUrl('/csm?tab=organisations')}
                className="px-5 py-2.5 text-sm font-medium bg-[#1a9ba3] text-white rounded-lg hover:bg-[#15848b]"
              >
                Go to Organisations
              </a>
            </div>
          ) : (orgsLoading || loading) ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-36 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-400 text-sm mb-4">
                {search || filterTag ? 'No templates match your filter.' : 'No templates yet.'}
              </p>
              {!search && !filterTag && selectedOrgId && (
                <button
                  onClick={() => { setEditTarget(null); setModalOpen(true); }}
                  className="px-5 py-2.5 text-sm font-medium bg-[#1a9ba3] text-white rounded-lg hover:bg-[#15848b]"
                >
                  Create your first template
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((t) => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  teamName={t.team ? (teams.find((tm) => tm.id === t.team)?.name ?? null) : null}
                  query={search}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onHistory={setHistoryTarget}
                />
              ))}
            </div>
          )}
        </div>

        {/* Template create/edit modal */}
        {selectedOrgId && (
          <TemplateModal
            open={modalOpen}
            initial={editTarget}
            orgId={selectedOrgId}
            teams={teams}
            managedTags={managedTagNames}
            onClose={() => { setModalOpen(false); setEditTarget(null); }}
            onSaved={handleSaved}
          />
        )}

        {/* History modal */}
        {historyTarget && (
          <HistoryModal
            template={historyTarget}
            onClose={() => setHistoryTarget(null)}
          />
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}

export default TemplatesPageContent;
