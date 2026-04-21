'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuthStore } from '@/lib/authStore';
import { useChatData } from '@/hooks/useChatData';
import { findPrivateChat } from '@/lib/api/chatApi';
import type { CreateChatDialogProps, ChatType } from '@/types/chat';
import ParticipantSelector from './ParticipantSelector';
import toast from 'react-hot-toast';

export default function CreateChatDialog({
  isOpen,
  onClose,
  projectId,
  onChatCreated,
  variant = 'default',
}: CreateChatDialogProps) {
  // Use selectors for stable references
  const user = useAuthStore(state => state.user);
  const { createNewChat } = useChatData({ projectId });
  
  const [chatType, setChatType] = useState<ChatType>(
    variant === 'channel' ? 'group' : 'private'
  );
  const [groupName, setGroupName] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<number[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (isOpen && variant === 'channel') {
      setChatType('group');
    }
  }, [isOpen, variant]);

  // Validation
  const isValid = () => {
    if (chatType === 'private') {
      return selectedParticipants.length === 1;
    }
    if (variant === 'channel') {
      return selectedParticipants.length >= 1 && groupName.trim() !== '';
    }
    return selectedParticipants.length >= 2 && groupName.trim() !== '';
  };

  // Reset form
  const resetForm = () => {
    setChatType(variant === 'channel' ? 'group' : 'private');
    setGroupName('');
    setSelectedParticipants([]);
  };

  // Handle close
  const handleClose = () => {
    if (!isCreating) {
      resetForm();
      onClose();
    }
  };

  // Handle create
  const handleCreate = async () => {
    if (!isValid() || !user || isCreating) return;

    try {
      setIsCreating(true);

      // For private chats, check if one already exists
      if (chatType === 'private' && selectedParticipants.length === 1) {
        const existingChat = await findPrivateChat(parseInt(projectId), selectedParticipants[0]);
        
        if (existingChat) {
          toast.success('Opening existing chat with this user');
          resetForm();
          onChatCreated(existingChat.id);
          return;
        }
      }

      // Backend will automatically add current user to participants
      const newChat = await createNewChat({
        type: chatType,
        project_id: parseInt(projectId),
        participant_ids: selectedParticipants,
        name: chatType === 'group' ? groupName.trim() : undefined,
      });

      resetForm();
      onChatCreated(newChat.id);
    } catch (error: any) {
      console.error('Error creating chat:', error);
      console.error('Error response:', error?.response?.data);
      
      // Extract error message from various possible formats
      const errorData = error?.response?.data;
      let errorMsg = '';
      
      if (typeof errorData === 'string') {
        errorMsg = errorData;
      } else if (errorData?.detail) {
        errorMsg = errorData.detail;
      } else if (errorData?.error) {
        errorMsg = errorData.error;
      } else if (errorData?.non_field_errors) {
        errorMsg = Array.isArray(errorData.non_field_errors) 
          ? errorData.non_field_errors[0] 
          : errorData.non_field_errors;
      } else if (errorData?.message) {
        errorMsg = errorData.message;
      } else if (errorData) {
        // Check for field-level errors
        const fieldErrors = Object.entries(errorData)
          .filter(([key]) => key !== 'status' && key !== 'code')
          .map(([key, value]) => `${key}: ${Array.isArray(value) ? value[0] : value}`)
          .join(', ');
        if (fieldErrors) {
          errorMsg = fieldErrors;
        }
      }
      
      // Check if error is about duplicate chat
      if (errorMsg.includes('already exists')) {
        // Extract chat ID from error message if possible
        const chatIdMatch = errorMsg.match(/Chat ID: (\d+)/);
        if (chatIdMatch) {
          const existingChatId = parseInt(chatIdMatch[1]);
          toast.success('Opening existing chat');
          resetForm();
          onChatCreated(existingChatId);
          return;
        }
      }
      
      // Show specific error or fallback to generic message
      toast.error(errorMsg || 'Failed to create chat');
    } finally {
      setIsCreating(false);
    }
  };

  // Handle chat type change
  const handleChatTypeChange = (type: ChatType) => {
    setChatType(type);
    setSelectedParticipants([]);
    setGroupName('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>
            {variant === 'channel' ? 'Create channel' : 'Create New Chat'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Chat Type Toggle */}
          {variant !== 'channel' && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Chat Type
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => handleChatTypeChange('private')}
                  disabled={isCreating}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                    chatType === 'private'
                      ? 'bg-[#3CCED7] text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  👤 Private
                </button>
                <button
                  onClick={() => handleChatTypeChange('group')}
                  disabled={isCreating}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                    chatType === 'group'
                      ? 'bg-[#3CCED7] text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  👥 Group
                </button>
              </div>
            </div>
          )}

          {/* Group Name Input (only for group chats) */}
          {chatType === 'group' && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                {variant === 'channel' ? 'Channel name' : 'Group Name'}{' '}
                <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder={variant === 'channel' ? 'e.g., general' : 'e.g., Design Team'}
                disabled={isCreating}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>
          )}

          {/* Participant Selector */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              {chatType === 'private' ? 'Select Participant' : 'Select Participants'}{' '}
              <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-500 mb-2">
              {chatType === 'private'
                ? 'Select 1 team member for private chat'
                : variant === 'channel'
                  ? 'Select at least one team member for the channel'
                  : 'Select at least 2 team members for group chat'}
            </p>
            <ParticipantSelector
              projectId={projectId}
              selectedIds={selectedParticipants}
              onSelect={setSelectedParticipants}
              maxSelection={chatType === 'private' ? 1 : undefined}
              currentUserId={user?.id ? Number(user.id) : 0}
            />
          </div>

          {/* Selected Counter */}
          {selectedParticipants.length > 0 && (
            <p className="text-sm text-gray-600">
              Selected: {selectedParticipants.length} member
              {selectedParticipants.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={handleClose}
            disabled={isCreating}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!isValid() || isCreating}
            className="px-4 py-2 text-sm font-medium text-white bg-[#3CCED7] hover:bg-[#2AB5BD] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isCreating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Creating...
              </>
            ) : variant === 'channel' ? (
              'Create channel'
            ) : (
              'Create Chat'
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
