"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { WorkflowAPI } from "@/lib/api/workflowApi";
import WorkflowCanvas from "./WorkflowCanvas";
import WorkflowSidebar from "./WorkflowSidebar";
import AddNodeDialog from "./AddNodeDialog";
import CreateConnectionDialog from "./CreateConnectionDialog";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { ChevronLeft } from "lucide-react";
import type { WorkflowSummary } from "@/lib/api/workflowApi";
import { useWorkflowGraph } from "@/hooks/useWorkflowGraph";
import toast from "react-hot-toast";

interface WorkflowEditorProps {
  workflowId: number;
}

export type SelectionType = "node" | "connection" | "empty";

export interface Selection {
  type: SelectionType;
  id: number | null;
}

export default function WorkflowEditor({ workflowId }: WorkflowEditorProps) {
  const router = useRouter();
  const { 
    nodes,
    connections,
    hasUnsavedChanges, 
    hasPendingOperations, 
    markAsSaved,
    loadGraph,
  } = useWorkflowGraph();
  const [workflow, setWorkflow] = useState<WorkflowSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selection, setSelection] = useState<Selection>({ type: "empty", id: null });
  const [showDiagram, setShowDiagram] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showConnectionLabels, setShowConnectionLabels] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Save initial state snapshot for Cancel functionality
  const [initialGraphState, setInitialGraphState] = useState<{
    nodes: typeof nodes;
    connections: typeof connections;
  } | null>(null);
  
  // Dialog states
  const [showAddNodeDialog, setShowAddNodeDialog] = useState(false);
  const [showCreateConnectionDialog, setShowCreateConnectionDialog] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  useEffect(() => {
    const loadWorkflow = async () => {
      if (!workflowId) return;
      setLoading(true);
      try {
        const wf = await WorkflowAPI.retrieve(workflowId);
        setWorkflow(wf);
      } catch (error) {
        console.error("Failed to load workflow:", error);
      } finally {
        setLoading(false);
      }
    };
    loadWorkflow();
  }, [workflowId]);

  // Save initial graph state when nodes and connections are loaded
  useEffect(() => {
    if (nodes.length > 0 && !initialGraphState) {
      console.log('📸 Saving initial graph state for Cancel functionality');
      setInitialGraphState({
        nodes: JSON.parse(JSON.stringify(nodes)),
        connections: JSON.parse(JSON.stringify(connections)),
      });
    }
  }, [nodes, connections, initialGraphState]);


  const handleNodeAdded = () => {
    // Refresh will happen automatically via useWorkflowGraph (Zustand store)
    // No need to trigger manual refresh as it would override optimistic updates
  };

  const handleConnectionCreated = () => {
    // Refresh will happen automatically via useWorkflowGraph (Zustand store)
    // No need to trigger manual refresh as it would override optimistic updates
  };

  const handleUpdateWorkflow = async () => {
    try {
      setSaving(true);
      
      // Check if there are pending operations
      if (hasPendingOperations) {
        toast("Waiting for operations to complete...");
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second for operations to finish
      }
      
      // Mark as saved (update snapshot) - this sets hasUnsavedChanges to false
      markAsSaved();
      
      // Update initial snapshot to current state
      // So next Cancel won't undo this save
      setInitialGraphState({
        nodes: JSON.parse(JSON.stringify(nodes)),
        connections: JSON.parse(JSON.stringify(connections)),
      });
      
      toast.success("Workflow updated successfully");
      
      // Navigate back to workflows list
      setTimeout(() => {
        router.push("/workflows");
      }, 500); // Small delay to show the success message
      
    } catch (error) {
      console.error("Failed to update workflow:", error);
      toast.error("Failed to update workflow");
    } finally {
      setSaving(false);
    }
  };

  const handleDiscardChanges = async () => {
    if (!initialGraphState) {
      toast("No changes to discard");
      router.push("/workflows");
      return;
    }

    // Show confirmation dialog
    setShowDiscardConfirm(true);
  };

  const confirmDiscardChanges = async () => {
    setShowDiscardConfirm(false);

    if (!initialGraphState) {
      toast("No changes to discard");
      router.push("/workflows");
      return;
    }

    try {
      setSaving(true);
      toast("Restoring workflow to original state...");
      
      const initialNodeIds = new Set(initialGraphState.nodes.map(n => n.id));
      const initialConnIds = new Set(initialGraphState.connections.map(c => c.id));
      const currentNodeIds = new Set(nodes.map(n => n.id));
      const currentConnIds = new Set(connections.map(c => c.id));
      
      // Step 1: Delete added nodes (using WorkflowAPI directly to ensure backend deletion)
      const nodesToDelete = [...currentNodeIds].filter(id => !initialNodeIds.has(id));
      console.log('🗑️ Deleting added nodes:', nodesToDelete);
      
      for (const nodeId of nodesToDelete) {
        try {
          await WorkflowAPI.deleteNode(workflowId, nodeId);
        } catch (error) {
          console.error(`Failed to delete node ${nodeId}:`, error);
        }
      }
      
      // Step 2: Delete added connections
      const connsToDelete = [...currentConnIds].filter(id => !initialConnIds.has(id));
      console.log('🗑️ Deleting added connections:', connsToDelete);
      
      for (const connId of connsToDelete) {
        try {
          await WorkflowAPI.deleteConnection(workflowId, connId);
        } catch (error) {
          console.error(`Failed to delete connection ${connId}:`, error);
        }
      }
      
      // Step 3: Restore deleted nodes
      const nodesToRestore = [...initialNodeIds].filter(id => !currentNodeIds.has(id));
      console.log('➕ Restoring deleted nodes:', nodesToRestore);
      
      const nodeIdMapping = new Map<number, number>();
      
      for (const oldNodeId of nodesToRestore) {
        const nodeData = initialGraphState.nodes.find(n => n.id === oldNodeId);
        if (nodeData) {
          try {
            const newNode = await WorkflowAPI.createNode(workflowId, {
              node_type: nodeData.node_type,
              label: nodeData.label,
              color: nodeData.color,
              data: nodeData.data,
            });
            nodeIdMapping.set(oldNodeId, newNode.id);
          } catch (error) {
            console.error(`Failed to restore node ${oldNodeId}:`, error);
          }
        }
      }
      
      // Step 4: Restore deleted connections
      const connsToRestore = [...initialConnIds].filter(id => !currentConnIds.has(id));
      console.log('➕ Restoring deleted connections:', connsToRestore);
      
      for (const oldConnId of connsToRestore) {
        const connData = initialGraphState.connections.find(c => c.id === oldConnId);
        if (connData) {
          try {
            const sourceId = nodeIdMapping.get(connData.source_node_id) || connData.source_node_id;
            const targetId = nodeIdMapping.get(connData.target_node_id) || connData.target_node_id;
            
            await WorkflowAPI.createConnection(workflowId, {
              source_node_id: sourceId,
              target_node_id: targetId,
              connection_type: connData.connection_type,
              name: connData.name,
              condition_config: connData.condition_config,
              priority: connData.priority,
              source_handle: connData.source_handle,
              target_handle: connData.target_handle,
              event_type: connData.event_type,
              properties: connData.properties,
            });
          } catch (error) {
            console.error(`Failed to restore connection ${oldConnId}:`, error);
          }
        }
      }
      
      // Step 5: Update modified nodes
      for (const initialNode of initialGraphState.nodes) {
        if (currentNodeIds.has(initialNode.id)) {
          const currentNode = nodes.find(n => n.id === initialNode.id);
          // Check if node was modified
          if (currentNode && JSON.stringify(currentNode.data) !== JSON.stringify(initialNode.data)) {
            try {
              await WorkflowAPI.updateNode(workflowId, initialNode.id, {
                label: initialNode.label,
                color: initialNode.color,
                data: initialNode.data,
              });
            } catch (error) {
              console.error(`Failed to restore node ${initialNode.id}:`, error);
            }
          }
        }
      }
      
      toast.success("Changes discarded successfully");
      
      // Navigate back and reload
      router.push("/workflows");
      
    } catch (error: any) {
      console.error("Failed to discard changes:", error);
      toast.error(error?.message || "Failed to discard changes");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-gray-600">Loading workflow...</div>
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-gray-600">Workflow not found</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/workflows")}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to workflows
            </button>
            <div className="h-6 w-px bg-gray-300" />
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{workflow.name}</h1>
              <p className="text-sm text-gray-500">
                {workflow.status === "draft" ? "Inactive workflow" : "Active workflow"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleUpdateWorkflow}
              disabled={saving || hasPendingOperations}
              className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${
                !saving && !hasPendingOperations
                  ? "bg-[#3CCED7] hover:bg-[#2AB5BD]"
                  : "bg-gray-400 cursor-not-allowed"
              }`}
            >
              {saving ? "Saving..." : "Update workflow"}
            </button>
            <button 
              onClick={handleDiscardChanges}
              disabled={saving}
              className={`rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium ${
                !saving
                  ? "text-gray-700 hover:bg-gray-50"
                  : "text-gray-400 cursor-not-allowed"
              }`}
            >
              Discard changes
            </button>
            <button className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-700 hover:bg-gray-50">
              ⋯
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main Canvas Area */}
        <div className="flex flex-1 flex-col border-r border-gray-200 bg-white">
          <div className="flex items-center justify-between gap-4 border-b border-gray-200 px-6 py-3">
            <div className="flex gap-2">
              <button
                onClick={() => setShowDiagram(true)}
                className={`rounded px-3 py-1.5 text-sm font-medium ${
                  showDiagram
                    ? "bg-[#3CCED7]/10 text-[#1a9ba3]"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                Diagram
              </button>
              <button
                onClick={() => setShowDiagram(false)}
                className={`rounded px-3 py-1.5 text-sm font-medium ${
                  !showDiagram
                    ? "bg-[#3CCED7]/10 text-[#1a9ba3]"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                Text
              </button>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowAddNodeDialog(true)}
                className="rounded-lg bg-[#3CCED7] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2AB5BD]"
              >
                Add node
              </button>
              <button
                onClick={() => setShowCreateConnectionDialog(true)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Add connection
              </button>
              <div className="h-6 w-px bg-gray-300" />
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input 
                  type="checkbox" 
                  className="rounded border-gray-300 cursor-pointer" 
                  checked={showConnectionLabels}
                  onChange={(e) => setShowConnectionLabels(e.target.checked)}
                />
                Show connection labels
              </label>
            </div>
          </div>

          {showDiagram ? (
            <WorkflowCanvas
              workflowId={workflowId}
              selection={selection}
              onSelectionChange={setSelection}
              refreshTrigger={refreshTrigger}
              showEdgeLabels={showConnectionLabels}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center text-gray-500">
              Text view coming soon...
            </div>
          )}
        </div>

        {/* Properties Sidebar */}
        <WorkflowSidebar selection={selection} workflowId={workflowId} />
      </div>

      {/* Dialogs */}
      <AddNodeDialog
        workflowId={workflowId}
        isOpen={showAddNodeDialog}
        onClose={() => setShowAddNodeDialog(false)}
        onNodeAdded={handleNodeAdded}
      />
      <CreateConnectionDialog
        workflowId={workflowId}
        isOpen={showCreateConnectionDialog}
        onClose={() => setShowCreateConnectionDialog(false)}
        onConnectionCreated={handleConnectionCreated}
      />

      {/* Discard Changes Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDiscardConfirm}
        title="Discard Changes"
        message="Are you sure you want to discard all changes? This will restore the workflow to its original state."
        type="warning"
        confirmText="Discard"
        cancelText="Cancel"
        onConfirm={confirmDiscardChanges}
        onCancel={() => setShowDiscardConfirm(false)}
      />
    </div>
  );
}
