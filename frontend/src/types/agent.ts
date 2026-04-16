// Type definitions for AI Agent feature

// ==================== Session Types ====================

export interface AgentSession {
  id: string;
  project_id: number;
  created_by: number;
  title?: string | null;
  status?: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
}

export interface AgentSessionDetail extends AgentSession {
  messages: AgentMessage[];
  follow_up_available?: boolean;
  follow_up_started?: boolean;
}

export interface UpdateSessionRequest {
  title?: string;
}

export interface CreateSessionRequest {
  project_id?: number;
}

// ==================== Message Types ====================

export type AgentMessageRole = 'user' | 'assistant';

export interface AgentMessage {
  id: string;
  session_id: number;
  role: AgentMessageRole;
  content: string;
  message_type?: string;
  created_at: string;
  data?: AgentMessageData | null;
}

export interface AgentMessageData {
  anomalies?: AnomalyItem[];
  decision_id?: number;
  task_ids?: number[];
  board_id?: string;
  event_type?: string;
  status?: string;
  suggested_decision?: SuggestedDecision;
  recommended_tasks?: RecommendedTask[];
  file_id?: string;
  workflow_run_id?: string;
  session_id?: string;
  filename?: string;
  original_filename?: string;
  row_count?: number;
  column_count?: number;
  step_order?: number;
  step_name?: string;
  total_steps?: number;
}

// ==================== SSE Stream Types ====================

export type SSEEventType =
  | 'text'
  | 'analysis'
  | 'confirmation_request'
  | 'follow_up_prompt'
  | 'decision_draft'
  | 'task_created'
  | 'miro_status'
  | 'file_uploaded'
  | 'calendar_invite'
  | 'calendar_updated'
  | 'step_progress'
  | 'column_mapping'
  | 'done'
  | 'error';

export interface SSEEvent {
  type: SSEEventType;
  content?: string;
  data?: AgentMessageData;
}

// ==================== Chat Request ====================

export type AgentAction = 'analyze' | 'confirm_decision' | 'create_tasks' | 'generate_miro' | 'distribute_message' | 'start_follow_up' | 'cancel_follow_up' | 'confirm_columns';

export interface CalendarContextPayload {
  type: 'calendar' | 'event';
  eventId?: string;
  eventTitle?: string;
  calendarId?: string;
  startDatetime?: string;
  endDatetime?: string;
  description?: string;
  calendarIds?: string[];
  currentView?: string;
  currentDate?: string;
  userTimezone?: string;
}

export interface AgentChatRequest {
  message: string;
  spreadsheet_id?: number;
  csv_filename?: string;
  action?: AgentAction;
  calendar_context?: CalendarContextPayload;
  workflow_id?: string;
  // User-approved column mapping for confirm_columns action.
  // Format: {original_header: canonical_name or "unknown"}
  column_mapping?: Record<string, string>;
}

// ==================== Analysis Types ====================

export type AnomalySeverity = 'critical' | 'warning' | 'info';

export interface AnomalyItem {
  metric: string;
  movement: string;
  severity: AnomalySeverity;
  current_value: number | string;
  previous_value: number | string;
  change_percent: number;
  campaign?: string | null;
  ad_set?: string | null;
  description: string;
}

// ==================== Spreadsheet Selector ====================

export interface AgentSpreadsheet {
  id: number;
  name: string;
  project_id: number;
  created_at: string;
  updated_at: string;
}

// ==================== UI State Types ====================

// ==================== Column Detection Types ====================

export interface ColumnDetectionData {
  schema_key: string | null
  schema_name: string
  source: 'rule' | 'llm' | 'none'
  confidence: number
  mappings: Record<string, string>
  categories: Record<string, string>
  unrecognized: string[]
  column_confidences: Record<string, number>
}

// ==================== Imported CSV File ====================

export interface ImportedCSVFile {
  id: string;
  filename: string;
  original_filename: string;
  row_count: number;
  column_count: number;
  file_size: number;
  created_at: string;
}

// ==================== Analysis Result Types ====================

export interface AnalysisResult {
  anomalies: AnomalyItem[];
  suggested_decision?: SuggestedDecision;
  recommended_tasks?: RecommendedTask[];
}

export interface SuggestedDecision {
  title: string;
  context_summary: string;
  reasoning: string;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  confidence: number;
  options: DecisionOption[];
}

export interface DecisionOption {
  text: string;
  order: number;
}

export interface RecommendedTask {
  type: string;
  summary: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

// ==================== Workflow Step State ====================

export interface WorkflowStepState {
  analysisComplete: boolean;
  decisionCreated: boolean;
  tasksCreated: boolean;
}

// ==================== Workflow Types ====================

export type WorkflowStepType =
  | 'analyze_data'
  | 'call_dify'
  | 'call_llm'
  | 'create_decision'
  | 'create_tasks'
  | 'custom_api'
  | 'await_confirmation'
  | 'detect_columns'
  | 'normalize_data';

export interface AgentWorkflowStep {
  id: string;
  name: string;
  step_type: WorkflowStepType;
  order: number;
  config: Record<string, unknown>;
  description?: string;
  created_at?: string;
}

export interface AgentWorkflowDefinition {
  id: string;
  name: string;
  description: string;
  is_default: boolean;
  is_system: boolean;
  status: 'active' | 'draft' | 'archived';
  step_count?: number;
  steps?: AgentWorkflowStep[];
  created_at: string;
  updated_at?: string;
}

export type StepExecutionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'awaiting';

export interface AgentStepExecution {
  id: string;
  step_order: number;
  step_name: string;
  status: StepExecutionStatus;
  input_data?: Record<string, unknown>;
  output_data?: Record<string, unknown>;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
}

export interface AgentWorkflowRun {
  id: string;
  session: string;
  workflow_definition?: string;
  status: string;
  current_step_order?: number;
  analysis_result?: Record<string, unknown>;
  created_tasks?: unknown[];
  error_message?: string;
  step_executions?: AgentStepExecution[];
  created_at: string;
  updated_at: string;
}
