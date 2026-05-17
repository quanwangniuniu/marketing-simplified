'use client';

import { useEffect } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import MessagePageContent from '@/components/messages/MessagePageContent';
import { useChatStore } from '@/lib/chatStore';

function MessagesV2Content() {
  const setMessagePageOpen = useChatStore((state) => state.setMessagePageOpen);

  useEffect(() => {
    setMessagePageOpen(true);
    return () => {
      setMessagePageOpen(false);
    };
  }, [setMessagePageOpen]);

  return (
    <DashboardLayout hideRightPanel>
      <div className="-m-1 flex h-[calc(100vh-3rem)] flex-col bg-white sm:-m-5">
        <MessagePageContent />
      </div>
    </DashboardLayout>
  );
}

export default function MessagesV2Page() {
  return (
    <ProtectedRoute renderChildrenWhileLoading>
      <MessagesV2Content />
    </ProtectedRoute>
  );
}
