'use client';

import { useState, useRef, useEffect, KeyboardEvent, ChangeEvent } from 'react';
import { Send, Smile, Paperclip, X, Image, FileText, Film, Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import toast from 'react-hot-toast';
import type { MessageInputProps, MessageAttachment } from '@/types/chat';
import { 
  uploadAttachment, 
  validateFile, 
  getFileTypeFromMime,
  formatFileSize,
} from '@/lib/api/attachmentApi';

// Dynamically import emoji picker to avoid SSR issues
const EmojiPicker = dynamic(
  () => import('emoji-picker-react'),
  { 
    ssr: false,
    loading: () => (
      <div className="w-[350px] h-[400px] bg-white border border-gray-200 rounded-lg flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3CCED7]" />
      </div>
    )
  }
);

interface PendingAttachment {
  id: string;  // Temporary ID for UI
  file: File;
  preview?: string;
  progress: number;
  uploading: boolean;
  uploaded?: MessageAttachment;
  error?: string;
}

interface ExtendedMessageInputProps extends MessageInputProps {
  onSendWithAttachments?: (content: string, attachmentIds: number[]) => void;
}

export default function MessageInput({ 
  onSend, 
  onSendWithAttachments,
  disabled = false 
}: ExtendedMessageInputProps) {
  const [content, setContent] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target as Node) &&
        emojiButtonRef.current &&
        !emojiButtonRef.current.contains(event.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup previews on unmount
  useEffect(() => {
    return () => {
      pendingAttachments.forEach(att => {
        if (att.preview) {
          URL.revokeObjectURL(att.preview);
        }
      });
    };
  }, [pendingAttachments]);

  const handleSend = async () => {
    const trimmedContent = content.trim();
    const uploadedAttachments = pendingAttachments.filter(a => a.uploaded);
    
    // Must have content or attachments
    if (!trimmedContent && uploadedAttachments.length === 0) return;
    if (disabled) return;
    
    // Check if still uploading
    if (pendingAttachments.some(a => a.uploading)) {
      toast.error('Please wait for uploads to complete');
      return;
    }

    // Check for upload errors
    const hasErrors = pendingAttachments.some(a => a.error);
    if (hasErrors) {
      toast.error('Some files failed to upload. Remove them and try again.');
      return;
    }

    if (uploadedAttachments.length > 0 && onSendWithAttachments) {
      const attachmentIds = uploadedAttachments
        .map(a => a.uploaded?.id)
        .filter((id): id is number => id !== undefined);
      onSendWithAttachments(trimmedContent, attachmentIds);
    } else {
      onSend(trimmedContent);
    }
    
    // Clear state
    setContent('');
    setPendingAttachments([]);
    setShowEmojiPicker(false);
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmojiClick = (emojiData: { emoji: string }) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setContent(prev => prev + emojiData.emoji);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newContent = content.slice(0, start) + emojiData.emoji + content.slice(end);
    setContent(newContent);

    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + emojiData.emoji.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const toggleEmojiPicker = () => {
    setShowEmojiPicker(prev => !prev);
  };

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: PendingAttachment[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Validate file
      const { isValid, error } = validateFile(file);
      if (!isValid) {
        toast.error(error || 'Invalid file');
        continue;
      }

      // Create preview for images
      let preview: string | undefined;
      if (file.type.startsWith('image/')) {
        preview = URL.createObjectURL(file);
      }

      const tempId = `temp-${Date.now()}-${i}`;
      newAttachments.push({
        id: tempId,
        file,
        preview,
        progress: 0,
        uploading: true,
      });
    }

    if (newAttachments.length === 0) {
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setPendingAttachments(prev => [...prev, ...newAttachments]);
    setIsUploading(true);

    // Upload files
    for (const attachment of newAttachments) {
      try {
        const uploaded = await uploadAttachment(attachment.file, (progress) => {
          setPendingAttachments(prev => 
            prev.map(a => 
              a.id === attachment.id 
                ? { ...a, progress } 
                : a
            )
          );
        });

        setPendingAttachments(prev => 
          prev.map(a => 
            a.id === attachment.id 
              ? { ...a, uploading: false, uploaded } 
              : a
          )
        );
      } catch (error: any) {
        console.error('Upload failed:', error);
        const errorMsg = error?.response?.data?.error || 'Upload failed';
        
        setPendingAttachments(prev => 
          prev.map(a => 
            a.id === attachment.id 
              ? { ...a, uploading: false, error: errorMsg } 
              : a
          )
        );
        toast.error(`Failed to upload ${attachment.file.name}`);
      }
    }

    setIsUploading(false);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveAttachment = (id: string) => {
    const attachment = pendingAttachments.find(a => a.id === id);
    if (attachment?.preview) {
      URL.revokeObjectURL(attachment.preview);
    }
    setPendingAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
  };

  const getFileIcon = (file: File) => {
    const type = getFileTypeFromMime(file.type);
    switch (type) {
      case 'image':
        return <Image className="w-4 h-4" />;
      case 'video':
        return <Film className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const hasContent = content.trim().length > 0;
  const hasAttachments = pendingAttachments.length > 0;
  const canSend = (hasContent || pendingAttachments.some(a => a.uploaded)) && 
                  !pendingAttachments.some(a => a.uploading);

  return (
    <div className="px-4 py-3 border-t border-gray-200 bg-white relative">
      {/* Attachment Previews */}
      {hasAttachments && (
        <div className="mb-3 flex flex-wrap gap-2">
          {pendingAttachments.map((attachment) => (
            <div 
              key={attachment.id}
              className={`relative flex items-center gap-2 px-3 py-2 rounded-lg border ${
                attachment.error 
                  ? 'bg-red-50 border-red-200' 
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              {/* Preview Image or Icon */}
              {attachment.preview ? (
                <img 
                  src={attachment.preview} 
                  alt={attachment.file.name}
                  className="w-10 h-10 object-cover rounded"
                />
              ) : (
                <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center">
                  {getFileIcon(attachment.file)}
                </div>
              )}

              {/* File Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 truncate max-w-[120px]">
                  {attachment.file.name}
                </p>
                <p className="text-xs text-gray-500">
                  {formatFileSize(attachment.file.size)}
                </p>
              </div>

              {/* Upload Progress or Status */}
              {attachment.uploading && (
                <div className="flex items-center gap-1">
                  <Loader2 className="w-4 h-4 animate-spin text-[#3CCED7]" />
                  <span className="text-xs text-[#3CCED7]">{attachment.progress}%</span>
                </div>
              )}

              {attachment.error && (
                <span className="text-xs text-red-600">Failed</span>
              )}

              {attachment.uploaded && !attachment.uploading && (
                <span className="text-xs text-green-600">✓</span>
              )}

              {/* Remove Button */}
              <button
                onClick={() => handleRemoveAttachment(attachment.id)}
                className="p-1 hover:bg-gray-200 rounded-full transition-colors"
                aria-label="Remove attachment"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* Attachment Button */}
        <button
          onClick={handleAttachmentClick}
          disabled={disabled || isUploading}
          className="p-2 rounded-lg transition-colors flex-shrink-0 hover:bg-gray-100 text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Add attachment"
          title="Add attachment"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Emoji Button */}
        <button
          ref={emojiButtonRef}
          onClick={toggleEmojiPicker}
          disabled={disabled}
          className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
            showEmojiPicker 
              ? 'bg-[#3CCED7]/15 text-[#3CCED7]' 
              : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          aria-label="Add emoji"
          title="Add emoji"
        >
          <Smile className="w-5 h-5" />
        </button>

        {/* Text Input */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={hasAttachments ? "Add a message..." : "Type a message..."}
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed text-sm max-h-24 overflow-y-auto"
          style={{
            minHeight: '38px',
            maxHeight: '96px',
          }}
        />

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={!canSend || disabled}
          className="bg-[#3CCED7] hover:bg-[#2AB5BD] disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg p-2 transition-colors flex-shrink-0"
          aria-label="Send message"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <div 
          ref={emojiPickerRef}
          className="absolute bottom-full left-0 mb-2 z-50"
        >
          <EmojiPicker
            onEmojiClick={handleEmojiClick}
            width={350}
            height={400}
            searchPlaceHolder="Search emoji..."
            previewConfig={{
              showPreview: false,
            }}
          />
        </div>
      )}

      {/* Helper Text */}
      <p className="text-xs text-gray-500 mt-2">
        Press <kbd className="px-1 py-0.5 bg-gray-100 rounded text-gray-700">Enter</kbd> to send, <kbd className="px-1 py-0.5 bg-gray-100 rounded text-gray-700">Shift+Enter</kbd> for new line
      </p>
    </div>
  );
}
