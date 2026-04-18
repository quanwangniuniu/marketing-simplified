'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import ProjectHeader from '@/components/select-project/ProjectHeader';
import ProjectCard from '@/components/select-project/ProjectCard';
import CreateProjectCard from '@/components/select-project/CreateProjectCard';
import ChatFAB from '@/components/global-chat/ChatFAB';
import { mockProjects, type HealthStatus } from '@/lib/mock/projectsMock';

type FilterStatus = 'all' | 'active' | 'completed' | 'paused';

const healthOrder: Record<HealthStatus, number> = { critical: 0, warning: 1, healthy: 2 };

const filterTabs: { value: FilterStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'paused', label: 'Paused' },
];

export default function SelectProjectPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [defaultProjectId, setDefaultProjectId] = useState<number | null>(null);

  const filtered = mockProjects
    .filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
      const matchesFilter = filter === 'all' || p.status === filter;
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => healthOrder[a.health] - healthOrder[b.health]);

  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      <ProjectHeader />

      <main className="max-w-[1200px] mx-auto px-8 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">
            Select a Project
          </h1>
          <p className="text-sm text-gray-500">
            Choose a project to view its dashboard, campaigns, and performance data.
          </p>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm border-gray-200 focus:border-[#3CCED7] focus:ring-[#3CCED7]/20"
            />
          </div>

          <div className="flex items-center gap-1 bg-gray-100 rounded-full p-0.5">
            {filterTabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setFilter(tab.value)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  filter === tab.value
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              isDefault={defaultProjectId === project.id}
              onSetDefault={(id) =>
                setDefaultProjectId((prev) => (prev === id ? null : id))
              }
            />
          ))}
          <CreateProjectCard />
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <p className="text-sm text-gray-400">No projects match your search.</p>
          </div>
        )}
      </main>

      <ChatFAB />
    </div>
  );
}
