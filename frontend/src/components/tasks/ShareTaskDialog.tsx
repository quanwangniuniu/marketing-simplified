'use client';

import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Chat } from '@/types/chat';
import ParticipantSelector from '@/components/chat/ParticipantSelector';

interface ShareTaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  availableChats: Chat[];
  currentUserId: number;
  isSharing?: boolean;
  onSubmit: (targetChatIds: number[], targetUserIds: number[]) => Promise<void> | void;
}

const getChatDisplayName = (chat: Chat, currentUserId: number): string => {
  if (chat.type === 'group') {
    return chat.name || `Group chat #${chat.id}`;
  }

  const otherParticipant = chat.participants.find(
    (participant) => participant.user.id !== currentUserId
  );
  return otherParticipant?.user.username || otherParticipant?.user.email || 'Private chat';
};

export default function ShareTaskDialog({
  isOpen,
  onClose,
  projectId,
  availableChats,
  currentUserId,
  isSharing = false,
  onSubmit,
}: ShareTaskDialogProps) {
  const [selectedChatIds, setSelectedChatIds] = useState<number[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setSelectedChatIds([]);
      setSelectedUserIds([]);
      setSearchQuery('');
    }
  }, [isOpen]);

  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return availableChats;
    const query = searchQuery.toLowerCase();
    return availableChats.filter((chat) =>
      getChatDisplayName(chat, currentUserId).toLowerCase().includes(query)
    );
  }, [availableChats, currentUserId, searchQuery]);

  const toggleChat = (chatId: number) => {
    setSelectedChatIds((prev) =>
      prev.includes(chatId) ? prev.filter((id) => id !== chatId) : [...prev, chatId]
    );
  };

  const handleSubmit = async () => {
    if (isSharing) return;
    await onSubmit(selectedChatIds, selectedUserIds);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Share Task</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-gray-500">
            Choose chats or users to share this task with.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Target chats</span>
                <span className="text-xs text-gray-400">
                  {selectedChatIds.length} selected
                </span>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chats..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-transparent"
              />
              <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200">
                {filteredChats.length === 0 ? (
                  <div className="py-8 text-center text-sm text-gray-500">
                    No chats found.
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {filteredChats.map((chat) => {
                      const displayName = getChatDisplayName(chat, currentUserId);
                      return (
                        <label
                          key={chat.id}
                          className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-gray-50"
                        >
                          <input
                            type="checkbox"
                            checked={selectedChatIds.includes(chat.id)}
                            onChange={() => toggleChat(chat.id)}
                            className="h-4 w-4 rounded border-gray-300 text-[#3CCED7] focus:ring-[#3CCED7]"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-gray-900">
                              {displayName}
                            </p>
                            <p className="truncate text-xs text-gray-500">
                              {chat.type === 'group' ? 'Group chat' : 'Private chat'}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Target users</span>
                <span className="text-xs text-gray-400">
                  {selectedUserIds.length} selected
                </span>
              </div>
              <ParticipantSelector
                projectId={projectId}
                selectedIds={selectedUserIds}
                onSelect={setSelectedUserIds}
                currentUserId={currentUserId}
              />
            </div>
          </div>

          <div className="text-xs text-gray-500">
            Targets: {selectedChatIds.length} chats, {selectedUserIds.length} users
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isSharing}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSharing || (selectedChatIds.length === 0 && selectedUserIds.length === 0)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#3CCED7] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2AB5BD] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSharing ? 'Sharing...' : 'Share'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
