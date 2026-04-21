'use client';

import { format } from 'date-fns';
import { Forward } from 'lucide-react';
import type { MessageItemProps } from '@/types/chat';
import MessageStatus from './MessageStatus';
import AttachmentDisplay from './AttachmentDisplay';
import LinkPreview from './LinkPreview';
import TaskSharePreview from './TaskSharePreview';
import { extractUrls } from '@/lib/api/linkPreviewApi';

const AGENT_BOT_EMAIL = 'agent-bot@system.local';
const AGENT_BOT_USERNAME = 'agent-bot';

function isAgentBot(sender: { email?: string; username?: string }): boolean {
  return sender.email === AGENT_BOT_EMAIL || sender.username === AGENT_BOT_USERNAME;
}

export default function MessageItem({
  message,
  isOwnMessage,
  showSender = true,
  senderRole,
  isSelectMode = false,
  isSelected = false,
  onToggleSelect,
  isHighlighted = false,
}: MessageItemProps) {
  const formatTime = (dateString: string) => {
    try {
      return format(new Date(dateString), 'h:mm a');
    } catch {
      return '';
    }
  };

  const messageContent = message.content || '';
  const isForwarded = Boolean(message.is_forwarded && message.forwarded_from);
  const forwardedFrom = message.forwarded_from?.sender_display?.trim() || '';

  const hasContent = Boolean(messageContent && messageContent.trim().length > 0);
  const hasAttachments = Boolean(message.attachments && message.attachments.length > 0);
  
  // Only check for URLs if there's content, and wrap in try-catch for safety
  let hasUrls = false;
  try {
    hasUrls = hasContent && extractUrls(messageContent).length > 0;
  } catch (error) {
    console.warn('Error extracting URLs:', error);
  }

  const extractTaskIds = (content: string) => {
    const matches = [...content.matchAll(/\/tasks\/(\d+)/g)];
    return matches
      .map((match) => Number(match[1]))
      .filter((taskId) => !Number.isNaN(taskId));
  };

  const taskIds = extractTaskIds(messageContent);
  const taskPreviewId = taskIds[0];
  const showTaskPreview = Boolean(taskPreviewId);
  const showLinkPreview = hasUrls && !showTaskPreview;

  const handleToggleSelect = () => {
    if (!isSelectMode || !onToggleSelect) return;
    onToggleSelect(message.id);
  };

  const selectionClass = isSelectMode
    ? `cursor-pointer border ${isSelected ? 'border-blue-400 ring-2 ring-blue-100' : 'border-transparent'} rounded-lg p-1`
    : '';
  const forwardedContainerClass = isForwarded ? 'relative pt-4' : '';
  const ownMessageContentClass = `${forwardedContainerClass} flex flex-col items-end`;
  const forwardedHeaderBaseClass =
    'absolute top-0 flex items-center gap-1 text-[11px] text-gray-500 pointer-events-none overflow-hidden max-w-[240px] sm:max-w-[320px]';
  const senderRowClass = 'flex items-center gap-2 mb-1 px-1 w-fit max-w-[240px] sm:max-w-[320px]';

  if (isOwnMessage) {
    // Own messages (right-aligned)
    return (
      <div
        id={`message-${message.id}`}
        className={[
          isSelectMode ? 'relative pl-8' : '',
          isHighlighted ? 'scroll-mt-24' : '',
        ].join(' ')}
      >
        {isSelectMode && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={handleToggleSelect}
            className="absolute left-0 top-2 w-4 h-4 text-blue-600 border-gray-300 rounded"
          />
        )}
        <div className="flex justify-end">
          <div className="max-w-[75%]">
            <div
              className={[
                selectionClass,
                isHighlighted ? 'ring-2 ring-amber-200 bg-amber-50/40 rounded-lg' : '',
              ].join(' ')}
              onClick={handleToggleSelect}
            >
              <div className={ownMessageContentClass}>
                {isForwarded && (
                  <div className={`${forwardedHeaderBaseClass} right-1`}>
                    <Forward className="w-3 h-3 shrink-0" />
                    <span className="min-w-0 truncate whitespace-nowrap">Forwarded from {forwardedFrom}</span>
                  </div>
                )}
                {/* Message bubble with content */}
                {hasContent && (
                  <div className="inline-block w-fit max-w-full bg-[#A6E661] text-gray-900 rounded-lg px-4 py-2 break-words">
                    <p className="text-sm whitespace-pre-wrap">{messageContent}</p>
                  </div>
                )}
                
                {/* Task Share Preview */}
                {showTaskPreview && taskPreviewId ? (
                  <TaskSharePreview taskId={taskPreviewId} className="mt-2" />
                ) : null}

                {/* Link Previews */}
                {showLinkPreview && (
                  <LinkPreview content={messageContent} />
                )}
                
                {/* Attachments */}
                {hasAttachments && (
                  <AttachmentDisplay 
                    attachments={message.attachments!} 
                    isOwnMessage={true}
                  />
                )}
                
                {/* Timestamp and status */}
                <div className="flex items-center justify-end gap-1 mt-1 px-1">
                  <span className="text-xs text-gray-500">{formatTime(message.created_at)}</span>
                  <MessageStatus message={message} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Other users' messages (left-aligned)
  return (
    <div
      id={`message-${message.id}`}
      className={[
        isSelectMode ? 'relative pl-8' : '',
        isHighlighted ? 'scroll-mt-24' : '',
      ].join(' ')}
    >
      {isSelectMode && (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={handleToggleSelect}
          className="absolute left-0 top-2 w-4 h-4 text-blue-600 border-gray-300 rounded"
        />
      )}
      <div className="flex justify-start">
        <div className="max-w-[75%]">
          <div
            className={[
              selectionClass,
              isHighlighted ? 'ring-2 ring-amber-200 bg-amber-50/40 rounded-lg' : '',
            ].join(' ')}
            onClick={handleToggleSelect}
          >
            <div className={forwardedContainerClass}>
              {isForwarded && (
                <div className={`${forwardedHeaderBaseClass} left-1`}>
                  <Forward className="w-3 h-3 shrink-0" />
                  <span className="min-w-0 truncate whitespace-nowrap">Forwarded from {forwardedFrom}</span>
                </div>
              )}
              {showSender && (
                <div className={senderRowClass}>
                  <p className="text-xs font-medium text-gray-700 truncate max-w-[140px]" title={message.sender.username}>
                    {isAgentBot(message.sender) ? 'AI Agent' : message.sender.username}
                  </p>
                  {isAgentBot(message.sender) ? (
                    <span className="text-[10px] font-semibold bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded flex-shrink-0">
                      AI
                    </span>
                  ) : senderRole ? (
                    <span
                      className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded truncate max-w-[140px]"
                      title={senderRole}
                    >
                      {senderRole}
                    </span>
                  ) : null}
                </div>
              )}
              
              {/* Message bubble with content */}
              {hasContent && (
                <div className={`inline-block w-fit max-w-full rounded-lg px-4 py-2 break-words ${
                  isAgentBot(message.sender)
                    ? 'bg-violet-50 text-gray-900 border border-violet-100'
                    : 'bg-gray-100 text-gray-900'
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{messageContent}</p>
                </div>
              )}

              {/* Task Share Preview */}
              {showTaskPreview && taskPreviewId ? (
                <TaskSharePreview taskId={taskPreviewId} className="mt-2" />
              ) : null}

              {/* Link Previews */}
              {showLinkPreview && (
                <LinkPreview content={messageContent} />
              )}

              {/* Attachments */}
              {hasAttachments && (
                <AttachmentDisplay
                  attachments={message.attachments!}
                  isOwnMessage={false}
                />
              )}

              {/* Timestamp */}
              <div className="flex items-center gap-1 mt-1 px-1">
                <span className="text-xs text-gray-500">{formatTime(message.created_at)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
