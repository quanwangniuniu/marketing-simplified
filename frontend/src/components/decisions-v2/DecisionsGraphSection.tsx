'use client';

import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import DecisionTree from '@/components/decisions/DecisionTree';
import type { DecisionGraphNode, DecisionGraphResponse } from '@/types/decision';

interface Props {
  graph: DecisionGraphResponse | null;
  projectId?: number | null;
  canEdit: boolean;
  onEditDecision: (node: DecisionGraphNode) => void;
  onCreateDecision: () => void;
  onDeleteDecision?: (node: DecisionGraphNode) => void;
}

export default function DecisionsGraphSection({
  graph,
  projectId,
  canEdit,
  onEditDecision,
  onCreateDecision,
  onDeleteDecision,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const nodes = graph?.nodes ?? [];
  const edges = graph?.edges ?? [];
  const nodeCount = nodes.length;

  if (nodeCount === 0) {
    return null;
  }

  const heightClass = nodeCount <= 2 ? 'h-[360px]' : 'h-[600px]';

  return (
    <div className="border-b border-gray-100 px-5 py-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-gray-900">
            Decision Tree
          </h3>
          <p className="mt-0.5 text-xs text-gray-500">
            Drag between decisions to create a link. Click a link to remove it.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand decision tree' : 'Collapse decision tree'}
          title={collapsed ? 'Expand' : 'Collapse'}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-50 hover:text-gray-900"
        >
          <ChevronRight
            className={`h-4 w-4 transition-transform duration-200 ${collapsed ? '' : 'rotate-90'}`}
          />
        </button>
      </div>
      {!collapsed && (
        <div className={`relative w-full ${heightClass}`}>
          <DecisionTree
            nodes={nodes}
            edges={edges}
            projectId={projectId}
            mode="viewer"
            onEditDecision={onEditDecision}
            onCreateDecision={onCreateDecision}
            canDelete={canEdit}
            onDelete={onDeleteDecision}
            getDecisionUrl={(id, pid) =>
              `/decisions/${id}${pid ? `?project_id=${pid}` : ''}`
            }
            getReviewUrl={(id, pid) =>
              `/decisions/${id}${pid ? `?project_id=${pid}` : ''}`
            }
          />
        </div>
      )}
    </div>
  );
}
