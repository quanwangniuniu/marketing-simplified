'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  AlertCircle,
  Circle,
  CheckCircle2,
  Copy,
  ExternalLink,
  Check,
  Loader2,
  Plus,
  Trash2,
  CalendarDays,
  Handshake,
  Sunrise,
  RefreshCw,
  Rocket,
  Search,
  FileSpreadsheet,
  Scale,
  ListTodo,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import Layout from '@/components/layout/Layout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

import { MeetingGeneratedKnowledgeSection } from '@/components/meetings/MeetingGeneratedKnowledgeSection';
import { ZoomPostMeetingSection } from '@/components/meetings/ZoomPostMeetingSection';

import { MeetingHeader } from '@/components/meetings/meeting-header';
import { AgendaSection } from '@/components/meetings/agenda-section';
import {
  AgendaBlockWithOutlineRail,
  meetingAgendaItemDomId,
  meetingAgendaSectionDomId,
} from '@/components/meetings/AgendaTOC';
import { ArtifactsSection } from '@/components/meetings/artifacts-section';
import { SortableBlock } from '@/components/meetings/SortableBlock';
import { CustomBlock } from '@/components/meetings/CustomBlock';
import { TemplateSidebar } from '@/components/meetings/TemplateSidebar';
import type { SidebarTemplate } from '@/components/meetings/TemplateSidebar';

import { formatProjectMemberLabel } from '@/components/meetings/projectMemberLabel';
import { DecisionAPI } from '@/lib/api/decisionApi';
import { TaskAPI } from '@/lib/api/taskApi';
import { SpreadsheetAPI } from '@/lib/api/spreadsheetApi';
import { MeetingsAPI } from '@/lib/api/meetingsApi';
import type { TaskData } from '@/types/task';
import {
  isKnownMeetingArtifactKind,
  meetingArtifactHref,
  normalizeMeetingArtifactType,
  type MeetingArtifactResourceIndex,
} from '@/lib/meetings/artifactLinks';
import { hasVisibleText, sanitizeDocumentPreviewHtml } from '@/lib/meetings/documentPreview';
import type { AgendaItem, ArtifactLink, Meeting, MeetingDocument, ParticipantLink } from '@/types/meeting';
import { ProjectAPI, type ProjectData, type ProjectMemberData } from '@/lib/api/projectApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import AutoResizeTextarea from '@/components/ui/AutoResizeTextarea';
import {
  meetingDateToInput,
  meetingTimeToInput,
  normalizeTimeForApi,
} from '@/lib/meetingSchedule';
import { getNestedTemplateForMeetingType, getTemplateForMeetingType, type NestedAgendaTemplateSection } from '@/lib/meetings/meetingTemplates';
import { MEETING_TYPE_OPTIONS, type MeetingTypeOptionValue } from '@/lib/meetings/meetingTypes';
import { DEFAULT_MEETING_WORKSPACE_BLOCKS } from '@/lib/meetings/defaultMeetingWorkspace';
import {
  customTemplateMeetingTypeValue,
  isCustomTemplateMeetingType,
} from '@/lib/meetings/unifiedMeetingTemplates';

const normalizeNumberParam = (value: unknown) => {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') return NaN;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : NaN;
};

type WorkspaceBlockType = 'header' | 'agenda' | 'participants' | 'artifacts' | 'custom_block';
type WorkspaceBlock = {
  id: string;
  type: WorkspaceBlockType;
  title?: string;
  content?: string;
};
type NestedSection = NestedAgendaTemplateSection;

function workspaceBlockOverline(block: WorkspaceBlock): string {
  switch (block.type) {
    case 'header':
      return 'Header';
    case 'agenda':
      return 'Agenda';
    case 'participants':
      return 'Participants';
    case 'artifacts':
      return 'Artifacts';
    case 'custom_block':
      return block.title?.trim() || 'Custom Block';
    default:
      return 'Block';
  }
}

const DEFAULT_WORKSPACE_BLOCKS = DEFAULT_MEETING_WORKSPACE_BLOCKS as WorkspaceBlock[];

function parseMeetingLayoutConfig(raw: unknown): {
  blocks: WorkspaceBlock[];
  nestedSections: NestedSection[] | null;
} {
  if (raw == null) {
    return { blocks: [], nestedSections: null };
  }
  if (Array.isArray(raw)) {
    return { blocks: raw as WorkspaceBlock[], nestedSections: null };
  }
  if (typeof raw === 'object') {
    const o = raw as { blocks?: unknown; nestedSections?: unknown };
    const blocks = Array.isArray(o.blocks) ? (o.blocks as WorkspaceBlock[]) : [];
    const nestedSections = Array.isArray(o.nestedSections) ? (o.nestedSections as NestedSection[]) : null;
    return { blocks, nestedSections };
  }
  return { blocks: [], nestedSections: null };
}

const SYSTEM_TEMPLATE_SIDEBAR: Record<
  MeetingTypeOptionValue,
  { Icon: typeof CalendarDays; tint: string }
> = {
  Planning: { Icon: CalendarDays, tint: 'bg-blue-100 text-blue-600' },
  'Client Meeting': { Icon: Handshake, tint: 'bg-amber-100 text-amber-800' },
  'Stand-up': { Icon: Sunrise, tint: 'bg-orange-100 text-orange-700' },
  'Review & Retrospective': { Icon: RefreshCw, tint: 'bg-violet-100 text-violet-700' },
  'Deployment Sync': { Icon: Rocket, tint: 'bg-indigo-100 text-indigo-600' },
};

const PARTICIPANT_ROLE_OPTIONS = [
  { value: 'Meeting Owner', label: 'Meeting Owner', className: 'bg-purple-100 text-purple-800' },
  { value: 'Participant', label: 'Participant', className: 'bg-blue-100 text-blue-800' },
  { value: 'Reviewer', label: 'Reviewer', className: 'bg-orange-100 text-orange-800' },
  { value: 'Observer', label: 'Observer', className: 'bg-slate-100 text-slate-700' },
] as const;

const DEFAULT_PARTICIPANT_ROLE = 'Participant';

type ArtifactKind = 'decision' | 'task' | 'spreadsheet';

type ArtifactSearchHit = {
  kind: ArtifactKind;
  id: number;
  title: string;
  subtitle?: string;
};

function artifactModuleBadge(kind: ArtifactKind): { label: string; className: string } {
  switch (kind) {
    case 'spreadsheet':
      return { label: 'Spreadsheet', className: 'bg-emerald-100 text-emerald-800' };
    case 'decision':
      return { label: 'Decision', className: 'bg-amber-100 text-amber-800' };
    case 'task':
      return { label: 'Task', className: 'bg-blue-100 text-blue-800' };
  }
}

function ArtifactTypeIcon({ kind }: { kind: ArtifactKind }) {
  const cls = 'h-4 w-4 shrink-0';
  if (kind === 'spreadsheet') return <FileSpreadsheet className={cls} />;
  if (kind === 'decision') return <Scale className={cls} />;
  return <ListTodo className={cls} />;
}

function artifactRowTitle(link: ArtifactLink, index: MeetingArtifactResourceIndex): string {
  const t = normalizeMeetingArtifactType(link.artifact_type);
  const id = link.artifact_id;
  if (t === 'decision') {
    const d = index.decisions.find((x) => x.id === id);
    return d?.title?.trim() || `Decision #${id}`;
  }
  if (t === 'task') {
    const task = index.tasks.find((x) => x.id === id);
    const s = task?.summary?.trim();
    return s ? s.slice(0, 200) + (s.length > 200 ? '…' : '') : `Task #${id}`;
  }
  if (t === 'spreadsheet') {
    const s = index.spreadsheets.find((x) => x.id === id);
    return s?.name?.trim() || `Spreadsheet #${id}`;
  }
  return `${t || 'Artifact'} #${id}`;
}

function normalizeMeetingFromApi(m: Meeting): Meeting {
  return { ...m };
}

