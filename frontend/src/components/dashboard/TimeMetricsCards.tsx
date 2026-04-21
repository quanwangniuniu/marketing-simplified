'use client';

import { TimeMetrics } from '@/types/dashboard';

interface TimeMetricsCardsProps {
  metrics: TimeMetrics;
}

export default function TimeMetricsCards({ metrics }: TimeMetricsCardsProps) {
  const cards = [
    {
      label: 'completed',
      value: metrics.completed_last_7_days,
      subtitle: 'in the last 7 days',
      icon: (
        <svg
          className="w-6 h-6 text-green-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      bgColor: 'bg-green-50',
      textColor: 'text-green-900',
    },
    {
      label: 'updated',
      value: metrics.updated_last_7_days,
      subtitle: 'in the last 7 days',
      icon: (
        <svg
          className="w-6 h-6 text-[#3CCED7]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ),
      bgColor: 'bg-[#3CCED7]/10',
      textColor: 'text-[#0f757a]',
    },
    {
      label: 'created',
      value: metrics.created_last_7_days,
      subtitle: 'in the last 7 days',
      icon: (
        <svg
          className="w-6 h-6 text-purple-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      ),
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-900',
    },
    {
      label: 'due soon',
      value: metrics.due_soon,
      subtitle: 'in the next 7 days',
      icon: (
        <svg
          className="w-6 h-6 text-orange-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-900',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className={`${card.bgColor} p-2 rounded-lg`}>
                  {card.icon}
                </div>
                <div>
                  <p className={`text-3xl font-bold ${card.textColor}`}>
                    {card.value}
                  </p>
                </div>
              </div>
              <p className="text-sm font-medium text-gray-900 capitalize">
                {card.label}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {card.subtitle}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
