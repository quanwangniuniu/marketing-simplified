// Attachment API client
import api from '../api';
import type { ChatFileListItem, MessageAttachment } from '@/types/chat';

// Re-export MessageAttachment for convenience (single source of truth is types/chat.ts)
export type { MessageAttachment };

// File size limits (in bytes)
export const FILE_SIZE_LIMITS = {
  image: 10 * 1024 * 1024,    // 10 MB
  video: 25 * 1024 * 1024,    // 25 MB
  document: 20 * 1024 * 1024, // 20 MB
};

// Allowed MIME types
export const ALLOWED_MIME_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  video: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'],
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
  ],
};

/**
 * Get file type from MIME type
 */
export function getFileTypeFromMime(mimeType: string): 'image' | 'video' | 'document' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  return 'document';
}

/**
 * Validate file before upload
 */
export function validateFile(file: File): { isValid: boolean; error?: string } {
  const fileType = getFileTypeFromMime(file.type);
  const maxSize = FILE_SIZE_LIMITS[fileType];
  
  // Check file size
  if (file.size > maxSize) {
    const maxMB = maxSize / (1024 * 1024);
    return {
      isValid: false,
      error: `File too large. Maximum size for ${fileType} is ${maxMB} MB`,
    };
  }
  
  // Check MIME type
  const allowedTypes = [
    ...ALLOWED_MIME_TYPES.image,
    ...ALLOWED_MIME_TYPES.video,
    ...ALLOWED_MIME_TYPES.document,
  ];
  
  if (!allowedTypes.includes(file.type)) {
    return {
      isValid: false,
      error: `File type "${file.type}" is not allowed`,
    };
  }
  
  return { isValid: true };
}

/**
 * Upload an attachment
 */
export async function uploadAttachment(
  file: File,
  onProgress?: (progress: number) => void
): Promise<MessageAttachment> {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await api.post('/api/chat/attachments/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (progressEvent.total && onProgress) {
        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(progress);
      }
    },
  });
  
  return response.data;
}

/**
 * Get attachment details
 */
export async function getAttachment(attachmentId: number): Promise<MessageAttachment> {
  const response = await api.get(`/api/chat/attachments/${attachmentId}/`);
  return response.data;
}

/**
 * Delete an unlinked attachment
 */
export async function deleteAttachment(attachmentId: number): Promise<void> {
  await api.delete(`/api/chat/attachments/${attachmentId}/`);
}

export async function listAccessibleChatFiles(params: {
  projectId: number;
  page?: number;
  pageSize?: number;
}): Promise<{
  results: ChatFileListItem[];
  page: number;
  page_size: number;
  total: number;
}> {
  const response = await api.get('/api/chat/attachments/files/', {
    params: {
      project_id: params.projectId,
      page: params.page ?? 1,
      page_size: params.pageSize ?? 25,
    },
  });
  return response.data;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * File icon type for use with Lucide icons
 */
export type FileIconType = 'image' | 'video' | 'pdf' | 'word' | 'excel' | 'presentation' | 'file';

/**
 * Get file icon type based on MIME type
 * Use this with Lucide icons: Image, Film, FileText, File, etc.
 */
export function getFileIconType(mimeType: string): FileIconType {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.includes('pdf')) return 'pdf';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'word';
  if (mimeType.includes('excel') || mimeType.includes('sheet')) return 'excel';
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'presentation';
  return 'file';
}

export default {
  uploadAttachment,
  getAttachment,
  deleteAttachment,
  listAccessibleChatFiles,
  validateFile,
  getFileTypeFromMime,
  formatFileSize,
  getFileIconType,
};

