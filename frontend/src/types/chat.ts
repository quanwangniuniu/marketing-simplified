// Chat feature TypeScript types
// Based on OpenAPI spec: /openapi/openapi_spec/chat.yaml

import type { DragEvent, MouseEvent } from 'react';

// ==================== User Types ====================

export interface User {
  id: number;
  email: string;
  username: string;
  is_online?: boolean;
}

export interface UserWithName extends User {
  first_name?: string;
  last_name?: string;
}

// ==================== Chat Types ====================

export type ChatType = 'private' | 'group';

export interface ChatParticipant {
  id: number;
  user: User;
  chat_id: number;
  joined_at: string;
  last_read_at?: string | null;
}

export interface Chat {
  id: number;
  project_id: number;
  project?: number; // Backend may send this instead of project_id
  type: ChatType;
  name?: string | null;
  participants: ChatParticipant[];
  created_at: string;
  updated_at: string;
  last_message?: Message | null;
  unread_count?: number;
}

// ==================== Message Types ====================

export type MessageStatusType = 'sent' | 'delivered' | 'read';

export interface MessageStatus {
  id: number;
  message_id: number;
  user_id: number;
  status: MessageStatusType;
  delivered_at?: string | null;
  read_at?: string | null;
}

export interface MessageAttachment {
  id: number;
  message: number | null;
  file_type: 'image' | 'video' | 'document';
  file_url: string;
  thumbnail_url: string | null;
  file_size: number;
  file_size_display: string;
  original_filename: string;
  mime_type: string;
  created_at: string;
}

export interface ChatContext {
  id: number;
  type: ChatType;
  name?: string | null;
}

export interface ChatFileListItem extends MessageAttachment {
  uploader: UserWithName;
  chat: ChatContext | null;
  message_id: number | null;
}

export interface Message {
  id: number;
  chat_id: number;
  chat?: number;  // Backend may send this instead of chat_id
  sender: User;
  content: string;
  is_forwarded?: boolean;
  forwarded_from?: {
    message_id: number | null;
    sender_display: string;
    created_at: string | null;
  } | null;
  created_at: string;
  updated_at: string;
  statuses?: MessageStatus[];
  is_read?: boolean;
  has_attachments?: boolean;
  attachment_count?: number;
  attachments?: MessageAttachment[];
}

// ==================== API Request/Response Types ====================

export interface CreateChatRequest {
  type: ChatType;
  project_id: number;
  participant_ids: number[];
  name?: string;
}

export interface CreateChatResponse extends Chat {}

export interface SendMessageRequest {
  chat_id: number;
  content: string;
  attachment_ids?: number[];
}

export interface SendMessageResponse extends Message {}

export interface ForwardBatchRequest {
  source_chat_id: number;
  source_message_ids: number[];
  target_chat_ids?: number[];
  target_user_ids?: number[];
}

export interface ForwardFailureItem {
  target_chat_id: number | null;
  target_user_id?: number | null;
  source_message_id: number | null;
  reason: string;
}

export interface ForwardBatchResponse {
  status: 'success' | 'partial_success' | 'failed';
  summary: {
    requested_messages: number;
    forwardable_messages: number;
    target_chats: number;
    attempted_sends: number;
    succeeded_sends: number;
    failed_sends: number;
  };
  resolved: {
    target_chat_ids: number[];
    created_private_chat_ids: number[];
    skipped_message_ids: number[];
  };
  failures: ForwardFailureItem[];
}

export interface GetChatsParams {
  project_id?: number;
  type?: ChatType;
  limit?: number;
  offset?: number;
}

export interface GetMessagesParams {
  chat_id: number;
  before?: string; // ISO timestamp for cursor-based pagination
  after?: string;  // ISO timestamp for cursor-based pagination
  limit?: number;
}

// Response type for messages with cursor pagination
export interface MessagesPaginatedResponse {
  results: Message[];
  next_cursor: string | null;
  prev_cursor: string | null;
  page_size: number;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface MarkAsReadRequest {
  message_id: number;
}

// ==================== WebSocket Types ====================

export type WebSocketMessageType = 
  | 'new_message'
  | 'chat_message'
  | 'message_status_update'
  | 'send_message'
  | 'typing_start'
  | 'typing_stop'
  | 'chat_created'
  | 'pong'
  | 'error';

export interface WebSocketMessage {
  type: WebSocketMessageType;
  message?: Message;
  chat?: Chat;
  chat_id?: number;
  content?: string;
  status?: MessageStatusType;
  message_id?: number;
  user_id?: number;
  error?: string;
}

// ==================== Store Types ====================

export interface ChatState {
  // Data
  chatsByProject: Record<number, Chat[]>; // Keyed by project_id
  currentChatId: number | null;  // For Messages page
  widgetChatId: number | null;   // For Chat Widget (independent)
  messages: Record<number, Message[]>; // Keyed by chat_id
  unreadCounts: Record<number, number>; // Keyed by chat_id
  globalUnreadCount: number; // Total unread across ALL projects
  
