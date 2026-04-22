"use client";

import { useWorkflowGraph } from "@/hooks/useWorkflowGraph";
import { ChevronRight, Edit2, Plus, Trash2, Check, X } from "lucide-react";
import { useState } from "react";
import type { NodeType } from "@/types/workflow";
import toast from "react-hot-toast";
import CreateConnectionDialog from "./CreateConnectionDialog";
import ConfirmDialog from "@/components/common/ConfirmDialog";

interface NodeEditorProps {
  nodeId: number;
  workflowId: number;
}

const NODE_CATEGORIES: { value: NodeType; label: string }[] = [
  { value: "start", label: "Start" },  // Entry point - cannot be changed
  { value: "to_do", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
];

const COLORS = [
  { value: "#6b7280", label: "Gray" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#10b981", label: "Green" },
  { value: "#eab308", label: "Yellow" },
  { value: "#ef4444", label: "Red" },
  { value: "#a855f7", label: "Purple" },
  { value: "#ec4899", label: "Pink" },
  { value: "#f97316", label: "Orange" },
];

export default function NodeEditor({ nodeId, workflowId }: NodeEditorProps) {
  const { nodes, connections, updateNode, removeNode } = useWorkflowGraph();
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  
  // Edit states
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [isEditingColor, setIsEditingColor] = useState(false);
  
  // Property management
  const [isAddingProperty, setIsAddingProperty] = useState(false);
  const [newPropertyKey, setNewPropertyKey] = useState("");
  const [newPropertyValue, setNewPropertyValue] = useState("");
  
  // Connection dialog
  const [isConnectionDialogOpen, setIsConnectionDialogOpen] = useState(false);
  
  // Delete confirmation dialog
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const node = nodes.find((n) => n.id === nodeId);
  
  // Get all related connections (both incoming and outgoing)
  const relatedConnections = connections.filter(
    (c) => c.source_node_id === nodeId || c.target_node_id === nodeId
  );

  if (!node) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500">Node not found</p>
      </div>
    );
  }

  // Map connections to display format with source and target nodes
  const connectionDisplays = relatedConnections.map((conn) => {
    const source = nodes.find((n) => n.id === conn.source_node_id);
    const target = nodes.find((n) => n.id === conn.target_node_id);
    const isOutgoing = conn.source_node_id === nodeId;
    return { connection: conn, sourceNode: source, targetNode: target, isOutgoing };
  });

  // Handle name update (optimistic)
  const handleNameUpdate = () => {
    if (!editedName.trim()) {
      toast.error("Name cannot be empty");
      return;
    }
    
    // Optimistic update - no await
    updateNode(workflowId, nodeId, { label: editedName });
    
    // Immediately close edit mode and show feedback
    setIsEditingName(false);
    // Store will handle rollback if API fails
  };

  const startEditingName = () => {
    setEditedName(node.label);
    setIsEditingName(true);
  };

  // Handle category update (optimistic)
  const handleCategoryUpdate = (newCategory: NodeType) => {
    // Optimistic update - no await
    updateNode(workflowId, nodeId, { node_type: newCategory });
    
    // Immediately close edit mode
    setIsEditingCategory(false);
    // Store will handle rollback if API fails
  };

  // Handle color update (optimistic)
  const handleColorUpdate = (newColor: string) => {
    // Optimistic update - no await
    updateNode(workflowId, nodeId, { color: newColor });
    
    // Immediately close edit mode
    setIsEditingColor(false);
    // Store will handle rollback if API fails
  };

  // Handle property add (optimistic)
  const handleAddProperty = () => {
    if (!newPropertyKey.trim()) {
      toast.error("Property key cannot be empty");
      return;
    }

    const updatedProperties = {
      ...(node.data?.properties || {}),
      [newPropertyKey]: newPropertyValue,
    };

    // Optimistic update - no await
    updateNode(workflowId, nodeId, {
      data: {
        ...node.data,
        properties: updatedProperties,
      },
    });
    
    // Immediately reset form and close
    setNewPropertyKey("");
    setNewPropertyValue("");
    setIsAddingProperty(false);
    // Store will handle rollback if API fails
  };

  // Handle property delete (optimistic)
  const handleDeleteProperty = (key: string) => {
    const updatedProperties = { ...(node.data?.properties || {}) };
    delete updatedProperties[key];

    // Optimistic update - no await
    updateNode(workflowId, nodeId, {
      data: {
        ...node.data,
        properties: updatedProperties,
      },
    });
    // Store will handle rollback if API fails
  };

  // Handle node delete (optimistic)
  const handleDeleteNode = () => {
    if (node.node_type === "start") {
      toast.error("START node cannot be deleted");
      return;
    }

    // Show confirmation dialog
    setShowDeleteConfirm(true);
  };

  const confirmDeleteNode = () => {
    // Optimistic delete - no await
    removeNode(workflowId, nodeId);
    toast.success("Node deleted");
    setShowDeleteConfirm(false);
    // Store will handle rollback if API fails
  };

  return (
    <>
      <div className="flex flex-col h-full">
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Node</h2>
            <button className="text-gray-400 hover:text-gray-600">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Nodes capture the stages of your working process.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Name Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Name</label>
              {!isEditingName && (
                <button
                  onClick={startEditingName}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
              )}
            </div>
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleNameUpdate();
                    if (e.key === "Escape") setIsEditingName(false);
                  }}
                />
                <button
                  onClick={handleNameUpdate}
                  className="p-2 text-green-600 hover:text-green-700"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setIsEditingName(false)}
                  className="p-2 text-gray-600 hover:text-gray-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-900">
                {node.label}
              </div>
            )}
          </div>

          {/* Category Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Category</label>
              {!isEditingCategory && node.node_type !== "start" && (
                <button
                  onClick={() => setIsEditingCategory(true)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
              )}
            </div>
            {node.node_type === "start" ? (
              <div className="rounded-lg bg-orange-50 px-3 py-2 text-sm text-orange-900 border border-orange-200">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Start</span>
                  <span className="text-xs text-orange-600">(Entry point - cannot be changed)</span>
                </div>
              </div>
            ) : isEditingCategory ? (
              <div className="space-y-2">
                {NODE_CATEGORIES.filter(cat => cat.value !== "start").map((category) => (
                  <button
                    key={category.value}
                    onClick={() => handleCategoryUpdate(category.value)}
                    className={`w-full text-left px-3 py-2 border rounded-md transition-colors ${
                      node.node_type === category.value
                        ? "border-[#3CCED7] bg-[#3CCED7]/10"
                        : "border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {category.label}
                  </button>
                ))}
                <button
                  onClick={() => setIsEditingCategory(false)}
                  className="w-full px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-900 capitalize">
                {node.node_type.replace(/_/g, " ")}
              </div>
            )}
          </div>

          {/* Color Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Color</label>
              {!isEditingColor && (
                <button
                  onClick={() => setIsEditingColor(true)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
              )}
            </div>
            {isEditingColor ? (
              <div className="space-y-2">
                <div className="grid grid-cols-4 gap-2">
                  {COLORS.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => handleColorUpdate(color.value)}
                      className={`flex items-center gap-2 p-2 border rounded-md hover:bg-gray-50 ${
                        node.color === color.value ? "ring-2 ring-[#3CCED7]" : ""
                      }`}
                    >
                      <span
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: color.value }}
                      />
                      <span className="text-xs text-gray-700">{color.label}</span>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setIsEditingColor(false)}
                  className="w-full px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
                <span
                  className="w-6 h-6 rounded-full border-2 border-gray-300"
                  style={{ backgroundColor: node.color || "#3b82f6" }}
                />
                <span className="text-sm text-gray-600">{node.color || "#3b82f6"}</span>
              </div>
            )}
          </div>

          {/* Properties Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Properties
                <span className="ml-1 inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium bg-[#3CCED7]/15 text-[#1a9ba3] rounded">
                  {Object.keys(node.data?.properties || {}).length}
                </span>
              </label>
              <button
                className="text-[#3CCED7] hover:text-[#1a9ba3] transition-colors"
                onClick={() => setPropertiesOpen(!propertiesOpen)}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              You can use properties to put restrictions on statuses.
            </p>

            {propertiesOpen && (
              <div className="mt-3 space-y-2">
                {Object.keys(node.data?.properties || {}).length === 0 ? (
                  <div className="text-center py-4 text-sm text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    No properties yet
                  </div>
                ) : (
                  Object.entries(node.data.properties || {}).map(([key, value]) => (
                    <div
                      key={key}
                      className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-gray-600">Key:</span>
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {key}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-600">Value:</span>
                          <span className="text-sm text-gray-700 truncate">
                            {String(value)}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteProperty(key)}
                        className="text-red-600 hover:text-red-700 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                )}

                {/* Add new property form */}
                {isAddingProperty ? (
                  <div className="p-3 bg-white rounded-lg border-2 border-[#3CCED7] space-y-2">
                    <input
                      type="text"
                      value={newPropertyKey}
                      onChange={(e) => setNewPropertyKey(e.target.value)}
                      placeholder="Property key"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                      autoFocus
                    />
                    <input
                      type="text"
                      value={newPropertyValue}
                      onChange={(e) => setNewPropertyValue(e.target.value)}
                      placeholder="Property value"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddProperty}
                        className="flex-1 px-3 py-2 text-sm font-medium text-white bg-[#3CCED7] rounded-md hover:bg-[#2AB5BD]"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => {
                          setIsAddingProperty(false);
                          setNewPropertyKey("");
                          setNewPropertyValue("");
                        }}
                        className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsAddingProperty(true)}
                    className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:border-[#3CCED7] hover:text-[#3CCED7] hover:bg-[#3CCED7]/10 transition-colors"
                  >
                    + Add new property
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Transitions Section */}
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">Transitions</label>
              <button
                onClick={() => setIsConnectionDialogOpen(true)}
                className="text-[#3CCED7] hover:text-[#1a9ba3]"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Connections link nodes. They represent actions people take to move work items
              through your workflow.
            </p>

            <div className="mt-3 space-y-2">
              {connectionDisplays.length === 0 ? (
                <div className="text-center py-4 text-sm text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  No transitions yet
                </div>
              ) : (
                connectionDisplays.map(({ connection, sourceNode, targetNode, isOutgoing }, idx) => (
                  <div
                    key={connection.id}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2"
                  >
                    <div className="text-xs text-gray-600">
                      <span className="font-medium">
                        {isOutgoing ? "Outgoing" : "Incoming"} Transition
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-gray-600">
                      <span className="rounded bg-gray-100 px-2 py-0.5 font-medium uppercase text-gray-700">
                        {sourceNode?.label || "Unknown"}
                      </span>
                      <span>→</span>
                      <span className="rounded bg-indigo-100 px-2 py-0.5 font-medium uppercase text-indigo-700">
                        {targetNode?.label || "Unknown"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 px-6 py-4">
          {node.node_type === "start" ? (
            <div className="text-sm text-gray-400">
              START node cannot be deleted (Entry point)
            </div>
          ) : (
            <button 
              onClick={handleDeleteNode}
              className="text-sm text-red-600 hover:text-red-700 font-medium transition-colors"
            >
              Delete node
            </button>
          )}
        </div>
      </div>

      {/* Create Connection Dialog */}
      <CreateConnectionDialog
        workflowId={workflowId}
        isOpen={isConnectionDialogOpen}
        onClose={() => setIsConnectionDialogOpen(false)}
        onConnectionCreated={() => {
          setIsConnectionDialogOpen(false);
          // Refresh will happen automatically via useWorkflowGraph
        }}
        preselectedFromNodeId={nodeId}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Node"
        message={`Are you sure you want to delete "${node.label}"? This action cannot be undone.`}
        type="danger"
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDeleteNode}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  );
}
