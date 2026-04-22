'use client';

import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Chat } from '@/types/chat';
import ParticipantSelector from './ParticipantSelector';

interface ForwardMessagesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  availableChats: Chat[];
  currentUserId: number;
  selectedMessageCount: number;
  isForwarding?: boolean;
  onSubmit: (targetChatIds: number[], targetUserIds: number[]) => Promise<void> | void;
}

function getChatDisplayName(chat: Chat, currentUserId: number): string {
  if (chat.type === 'group') {
    return chat.name || 'Group Chat';
  }

  const other = chat.participants?.find((p) => p.user.id !== currentUserId);
  return other?.user?.username || 'Private Chat';
}

export default function ForwardMessagesDialog({
  isOpen,
  onClose,
  projectId,
  availableChats,
  currentUserId,
  selectedMessageCount,
  isForwarding = false,
  onSubmit,
}: ForwardMessagesDialogProps) {
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
    const query = searchQuery.trim().toLowerCase();
    return availableChats.filter((chat) => {
      const name = getChatDisplayName(chat, currentUserId).toLowerCase();
      return name.includes(query);
    });
  }, [availableChats, currentUserId, searchQuery]);

  const toggleChat = (chatId: number) => {
    setSelectedChatIds((prev) =>
      prev.includes(chatId) ? prev.filter((id) => id !== chatId) : [...prev, chatId]
    );
  };

  const hasTargets = selectedChatIds.length > 0 || selectedUserIds.length > 0;
  const handleSubmit = async () => {
    if (!hasTargets || isForwarding) return;
    await onSubmit(selectedChatIds, selectedUserIds);
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Forward Messages</DialogTitle>
        </DialogHeader>

        <div className="text-sm text-gray-600">
          Forwarding <span className="font-semibold text-gray-900">{selectedMessageCount}</span> selected message
          {selectedMessageCount === 1 ? '' : 's'}.
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-hidden flex-1 min-h-0 py-2">
          <div className="border border-gray-200 rounded-lg p-3 flex flex-col min-h-0">
            <h3 className="text-sm font-medium text-gray-900 mb-2">Target chats</h3>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats..."
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
            />
            <div className="overflow-y-auto space-y-2 pr-1">
              {filteredChats.length === 0 ? (
                <p className="text-xs text-gray-500">No chats found.</p>
              ) : (
                filteredChats.map((chat) => (
                  <label
                    key={chat.id}
                    className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedChatIds.includes(chat.id)}
                      onChange={() => toggleChat(chat.id)}
                      className="w-4 h-4 text-[#3CCED7] border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-800 truncate">
                      {getChatDisplayName(chat, currentUserId)}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-3 flex flex-col min-h-0">
            <h3 className="text-sm font-medium text-gray-900 mb-2">Target users</h3>
            <div className="overflow-y-auto">
              <ParticipantSelector
                projectId={projectId}
                selectedIds={selectedUserIds}
                onSelect={setSelectedUserIds}
                currentUserId={currentUserId}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-gray-200 pt-3 mt-1">
          <p className="text-xs text-gray-600">
            Targets: {selectedChatIds.length} chats, {selectedUserIds.length} users
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isForwarding}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!hasTargets || isForwarding}
              className="px-3 py-2 text-sm font-medium text-white bg-[#3CCED7] hover:bg-[#2AB5BD] rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isForwarding ? 'Forwarding...' : 'Forward'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