  // UI State
  isWidgetOpen: boolean;
  isMessagePageOpen: boolean;
  selectedProjectId: number | null;
  widgetProjectId: number | null;  // Widget's own project selection
  currentView: 'list' | 'chat';
  widgetView: 'list' | 'chat';     // Widget's own view state
  isLoading: boolean;
  
  // Actions
  setChatsForProject: (projectId: number, chats: Chat[]) => void;
  getChatsForProject: (projectId: number | null) => Chat[];
  addChat: (chat: Chat) => void;
  removeChat: (chatId: number) => void;
  updateChat: (chatId: number, updates: Partial<Chat>) => void;
  setCurrentChat: (chatId: number | null) => void;
  setWidgetChat: (chatId: number | null) => void;
  setWidgetProjectId: (projectId: number | null) => void;
  setWidgetView: (view: 'list' | 'chat') => void;
  
  setMessages: (chatId: number, messages: Message[]) => void;
  addMessage: (chatId: number, message: Message, currentUserId?: number) => void;
  prependMessages: (chatId: number, messages: Message[]) => void;
  updateMessage: (messageId: number, updates: Partial<Message>) => void;
  
  updateUnreadCount: (chatId: number, count: number) => void;
  decrementUnreadCount: (chatId: number) => void;
  
  // Global unread count actions
  fetchGlobalUnreadCount: () => Promise<number>;
  setGlobalUnreadCount: (count: number) => void;
  incrementGlobalUnreadCount: () => void;
  decrementGlobalUnreadCount: (amount?: number) => void;
  
  openWidget: () => void;
  closeWidget: () => void;
  setMessagePageOpen: (isOpen: boolean) => void;
  setSelectedProjectId: (projectId: number | null) => void;
  setView: (view: 'list' | 'chat') => void;
  
  setLoading: (loading: boolean) => void;
  
  // Helpers
  getCurrentChat: () => Chat | undefined;
  getCurrentMessages: () => Message[];
  getTotalUnreadCount: () => number;
}

// ==================== Component Props Types ====================

export interface ChatWidgetProps {
  projectId: string;
}

export interface ChatListProps {
  chats: Chat[];
  currentChatId: number | null;
  onSelectChat: (chatId: number) => void;
  onCreateChat: () => void;
  roleByUserId?: Record<number, string>;
}

export interface ChatListItemProps {
  chat: Chat;
  isActive: boolean;
  onClick: () => void;
  roleByUserId?: Record<number, string>;
  /** Show star / unstar control (Messages sidebar). */
  showStarToggle?: boolean;
  isStarred?: boolean;
  onStarToggle?: (e: MouseEvent<HTMLElement>) => void;
  /** HTML5 drag — starred section reordering. */
  draggable?: boolean;
  onDragStart?: (e: DragEvent<HTMLElement>) => void;
  onDragOver?: (e: DragEvent<HTMLElement>) => void;
  onDrop?: (e: DragEvent<HTMLElement>) => void;
}

export interface ChatWindowProps {
  chat: Chat;
  messages: Message[];
  onBack: () => void;
  onSendMessage: (content: string) => void;
  onLoadMore: () => void;
  hasMore: boolean;
  isLoading: boolean;
}

export interface MessageListProps {
  messages: Message[];
  currentUserId: number;
  onLoadMore: () => void;
  hasMore: boolean;
  isLoading: boolean;
  roleByUserId?: Record<number, string>;
  isGroupChat?: boolean;
  isSelectMode?: boolean;
  selectedMessageIds?: number[];
  onToggleSelectMessage?: (messageId: number) => void;
}

export interface MessageItemProps {
  message: Message;
  isOwnMessage: boolean;
  showSender?: boolean;
  senderRole?: string;
  isSelectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (messageId: number) => void;
  /** When true, visually emphasize this message (e.g. jump target). */
  isHighlighted?: boolean;
}

export interface MessageInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
}

export interface CreateChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onChatCreated: (chatId: number) => void;
  /** When set, only group (channel) creation is shown — for Slack-style “Add channel”. */
  variant?: 'default' | 'channel';
}

/** Row from GET /api/chat/starred/?project_id= */
export interface ChatStarRow {
  id: number;
  position: number;
  chat: Chat;
  created_at: string;
  updated_at: string;
}

export interface ParticipantSelectorProps {
  projectId: string;
  selectedIds: number[];
  onSelect: (ids: number[]) => void;
  maxSelection?: number;
  currentUserId: number;
}

// ==================== Project Member Types ====================

export interface ProjectMember {
  id: number;
  user: User;
  project: {
    id: number;
    name: string;
  };
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ==================== Link Preview Types ====================

export interface LinkPreview {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  site_name: string | null;
  type: string;
}
