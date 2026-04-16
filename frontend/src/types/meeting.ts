// frontend/src/types/meeting.ts

export type MeetingStatus = 'draft' | 'planned' | 'in_progress' | 'completed' | 'archived';

/** In-app path + label from the API for contextual navigation (meetings ↔ decisions ↔ tasks). */
export interface KnowledgeNavigationLink {
  id: number;
  title: string;
  /** Preferred deep link; falls back to ``url`` when absent. */
  url: string;
  detail_url?: string;
  status?: string;
  assignee_name?: string | null;
}

/** Task/decision detail: meeting this artifact was generated from (reverse nav). */
export interface OriginMeetingPayload {
  id: number;
  title: string;
  /** Deep link to the meeting workspace (preferred when present). */
  url: string;
  detail_url?: string;
  scheduled_date?: string | null;
  /** Meeting type slug (``MeetingTypeDefinition.slug``). */
  type?: string | null;
  project_id?: number;
}

export interface Meeting {
  id: number;
  project: number;
  title: string;
  meeting_type: string;
  objective: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  external_reference: string | null;
  status: MeetingStatus;
  /** Included on create/detail when the API returns embedded discovery fields. */
  participants?: MeetingListParticipant[];
  tags?: MeetingListTag[];
  /** Origin-based: ``MeetingDecisionOrigin`` / ``MeetingTaskOrigin`` (mandatory navigation). */
  generated_decisions?: KnowledgeNavigationLink[];
  generated_tasks?: KnowledgeNavigationLink[];
  generated_decisions_count?: number;
  generated_tasks_count?: number;
  /** ``ArtifactLink`` only, excluding ids already in generated (supplementary). */
  related_decisions?: KnowledgeNavigationLink[];
  related_tasks?: KnowledgeNavigationLink[];
  /** Workspace layout: legacy list of blocks, or `{ blocks, nestedSections }`. */
  layout_config?: unknown | null;
}

/** List row from GET /meetings/ (knowledge discovery). */
export interface MeetingListParticipant {
  user_id: number;
  role: string | null;
}

export interface MeetingListTag {
  slug: string;
  label: string;
}

export interface MeetingListItem {
  id: number;
  title: string;
  summary: string;
  scheduled_date: string | null;
  /** Time of day (`HH:MM:SS`) when present on detail; list rows omit this. */
  scheduled_time?: string | null;
  status: MeetingStatus;
  meeting_type: string;
  meeting_type_slug: string;
  participants: MeetingListParticipant[];
  tags: MeetingListTag[];
  decision_count: number;
  task_count: number;
  /** Same values as ``decision_count`` / ``task_count`` (explicit naming for UI). */
  generated_decisions_count?: number;
  generated_tasks_count?: number;
  generated_decisions: KnowledgeNavigationLink[];
  generated_tasks: KnowledgeNavigationLink[];
  related_decisions: KnowledgeNavigationLink[];
  related_tasks: KnowledgeNavigationLink[];
  is_archived: boolean;
}

export interface PaginatedMeetingsList {
  count: number;
  next: string | null;
  previous: string | null;
  results: MeetingListItem[];
  /**
   * Hub list (normalized in `meetingsApi.listMeetingsPaginated` from JSON snake_case).
   * **B** = lane total without discovery filters; **A** = lane + filters (full queryset, not page size).
   */
  incomingLaneTotal?: number;
  incomingResultCount?: number;
  completedLaneTotal?: number;
  completedResultCount?: number;
}

/**
 * Shape of meetings **hub URL state** and the object passed around before building the list API request.
 *
 * **Sent to `GET /api/v1/projects/{project_id}/meetings/`** (see `buildMeetingListParams` in `meetingsApi.ts`):
 * `q`, `meeting_type`, `participant` (repeated ids), `exclude_participant` (repeated ids), `tag`, `date_from`, `date_to`, `is_archived`,
 * `has_generated_decisions`, `has_generated_tasks`, `ordering`, `page`.
 *
 * **Per-section list ordering (Incoming / Completed)** is **React state** on the hub page (`MeetingSortKey` in
 * `meetingSectionSort.ts`), not URL or API parameters.
 */
