"use client";

import { useState, useEffect } from "react";
import { WorkflowAPI } from "@/lib/api/workflowApi";
import { useWorkflowGraph } from "@/hooks/useWorkflowGraph";
import type { WorkflowNode, ConnectionType, HandlePosition } from "@/types/workflow";
import { calculateOptimalHandles } from "@/lib/handleCalculation";
import toast from "react-hot-toast";

interface CreateConnectionDialogProps {
  workflowId: number;
  isOpen: boolean;
  onClose: () => void;
  onConnectionCreated: () => void;
  preselectedFromNodeId?: number;
}

export default function CreateConnectionDialog({
  workflowId,
  isOpen,
  onClose,
  onConnectionCreated,
  preselectedFromNodeId,
}: CreateConnectionDialogProps) {
  const { addConnection } = useWorkflowGraph();
  const [loading, setLoading] = useState(false);
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  
  // Form state
  const [fromNodeId, setFromNodeId] = useState<number | null>(null);
  const [toNodeId, setToNodeId] = useState<number | null>(null);
  const [customName, setCustomName] = useState<string>("");
  
  // Hidden fields with default values (shown only in sidebar after creation)
  const connectionType: ConnectionType = "sequential";
  const eventType = "manual_transition";
  const properties: Record<string, any> = {};
  const conditionConfig = {}; // Empty by default

  // Load nodes when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadNodes();
      // Set preselected from node if provided
      if (preselectedFromNodeId) {
        setFromNodeId(preselectedFromNodeId);
      }
    }
  }, [isOpen, workflowId, preselectedFromNodeId]);

  const loadNodes = async () => {
    try {
      setLoading(true);
      const fetchedNodes = await WorkflowAPI.getNodes(workflowId);
      setNodes(fetchedNodes);
    } catch (error) {
      console.error("Failed to load nodes:", error);
      toast.error("Failed to load nodes");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    // Validation
    if (!fromNodeId) {
      toast.error("Please select a source node");
      return;
    }
    if (!toNodeId) {
      toast.error("Please select a destination node");
      return;
    }
    if (fromNodeId === toNodeId) {
      toast.error("Source and destination nodes cannot be the same");
      return;
    }

    // Validate node types
    const sourceNode = nodes.find(n => n.id === fromNodeId);
    const targetNode = nodes.find(n => n.id === toNodeId);
    
    if (sourceNode?.node_type === "done") {
      toast.error("Done nodes cannot have outgoing connections (terminal status)");
      return;
    }
    
    if (targetNode?.node_type === "start") {
      toast.error("START node cannot have incoming connections (entry point)");
      return;
    }

    try {
      setLoading(true);

      // Calculate optimal handle positions
      
      let sourceHandle: HandlePosition = 'right';
      let targetHandle: HandlePosition = 'left';
      
      if (sourceNode && targetNode) {
        const sourcePos = sourceNode.data?.position || { x: 0, y: 0 };
        const targetPos = targetNode.data?.position || { x: 0, y: 0 };
        const handles = calculateOptimalHandles(sourcePos, targetPos);
        sourceHandle = handles.sourceHandle as HandlePosition;
        targetHandle = handles.targetHandle as HandlePosition;
      }

      // Optimistic update - no await
      addConnection(workflowId, {
        source_node_id: fromNodeId,
        target_node_id: toNodeId,
        connection_type: connectionType,
        name: customName.trim(),  // Name is now required
        condition_config: conditionConfig,
        priority: 0,
        source_handle: sourceHandle,
        target_handle: targetHandle,
        event_type: eventType,
        properties: properties,
      });

      // Immediately close dialog and show feedback
      toast.success("Connection created");
      handleClose();
      onConnectionCreated();
      // Store will handle rollback if API fails
    } catch (error: any) {
      console.error("Validation error:", error);
      const errorMessage = error.response?.data?.detail || error.message || "Invalid connection";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFromNodeId(null);
    setToNodeId(null);
    setCustomName("");
    onClose();
  };

  if (!isOpen) return null;

  // Filter nodes based on workflow rules
  // Source: Done nodes cannot be source (terminal status)
  const sourceNodes = nodes.filter(node => node.node_type !== "done");
  // Destination: START node cannot be destination (entry point)
  const destinationNodes = nodes.filter(node => node.node_type !== "start");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Create connection</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Description */}
        <div className="px-6 py-4 bg-gray-50 border-b">
          <p className="text-sm text-gray-600">
            Connections connect nodes. They represent actions people take to move issues through your workflow. They also appear as drop zones when people move cards across your project's board.
          </p>
        </div>

        {/* Info Banner */}
        <div className="px-6 py-3 bg-[#3CCED7]/10 border-b border-[#3CCED7]/20">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[#3CCED7] flex items-center justify-center mt-0.5">
              <span className="text-white text-xs font-bold">i</span>
            </div>
            <p className="text-sm text-[#0f757a]">
              To reuse a connection, edit the connection and select additional source nodes.
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          {loading && nodes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Loading nodes...</div>
          ) : nodes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="mb-2">No nodes available</p>
              <p className="text-sm">Please create nodes first before adding connections</p>
            </div>
          ) : (
            <>
              {/* From/To Nodes */}
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    From node
                  </label>
                  <select
                    value={fromNodeId || ""}
                    onChange={(e) => setFromNodeId(Number(e.target.value) || null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                  >
                    <option value="">Select source node</option>
                    {sourceNodes.map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.label} ({node.node_type})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex-shrink-0 mt-6">
                  <svg
                    className="w-6 h-6 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 8l4 4m0 0l-4 4m4-4H3"
                    />
                  </svg>
                </div>

                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    To node
                  </label>
                  <select
                    value={toNodeId || ""}
                    onChange={(e) => setToNodeId(Number(e.target.value) || null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                  >
                    <option value="">Select destination node</option>
                    {destinationNodes.map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.label} ({node.node_type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Connection Name (Required) */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g., Start Work, Merge, Approve"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Tip: Name your transition as an action people take to move an issue.
                </p>
              </div>

            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
          <button
            onClick={handleClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={loading || !fromNodeId || !toNodeId || !customName.trim() || nodes.length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-[#3CCED7] rounded-md hover:bg-[#2AB5BD] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

