'use client';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import MessagePageContent from '@/components/messages/MessagePageContent';
import Layout from '@/components/layout/Layout';
import { useAuthStore } from '@/lib/authStore';
import { useChatStore } from '@/lib/chatStore';
import { useEffect } from 'react';

export default function MessagesPage() {
  const { user } = useAuthStore();
  const setMessagePageOpen = useChatStore(state => state.setMessagePageOpen);

  useEffect(() => {
    setMessagePageOpen(true);
    return () => {
      setMessagePageOpen(false);
    };
  }, [setMessagePageOpen]);

  const layoutUser = user
    ? {
        name: user.username || user.email,
        email: user.email,
        role: user.roles && user.roles.length > 0 ? user.roles[0] : undefined,
      }
    : undefined;

  return (
    <ProtectedRoute>
      <Layout user={layoutUser} showHeader={true} showSidebar={true}>
        <MessagePageContent />
      </Layout>
    </ProtectedRoute>
  );
}