export interface MeetingListQueryParams {
  q?: string;
  /** Meeting type slugs (OR). URL: repeated `meeting_type`. */
  meeting_type?: string[];
  tag?: string;
  /** Include meetings that have **any** of these participants (user ids). URL: repeated `participant`. */
  participant?: number[];
  /** Exclude meetings that include **any** of these participants. URL: repeated `exclude_participant`. */
  exclude_participant?: number[];
  date_from?: string;
  date_to?: string;
  is_archived?: boolean;
  /** Origin-based only (`MeetingDecisionOrigin`); not artifact / related. */
  has_generated_decisions?: boolean;
  /** Origin-based only (`MeetingTaskOrigin`); not artifact / related. */
  has_generated_tasks?: boolean;
  /**
   * Server-side list ordering. Default when omitted is **`-created_at`** (see OpenAPI + `DEFAULT_MEETING_ORDERING`).
   * Hub list fetch forces this for stable pagination.
   */
  ordering?: string;
  page?: number;
}

export interface MeetingCreateRequest {
  title: string;
  meeting_type: string;
  objective: string;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  external_reference?: string | null;
  status?: MeetingStatus;
  /** Optional on create: project member user IDs (see SMP-484 participants timing). */
  participant_user_ids?: number[];
  /** Optional workspace layout (list or `{ blocks, nestedSections }`). */
  layout_config?: unknown | null;
}

export interface MeetingUpdateRequest {
  title: string;
  meeting_type: string;
  objective: string;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  external_reference?: string | null;
  status: MeetingStatus;
}

export interface MeetingPartialUpdateRequest {
  title?: string;
  meeting_type?: string;
  objective?: string;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  external_reference?: string | null;
  status?: MeetingStatus;
  layout_config?: unknown | null;
}

export interface AgendaItem {
  id: number;
  meeting: number;
  content: string;
  order_index: number;
  is_priority: boolean;
}

export interface AgendaItemCreateRequest {
  content: string;
  order_index: number;
  is_priority?: boolean;
}

export interface AgendaItemUpdateRequest {
  content: string;
  order_index: number;
  is_priority: boolean;
}

export interface AgendaItemPartialUpdateRequest {
  content?: string;
  order_index?: number;
  is_priority?: boolean;
}

export interface AgendaItemsReorderItem {
  id: number;
  order_index: number;
}

export interface AgendaItemsReorderRequest {
  items: AgendaItemsReorderItem[];
}

export interface ParticipantLink {
  id: number;
  meeting: number;
  user: number;
  role: string | null;
}

export interface ParticipantLinkCreateRequest {
  user: number;
  role?: string | null;
}

export interface ParticipantLinkPartialUpdateRequest {
  role?: string | null;
}

export interface ArtifactLink {
  id: number;
  meeting: number;
  artifact_type: string;
  artifact_id: number;
}

export interface ArtifactLinkCreateRequest {
  artifact_type: string;
  artifact_id: number;
}

export interface MeetingDocument {
  id: number;
  meeting: number;
  content: string;
  yjs_state?: string;
  last_edited_by: number | null;
  created_at: string;
  updated_at: string;
}

/** Follow-up row on a meeting before it becomes a task (SMP-489). */
export interface MeetingActionItem {
  id: number;
  meeting: number;
  title: string;
  description: string;
  order_index: number;
  created_at?: string;
  updated_at?: string;
  converted_task_id: number | null;
}

export interface MeetingActionItemCreateRequest {
  title: string;
  description?: string;
  order_index?: number;
}

export interface MeetingActionItemPartialUpdateRequest {
  title?: string;
  description?: string;
  order_index?: number;
}

export interface ConvertActionItemToTaskRequest {
  owner_id?: number | null;
  due_date?: string | null;
  priority?: string | null;
  type?: string;
  current_approver_id?: number | null;
  create_as_draft?: boolean;
}

export interface BulkConvertActionItemRow extends ConvertActionItemToTaskRequest {
  action_item_id: number;
}

export interface BulkConvertActionItemsRequest {
  items: BulkConvertActionItemRow[];
}
