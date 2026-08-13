"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  MarkerType,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
} from "reactflow";
import "reactflow/dist/style.css";
import { ArrowLeft, PanelLeftOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { AgentAPI } from "@/lib/api/agentApi";
import { useBuildUrl } from "@/lib/buildUrl";
import type { AgentWorkflowTemplate, AgentWorkflowStep } from "@/types/agent";
import { useAgentWorkflowProjectParams } from "../hooks/useAgentWorkflows";
import { getStepMeta } from "./canvasStepMeta";
import AgentStepNode, { type AgentStepNodeData } from "./nodes/AgentStepNode";
import AgentStepEdge, { type AgentStepEdgeData } from "./edges/AgentStepEdge";
import TemplateInfoDrawer from "../templates/TemplateInfoDrawer";
import { cn } from "@/lib/utils";

// Node and edge type registry
const nodeTypes = {
  agentStep: AgentStepNode,
};

const edgeTypes = {
  agentStepEdge: AgentStepEdge,
};

// Layout constants
const STEP_X_GAP = 200;
const NODE_Y = 0;

// ── Inner canvas (needs ReactFlow context) ────────────────────────────────────
interface CanvasInnerProps {
  template: AgentWorkflowTemplate;
  steps: AgentWorkflowStep[];
  onCreateWorkflow: () => void;
  onCancel: () => void;
  isCreating: boolean;
}

function CanvasInner({ template, steps, onCreateWorkflow, onCancel, isCreating }: CanvasInnerProps) {
  const { fitView } = useReactFlow();
  const [drawerOpen, setDrawerOpen] = useState(true);

  // Drawer width constant
  const DRAWER_WIDTH = "33.333333%";

  // Fit view on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      fitView({ padding: 0.6 });
    }, 50);
    return () => clearTimeout(timer);
  }, [fitView]);

  // ── Derive RF nodes (preview mode - no interactions) ───────────────
  const rfNodes: Node[] = useMemo(() => {
    return steps.map((step, idx): Node<AgentStepNodeData> => ({
      id: step.id,
      type: "agentStep",
      position: { x: idx * STEP_X_GAP, y: NODE_Y },
      draggable: false,
      selectable: false,
      data: {
        step,
        isSelected: false,
        hasNext: idx < steps.length - 1,
        isPreviewMode: true, // Enable preview mode
        onDelete: undefined,
        onAddAfter: undefined,
        onSelect: undefined,
      },
    }));
  }, [steps]);

  // ── Derive RF edges ─────────────────────────────────────────────────────────
  const rfEdges: Edge[] = useMemo(() => {
    const edges: Edge[] = [];

    for (let i = 0; i < steps.length - 1; i++) {
      const meta = getStepMeta(steps[i].step_type);
      edges.push({
        id: `e-${steps[i].id}-${steps[i + 1].id}`,
        source: steps[i].id,
        target: steps[i + 1].id,
        type: "agentStepEdge",
        markerEnd: { type: MarkerType.ArrowClosed, color: meta.edgeColor, width: 16, height: 16 },
        data: {
          onAddBetween: () => {},
        } satisfies AgentStepEdgeData,
      });
    }

    return edges;
  }, [steps]);

  return (
    <div className="relative h-full w-full">
      {/* Canvas area - fullscreen, independent of drawer */}
      <div className="absolute inset-0">
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.6 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          nodesFocusable={false}
          edgesFocusable={false}
          panOnScroll
          zoomOnScroll
          minZoom={0.3}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="#cbd5e1" />
        </ReactFlow>
      </div>

      {/* Template Info Drawer - independent, collapsible */}
      <div
        className={cn(
          "absolute left-0 top-0 h-full bg-white shadow-xl transition-transform duration-300 z-30",
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ width: DRAWER_WIDTH }}
      >
        <TemplateInfoDrawer
          template={template}
          onCreateWorkflow={onCreateWorkflow}
          onCancel={onCancel}
          isCreating={isCreating}
          onClose={() => setDrawerOpen(false)}
        />
      </div>

      {/* Expand button - shown when drawer is closed */}
      {!drawerOpen && (
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="absolute left-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#3CCED7] to-[#A6E661] shadow-lg hover:shadow-xl transition"
          aria-label="Open template info"
        >
          <PanelLeftOpen className="h-5 w-5 text-white" />
        </button>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
interface TemplatePreviewCanvasProps {
  template: AgentWorkflowTemplate;
  onBack: () => void;
}

export default function TemplatePreviewCanvas({ template, onBack }: TemplatePreviewCanvasProps) {
  const router = useRouter();
  const buildUrl = useBuildUrl();
  const { projectParams } = useAgentWorkflowProjectParams();
  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);

  // Use template's own steps_config (no need to fetch workflow)
  // Add temporary IDs for React Flow nodes
  const steps = useMemo(() => {
    if (!template.steps_config) return [];
    return template.steps_config.map((step, index) => ({
      ...step,
      id: `template-step-${index}`, // Temporary ID for display
    }));
  }, [template.steps_config]);

  const handleCreateWorkflow = useCallback(async () => {
    // Prevent duplicate clicks
    if (creatingRef.current || creating) {
      console.warn("[CREATE] Already creating workflow, ignoring duplicate call");
      return;
    }

    if (!projectParams?.project_id) {
      toast.error("Project ID is required");
      return;
    }

    creatingRef.current = true;
    setCreating(true);

    try {
      console.log("[CREATE] Starting workflow creation from template:", template.id);
      console.log("[CREATE] Project ID:", projectParams.project_id);

      const newWorkflow = await AgentAPI.applyTemplate(template.id, {
        project_id: Number(projectParams.project_id),
        name: template.name, // Use template name as initial workflow name
      });

      console.log("[CREATE] Created workflow:", newWorkflow);
      console.log("[CREATE] Workflow ID:", newWorkflow.id);

      if (!newWorkflow.id) {
        throw new Error("Created workflow has no ID");
      }

      toast.success("Workflow created successfully");

      // Navigate to the new workflow canvas with new=1 parameter
      const targetUrl = buildUrl(`/workflows/${newWorkflow.slug}?new=1`);
      console.log("[CREATE] Navigating to:", targetUrl);
      router.push(targetUrl);
    } catch (err) {
      console.error("[CREATE] Failed to create workflow:", err);
      toast.error("Failed to create workflow");
      creatingRef.current = false; // Reset on error
    } finally {
      setCreating(false);
    }
  }, [template.id, template.name, projectParams, router, creating]);

  if (steps.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-gray-500">No steps found in this template</p>
          <button
            type="button"
            onClick={onBack}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <CanvasInner
        template={template}
        steps={steps}
        onCreateWorkflow={handleCreateWorkflow}
        onCancel={onBack}
        isCreating={creating}
      />
    </ReactFlowProvider>
  );
}
