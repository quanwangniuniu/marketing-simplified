"use client";

import Layout from "@/components/layout/Layout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { TimelinePageContent } from "./TimelinePageContent";

export default function TimelinePage() {
  return (
    <ProtectedRoute>
      <Layout>
        <TimelinePageContent />
      </Layout>
    </ProtectedRoute>
  );
}
