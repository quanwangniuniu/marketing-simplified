'use client';

import { useState } from 'react';
import { PanelRightClose, PanelRightOpen, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DashboardSidebar from './DashboardSidebar';
import AlertPanel from './AlertPanel';
import DataFreshness from './DataFreshness';
import type { AlertData, DataSourceStatus } from '@/lib/mock/dashboardMock';

interface DashboardLayoutProps {
  children: React.ReactNode;
  alerts: AlertData[];
  dataSources: DataSourceStatus[];
}

export default function DashboardLayout({ children, alerts, dataSources }: DashboardLayoutProps) {
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  return (
    <div className="flex h-screen bg-[#F7F8FA] overflow-hidden">
      <DashboardSidebar />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="flex items-center justify-between px-5 h-12 border-b border-gray-200 bg-white shrink-0">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-400">Dashboard</span>
            <span className="text-gray-300">/</span>
            <span className="font-medium text-gray-900">Overview</span>
          </div>
          <div className="flex items-center gap-3">
            <DataFreshness sources={dataSources} />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsPanelOpen(!isPanelOpen)}
              className="h-7 px-2 text-xs text-gray-500 hover:text-gray-700"
            >
              {isPanelOpen ? (
                <><PanelRightClose className="w-4 h-4 mr-1" /> Hide Panel</>
              ) : (
                <><PanelRightOpen className="w-4 h-4 mr-1" /> Show Panel</>
              )}
            </Button>
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto p-5 space-y-4">
          {children}
        </main>
      </div>

      <AlertPanel alerts={alerts} isOpen={isPanelOpen} />
    </div>
  );
}
