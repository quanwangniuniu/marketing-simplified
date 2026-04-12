// Chat API client
import api from '../api';
import type {
  Chat,
  ChatStarRow,
  Message,
  CreateChatRequest,
  CreateChatResponse,
  SendMessageRequest,
  SendMessageResponse,
  ForwardBatchRequest,
  ForwardBatchResponse,
  GetChatsParams,
  GetMessagesParams,
  PaginatedResponse,
} from '@/types/chat';

// ==================== Chat Endpoints ====================

/**
 * Get all chats for the current user, optionally filtered by project
 */
export const getChats = async (params?: GetChatsParams): Promise<PaginatedResponse<Chat>> => {
  const response = await api.get('/api/chat/chats/', { params });
  return response.data;
};

/**
 * Get a specific chat by ID
 */
export const getChat = async (chatId: number): Promise<Chat> => {
  const response = await api.get(`/api/chat/chats/${chatId}/`);
  return response.data;
};

/**
 * Create a new chat (private or group)
 */
export const createChat = async (data: CreateChatRequest): Promise<CreateChatResponse> => {
  // Transform project_id to project (backend expects 'project' field)
  const payload = {
    type: data.type,
    project: data.project_id, // Backend expects 'project' not 'project_id'
    participant_ids: data.participant_ids,
    ...(data.name && { name: data.name }), // Only include name if provided
  };
  
  const response = await api.post('/api/chat/chats/', payload);
  return response.data;
};

/**
 * Delete a chat
 */
export const deleteChat = async (chatId: number): Promise<void> => {
  await api.delete(`/api/chat/chats/${chatId}/`);
};

// ==================== Starred chats ====================

export const listStarredChats = async (projectId: number): Promise<ChatStarRow[]> => {
  const response = await api.get('/api/chat/starred/', { params: { project_id: projectId } });
  return response.data;
};

export const starChat = async (chatId: number): Promise<ChatStarRow> => {
  const response = await api.post('/api/chat/starred/', { chat_id: chatId });
  return response.data;
};

export const unstarChat = async (chatId: number): Promise<void> => {
  await api.delete(`/api/chat/starred/${chatId}/`);
};

export const reorderStarredChats = async (
  projectId: number,
  chatIds: number[]
): Promise<void> => {
  await api.post('/api/chat/starred/reorder/', {
    project_id: projectId,
    chat_ids: chatIds,
  });
};

/**
 * Add a participant to a group chat
 */
export const addParticipant = async (chatId: number, userId: number): Promise<Chat> => {
  const response = await api.post(`/api/chat/chats/${chatId}/add_participant/`, {
    user_id: userId,
  });
  return response.data;
};

/**
 * Remove a participant from a group chat
 */
export const removeParticipant = async (chatId: number, userId: number): Promise<Chat> => {
  const response = await api.post(`/api/chat/chats/${chatId}/remove_participant/`, {
    user_id: userId,
  });
  return response.data;
};

// ==================== Message Endpoints ====================

/**
 * Get messages for a specific chat with cursor-based pagination
 */
export const getMessages = async (params: GetMessagesParams): Promise<{
  results: Message[];
  next_cursor: string | null;
  prev_cursor: string | null;
  page_size: number;
}> => {
  // Transform params to match backend API (page_size instead of limit)
  const queryParams: Record<string, any> = {
    chat_id: params.chat_id,
  };
  
  if (params.limit) {
    queryParams.page_size = params.limit;
  }
  if (params.before) {
    queryParams.before = params.before;
  }
  if (params.after) {
    queryParams.after = params.after;
  }
  
  const response = await api.get('/api/chat/messages/', { params: queryParams });
  return response.data;
};

/**
 * Get a specific message by ID
 */
export const getMessage = async (messageId: number): Promise<Message> => {
  const response = await api.get(`/api/chat/messages/${messageId}/`);
  return response.data;
};

/**
 * Send a new message
 */
export const sendMessage = async (data: SendMessageRequest): Promise<SendMessageResponse> => {
  // Transform chat_id to chat (backend expects 'chat' field)
  const payload: Record<string, any> = {
    chat: data.chat_id, // Backend expects 'chat' not 'chat_id'
    content: data.content,
  };
  
  // Include attachment_ids if present
  if (data.attachment_ids && data.attachment_ids.length > 0) {
    payload.attachment_ids = data.attachment_ids;
  }
  
  const response = await api.post('/api/chat/messages/', payload);
  return response.data;
};

/**
 * Mark a message as read
 */
export const markMessageAsRead = async (messageId: number): Promise<Message> => {
  const response = await api.post(`/api/chat/messages/${messageId}/mark_as_read/`);
  return response.data;
};

/**
 * Mark all messages in a chat as read (via backend endpoint)
 */
export const markChatAsRead = async (chatId: number): Promise<void> => {
  await api.post(`/api/chat/chats/${chatId}/mark_as_read/`);
};

/**
 * Forward multiple messages to multiple chats/users
 */
export const forwardMessagesBatch = async (
  data: ForwardBatchRequest
): Promise<ForwardBatchResponse> => {
  const payload = {
    source_chat_id: data.source_chat_id,
    source_message_ids: data.source_message_ids,
    target_chat_ids: data.target_chat_ids || [],
    target_user_ids: data.target_user_ids || [],
  };

  const response = await api.post('/api/chat/messages/forward_batch/', payload);
  return response.data;
};

// ==================== Helper Functions ====================

/**
 * Check if a private chat already exists between two users
 */
export const findPrivateChat = async (
  projectId: number,
  otherUserId: number
): Promise<Chat | null> => {
  try {
    const response = await getChats({
      project_id: projectId,
      type: 'private',
      limit: 100,
    });
    
    // Find chat with the specific user
    const existingChat = response.results.find(chat => {
      return chat.participants.some(p => p.user.id === otherUserId);
    });
    
    return existingChat || null;
  } catch (error) {
    console.error('Error finding private chat:', error);
    return null;
  }
};

/**
 * Get unread message count
 * @param chatId - Optional. If provided, returns unread count for specific chat.
 *                 If not provided, returns total unread count across ALL chats/projects.
 */
export const getUnreadCount = async (chatId?: number): Promise<number> => {
  try {
    const params = chatId ? { chat_id: chatId } : {};
    const response = await api.get('/api/chat/messages/unread_count/', { params });
    return response.data.unread_count || 0;
  } catch (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }
};

// Export all functions as a single API object (optional alternative style)
const chatApi = {
  getChats,
  getChat,
  createChat,
  deleteChat,
  listStarredChats,
  starChat,
  unstarChat,
  reorderStarredChats,
  addParticipant,
  removeParticipant,
  getMessages,
  getMessage,
  sendMessage,
  forwardMessagesBatch,
  markMessageAsRead,
  markChatAsRead,
  findPrivateChat,
  getUnreadCount,
};

export default chatApi;