function SortableAgendaRow({
  item,
  isSaving,
  isDeleting,
  isPrioritySaving,
  draftValue,
  onDraftChange,
  onBlurSave,
  onDelete,
  onPriorityChange,
}: {
  item: AgendaItem;
  isSaving: boolean;
  isDeleting: boolean;
  isPrioritySaving: boolean;
  draftValue: string;
  onDraftChange: (next: string) => void;
  onBlurSave: () => void;
  onDelete: () => void;
  onPriorityChange: (next: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  } as React.CSSProperties;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center justify-between gap-3 rounded-xl border bg-white px-3 py-2 ${
        item.is_priority ? 'border-amber-200 bg-amber-50/30' : 'border-gray-100'
      } ${isDragging ? 'opacity-70 shadow-sm ring-1 ring-blue-100' : ''}`}
    >
      {/* Use div (not button) as drag handle — nested buttons + dnd-kit + React can cause DOM/removeChild mismatches */}
      <div
        className="cursor-grab rounded-md p-1 text-gray-300 opacity-0 transition group-hover:opacity-100 active:cursor-grabbing"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        ≡
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Circle className="h-4 w-4 text-gray-300" />
        <AutoResizeTextarea
          value={draftValue}
          onChange={(e) => onDraftChange(e.currentTarget.value)}
          onBlur={onBlurSave}
          placeholder="Agenda item…"
          className="w-full rounded-md border border-transparent bg-transparent px-0 py-0.5 text-sm text-gray-700 focus:border-transparent focus:outline-none focus:ring-0"
        />
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <span className="min-w-[34px] text-right text-sm text-gray-400">{item.is_priority ? '10m' : '5m'}</span>
        <label className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap text-xs text-gray-600 select-none">
          <input
            type="checkbox"
            checked={item.is_priority}
            disabled={isDeleting || isPrioritySaving}
            onChange={(e) => onPriorityChange(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
          />
          <span className={item.is_priority ? 'font-medium text-amber-900' : 'text-gray-400'}>
            {isPrioritySaving ? '...' : 'Focus'}
          </span>
        </label>
        {isSaving ? (
          <span className="text-xs text-gray-500">Saving…</span>
        ) : (
          <span className="text-xs text-gray-300" aria-hidden="true">
            <Check className="h-3 w-3" />
          </span>
        )}
        <button
          type="button"
          onClick={onDelete}
          disabled={isDeleting}
          className="rounded-md p-2 text-gray-500 hover:bg-gray-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Delete agenda item"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function SortableNestedSection({
  section,
  scrollAnchorId,
  isEditingTitle,
  onStartEditTitle,
  onSaveTitle,
  onDeleteSection,
  children,
}: {
  section: NestedSection;
  /** DOM id for outline scroll / scroll-spy (e.g. meetingAgendaSectionDomId). */
  scrollAnchorId: string;
  isEditingTitle: boolean;
  onStartEditTitle: () => void;
  onSaveTitle: (title: string) => void;
  onDeleteSection: () => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, attributes, listeners, transform, transition } = useSortable({
    id: `section:${section.id}`,
    transition: {
      duration: 200,
      easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
    },
  });

  return (
    <div
      id={scrollAnchorId}
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="group/section scroll-mt-32 p-1"
    >
      <div className="mb-3 flex w-full items-center gap-2 text-sm font-bold tracking-wider text-black uppercase">
        <button
          type="button"
          className="relative z-10 cursor-grab rounded p-1 text-gray-300 opacity-0 transition-opacity group-hover/section:opacity-100 hover:text-gray-500 active:cursor-grabbing"
          {...(attributes as React.HTMLAttributes<HTMLButtonElement>)}
          {...listeners}
          aria-label="Drag section"
        >
          ⠿
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {isEditingTitle ? (
            <input
              autoFocus
              defaultValue={section.title}
              onBlur={(e) => onSaveTitle(e.currentTarget.value.trim() || 'New Section')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
              }}
              className="min-w-0 flex-1 bg-transparent text-sm font-bold text-black outline-none"
            />
          ) : (
            <button type="button" onClick={onStartEditTitle} className="min-w-0 flex-1 text-left text-sm font-bold text-black">
              {section.title}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onDeleteSection}
          className="shrink-0 rounded-md p-1.5 text-gray-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover/section:opacity-100"
          aria-label="Delete section and all items"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {children}
    </div>
  );
}

function SortableNestedItem({
  sectionId,
  item,
  onToggle,
  onTextChange,
  onDurationChange,
  onDelete,
}: {
  sectionId: string;
  item: NestedSection['items'][number];
  onToggle: () => void;
  onTextChange: (text: string) => void;
  onDurationChange: (duration: string) => void;
  onDelete: () => void;
}) {
  const { setNodeRef, attributes, listeners, transform, transition } = useSortable({
    id: `item:${item.id}`,
    transition: {
      duration: 200,
      easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
    },
  });
  const [editingText, setEditingText] = useState(false);
  const [editingDuration, setEditingDuration] = useState(false);

  return (
    <div
      id={meetingAgendaItemDomId(sectionId, item.id)}
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="group/item flex scroll-mt-32 items-center gap-1.5 px-0.5 py-0.5"
      data-section-id={sectionId}
    >
      <button
        type="button"
        className="relative z-10 cursor-grab rounded p-1 text-gray-300 opacity-0 transition-opacity group-hover/item:opacity-100 hover:text-gray-500 active:cursor-grabbing"
        {...(attributes as React.HTMLAttributes<HTMLButtonElement>)}
        {...listeners}
        aria-label="Drag item"
      >
        ⠿
      </button>
      <button type="button" onClick={onToggle} className="text-gray-400 hover:text-gray-600" aria-label="Toggle complete">
        {item.completed ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Circle className="h-4 w-4 text-gray-400" />}
      </button>
      {editingText ? (
        <input
          autoFocus
          value={item.text}
          onChange={(e) => onTextChange(e.target.value)}
          onBlur={() => setEditingText(false)}
          className={`min-w-0 flex-1 border-none bg-transparent px-1 py-0.5 text-sm outline-none ${
            item.completed ? 'line-through text-slate-400' : 'text-slate-700'
          }`}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditingText(true)}
          className={`min-w-0 flex-1 px-1 py-0.5 text-left text-sm ${
            item.completed ? 'line-through text-slate-400' : 'text-slate-700'
          }`}
        >
          {item.text || 'Empty item'}
        </button>
      )}
      {editingDuration ? (
        <input
          autoFocus
          value={item.duration}
          onChange={(e) => onDurationChange(e.target.value)}
          onBlur={() => setEditingDuration(false)}
          className="w-12 border-none bg-transparent px-1 py-0.5 text-right text-xs text-gray-500 outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditingDuration(true)}
          className="w-12 text-right text-xs text-gray-400"
        >
          {item.duration}
        </button>
      )}
      <button
        type="button"
        onClick={onDelete}
        className="shrink-0 rounded-md p-1 text-gray-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover/item:opacity-100"
        aria-label="Delete agenda item"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function MeetingWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const projectId = normalizeNumberParam(params?.projectId);
  const meetingId = normalizeNumberParam(params?.meetingId);

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);
  const [participants, setParticipants] = useState<ParticipantLink[]>([]);
  const [artifacts, setArtifacts] = useState<ArtifactLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newAgendaText, setNewAgendaText] = useState('');
  const [newAgendaPriority, setNewAgendaPriority] = useState(false);
  const [addingAgenda, setAddingAgenda] = useState(false);
  const [agendaDrafts, setAgendaDrafts] = useState<Record<number, string>>({});
  const [savingAgendaIds, setSavingAgendaIds] = useState<Set<number>>(new Set());
  const [savingAgendaPriorityIds, setSavingAgendaPriorityIds] = useState<Set<number>>(new Set());
  const [deletingAgendaIds, setDeletingAgendaIds] = useState<Set<number>>(new Set());
  const saveTimersRef = useRef<Record<number, number | null>>({});

  const [projectMembers, setProjectMembers] = useState<ProjectMemberData[]>([]);
  const [project, setProject] = useState<ProjectData | null>(null);
  const [participantDropdownOpen, setParticipantDropdownOpen] = useState(false);
  const [participantSearchMode, setParticipantSearchMode] = useState(false);
  const [participantSearchText, setParticipantSearchText] = useState('');
  const [addingParticipant, setAddingParticipant] = useState(false);
  const [savingParticipantIds, setSavingParticipantIds] = useState<Set<number>>(new Set());
  const [removingParticipantIds, setRemovingParticipantIds] = useState<Set<number>>(new Set());

  const [artifactResources, setArtifactResources] = useState<MeetingArtifactResourceIndex>({
    decisions: [],
    tasks: [],
    spreadsheets: [],
  });
  const [artifactResourcesLoading, setArtifactResourcesLoading] = useState(false);
  const [addingArtifact, setAddingArtifact] = useState(false);
  const [artifactDropdownOpen, setArtifactDropdownOpen] = useState(false);
  const [artifactSearchMode, setArtifactSearchMode] = useState(false);
  const [artifactSearchText, setArtifactSearchText] = useState('');
  const [removingArtifactIds, setRemovingArtifactIds] = useState<Set<number>>(new Set());

  const [schedDateDraft, setSchedDateDraft] = useState('');
  const [schedTimeDraft, setSchedTimeDraft] = useState('');
  const [extRefDraft, setExtRefDraft] = useState('');
  const [savingMeetingMeta, setSavingMeetingMeta] = useState(false);
  const [meetingTypeSaving, setMeetingTypeSaving] = useState(false);
  const [isAgendaDragging, setIsAgendaDragging] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [templateDirty, setTemplateDirty] = useState(false);
  const [nestedSections, setNestedSections] = useState<NestedSection[]>([]);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [activeSectionDragId, setActiveSectionDragId] = useState<string | null>(null);
  const [activeItemDragId, setActiveItemDragId] = useState<string | null>(null);

  /** Isolated sensors for nested agenda DnD (avoids cross-talk with AgendaTOC outline DndContext). */
  const agendaNestedSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const [layoutSaving, setLayoutSaving] = useState(false);
  const [layoutSaveFeedback, setLayoutSaveFeedback] = useState<'idle' | 'saving' | 'saved'>('idle');
  const layoutSavedTimerRef = useRef<number | null>(null);
  type WorkspaceSnapshot = { blocks: WorkspaceBlock[]; nestedSections: NestedSection[] };
  const [workspaceBaseline, setWorkspaceBaseline] = useState<WorkspaceSnapshot | null>(null);

  const [customTemplates, setCustomTemplates] = useState<SidebarTemplate[]>([]);

  const templateLibrary = useMemo(
    () =>
      MEETING_TYPE_OPTIONS.map((opt) => {
        const { Icon, tint } = SYSTEM_TEMPLATE_SIDEBAR[opt.value];
        const sections = getNestedTemplateForMeetingType(opt.value);
        const itemCount = getTemplateForMeetingType(opt.value).length;
        return {
          id: opt.value,
          meetingType: opt.value,
          name: opt.label,
          meta: `${sections.length} sections • ${itemCount} items`,
          icon: <Icon className="h-4 w-4" aria-hidden />,
          tint,
        };
      }),
    [],
  );

  const templateList = useMemo<SidebarTemplate[]>(
    () => [...templateLibrary, ...customTemplates],
    [templateLibrary, customTemplates],
  );

  const meetingTypePickerOptions = useMemo(
    () =>
      templateList.map((t) => ({
        value: t.meetingType ?? customTemplateMeetingTypeValue(t.id),
        label: t.name,
      })),
    [templateList],
  );

  const [blocks, setBlocks] = useState<WorkspaceBlock[]>(DEFAULT_WORKSPACE_BLOCKS);

  const blocksRef = useRef(blocks);
  const nestedRef = useRef(nestedSections);
  blocksRef.current = blocks;
  nestedRef.current = nestedSections;

  const hydratedNestedFromLayoutRef = useRef(false);
  const skipLayoutPersistRef = useRef(true);
  const layoutPersistTimerRef = useRef<number | null>(null);
  const lastPersistedLayoutJsonRef = useRef<string | null>(null);
  const [documentPreviewHtml, setDocumentPreviewHtml] = useState('');

  const orderedAgenda = useMemo(() => {
    const list = Array.isArray(agendaItems) ? agendaItems : [];
    return [...list].sort((a, b) => a.order_index - b.order_index || a.id - b.id);
  }, [agendaItems]);

  const layoutStorageKey = useMemo(
    () =>
      Number.isFinite(projectId) && Number.isFinite(meetingId)
        ? `meeting-workspace-layout:${projectId}:${meetingId}`
        : null,
    [projectId, meetingId],
  );

  useEffect(() => {
    if (!meeting || !layoutStorageKey) return;
    lastPersistedLayoutJsonRef.current = null;
    const raw = meeting.layout_config;
    let { blocks: nextBlocks, nestedSections: fromApiNested } = parseMeetingLayoutConfig(raw);
    let localNested: NestedSection[] | null = null;

    if (nextBlocks.length === 0 && typeof window !== 'undefined') {
      const saved = window.localStorage.getItem(layoutStorageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object' && Array.isArray(parsed.blocks)) {
            nextBlocks = parsed.blocks as WorkspaceBlock[];
            if (Array.isArray(parsed.nestedSections)) {
              localNested = parsed.nestedSections as NestedSection[];
            }
          } else if (Array.isArray(parsed)) {
            nextBlocks = parsed as WorkspaceBlock[];
          }
        } catch {
          // ignore malformed local layout
        }
      }
    }

    if (nextBlocks.length === 0) {
      nextBlocks = DEFAULT_WORKSPACE_BLOCKS;
    }

    setBlocks(nextBlocks);

    if (fromApiNested !== null) {
      setNestedSections(fromApiNested);
      hydratedNestedFromLayoutRef.current = true;
    } else if (localNested) {
      setNestedSections(localNested);
      hydratedNestedFromLayoutRef.current = true;
    } else {
      hydratedNestedFromLayoutRef.current = false;
    }
  }, [meeting?.id, layoutStorageKey]);

  const isLayoutDirty = useMemo(() => {
    if (!workspaceBaseline) return false;
    return (
      JSON.stringify({ blocks, nestedSections }) !== JSON.stringify(workspaceBaseline)
    );
  }, [blocks, nestedSections, workspaceBaseline]);

  useEffect(() => {
    if (!layoutStorageKey) return;
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(layoutStorageKey, JSON.stringify({ blocks, nestedSections }));
  }, [blocks, nestedSections, layoutStorageKey]);

  useEffect(() => {
    setAgendaDrafts((prev) => {
      const next: Record<number, string> = { ...prev };
      for (const item of orderedAgenda) {
        if (!(item.id in next)) next[item.id] = item.content ?? '';
      }
      for (const key of Object.keys(next)) {
        const id = Number(key);
        if (!Number.isFinite(id)) continue;
        if (!orderedAgenda.some((item) => item.id === id)) delete next[id];
      }
      return next;
    });
  }, [orderedAgenda]);

  useEffect(() => {
    if (activeTemplateId) return;
    if (hydratedNestedFromLayoutRef.current) return;
    if (nestedSections.length > 1) return;
    setNestedSections([
      {
        id: 'section-default',
        title: 'Agenda',
        items: orderedAgenda.map((item) => ({
          id: String(item.id),
          text: item.content ?? '',
          completed: false,
          duration: item.is_priority ? '10m' : '5m',
        })),
      },
    ]);
  }, [orderedAgenda, activeTemplateId, nestedSections.length]);

  const orderedParticipants = useMemo(() => {
    const list = Array.isArray(participants) ? participants : [];
    return [...list].sort((a, b) => (a.user ?? 0) - (b.user ?? 0) || a.id - b.id);
  }, [participants]);

  useEffect(() => {
    if (!meeting) return;
    setSchedDateDraft(meetingDateToInput(meeting.scheduled_date));
    setSchedTimeDraft(meetingTimeToInput(meeting.scheduled_time));
    setExtRefDraft(meeting.external_reference ?? '');
  }, [
    meeting?.id,
    meeting?.scheduled_date,
    meeting?.scheduled_time,
    meeting?.external_reference,
  ]);

  useEffect(() => {
    if (!projectId || Number.isNaN(projectId) || !meetingId || Number.isNaN(meetingId)) {
      setError('Project ID and Meeting ID are required');
      setProject(null);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        skipLayoutPersistRef.current = true;
        setLoading(true);
        setError(null);

        const [m, agenda, people, links, mems, p, doc] = await Promise.all([
          MeetingsAPI.getMeeting(projectId, meetingId),
          MeetingsAPI.listAgendaItems(projectId, meetingId),
          MeetingsAPI.listParticipants(projectId, meetingId),
          MeetingsAPI.listArtifacts(projectId, meetingId),
          ProjectAPI.getAllProjectMembers(projectId).catch(() => [] as ProjectMemberData[]),
          ProjectAPI.getProject(projectId).catch(() => null as ProjectData | null),
          MeetingsAPI.getMeetingDocument(projectId, meetingId).catch(() => null as MeetingDocument | null),
        ]);

        setMeeting(normalizeMeetingFromApi(m));
        setProject(p);
        setAgendaItems(Array.isArray(agenda) ? agenda : []);
        setParticipants(Array.isArray(people) ? people : []);
        setArtifacts(Array.isArray(links) ? links : []);
        setProjectMembers(
          Array.isArray(mems) ? mems.filter((row) => row.is_active) : [],
        );
        setDocumentPreviewHtml(doc?.content ? sanitizeDocumentPreviewHtml(doc.content) : '');
      } catch (err: unknown) {
        console.error('Failed to load meeting workspace:', err);
        setProject(null);
        setProjectMembers([]);
        setDocumentPreviewHtml('');
        const message =
          (err as { response?: { data?: { error?: string; detail?: string } }; message?: string })
            ?.response?.data?.error ||
          (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
          (err as { message?: string })?.message ||
          'Failed to load meeting workspace';
        setError(String(message));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [projectId, meetingId]);

  // After creating a task/decision in another tab or via bfcache back, refetch so generated_* links appear.
  useEffect(() => {
    if (!projectId || Number.isNaN(projectId) || !meetingId || Number.isNaN(meetingId)) {
      return;
    }
    let cancelled = false;
    const refreshMeeting = () => {
      MeetingsAPI.getMeeting(projectId, meetingId)
        .then((m) => {
          if (!cancelled) setMeeting(m);
        })
        .catch(() => {});
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshMeeting();
      }
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        refreshMeeting();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', onPageShow as EventListener);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', onPageShow as EventListener);
    };
  }, [projectId, meetingId]);

  // Meeting Type Sync: when opening a meeting, auto-apply the matching template agenda structure.
  // This ensures the initial editor state matches `meeting.meeting_type`.
  useEffect(() => {
    if (!meeting) return;
    if (!meeting.meeting_type) return;
    if (isCustomTemplateMeetingType(meeting.meeting_type)) return;
    if (activeTemplateId) return; // avoid overriding user/template interactions
    if (loading) return;
    void applyTemplateIfAgendaEmpty(meeting.meeting_type);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting?.id, loading]);

  // Load saved custom templates so the sidebar reflects persisted data.
  useEffect(() => {
    if (loading) return;
    void (async () => {
      try {
        const list = await MeetingsAPI.listMeetingTemplates();
        const normalized: SidebarTemplate[] = (Array.isArray(list) ? list : [])
          .map((tpl) => {
            const rawCfg = tpl.layout_config as any;

            // We only want templates created via "Configure Template" (layout_config = { blocks, nestedSections }).
            // Some built-in templates saved via "Save Changes" store layout_config as nestedSections array only.
            const cfgObj = rawCfg && typeof rawCfg === 'object' ? rawCfg : null;
            const hasBlocksArray = !!cfgObj && Array.isArray(cfgObj.blocks);
            const hasLegacyBlocksArray =
              Array.isArray(rawCfg) &&
              rawCfg.length > 0 &&
              rawCfg[0] &&
              typeof rawCfg[0] === 'object' &&
              'type' in rawCfg[0];

            if (!hasBlocksArray && !hasLegacyBlocksArray) return null;

            const blocks = hasBlocksArray ? (cfgObj.blocks as WorkspaceBlock[]) : (rawCfg as WorkspaceBlock[]);
            const meta = `${blocks.length} modules`;

            return {
              id: tpl.id,
              name: tpl.name,
              meta,
              layout_config: tpl.layout_config,
            } as SidebarTemplate;
          })
          .filter(Boolean) as SidebarTemplate[];

        setCustomTemplates(normalized);
      } catch (err) {
        // Ignore sidebar load failures; built-in templates still work.
        console.error('Failed to load custom meeting templates:', err);
      }
    })();
  }, [loading]);

  useEffect(() => {
    if (!Number.isFinite(projectId) || !meeting) {
      setArtifactResources({ decisions: [], tasks: [], spreadsheets: [] });
      setArtifactResourcesLoading(false);
      return;
    }

    let cancelled = false;
    setArtifactResourcesLoading(true);

    const load = async () => {
      try {
        const [dList, tRes, ssRes] = await Promise.all([
          DecisionAPI.listDecisions(projectId),
          TaskAPI.getTasks({ project_id: projectId }),
          SpreadsheetAPI.listSpreadsheets(projectId, { page_size: 200 }),
        ]);
        if (cancelled) return;
        const rawTasks = (tRes as { data?: { results?: TaskData[] } & TaskData[] }).data;
        const tasksList = Array.isArray(rawTasks?.results)
          ? rawTasks.results
          : Array.isArray(rawTasks)
            ? rawTasks
            : [];
        setArtifactResources({
          decisions: dList.items ?? [],
          tasks: tasksList,
          spreadsheets: ssRes.results ?? [],
        });
      } catch {
        if (!cancelled) {
          setArtifactResources({ decisions: [], tasks: [], spreadsheets: [] });
        }
      } finally {
        if (!cancelled) setArtifactResourcesLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [projectId, meeting?.id]);

  const getApiErrorMessage = (err: unknown, fallback: string) => {
    const anyErr = err as {
      response?: { data?: unknown };
      message?: string;
    };
    const data = anyErr?.response?.data as any;
    if (data?.error) return String(data.error);
    if (data?.detail) return String(data.detail);
    if (data && typeof data === 'object') {
      try {
        return JSON.stringify(data);
      } catch {
        // ignore
      }
    }
    return String(anyErr?.message || fallback);
  };

  const queuePersistWorkspaceLayout = () => {
    if (!Number.isFinite(projectId) || !Number.isFinite(meetingId)) return;
    if (skipLayoutPersistRef.current) return;
    if (layoutPersistTimerRef.current) window.clearTimeout(layoutPersistTimerRef.current);
    layoutPersistTimerRef.current = window.setTimeout(() => {
      layoutPersistTimerRef.current = null;
      void (async () => {
        try {
          const payload = {
            blocks: blocksRef.current,
            nestedSections: nestedRef.current,
          };
          const json = JSON.stringify({
            blocks: payload.blocks,
            nestedSections: payload.nestedSections,
          });
          if (json === lastPersistedLayoutJsonRef.current) return;
          const updated = await MeetingsAPI.patchMeeting(projectId, meetingId, {
            layout_config: payload,
          });
          lastPersistedLayoutJsonRef.current = json;
          setMeeting((prev) =>
            prev ? { ...prev, layout_config: updated.layout_config ?? payload } : null,
          );
        } catch (err: unknown) {
          toast.error(getApiErrorMessage(err, 'Failed to save workspace layout'));
        }
      })();
    }, 450);
  };

  const discardWorkspaceLayoutChanges = () => {
    if (!workspaceBaseline) return;
    setBlocks(JSON.parse(JSON.stringify(workspaceBaseline.blocks)));
    setNestedSections(JSON.parse(JSON.stringify(workspaceBaseline.nestedSections)));
  };

  /** `meeting_only` — PATCH meeting only. `meeting_and_template` — also PATCH saved template when a custom template is active. */
  type SaveLayoutMode = 'meeting_only' | 'meeting_and_template';

  const isActiveCustomTemplate =
    Boolean(activeTemplateId) && customTemplates.some((t) => t.id === activeTemplateId);

  const saveLayoutNow = async (mode: SaveLayoutMode = 'meeting_only') => {
    if (!Number.isFinite(projectId) || !Number.isFinite(meetingId)) return;
    if (layoutPersistTimerRef.current) {
      window.clearTimeout(layoutPersistTimerRef.current);
      layoutPersistTimerRef.current = null;
    }
    setLayoutSaving(true);
    setLayoutSaveFeedback('saving');
    try {
      const payload = {
        blocks: blocksRef.current,
        nestedSections: nestedRef.current,
      };
      const updated = await MeetingsAPI.patchMeeting(projectId, meetingId, {
        layout_config: payload,
      });
      const json = JSON.stringify({
        blocks: payload.blocks,
        nestedSections: payload.nestedSections,
      });
      lastPersistedLayoutJsonRef.current = json;
      setMeeting((prev) =>
        prev ? { ...prev, layout_config: updated.layout_config ?? payload } : null,
      );
      setWorkspaceBaseline({
        blocks: JSON.parse(JSON.stringify(blocksRef.current)),
        nestedSections: JSON.parse(JSON.stringify(nestedRef.current)),
      });

      const tplId = activeTemplateId;
      const shouldUpdateTemplate =
        mode === 'meeting_and_template' &&
        tplId &&
        customTemplates.some((t) => t.id === tplId);

      if (shouldUpdateTemplate) {
        const templatePayload = {
          blocks: JSON.parse(JSON.stringify(payload.blocks)),
          nestedSections: JSON.parse(JSON.stringify(payload.nestedSections)),
        };
        try {
          await MeetingsAPI.saveTemplateLayout(tplId, templatePayload);
          setCustomTemplates((prev) =>
            prev.map((t) =>
              t.id === tplId ? { ...t, layout_config: templatePayload } : t,
            ),
          );
          toast.success('Saved to this meeting and the template.');
        } catch (tplErr: unknown) {
          toast.error(getApiErrorMessage(tplErr, 'Meeting saved, but updating the template failed'));
        }
      }

      setLayoutSaveFeedback('saved');
      if (layoutSavedTimerRef.current) window.clearTimeout(layoutSavedTimerRef.current);
      layoutSavedTimerRef.current = window.setTimeout(() => setLayoutSaveFeedback('idle'), 1800);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Failed to save layout'));
      setLayoutSaveFeedback('idle');
    } finally {
      setLayoutSaving(false);
    }
  };

  useEffect(() => {
    if (!meeting || loading) return;
    skipLayoutPersistRef.current = true;
    const t = window.setTimeout(() => {
      const snap = {
        blocks: JSON.parse(JSON.stringify(blocksRef.current)),
        nestedSections: JSON.parse(JSON.stringify(nestedRef.current)),
      };
      setWorkspaceBaseline(snap);
      lastPersistedLayoutJsonRef.current = JSON.stringify({
        blocks: snap.blocks,
        nestedSections: snap.nestedSections,
      });
      skipLayoutPersistRef.current = false;
    }, 500);
    return () => window.clearTimeout(t);
  }, [meeting?.id, loading]);

  useEffect(() => {
    if (!meeting || loading) return;
    if (skipLayoutPersistRef.current) return;
    queuePersistWorkspaceLayout();
    return () => {
      if (layoutPersistTimerRef.current) {
        window.clearTimeout(layoutPersistTimerRef.current);
        layoutPersistTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounced persist reads latest via refs
  }, [blocks, nestedSections, meeting?.id, loading]);

  const saveMeetingMeta = async () => {
    if (!projectId || Number.isNaN(projectId) || !meetingId || Number.isNaN(meetingId)) return;
    if (savingMeetingMeta) return;

    setSavingMeetingMeta(true);
    try {
      const updated = await MeetingsAPI.patchMeeting(projectId, meetingId, {
        scheduled_date: schedDateDraft.trim() || null,
        scheduled_time: schedTimeDraft.trim() ? normalizeTimeForApi(schedTimeDraft) : null,
        external_reference: extRefDraft.trim() || null,
      });
      setMeeting(normalizeMeetingFromApi(updated));
      toast.success('Schedule & reference saved');
    } catch (err: unknown) {
      console.error('Failed to save meeting meta:', err);
      toast.error(getApiErrorMessage(err, 'Failed to save meeting details'));
    } finally {
      setSavingMeetingMeta(false);
    }
  };

  const applyTemplateIfAgendaEmpty = async (meetingType: string) => {
    if (!projectId || Number.isNaN(projectId) || !meetingId || Number.isNaN(meetingId)) return;
    if (orderedAgenda.length > 0) return;
    if (isCustomTemplateMeetingType(meetingType)) return;

    const templateSections = getNestedTemplateForMeetingType(meetingType);
    if (templateSections.length === 0) return;
    const templateItems = templateSections.flatMap((s) => s.items);

    // Ensure nested agenda state matches the meeting type template (and uses numeric ids after creation)
    setActiveTemplateId(meetingType);
    setTemplateDirty(false);
    setNestedSections(templateSections);

    try {
      for (let i = 0; i < templateItems.length; i += 1) {
        const item = templateItems[i];
        await MeetingsAPI.createAgendaItem(projectId, meetingId, {
          content: item.text,
          order_index: i,
          is_priority: item.duration === '10m',
        });
      }
      const refreshed = await MeetingsAPI.listAgendaItems(projectId, meetingId);
      const refreshedList = Array.isArray(refreshed) ? refreshed : [];
      setAgendaItems(refreshedList);

      // Replace nested item ids (string template ids) with backend numeric agenda item ids,
      // so edits can debounce-save to the backend.
      if (refreshedList.length > 0) {
        let idx = 0;
        const nextNested = templateSections.map((section) => ({
          ...section,
          items: section.items.map((it) => {
            const agendaItem = refreshedList[idx];
            idx += 1;
            return {
              ...it,
              id: agendaItem ? String(agendaItem.id) : it.id,
            };
          }),
        }));
        setNestedSections(nextNested);
      }
      toast.success('Template agenda applied');
    } catch (err: unknown) {
      console.error('Failed to apply meeting template:', err);
      toast.error(getApiErrorMessage(err, 'Failed to apply template'));
    }
  };

  const handleMeetingTypeChange = async (nextType: string) => {
    if (!projectId || Number.isNaN(projectId) || !meetingId || Number.isNaN(meetingId)) return;
    if (!meeting) return;
    const trimmed = nextType.trim();
    if (!trimmed || trimmed === meeting.meeting_type || meetingTypeSaving) return;

    setMeetingTypeSaving(true);
    try {
      const updated = await MeetingsAPI.patchMeeting(projectId, meetingId, {
        meeting_type: trimmed,
      });
      setMeeting(normalizeMeetingFromApi(updated));
      const tpl = templateList.find((t) => {
        const v = t.meetingType ?? customTemplateMeetingTypeValue(t.id);
        return v === trimmed;
      });
      if (tpl && !tpl.meetingType) {
        applySidebarTemplate(tpl);
      } else {
        const newBlocks = DEFAULT_WORKSPACE_BLOCKS;
        const newNestedSections = getNestedTemplateForMeetingType(trimmed);
        setBlocks(newBlocks);
        setNestedSections(newNestedSections);
        setActiveTemplateId(trimmed);
        setTemplateDirty(false);
        // Reset baseline so save buttons don't show immediately after type change
        setWorkspaceBaseline({
          blocks: JSON.parse(JSON.stringify(newBlocks)),
          nestedSections: JSON.parse(JSON.stringify(newNestedSections)),
        });
        await applyTemplateIfAgendaEmpty(trimmed);
      }
      toast.success('Meeting type updated');
    } catch (err: unknown) {
      console.error('Failed to update meeting type:', err);
      toast.error(getApiErrorMessage(err, 'Failed to update meeting type'));
    } finally {
      setMeetingTypeSaving(false);
    }
  };

  const saveMeetingTitle = async (nextTitle: string) => {
    if (!projectId || Number.isNaN(projectId) || !meetingId || Number.isNaN(meetingId)) return;
    if (!meeting || nextTitle.trim() === meeting.title.trim()) return;
    try {
      const updated = await MeetingsAPI.patchMeeting(projectId, meetingId, { title: nextTitle.trim() });
      setMeeting(normalizeMeetingFromApi(updated));
      toast.success('Title saved');
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Failed to save title'));
    }
  };

  const saveMeetingObjective = async (nextObjective: string) => {
    if (!projectId || Number.isNaN(projectId) || !meetingId || Number.isNaN(meetingId)) return;
    if (!meeting || (nextObjective ?? '').trim() === (meeting.objective ?? '').trim()) return;
    try {
      const updated = await MeetingsAPI.patchMeeting(projectId, meetingId, { objective: nextObjective.trim() || '' });
      setMeeting(normalizeMeetingFromApi(updated));
      toast.success('Objective saved');
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Failed to save objective'));
    }
  };

  const handleTemplateSelect = async (meetingType: string) => {
    setIsSidebarOpen(true);
    const newBlocks = DEFAULT_WORKSPACE_BLOCKS;
    const newNestedSections = getNestedTemplateForMeetingType(meetingType);
    setBlocks(newBlocks);
    setNestedSections(newNestedSections);
    setActiveTemplateId(meetingType);
    setTemplateDirty(false);
    // Reset baseline so save buttons don't show immediately after template switch
    setWorkspaceBaseline({
      blocks: JSON.parse(JSON.stringify(newBlocks)),
      nestedSections: JSON.parse(JSON.stringify(newNestedSections)),
    });
    if (meeting?.meeting_type !== meetingType) await handleMeetingTypeChange(meetingType);
    await applyTemplateIfAgendaEmpty(meetingType);
    toast.success('Template applied');
    setIsSidebarOpen(false);
  };

  const leaveTemplateConfigureMode = () => {
    setActiveTemplateId(null);
    setBlocks(DEFAULT_WORKSPACE_BLOCKS);
  };

  const enterCreateMode = () => {
    // Align with the requirement: configuration mode should provide a clean "LEGO base".
    setBlocks([]);
    // Use a truthy id to prevent "default single section" sync effect from overwriting
    // our draft nestedSections while the user configures a new template.
    setActiveTemplateId('create-template');
    setTemplateDirty(false);
    setNestedSections([]);
    // Reset baseline so save buttons don't show immediately
    setWorkspaceBaseline({ blocks: [], nestedSections: [] });
    toast('Canvas cleared. Add modules from the sidebar or add a block below.', { icon: 'ℹ️' });
  };

  const applySidebarTemplate = (tpl: SidebarTemplate) => {
    if (tpl.meetingType) {
      void handleTemplateSelect(tpl.meetingType);
      return;
    }

    // Custom template: apply stored layout_config (supports both legacy array and new object shape).
    const rawCfg = tpl.layout_config as unknown;

    let layoutBlocks: WorkspaceBlock[] | null = null;
    let layoutNestedSections: NestedSection[] | null = null;

    if (Array.isArray(rawCfg)) {
      layoutBlocks = rawCfg as WorkspaceBlock[];
    } else if (rawCfg && typeof rawCfg === 'object') {
      const cfg = rawCfg as { blocks?: unknown; nestedSections?: unknown };
      if (Array.isArray(cfg.blocks)) layoutBlocks = cfg.blocks as WorkspaceBlock[];
      if (Array.isArray(cfg.nestedSections))
        layoutNestedSections = cfg.nestedSections as NestedSection[];
    }

    if (!layoutBlocks) {
      toast.error('Invalid template layout');
      return;
    }

    setBlocks(layoutBlocks);
    const finalNestedSections = layoutNestedSections ?? [];
    if (layoutNestedSections) {
      // Use a truthy id to prevent the "default single section" sync effect from overwriting our draft.
      setActiveTemplateId(tpl.id);
      setNestedSections(layoutNestedSections);
    } else {
      setActiveTemplateId(null);
    }
    setTemplateDirty(false);
    // Reset baseline so save buttons don't show immediately after template switch
    setWorkspaceBaseline({
      blocks: JSON.parse(JSON.stringify(layoutBlocks)),
      nestedSections: JSON.parse(JSON.stringify(finalNestedSections)),
    });
    const expectedMeetingType = customTemplateMeetingTypeValue(tpl.id);
    const priorMeetingType = meeting?.meeting_type;
    void (async () => {
      if (
        priorMeetingType !== expectedMeetingType &&
        Number.isFinite(projectId) &&
        Number.isFinite(meetingId)
      ) {
        try {
          const typeUpdated = await MeetingsAPI.patchMeeting(projectId, meetingId, {
            meeting_type: expectedMeetingType,
          });
          setMeeting(normalizeMeetingFromApi(typeUpdated));
        } catch (err: unknown) {
          toast.error(getApiErrorMessage(err, 'Failed to update meeting type for template'));
          return;
        }
      }

      // If meeting agenda is empty, create backend agenda rows so nested edits can debounce-save.
      if (orderedAgenda.length === 0 && layoutNestedSections) {
        const flatItems = layoutNestedSections.flatMap((s) => s.items);
        try {
          for (let i = 0; i < flatItems.length; i += 1) {
            const item = flatItems[i];
            await MeetingsAPI.createAgendaItem(projectId, meetingId, {
              content: item.text,
              order_index: i,
              is_priority: item.duration === '10m',
            });
          }

          const refreshed = await MeetingsAPI.listAgendaItems(projectId, meetingId);
          const refreshedList = Array.isArray(refreshed) ? refreshed : [];
          setAgendaItems(refreshedList);

          // Sync nested item ids to backend numeric agenda item ids.
          if (refreshedList.length > 0) {
            let idx = 0;
            const nextNested = layoutNestedSections.map((section) => ({
              ...section,
              items: section.items.map((it) => {
                const agendaItem = refreshedList[idx];
                idx += 1;
                return {
                  ...it,
                  id: agendaItem ? String(agendaItem.id) : it.id,
                };
              }),
            }));
            setNestedSections(nextNested);
          }
        } catch (err: unknown) {
          toast.error(getApiErrorMessage(err, 'Failed to apply template'));
          return;
        }
      }

      toast.success('Template applied');
      setIsSidebarOpen(false);
    })();
  };

  const deleteCustomTemplate = async (templateId: string) => {
    try {
      await MeetingsAPI.deleteMeetingTemplate(templateId);
      setCustomTemplates((prev) => prev.filter((t) => t.id !== templateId));
      toast.success('Template deleted');
    } catch (err: unknown) {
      console.error('Failed to delete template:', err);
      toast.error(getApiErrorMessage(err, 'Failed to delete template'));
    }
  };

  const orderedArtifacts = useMemo(() => {
    const list = Array.isArray(artifacts) ? artifacts : [];
    return [...list].sort(
      (a, b) =>
        String(a.artifact_type ?? '').localeCompare(String(b.artifact_type ?? '')) ||
        (a.artifact_id ?? 0) - (b.artifact_id ?? 0) ||
        a.id - b.id,
    );
  }, [artifacts]);

  const participantLabelForUserId = (userId: number) => {
    const row = projectMembers.find((m) => m.user.id === userId);
    return row ? formatProjectMemberLabel(row) : `User #${userId}`;
  };

  const participantInitialsForUserId = (userId: number) => {
    return participantLabelForUserId(userId)
      .split(' ')
      .map((s) => s.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  const roleMetaFor = (role: string | null | undefined) => {
    const normalized = (role ?? '').trim();
    const matched = PARTICIPANT_ROLE_OPTIONS.find((opt) => opt.value === normalized);
    return matched ?? PARTICIPANT_ROLE_OPTIONS[1];
  };

  const availableMembers = useMemo(
    () => projectMembers.filter((m) => !orderedParticipants.some((p) => p.user === m.user.id)),
    [projectMembers, orderedParticipants],
  );

  const participantSearchResults = useMemo(() => {
    const term = participantSearchText.trim().toLowerCase();
    if (!term) return [];
    return availableMembers.filter((m) => (m.user.email ?? '').toLowerCase().includes(term));
  }, [availableMembers, participantSearchText]);

  const artifactChoices = useMemo(() => {
    const linked = new Set(artifacts.map((a) => `${normalizeMeetingArtifactType(a.artifact_type)}:${a.artifact_id}`));
    const byType = {
      decision: artifactResources.decisions
        .filter((d) => !linked.has(`decision:${d.id}`))
        .map((d) => ({ id: d.id, label: d.title?.trim() || `Decision #${d.id}` })),
      task: artifactResources.tasks
        .filter((t) => t.id != null && !linked.has(`task:${t.id}`))
        .map((t) => ({ id: t.id as number, label: t.summary?.trim() || `Task #${t.id}` })),
      spreadsheet: artifactResources.spreadsheets
        .filter((s) => !linked.has(`spreadsheet:${s.id}`))
        .map((s) => ({ id: s.id, label: s.name?.trim() || `Spreadsheet #${s.id}` })),
    };
    return byType;
  }, [artifactResources, artifacts]);

  const artifactSearchHits = useMemo((): ArtifactSearchHit[] => {
    const term = artifactSearchText.trim().toLowerCase();
    if (!term) return [];

    const linked = new Set(
      artifacts.map((a) => `${normalizeMeetingArtifactType(a.artifact_type)}:${a.artifact_id}`),
    );
    const hits: ArtifactSearchHit[] = [];

    for (const d of artifactResources.decisions) {
      if (linked.has(`decision:${d.id}`)) continue;
      const title = (d.title ?? '').trim();
      const hay = title.toLowerCase();
      if (hay.includes(term)) {
        hits.push({ kind: 'decision', id: d.id, title: title || `Decision #${d.id}` });
      }
    }

    for (const t of artifactResources.tasks) {
      const tid = t.id;
      if (tid == null || linked.has(`task:${tid}`)) continue;
      const summary = (t.summary ?? '').trim();
      const hay = summary.toLowerCase();
      if (hay.includes(term)) {
        hits.push({
          kind: 'task',
          id: tid,
          title: summary || `Task #${tid}`,
        });
      }
    }

    for (const s of artifactResources.spreadsheets) {
      if (linked.has(`spreadsheet:${s.id}`)) continue;
      const name = (s.name ?? '').trim();
      if (name.toLowerCase().includes(term)) {
        hits.push({ kind: 'spreadsheet', id: s.id, title: name || `Spreadsheet #${s.id}` });
      }
    }

    return hits;
  }, [artifactResources, artifacts, artifactSearchText]);

  const addParticipant = async (userId: number) => {
    if (!projectId || Number.isNaN(projectId) || !meetingId || Number.isNaN(meetingId)) return;
    if (addingParticipant) return;

    setAddingParticipant(true);
    try {
      const created = await MeetingsAPI.addParticipant(projectId, meetingId, {
        user: userId,
        role: DEFAULT_PARTICIPANT_ROLE,
      });
      setParticipants((prev) => [...(Array.isArray(prev) ? prev : []), created]);
      setParticipantDropdownOpen(false);
      setParticipantSearchMode(false);
      setParticipantSearchText('');
      toast.success('Participant added');
      queuePersistWorkspaceLayout();
    } catch (err: unknown) {
      console.error('Failed to add participant:', err);
      toast.error(getApiErrorMessage(err, 'Failed to add participant'));
    } finally {
      setAddingParticipant(false);
    }
  };

  const linkMeetingArtifact = async (artifact_type: string, artifact_id: number) => {
    if (!projectId || Number.isNaN(projectId) || !meetingId || Number.isNaN(meetingId)) return;
    if (addingArtifact) return;

    const id = Math.trunc(artifact_id);
    if (!Number.isFinite(id) || id < 1) {
      toast.error('Invalid artifact id');
      return;
    }

    const storedType = isKnownMeetingArtifactKind(artifact_type)
      ? normalizeMeetingArtifactType(artifact_type)
      : artifact_type.trim().slice(0, 50);
    if (!storedType) {
      toast.error('Artifact type is required');
      return;
    }

    const dup = artifacts.some(
      (x) =>
        normalizeMeetingArtifactType(x.artifact_type) === normalizeMeetingArtifactType(storedType) &&
        x.artifact_id === id,
    );
    if (dup) {
      toast.error('This resource is already linked');
      return;
    }

    setAddingArtifact(true);
    try {
      const created = await MeetingsAPI.addArtifact(projectId, meetingId, {
        artifact_type: storedType,
        artifact_id: id,
      });
      setArtifacts((prev) => [...(Array.isArray(prev) ? prev : []), created]);
      setArtifactDropdownOpen(false);
      setArtifactSearchMode(false);
      setArtifactSearchText('');
      toast.success('Artifact linked');
      queuePersistWorkspaceLayout();
    } catch (err: unknown) {
      console.error('Failed to add artifact:', err);
      toast.error(getApiErrorMessage(err, 'Failed to add artifact'));
    } finally {
      setAddingArtifact(false);
    }
  };

  const removeArtifact = async (artifactLinkId: number) => {
    if (!projectId || Number.isNaN(projectId) || !meetingId || Number.isNaN(meetingId)) return;
    if (removingArtifactIds.has(artifactLinkId)) return;

    const snapshot = artifacts;
    setRemovingArtifactIds((prev) => new Set([...prev, artifactLinkId]));
    setArtifacts((prev) => prev.filter((a) => a.id !== artifactLinkId));

    try {
      await MeetingsAPI.removeArtifact(projectId, meetingId, artifactLinkId);
      toast.success('Artifact unlinked');
      queuePersistWorkspaceLayout();
    } catch (err: unknown) {
      console.error('Failed to remove artifact:', err);
      setArtifacts(snapshot);
      toast.error(getApiErrorMessage(err, 'Failed to remove artifact'));
    } finally {
      setRemovingArtifactIds((prev) => {
        const next = new Set(prev);
        next.delete(artifactLinkId);
        return next;
      });
    }
  };

  const saveParticipantRole = async (participantLinkId: number, nextRole: string) => {
    if (!projectId || Number.isNaN(projectId) || !meetingId || Number.isNaN(meetingId)) return;
    if (savingParticipantIds.has(participantLinkId)) return;

    const current = participants.find((p) => p.id === participantLinkId);
    const trimmed = nextRole.trim();
    const currentRole = (current?.role ?? '').trim();
    if (trimmed === currentRole) return;

    setSavingParticipantIds((prev) => new Set([...prev, participantLinkId]));
    try {
      const updated = await MeetingsAPI.patchParticipant(projectId, meetingId, participantLinkId, {
        role: trimmed ? trimmed : null,
      });
      setParticipants((prev) => prev.map((p) => (p.id === participantLinkId ? updated : p)));
      toast.success('Role saved');
      queuePersistWorkspaceLayout();
    } catch (err: unknown) {
      console.error('Failed to save participant role:', err);
      toast.error(getApiErrorMessage(err, 'Failed to save participant role'));
    } finally {
      setSavingParticipantIds((prev) => {
        const next = new Set(prev);
        next.delete(participantLinkId);
        return next;
      });
    }
  };

  const removeParticipant = async (participantLinkId: number) => {
    if (!projectId || Number.isNaN(projectId) || !meetingId || Number.isNaN(meetingId)) return;
    if (removingParticipantIds.has(participantLinkId)) return;

    const snapshot = participants;
    setRemovingParticipantIds((prev) => new Set([...prev, participantLinkId]));
    setParticipants((prev) => prev.filter((p) => p.id !== participantLinkId));

    try {
      await MeetingsAPI.removeParticipant(projectId, meetingId, participantLinkId);
      toast.success('Participant removed');
      queuePersistWorkspaceLayout();
    } catch (err: unknown) {
      console.error('Failed to remove participant:', err);
      setParticipants(snapshot);
      toast.error(getApiErrorMessage(err, 'Failed to remove participant'));
    } finally {
      setRemovingParticipantIds((prev) => {
        const next = new Set(prev);
        next.delete(participantLinkId);
        return next;
      });
    }
  };

  const saveAgendaItem = async (
    agendaItemId: number,
    nextContent: string,
    opts?: { silent?: boolean },
  ) => {
    if (!projectId || Number.isNaN(projectId) || !meetingId || Number.isNaN(meetingId)) return;

    const trimmed = nextContent.trim();
    const current = agendaItems.find((a) => a.id === agendaItemId);
    const currentContent = (current?.content ?? '').trim();
    if (trimmed === currentContent) return;

    setSavingAgendaIds((prev) => new Set([...prev, agendaItemId]));
    try {
      const updated = await MeetingsAPI.patchAgendaItem(projectId, meetingId, agendaItemId, {
        content: trimmed,
      });
      setAgendaItems((prev) => prev.map((a) => (a.id === agendaItemId ? updated : a)));
      if (!opts?.silent) toast.success('Saved');
    } catch (err: unknown) {
      console.error('Failed to save agenda item:', err);
      toast.error(getApiErrorMessage(err, 'Failed to save agenda item'));
      if (current) setAgendaDrafts((prev) => ({ ...prev, [agendaItemId]: current.content ?? '' }));
    } finally {
      setSavingAgendaIds((prev) => {
        const next = new Set(prev);
        next.delete(agendaItemId);
        return next;
      });
    }
  };

  const patchAgendaPriority = async (agendaItemId: number, is_priority: boolean) => {
    if (!projectId || Number.isNaN(projectId) || !meetingId || Number.isNaN(meetingId)) return;

    const current = agendaItems.find((a) => a.id === agendaItemId);
    if (!current || current.is_priority === is_priority) return;

    setSavingAgendaPriorityIds((prev) => new Set([...prev, agendaItemId]));
    try {
      const updated = await MeetingsAPI.patchAgendaItem(projectId, meetingId, agendaItemId, {
        is_priority,
      });
      setAgendaItems((prev) => prev.map((a) => (a.id === agendaItemId ? updated : a)));
    } catch (err: unknown) {
      console.error('Failed to update agenda priority:', err);
      toast.error(getApiErrorMessage(err, 'Failed to update priority'));
    } finally {
      setSavingAgendaPriorityIds((prev) => {
        const next = new Set(prev);
        next.delete(agendaItemId);
        return next;
      });
    }
  };

  const queueAgendaSave = (agendaItemId: number, nextContent: string) => {
    const existing = saveTimersRef.current[agendaItemId];
    if (existing) window.clearTimeout(existing);

    saveTimersRef.current[agendaItemId] = window.setTimeout(() => {
      saveTimersRef.current[agendaItemId] = null;
      void saveAgendaItem(agendaItemId, nextContent, { silent: true });
    }, 500);
  };

  const reorderBlocks = (activeId: string, overId: string) => {
    if (activeId === overId) return;
    setBlocks((prev) => {
      const oldIndex = prev.findIndex((b) => b.id === activeId);
      const newIndex = prev.findIndex((b) => b.id === overId);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const addBlock = (type: WorkspaceBlockType) => {
    if (type === 'custom_block') {
      setBlocks((prev) => [
        ...prev,
        { id: `custom-${crypto.randomUUID()}`, type: 'custom_block', title: 'Custom Block', content: '' },
      ]);
      return;
    }
    setBlocks((prev) => [...prev, { id: `${type}-${crypto.randomUUID()}`, type }]);
  };

  const removeBlock = (blockId: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== blockId));
  };

  const copyBlock = (blockId: string) => {
    setBlocks((prev) => {
      const source = prev.find((b) => b.id === blockId);
      if (!source) return prev;
      const clone: WorkspaceBlock = {
        ...source,
        id: `${source.type}-${crypto.randomUUID()}`,
        title: source.title ?? (source.type === 'custom_block' ? 'Custom Block' : undefined),
      };
      return [...prev, clone];
    });
  };

  const findSectionByItemId = (itemId: string) =>
    nestedSections.find((section) => section.items.some((item) => item.id === itemId));

  const handleNestedDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id);
    if (id.startsWith('section:')) setActiveSectionDragId(id.replace('section:', ''));
    if (id.startsWith('item:')) setActiveItemDragId(id.replace('item:', ''));
  };

  const reorderNestedSectionsFromSortableIds = (active: string, over: string) => {
    if (!active.startsWith('section:') || !over.startsWith('section:')) return;
    if (active === over) return;
    const activeSectionId = active.replace('section:', '');
    const overSectionId = over.replace('section:', '');
    setNestedSections((prev) => {
      const oldIndex = prev.findIndex((s) => s.id === activeSectionId);
      const newIndex = prev.findIndex((s) => s.id === overSectionId);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
    setTemplateDirty(true);
  };

  const handleNestedDragEnd = (event: DragEndEvent) => {
    setActiveSectionDragId(null);
    setActiveItemDragId(null);
    const active = String(event.active.id ?? '');
    const over = String(event.over?.id ?? '');
    if (!active || !over || active === over) return;

    if (active.startsWith('section:') && over.startsWith('section:')) {
      reorderNestedSectionsFromSortableIds(active, over);
      return;
    }

    if (active.startsWith('item:')) {
      const activeItemId = active.replace('item:', '');

      if (over.startsWith('item:')) {
        const overItemId = over.replace('item:', '');
        const fromSection = findSectionByItemId(activeItemId);
        const overSection = findSectionByItemId(overItemId);
        if (!fromSection || !overSection) return;

        if (fromSection.id === overSection.id) {
          setNestedSections((prev) =>
            prev.map((section) => {
              if (section.id !== fromSection.id) return section;
              const items = [...section.items];
              const oldIndex = items.findIndex((i) => i.id === activeItemId);
              const newIndex = items.findIndex((i) => i.id === overItemId);
              if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return section;
              return { ...section, items: arrayMove(items, oldIndex, newIndex) };
            }),
          );
          setTemplateDirty(true);
          return;
        }

        setNestedSections((prev) => {
          const fromSectionInner = prev.find((s) => s.items.some((i) => i.id === activeItemId));
          const toSectionInner = prev.find((s) => s.items.some((i) => i.id === overItemId));
          if (!fromSectionInner || !toSectionInner) return prev;
          const moving = fromSectionInner.items.find((i) => i.id === activeItemId);
          if (!moving) return prev;

          const next = prev.map((section) => ({
            ...section,
            items: section.items.filter((i) => i.id !== activeItemId),
          }));
          const targetIndex = next.findIndex((s) => s.id === toSectionInner.id);
          if (targetIndex < 0) return prev;
          const overIndex = next[targetIndex].items.findIndex((i) => i.id === overItemId);
          const insertIndex = overIndex >= 0 ? overIndex : next[targetIndex].items.length;
          next[targetIndex].items.splice(insertIndex, 0, moving);
          return [...next];
        });
        setTemplateDirty(true);
        return;
      }

      if (over.startsWith('section:')) {
        const targetSectionId = over.replace('section:', '');
        setNestedSections((prev) => {
          const fromSectionInner = prev.find((s) => s.items.some((i) => i.id === activeItemId));
          const targetSectionInner = prev.find((s) => s.id === targetSectionId);
          if (!fromSectionInner || !targetSectionInner) return prev;
          const moving = fromSectionInner.items.find((i) => i.id === activeItemId);
          if (!moving) return prev;
          if (fromSectionInner.id === targetSectionInner.id) return prev;

          const next = prev.map((section) => ({
            ...section,
            items: section.items.filter((i) => i.id !== activeItemId),
          }));
          const targetIndex = next.findIndex((s) => s.id === targetSectionId);
          if (targetIndex < 0) return prev;
          next[targetIndex].items.push(moving);
          return [...next];
        });
        setTemplateDirty(true);
      }
    }
  };

  const updateNestedItem = (sectionId: string, itemId: string, patch: Partial<NestedSection['items'][number]>) => {
    setNestedSections((prev) =>
      prev.map((section) =>
        section.id !== sectionId
          ? section
          : {
              ...section,
              items: section.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
            },
      ),
    );
    setTemplateDirty(true);
  };

  const addSection = () => {
    const sectionId = `section-${crypto.randomUUID()}`;
    setNestedSections((prev) => [
      ...prev,
      { id: sectionId, title: 'New Section', items: [] },
    ]);
    setEditingSectionId(sectionId);
    setTemplateDirty(true);
  };

  const saveSectionTitle = (sectionId: string, title: string) => {
    setNestedSections((prev) =>
      prev.map((section) => (section.id === sectionId ? { ...section, title } : section)),
    );
    setEditingSectionId(null);
    setTemplateDirty(true);
  };

  const addItemToSection = (sectionId: string) => {
    setNestedSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              items: [
                ...section.items,
                {
                  id: `item-${crypto.randomUUID()}`,
                  text: 'New item',
                  completed: false,
                  duration: '5m',
                },
              ],
            }
          : section,
      ),
    );
    setTemplateDirty(true);
  };

  const saveTemplateLayout = async () => {
    if (!activeTemplateId) return;
    const tplId = activeTemplateId;
    const templatePayload = {
      blocks: JSON.parse(JSON.stringify(blocks)),
      nestedSections: JSON.parse(JSON.stringify(nestedSections)),
    };
    try {
      await MeetingsAPI.saveTemplateLayout(tplId, templatePayload);
      setCustomTemplates((prev) =>
        prev.map((t) => (t.id === tplId ? { ...t, layout_config: templatePayload } : t)),
      );
      setTemplateDirty(false);
      toast.success('Template layout saved');
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Failed to save template layout'));
    }
  };

  const createCustomTemplate = async (payload: { name: string; layout_config: unknown }) => {
    try {
      // Ensure payload contains full nested sections/items structure for later re-application.
      const created = await MeetingsAPI.createMeetingTemplate({
        name: payload.name,
        layout_config: {
          blocks: payload.layout_config,
          nestedSections,
        },
      });

      const cfg = created.layout_config as any;
      const blocksLayout = Array.isArray(cfg?.blocks)
        ? (cfg.blocks as WorkspaceBlock[])
        : Array.isArray(cfg)
          ? (cfg as WorkspaceBlock[])
          : [];

      const meta = `${blocksLayout.length} modules`;
      const normalized: SidebarTemplate = {
        id: created.id,
        name: created.name,
        meta,
        layout_config: created.layout_config,
      };

      setCustomTemplates((prev) => [normalized, ...prev]);
      return normalized;
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Failed to save template'));
      throw err;
    }
  };

  const deleteAgendaItem = async (agendaItemId: number) => {
    if (!projectId || Number.isNaN(projectId) || !meetingId || Number.isNaN(meetingId)) return;
    if (deletingAgendaIds.has(agendaItemId)) return;

    const snapshot = agendaItems;
    setDeletingAgendaIds((prev) => new Set([...prev, agendaItemId]));
    setAgendaItems((prev) => prev.filter((a) => a.id !== agendaItemId));

    try {
      await MeetingsAPI.deleteAgendaItem(projectId, meetingId, agendaItemId);
    } catch (err: unknown) {
      console.error('Failed to delete agenda item:', err);
      setAgendaItems(snapshot);
      toast.error(getApiErrorMessage(err, 'Failed to delete agenda item'));
    } finally {
      setDeletingAgendaIds((prev) => {
        const next = new Set(prev);
        next.delete(agendaItemId);
        return next;
      });
    }
  };

  const deleteNestedSection = async (sectionId: string) => {
    if (!projectId || Number.isNaN(projectId) || !meetingId || Number.isNaN(meetingId)) return;
    const section = nestedSections.find((s) => s.id === sectionId);
    if (!section) return;
    const numericIds = section.items
      .map((it) => Number(it.id))
      .filter((n) => Number.isFinite(n) && n > 0);
    const prevNested = nestedSections;
    const prevAgenda = agendaItems;
    setNestedSections((p) => p.filter((s) => s.id !== sectionId));
    setTemplateDirty(true);
    if (numericIds.length === 0) return;
    setAgendaItems((p) => p.filter((a) => !numericIds.includes(a.id)));
    try {
      await Promise.all(
        numericIds.map((id) => MeetingsAPI.deleteAgendaItem(projectId, meetingId, id)),
      );
    } catch (err: unknown) {
      setNestedSections(prevNested);
      setAgendaItems(prevAgenda);
      toast.error(getApiErrorMessage(err, 'Failed to delete section'));
    }
  };

  const deleteNestedItem = async (sectionId: string, itemId: string) => {
    if (!projectId || Number.isNaN(projectId) || !meetingId || Number.isNaN(meetingId)) return;
    const nid = Number(itemId);
    if (Number.isFinite(nid) && nid > 0) {
      const prevNested = nestedSections;
      setNestedSections((prev) =>
        prev.map((s) =>
          s.id === sectionId ? { ...s, items: s.items.filter((i) => i.id !== itemId) } : s,
        ),
      );
      setTemplateDirty(true);
      try {
        await MeetingsAPI.deleteAgendaItem(projectId, meetingId, nid);
        setAgendaItems((prev) => prev.filter((a) => a.id !== nid));
      } catch (err: unknown) {
        setNestedSections(prevNested);
        toast.error(getApiErrorMessage(err, 'Failed to delete agenda item'));
      }
      return;
    }
    setNestedSections((prev) =>
      prev.map((s) =>
        s.id === sectionId ? { ...s, items: s.items.filter((i) => i.id !== itemId) } : s,
      ),
    );
    setTemplateDirty(true);
  };

  const handleAddAgendaItem = async () => {
    if (!projectId || Number.isNaN(projectId) || !meetingId || Number.isNaN(meetingId)) return;
    const content = newAgendaText.trim();
    if (!content) return;

    const nextOrderIndex =
      orderedAgenda.length > 0 ? orderedAgenda[orderedAgenda.length - 1].order_index + 1 : 0;

    setAddingAgenda(true);
    try {
      const created = await MeetingsAPI.createAgendaItem(projectId, meetingId, {
        content,
        order_index: nextOrderIndex,
        is_priority: newAgendaPriority,
      });
      setAgendaItems((prev) => [...(Array.isArray(prev) ? prev : []), created]);
      setNewAgendaText('');
      setNewAgendaPriority(false);
    } catch (err: unknown) {
      console.error('Failed to add agenda item:', err);
      toast.error(getApiErrorMessage(err, 'Failed to add agenda item'));
    } finally {
      setAddingAgenda(false);
    }
  };

  const reorderAgendaOptimistically = async (activeId: number, overId: number) => {
    if (!projectId || Number.isNaN(projectId) || !meetingId || Number.isNaN(meetingId)) return;
    if (activeId === overId) return;

    const before = orderedAgenda;
    const oldIndex = before.findIndex((a) => a.id === activeId);
    const newIndex = before.findIndex((a) => a.id === overId);
    if (oldIndex < 0 || newIndex < 0) return;

    const moved = arrayMove(before, oldIndex, newIndex).map((item, index) => ({
      ...item,
      order_index: index,
    }));

    setAgendaItems(moved);

    try {
      await MeetingsAPI.reorderAgendaItems(projectId, meetingId, {
        items: moved.map((i) => ({ id: i.id, order_index: i.order_index })),
      });
    } catch (err: unknown) {
      console.error('Failed to reorder agenda items:', err);
      setAgendaItems(before);
      toast.error(getApiErrorMessage(err, 'Failed to reorder agenda items'));
    }
  };

  const renderBody = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center text-gray-500">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          <p className="mt-3 font-medium text-gray-900">Loading meeting…</p>
          <p className="text-sm text-gray-600">Preparing workspace.</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-red-200 bg-white p-10 text-center text-red-600">
          <AlertCircle className="h-6 w-6" />
          <p className="mt-3 font-semibold">Could not load meeting</p>
          <p className="text-sm text-red-500">{error}</p>
          {Number.isNaN(projectId) ? null : (
            <button
              type="button"
              onClick={() => router.push(`/projects/${projectId}/meetings`)}
              className="mt-4 text-sm font-medium text-blue-600 hover:underline"
            >
              Back to meetings
            </button>
          )}
        </div>
      );
    }

    if (!meeting) {
      return (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
          Meeting not found.
        </div>
      );
    }

    return (
      <div className="flex w-full gap-0 overflow-x-clip overflow-y-visible">
        <motion.div
          className="min-w-0 overflow-visible"
          animate={{ width: isSidebarOpen ? 'calc(100% - 350px)' : '100%' }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        >
        <DndContext
          id={`meeting-${meetingId}-workspace-dnd`}
          collisionDetection={closestCenter}
          onDragEnd={(event) => {
            const activeId = String(event.active?.id ?? '');
            const overId = String(event.over?.id ?? '');
            if (!activeId || !overId) return;
            reorderBlocks(activeId, overId);
          }}
          accessibility={{
            announcements: {
              onDragStart: () => '',
              onDragMove: () => '',
              onDragOver: () => '',
              onDragEnd: () => '',
              onDragCancel: () => '',
            },
            screenReaderInstructions: {
              draggable: '',
            },
          }}
        >
          <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-12 text-left">
              <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800">Meeting document</p>
                    <p className="mt-1 text-xs text-slate-600">
                      {hasVisibleText(documentPreviewHtml)
                        ? 'Preview below — open the full editor to collaborate.'
                        : 'No document content yet.'}
                    </p>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      router.push(`/projects/${projectId}/meetings/${meetingId}/document`)
                    }
                  >
                    Open document
                  </Button>
                </div>
                {hasVisibleText(documentPreviewHtml) ? (
                  <div
                    className="mt-3 max-h-40 overflow-y-auto rounded-lg border border-blue-100 bg-white p-3 text-xs text-gray-700 [&_h1]:text-sm [&_h1]:font-semibold [&_h2]:text-sm [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4"
                    dangerouslySetInnerHTML={{ __html: documentPreviewHtml }}
                  />
                ) : null}
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-800">Zoom post-meeting</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Recording and summary from Zoom after the meeting (when linked).
                </p>
                <div className="mt-3">
                  <ZoomPostMeetingSection zoomPostMeeting={meeting.zoom_post_meeting} />
                </div>
              </div>

              {meeting && Number.isFinite(projectId) && Number.isFinite(meetingId) ? (
                <div className="mt-6">
                  <MeetingGeneratedKnowledgeSection
                    projectId={projectId}
                    meetingId={meetingId}
                    generatedTasks={meeting.generated_tasks ?? []}
                    generatedDecisions={meeting.generated_decisions ?? []}
                  />
                </div>
              ) : null}

              {blocks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
                  Canvas is empty. Please click a module from the sidebar or add a block below.
                </div>
              ) : null}
              {blocks.map((block) => {
                if (block.type === 'header') {
                  return (
                    <SortableBlock
                      id={block.id}
                      key={block.id}
                      overlineLabel={workspaceBlockOverline(block)}
                      actions={(
                        <div className="flex items-center gap-2 rounded-md p-0">
                          <button
                            type="button"
                            onClick={() => copyBlock(block.id)}
                            className="rounded p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                            aria-label="Copy block"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeBlock(block.id)}
                            className="rounded p-1 text-slate-400 hover:bg-slate-50 hover:text-red-600"
                            aria-label="Delete block"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    >
                      <MeetingHeader
                        title={meeting.title}
                        meetingType={meeting.meeting_type}
                        meetingTypeOptions={meetingTypePickerOptions}
                        status={meeting.status}
                        meetingTypeSaving={meetingTypeSaving}
                        objective={meeting.objective}
                        scheduledDate={schedDateDraft}
                        scheduledTime={schedTimeDraft}
                        externalReference={extRefDraft}
                        saving={savingMeetingMeta}
                        onScheduledDateChange={setSchedDateDraft}
                        onScheduledTimeChange={setSchedTimeDraft}
                        onExternalReferenceChange={setExtRefDraft}
                        onMeetingTypeChange={(value) => void handleMeetingTypeChange(value)}
                        onSave={() => void saveMeetingMeta()}
                        onBack={() => router.push(`/projects/${projectId}/meetings`)}
                        onTitleSave={(value) => void saveMeetingTitle(value)}
                        onObjectiveSave={(value) => void saveMeetingObjective(value)}
                      />
                    </SortableBlock>
                  );
                }

                if (block.type === 'agenda') {
                  return (
                    <SortableBlock
                      id={block.id}
                      key={block.id}
                      overlineLabel={workspaceBlockOverline(block)}
                      actions={(
                        <div className="flex items-center gap-2 rounded-md p-0">
                          <button
                            type="button"
                            onClick={() => copyBlock(block.id)}
                            className="rounded p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                            aria-label="Copy block"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeBlock(block.id)}
                            className="rounded p-1 text-slate-400 hover:bg-slate-50 hover:text-red-600"
                            aria-label="Delete block"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    >
                      <AgendaBlockWithOutlineRail
                        sections={nestedSections}
                        meetingId={meetingId}
                        onSectionReorder={reorderNestedSectionsFromSortableIds}
                      >
                      <AgendaSection
                        orderedAgenda={orderedAgenda}
                        addingAgenda={addingAgenda}
                        newAgendaText={newAgendaText}
                        newAgendaPriority={newAgendaPriority}
                        onNewAgendaTextChange={setNewAgendaText}
                        onNewAgendaPriorityChange={setNewAgendaPriority}
                        onAddAgendaItem={() => void handleAddAgendaItem()}
                        onUseTemplate={() => setIsSidebarOpen((v) => !v)}
                        isDragging={isAgendaDragging}
                      >
                        <DndContext
                          id={`meeting-${meetingId}-agenda-nested-dnd`}
                          sensors={agendaNestedSensors}
                          collisionDetection={closestCorners}
                          onDragStart={handleNestedDragStart}
                          onDragEnd={handleNestedDragEnd}
                          onDragCancel={() => {
                            setActiveSectionDragId(null);
                            setActiveItemDragId(null);
                          }}
                          accessibility={{
                            announcements: {
                              onDragStart: () => '',
                              onDragMove: () => '',
                              onDragOver: () => '',
                              onDragEnd: () => '',
                              onDragCancel: () => '',
                            },
                            screenReaderInstructions: {
                              draggable: '',
                            },
                          }}
                        >
                          <SortableContext
                            items={nestedSections.map((section) => `section:${section.id}`)}
                            strategy={verticalListSortingStrategy}
                          >
                            <div className="space-y-4">
                              {nestedSections.map((section) => (
                                <SortableNestedSection
                                  key={section.id}
                                  section={section}
                                  scrollAnchorId={meetingAgendaSectionDomId(section.id)}
                                  isEditingTitle={editingSectionId === section.id}
                                  onStartEditTitle={() => setEditingSectionId(section.id)}
                                  onSaveTitle={(title) => saveSectionTitle(section.id, title)}
                                  onDeleteSection={() => void deleteNestedSection(section.id)}
                                >
                                  <SortableContext
                                    items={section.items.map((item) => `item:${item.id}`)}
                                    strategy={verticalListSortingStrategy}
                                  >
                                    <div className="space-y-1">
                                      {section.items.map((item) => (
                                        <SortableNestedItem
                                          key={item.id}
                                          sectionId={section.id}
                                          item={item}
                                          onToggle={() =>
                                            updateNestedItem(section.id, item.id, { completed: !item.completed })
                                          }
                                          onTextChange={(text) => {
                                            updateNestedItem(section.id, item.id, { text });
                                            const numericId = Number(item.id);
                                            if (Number.isFinite(numericId)) queueAgendaSave(numericId, text);
                                          }}
                                          onDurationChange={(duration) => updateNestedItem(section.id, item.id, { duration })}
                                          onDelete={() => void deleteNestedItem(section.id, item.id)}
                                        />
                                      ))}
                                    </div>
                                  </SortableContext>
                                  <button
                                    type="button"
                                    className="mt-2 text-xs text-gray-500 hover:text-gray-700"
                                    onClick={() => addItemToSection(section.id)}
                                  >
                                    + Add Item
                                  </button>
                                </SortableNestedSection>
                              ))}
                            </div>
                          </SortableContext>
                        </DndContext>
                        <div className="mt-4">
                          <button
                            type="button"
                            className="text-sm text-gray-600 hover:text-gray-800"
                            onClick={addSection}
                          >
                            + Add Section
                          </button>
                        </div>
                      </AgendaSection>
                      </AgendaBlockWithOutlineRail>
                    </SortableBlock>
                  );
                }

                if (block.type === 'participants') {
                  return (
                    <SortableBlock
                      id={block.id}
                      key={block.id}
                      overlineLabel={workspaceBlockOverline(block)}
                      actions={(
                        <div className="flex items-center gap-2 rounded-md p-0">
                          <button
                            type="button"
                            onClick={() => copyBlock(block.id)}
                            className="rounded p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                            aria-label="Copy block"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeBlock(block.id)}
                            className="rounded p-1 text-slate-400 hover:bg-slate-50 hover:text-red-600"
                            aria-label="Delete block"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    >
                      <section className="p-1">
                        <div className="mb-3 flex items-center justify-between">
                          <h3 className="text-xl font-bold text-slate-900">
                            Participants ({orderedParticipants.length})
                          </h3>
                          <DropdownMenu open={participantDropdownOpen} onOpenChange={setParticipantDropdownOpen}>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="text-sm text-gray-500 transition hover:text-gray-800"
                              >
                                + Add
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-72">
                              <DropdownMenuItem
                                onSelect={() => {
                                  setParticipantSearchMode(true);
                                  setParticipantSearchText('');
                                }}
                              >
                                <Search className="h-4 w-4" />
                                Search members
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {availableMembers.length === 0 ? (
                                <DropdownMenuItem disabled>
                                  All project members are already participants
                                </DropdownMenuItem>
                              ) : (
                                availableMembers.map((m) => (
                                  <DropdownMenuItem
                                    key={m.id}
                                    disabled={addingParticipant}
                                    onSelect={() => {
                                      void addParticipant(m.user.id);
                                    }}
                                  >
                                    {formatProjectMemberLabel(m)}
                                  </DropdownMenuItem>
                                ))
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        {participantSearchMode ? (
                          <Card className="mb-3 rounded-xl border-slate-200 bg-white/70 p-3 shadow-none">
                            <div className="relative">
                              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                              <Input
                                value={participantSearchText}
                                onChange={(e) => setParticipantSearchText(e.currentTarget.value)}
                                placeholder="Search by email"
                                className="h-10 rounded-xl border border-transparent bg-slate-50 pl-9 pr-3 text-sm focus-visible:border-blue-400 focus-visible:bg-white"
                              />
                            </div>
                            <div className="mt-2">
                              {participantSearchText.trim().length === 0 ? null : participantSearchResults.length > 0 ? (
                                <div className="space-y-2">
                                  {participantSearchResults.map((m) => (
                                    <Card key={m.id} className="rounded-lg border-slate-200 bg-white p-0 shadow-none">
                                      <button
                                        type="button"
                                        disabled={addingParticipant}
                                        onClick={() => {
                                          void addParticipant(m.user.id);
                                        }}
                                        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-slate-50 disabled:opacity-50"
                                      >
                                        <span className="truncate text-sm text-slate-800">
                                          {formatProjectMemberLabel(m)}
                                        </span>
                                        <span className="text-xs text-slate-400">{m.user.email ?? ''}</span>
                                      </button>
                                    </Card>
                                  ))}
                                </div>
                              ) : (
                                <Card className="mt-2 rounded-xl border-slate-200 bg-slate-50/50 p-6 shadow-none">
                                  <div className="flex flex-col items-center justify-center gap-2">
                                    <Search className="h-8 w-8 text-slate-300" />
                                    <p className="text-sm text-slate-500">No member found in this project.</p>
                                  </div>
                                </Card>
                              )}
                            </div>
                          </Card>
                        ) : null}
                        <div className="grid gap-2">
                          {orderedParticipants.length === 0 ? (
                            <div className="p-2 text-sm text-gray-500">
                              No participants yet.
                            </div>
                          ) : (
                            orderedParticipants.map((p) => {
                              const roleMeta = roleMetaFor(p.role);
                              return (
                                <Card key={p.id} className="rounded-xl border-slate-200 bg-white px-3 py-2 shadow-none">
                                  <div className="flex items-center justify-between">
                                    <div className="flex min-w-0 items-center gap-4">
                                      <Avatar className="h-9 w-9">
                                        <AvatarFallback className="bg-indigo-100 text-xs font-semibold text-indigo-700">
                                          {participantInitialsForUserId(p.user)}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span className="truncate text-sm font-medium text-slate-800">
                                        {participantLabelForUserId(p.user)}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <Select
                                        value={roleMeta.value}
                                        onValueChange={(nextRole) => {
                                          void saveParticipantRole(p.id, nextRole);
                                        }}
                                      >
                                        <SelectTrigger className={`h-8 w-36 border-none px-2 text-xs font-medium ${roleMeta.className}`}>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {PARTICIPANT_ROLE_OPTIONS.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                              {opt.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <button
                                        type="button"
                                        onClick={() => removeParticipant(p.id)}
                                        disabled={removingParticipantIds.has(p.id)}
                                        className="rounded-md p-1 text-gray-400 transition hover:bg-gray-50 hover:text-red-500"
                                        aria-label="Remove participant"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>
                                </Card>
                              );
                            })
                          )}
                        </div>
                      </section>
                    </SortableBlock>
                  );
                }

                if (block.type === 'custom_block') {
                  return (
                    <SortableBlock
                      id={block.id}
                      key={block.id}
                      overlineLabel={workspaceBlockOverline(block)}
                      actions={(
                      <div className="flex items-center gap-2 rounded-md p-0">
                          <button
                            type="button"
                            onClick={() => copyBlock(block.id)}
                            className="rounded p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                            aria-label="Copy block"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeBlock(block.id)}
                            className="rounded p-1 text-slate-400 hover:bg-slate-50 hover:text-red-600"
                            aria-label="Delete block"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    >
                      <CustomBlock
                        title={block.title ?? 'Custom Block'}
                        content={block.content ?? ''}
                        onTitleChange={(value) =>
                          setBlocks((prev) => prev.map((b) => (b.id === block.id ? { ...b, title: value } : b)))
                        }
                        onContentChange={(value) =>
                          setBlocks((prev) => prev.map((b) => (b.id === block.id ? { ...b, content: value } : b)))
                        }
                      />
                    </SortableBlock>
                  );
                }

                return (
                  <SortableBlock
                    id={block.id}
                    key={block.id}
                    overlineLabel={workspaceBlockOverline(block)}
                    actions={(
                      <div className="flex items-center gap-2 rounded-md p-0">
                        <button
                          type="button"
                          onClick={() => copyBlock(block.id)}
                          className="rounded p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                          aria-label="Copy block"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeBlock(block.id)}
                          className="rounded p-1 text-slate-400 hover:bg-slate-50 hover:text-red-600"
                          aria-label="Delete block"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  >
                    <ArtifactsSection
                      artifactsCount={orderedArtifacts.length}
                      orderedArtifacts={orderedArtifacts}
                      addControl={
                        <DropdownMenu open={artifactDropdownOpen} onOpenChange={setArtifactDropdownOpen}>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="text-sm text-gray-500 transition hover:text-gray-800"
                              disabled={addingArtifact}
                            >
                              + Add
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuItem
                              onSelect={() => {
                                setArtifactSearchMode(true);
                                setArtifactSearchText('');
                              }}
                            >
                              <Search className="h-4 w-4" />
                              Search artifacts
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger disabled={artifactResourcesLoading}>
                                Spreadsheet
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent className="max-h-64 overflow-y-auto">
                                {artifactChoices.spreadsheet.length === 0 ? (
                                  <DropdownMenuItem disabled>
                                    {artifactResourcesLoading ? 'Loading…' : 'No spreadsheets'}
                                  </DropdownMenuItem>
                                ) : (
                                  artifactChoices.spreadsheet.map((row) => (
                                    <DropdownMenuItem
                                      key={`ss-${row.id}`}
                                      disabled={addingArtifact}
                                      onSelect={() => {
                                        void linkMeetingArtifact('spreadsheet', row.id);
                                      }}
                                    >
                                      {row.label}
                                    </DropdownMenuItem>
                                  ))
                                )}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger disabled={artifactResourcesLoading}>
                                Decisions
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent className="max-h-64 overflow-y-auto">
                                {artifactChoices.decision.length === 0 ? (
                                  <DropdownMenuItem disabled>
                                    {artifactResourcesLoading ? 'Loading…' : 'No decisions'}
                                  </DropdownMenuItem>
                                ) : (
                                  artifactChoices.decision.map((row) => (
                                    <DropdownMenuItem
                                      key={`d-${row.id}`}
                                      disabled={addingArtifact}
                                      onSelect={() => {
                                        void linkMeetingArtifact('decision', row.id);
                                      }}
                                    >
                                      {row.label}
                                    </DropdownMenuItem>
                                  ))
                                )}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger disabled={artifactResourcesLoading}>
                                Tasks
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent className="max-h-64 overflow-y-auto">
                                {artifactChoices.task.length === 0 ? (
                                  <DropdownMenuItem disabled>
                                    {artifactResourcesLoading ? 'Loading…' : 'No tasks'}
                                  </DropdownMenuItem>
                                ) : (
                                  artifactChoices.task.map((row) => (
                                    <DropdownMenuItem
                                      key={`t-${row.id}`}
                                      disabled={addingArtifact}
                                      onSelect={() => {
                                        void linkMeetingArtifact('task', row.id);
                                      }}
                                    >
                                      {row.label}
                                    </DropdownMenuItem>
                                  ))
                                )}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      }
                      searchPanel={
                        artifactSearchMode ? (
                          <Card className="mb-3 rounded-xl border-slate-200 bg-white/70 p-3 shadow-none">
                            <div className="relative">
                              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                              <Input
                                value={artifactSearchText}
                                onChange={(e) => setArtifactSearchText(e.currentTarget.value)}
                                placeholder="Search by name or description"
                                className="h-10 rounded-xl border border-transparent bg-slate-50 pl-9 pr-3 text-sm focus-visible:border-blue-400 focus-visible:bg-white"
                              />
                            </div>
                            <div className="mt-2">
                              {artifactSearchText.trim().length === 0 ? null : artifactSearchHits.length > 0 ? (
                                <div className="space-y-2">
                                  {artifactSearchHits.map((hit) => {
                                    const badge = artifactModuleBadge(hit.kind);
                                    return (
                                      <Card key={`${hit.kind}-${hit.id}`} className="rounded-lg border-slate-200 bg-white p-0 shadow-none">
                                        <button
                                          type="button"
                                          disabled={addingArtifact}
                                          onClick={() => {
                                            void linkMeetingArtifact(hit.kind, hit.id);
                                          }}
                                          className="flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-slate-50 disabled:opacity-50"
                                        >
                                          <div className="flex min-w-0 flex-1 items-start gap-3">
                                            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-600">
                                              <ArtifactTypeIcon kind={hit.kind} />
                                            </div>
                                            <div className="min-w-0">
                                              <div className="truncate text-sm font-medium text-slate-800">{hit.title}</div>
                                              {hit.subtitle ? (
                                                <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">{hit.subtitle}</div>
                                              ) : null}
                                            </div>
                                          </div>
                                          <span
                                            className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge.className}`}
                                          >
                                            {badge.label}
                                          </span>
                                        </button>
                                      </Card>
                                    );
                                  })}
                                </div>
                              ) : (
                                <Card className="mt-2 rounded-xl border-slate-200 bg-slate-50/50 p-6 shadow-none">
                                  <div className="flex flex-col items-center justify-center gap-2">
                                    <Search className="h-8 w-8 text-slate-300" />
                                    <p className="text-sm text-slate-500">No artifacts found in this project.</p>
                                  </div>
                                </Card>
                              )}
                            </div>
                          </Card>
                        ) : null
                      }
                      rows={orderedArtifacts.map((a) => {
                        const href =
                          Number.isFinite(projectId) && !Number.isNaN(projectId)
                            ? meetingArtifactHref(projectId, a.artifact_type, a.artifact_id)
                            : null;
                        const rawT = normalizeMeetingArtifactType(a.artifact_type);
                        const kind: ArtifactKind =
                          rawT === 'spreadsheet' || rawT === 'decision' || rawT === 'task' ? rawT : 'task';
                        const badge = artifactModuleBadge(kind);
                        const displayTitle = artifactRowTitle(a, artifactResources);
                        return (
                          <Card key={a.id} className="rounded-xl border-slate-200 bg-white px-3 py-2 shadow-none">
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex min-w-0 flex-1 items-center gap-4">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-600">
                                  <ArtifactTypeIcon kind={kind} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-sm font-medium text-slate-800">{displayTitle}</div>
                                  {href ? (
                                    <Link
                                      href={href}
                                      className="mt-1 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                                    >
                                      Open <ExternalLink className="h-3 w-3" />
                                    </Link>
                                  ) : null}
                                </div>
                                <span
                                  className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge.className}`}
                                >
                                  {badge.label}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeArtifact(a.id)}
                                disabled={removingArtifactIds.has(a.id)}
                                className="shrink-0 rounded-md p-1 text-gray-400 transition hover:bg-gray-50 hover:text-red-500"
                                aria-label="Unlink artifact"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </Card>
                        );
                      })}
                    />
                  </SortableBlock>
                );
              })}
              <div className="w-full">
                <button
                  type="button"
                  onClick={() => addBlock('custom_block')}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white py-3 text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-800"
                >
                  <Plus className="h-4 w-4 shrink-0" aria-hidden />
                  Add custom block
                </button>
              </div>
            </div>
          </SortableContext>
        </DndContext>
        </motion.div>

        <TemplateSidebar
          isOpen={isSidebarOpen}
          blocks={blocks}
          templateList={templateList}
          onApplyTemplate={applySidebarTemplate}
          onEnterCreateMode={enterCreateMode}
          onLeaveConfigureMode={leaveTemplateConfigureMode}
          onAddDefaultBlock={addBlock}
          onCreateTemplate={createCustomTemplate}
          templateDirty={templateDirty}
          activeTemplateId={activeTemplateId}
          onSaveTemplateAgendaChanges={saveTemplateLayout}
          onAfterSave={() => setIsSidebarOpen(false)}
          onDeleteTemplate={deleteCustomTemplate}
        />
      </div>
    );
  };

  return (
    <ProtectedRoute>
      <Layout mainScrollMode="page">
        <div className="min-h-screen bg-[#F8F9FA]">
        <div className="mx-auto w-full max-w-5xl px-6 py-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-gray-900">Meeting Preparation Workspace</h1>
              <p className="text-sm text-gray-600">
                Project:{' '}
                <span className="font-medium">
                  {project?.name?.trim() || (Number.isNaN(projectId) ? '—' : `#${projectId}`)}
                </span>
              </p>
              {layoutSaving ? <p className="text-xs text-slate-400">Saving layout…</p> : null}
            </div>
            <div className="flex items-center gap-3">
              {isLayoutDirty ? (
                <div className="flex flex-wrap items-center gap-2">
                  {isActiveCustomTemplate ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void saveLayoutNow('meeting_only')}
                        disabled={layoutSaving}
                        title="Save layout to this meeting only. Does not change the reusable template."
                        className={
                          layoutSaveFeedback === 'saved'
                            ? 'inline-flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700'
                            : layoutSaveFeedback === 'saving'
                              ? 'inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600'
                              : 'inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50'
                        }
                      >
                        {layoutSaveFeedback === 'saved' ? <Check className="h-4 w-4" /> : null}
                        {layoutSaveFeedback === 'saved'
                          ? 'Saved!'
                          : layoutSaveFeedback === 'saving'
                            ? 'Saving...'
                            : 'Save to meeting'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void saveLayoutNow('meeting_and_template')}
                        disabled={layoutSaving}
                        title="Update this meeting and the saved template (sidebar) for future use."
                        className={
                          layoutSaveFeedback === 'saved'
                            ? 'inline-flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700'
                            : layoutSaveFeedback === 'saving'
                              ? 'inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600'
                              : 'inline-flex items-center gap-2 rounded-md border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-800 transition hover:bg-violet-100'
                        }
                      >
                        {layoutSaveFeedback === 'saved' ? <Check className="h-4 w-4" /> : null}
                        {layoutSaveFeedback === 'saved'
                          ? 'Saved!'
                          : layoutSaveFeedback === 'saving'
                            ? 'Saving...'
                            : 'Save to template'}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void saveLayoutNow('meeting_only')}
                      disabled={layoutSaving}
                      className={
                        layoutSaveFeedback === 'saved'
                          ? 'inline-flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700'
                          : layoutSaveFeedback === 'saving'
                            ? 'inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600'
                            : 'inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50'
                      }
                    >
                      {layoutSaveFeedback === 'saved' ? <Check className="h-4 w-4" /> : null}
                      {layoutSaveFeedback === 'saved'
                        ? 'Saved!'
                        : layoutSaveFeedback === 'saving'
                          ? 'Saving...'
                          : 'Save layout'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={discardWorkspaceLayoutChanges}
                    disabled={layoutSaving}
                    className="text-sm text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              ) : null}
              <Link href={`/projects/${projectId}`} className="text-sm text-blue-600 hover:underline">
                Back to project
              </Link>
            </div>
          </div>

          {renderBody()}
        </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}

