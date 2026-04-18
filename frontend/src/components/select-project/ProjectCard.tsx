'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Clock, Target, TrendingUp } from 'lucide-react';
import type { MockProject, HealthStatus } from '@/lib/mock/projectsMock';

interface ProjectCardProps {
  project: MockProject;
  isDefault: boolean;
  onSetDefault: (id: number) => void;
}

const platformColors: Record<string, string> = {
  meta: 'bg-blue-500',
  google: 'bg-red-500',
  tiktok: 'bg-gray-900',
};

const statusConfig = {
  active: { label: 'Active', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  completed: { label: 'Completed', className: 'bg-gray-100 text-gray-600 border-gray-200' },
  paused: { label: 'Paused', className: 'bg-amber-50 text-amber-700 border-amber-200' },
};

const healthBarColor: Record<HealthStatus, string> = {
  critical: 'bg-red-500',
  warning: 'bg-amber-400',
  healthy: 'bg-emerald-500',
};

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

export default function ProjectCard({ project, isDefault, onSetDefault }: ProjectCardProps) {
  const router = useRouter();
  const status = statusConfig[project.status];

  return (
    <Card
      className="group relative cursor-pointer border-[0.5px] border-gray-200 hover:border-[#3CCED7]/40 hover:shadow-md transition-all duration-200 bg-white overflow-hidden"
      onClick={() => router.push('/overview')}
    >
      {/* Health status bar */}
      <div className={`h-[3px] w-full ${healthBarColor[project.health]}`} />

      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-base font-medium text-gray-900 group-hover:text-[#3CCED7] transition-colors line-clamp-1">
            {project.name}
          </h3>
          <Badge variant="outline" className={`text-[11px] shrink-0 ml-2 ${status.className}`}>
            {status.label}
          </Badge>
        </div>

        <p className="text-[13px] text-gray-500 leading-5 line-clamp-2 mb-3 min-h-[40px]">
          {project.description}
        </p>

        {/* Health reason */}
        {project.healthReason && project.health !== 'healthy' && (
          <div className={`text-[11px] leading-4 px-2 py-1.5 rounded mb-3 ${
            project.health === 'critical'
              ? 'bg-red-50 text-red-600'
              : 'bg-amber-50 text-amber-600'
          }`}>
            {project.healthReason}
          </div>
        )}

        {/* Mini KPIs */}
        {project.miniKpis && project.status === 'active' && (
          <div className="flex items-center gap-4 mb-3">
            <div className="flex items-center gap-1.5 text-[12px]">
              <Target className="w-3 h-3 text-gray-400" />
              <span className="text-gray-500">ROAS</span>
              <span className={`font-medium ${
                project.miniKpis.roas < 1 ? 'text-red-600' : project.miniKpis.roas < 2 ? 'text-amber-600' : 'text-emerald-600'
              }`}>
                {project.miniKpis.roas.toFixed(1)}x
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[12px]">
              <TrendingUp className="w-3 h-3 text-gray-400" />
              <span className="text-gray-500">Pacing</span>
              <span className={`font-medium ${
                project.miniKpis.pacingPercent < 60 ? 'text-amber-600' : 'text-gray-700'
              }`}>
                {project.miniKpis.pacingPercent}%
              </span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-1.5 mb-4">
          {project.advertising_platforms.map((p) => (
            <div
              key={p}
              className={`w-5 h-5 rounded-full ${platformColors[p] || 'bg-gray-400'} flex items-center justify-center`}
              title={p}
            >
              <span className="text-white text-[8px] font-bold uppercase">{p[0]}</span>
            </div>
          ))}
          <span className="text-[11px] text-gray-400 ml-1">
            ${(project.total_monthly_budget / 1000).toFixed(0)}k/mo
          </span>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <div className="flex items-center gap-3 text-[12px] text-gray-400">
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {project.member_count}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {formatRelativeTime(project.updated_at)}
            </span>
          </div>

          <label
            className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-[#3CCED7] cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={isDefault}
              onChange={() => onSetDefault(project.id)}
              className="w-3.5 h-3.5 rounded border-gray-300 text-[#3CCED7] focus:ring-[#3CCED7]/30 accent-[#3CCED7]"
            />
            Default
          </label>
        </div>
      </CardContent>
    </Card>
  );
}
