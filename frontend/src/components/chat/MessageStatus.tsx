'use client';

import { Check, CheckCheck } from 'lucide-react';
import type { Message } from '@/types/chat';

interface MessageStatusProps {
  message: Message;
}

export default function MessageStatus({ message }: MessageStatusProps) {
  // Determine the highest status across all recipients
  const getHighestStatus = () => {
    if (!message.statuses || message.statuses.length === 0) {
      return 'sent';
    }

    const hasRead = message.statuses.some((s) => s.status === 'read');
    const hasDelivered = message.statuses.some((s) => s.status === 'delivered');

    if (hasRead) return 'read';
    if (hasDelivered) return 'delivered';
    return 'sent';
  };

  const status = getHighestStatus();

  // Render status icon
  switch (status) {
    case 'sent':
      return (
        <Check
          className="w-3 h-3 text-gray-400"
          aria-label="Sent"
        />
      );

    case 'delivered':
      return (
        <CheckCheck
          className="w-3 h-3 text-gray-400"
          aria-label="Delivered"
        />
      );

    case 'read':
      return (
        <CheckCheck
          className="w-3 h-3 text-[#3CCED7]"
          aria-label="Read"
        />
      );

    default:
      return null;
  }
}

