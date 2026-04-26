'use client';

import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Bell, Lightbulb } from 'lucide-react';
import AlertCard from './AlertCard';
import type { AlertData, AlertSeverity } from '@/lib/mock/dashboardMock';

interface AlertPanelProps {
  alerts: AlertData[];
  isOpen: boolean;
}

type FilterType = 'all' | AlertSeverity;

const filters: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'critical', label: 'Critical' },
  { value: 'warning', label: 'Warning' },
  { value: 'info', label: 'Info' },
];

export default function AlertPanel({ alerts: initialAlerts, isOpen }: AlertPanelProps) {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [filter, setFilter] = useState<FilterType>('all');

  const openAlerts = alerts.filter((a) => a.status === 'open');
  const filteredAlerts = openAlerts.filter((a) => filter === 'all' || a.severity === filter);

  const handleAction = (id: number, action: 'accepted' | 'deferred' | 'dismissed') => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, status: action } : a)));
  };

  return (
    <aside
      className={`h-full border-l border-gray-200 bg-white shrink-0 transition-all duration-300 overflow-hidden ${
        isOpen ? 'w-[320px]' : 'w-0'
      }`}
    >
      <div className="w-[320px] h-full flex flex-col">
        <Tabs defaultValue="alerts" className="flex-1 flex flex-col">
          <div className="px-3 pt-3 pb-0">
            <TabsList className="w-full bg-gray-100 h-8">
              <TabsTrigger value="alerts" className="flex-1 text-xs gap-1.5 data-[state=active]:bg-white">
                <Bell className="w-3.5 h-3.5" />
                Alerts
                {openAlerts.length > 0 && (
                  <span className="ml-0.5 text-[10px] bg-red-500 text-white px-1 py-0 rounded-full min-w-[16px] text-center">
                    {openAlerts.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="insights" className="flex-1 text-xs gap-1.5 data-[state=active]:bg-white">
                <Lightbulb className="w-3.5 h-3.5" />
                Insights
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="alerts" className="flex-1 flex flex-col mt-0">
            {/* Filter pills */}
            <div className="flex items-center gap-1 px-3 py-2">
              {filters.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                    filter === f.value
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Alert list */}
            <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
              {filteredAlerts.map((alert) => (
                <AlertCard key={alert.id} alert={alert} onAction={handleAction} />
              ))}
              {filteredAlerts.length === 0 && (
                <div className="text-center py-8 text-xs text-gray-400">
                  No {filter !== 'all' ? filter : ''} alerts
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="insights" className="flex-1 flex items-center justify-center">
            <div className="text-center px-6">
              <Lightbulb className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-400">AI-generated insights will appear here once connected to live data.</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </aside>
  );
}
