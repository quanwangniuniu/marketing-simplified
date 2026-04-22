"use client";

import { useState, useEffect } from "react";
import { WorkflowAPI } from "@/lib/api/workflowApi";
import type { WorkflowNode, NodeType } from "@/types/workflow";
import toast from "react-hot-toast";
import { useWorkflowGraph } from "@/hooks/useWorkflowGraph";

interface AddNodeDialogProps {
  workflowId: number;
  isOpen: boolean;
  onClose: () => void;
  onNodeAdded: () => void;
}

type TabType = "existing" | "new";

// Node categories aligned with Jira Status Categories
const NODE_CATEGORIES: { value: NodeType; label: string; description: string }[] = [
  { 
    value: "to_do", 
    label: "To Do",
    description: "Work that has not been started"
  },
  { 
    value: "in_progress", 
    label: "In Progress",
    description: "Work that is actively being worked on"
  },
  { 
    value: "done", 
    label: "Done",
    description: "Work that has been completed"
  },
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

export default function AddNodeDialog({
  workflowId,
  isOpen,
  onClose,
  onNodeAdded,
}: AddNodeDialogProps) {
  const { nodes, addNode } = useWorkflowGraph();
  const [activeTab, setActiveTab] = useState<TabType>("existing");
  const [loading, setLoading] = useState(false);
  const [existingNodes, setExistingNodes] = useState<WorkflowNode[]>([]);
  const [selectedExistingNode, setSelectedExistingNode] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // New node form state
  const [newNodeName, setNewNodeName] = useState("");
  const [newNodeType, setNewNodeType] = useState<NodeType>("to_do");
  const [newNodeColor, setNewNodeColor] = useState("#3b82f6");

  // Load existing nodes
  useEffect(() => {
    if (isOpen && activeTab === "existing") {
      loadExistingNodes();
    }
  }, [isOpen, activeTab, workflowId]);

  const loadExistingNodes = async () => {
    try {
      setLoading(true);
      const nodes = await WorkflowAPI.getNodes(workflowId);
      setExistingNodes(nodes);
    } catch (error) {
      console.error("Failed to load existing nodes:", error);
      toast.error("Failed to load existing nodes");
    } finally {
      setLoading(false);
    }
  };

  const handleAddExistingNode = async () => {
    if (!selectedExistingNode) {
      toast.error("Please select a node");
      return;
    }

    try {
      setLoading(true);
      const selectedNode = existingNodes.find(n => n.id === selectedExistingNode);
      if (!selectedNode) return;

      // Create a copy of the existing node using addNode for optimistic update
      addNode(workflowId, {
        node_type: selectedNode.node_type,
        label: selectedNode.label,
        color: selectedNode.color,
        data: {
          ...selectedNode.data,
          position: {
            x: (selectedNode.data?.position?.x || 0) + 100,
            y: (selectedNode.data?.position?.y || 0) + 100,
          },
        },
      });

      toast.success("Node added successfully");
      handleClose();
      onNodeAdded();
    } catch (error) {
      console.error("Failed to add node:", error);
      toast.error("Failed to add node");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewNode = async () => {
    if (!newNodeName.trim()) {
      toast.error("Please enter a node name");
      return;
    }

    try {
      setLoading(true);
      
      // Calculate position for new node using nodes from Zustand store
      const maxX = Math.max(...nodes.map(n => n.data?.position?.x || 0), 0);
      const maxY = Math.max(...nodes.map(n => n.data?.position?.y || 0), 0);

      // Use addNode for optimistic update
      addNode(workflowId, {
        node_type: newNodeType,
        label: newNodeName,
        color: newNodeColor,
        data: {
          position: {
            x: maxX + 200,
            y: maxY + 100,
          },
        },
      });

      toast.success("Node created successfully");
      handleClose();
      onNodeAdded();
    } catch (error) {
      console.error("Failed to create node:", error);
      toast.error("Failed to create node");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setActiveTab("existing");
    setSelectedExistingNode(null);
    setSearchTerm("");
    setNewNodeName("");
    setNewNodeType("to_do");
    setNewNodeColor("#3b82f6");
    onClose();
  };

  if (!isOpen) return null;

  const filteredNodes = existingNodes.filter(node =>
    node.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    node.node_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Add a node</h2>
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
            Nodes capture the stages of your working process. Add more nodes to represent different stages in your team's process.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-6">
          <button
            onClick={() => setActiveTab("existing")}
            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "existing"
                ? "border-[#3CCED7] text-[#3CCED7]"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            Add existing node
          </button>
          <button
            onClick={() => setActiveTab("new")}
            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "new"
                ? "border-[#3CCED7] text-[#3CCED7]"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            Create new node
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 max-h-[400px] overflow-y-auto">
          {activeTab === "existing" ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search for a node
                </label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search nodes..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                />
              </div>

              {loading ? (
                <div className="text-center py-8 text-gray-500">Loading nodes...</div>
              ) : filteredNodes.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {searchTerm ? "No nodes found" : "No existing nodes"}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredNodes.map((node) => (
                    <label
                      key={node.id}
                      className="flex items-center p-3 border rounded-md hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="existing-node"
                        value={node.id}
                        checked={selectedExistingNode === node.id}
                        onChange={() => setSelectedExistingNode(node.id)}
                        className="mr-3"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: node.color || "#6b7280" }}
                          />
                          <span className="font-medium text-gray-900">{node.label}</span>
                          <span className="text-xs text-gray-500">
                            ({node.node_type})
                          </span>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New node name
                </label>
                <input
                  type="text"
                  value={newNodeName}
                  onChange={(e) => setNewNodeName(e.target.value)}
                  placeholder="Enter node name..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={newNodeType}
                  onChange={(e) => setNewNodeType(e.target.value as NodeType)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                >
                  {NODE_CATEGORIES.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {NODE_CATEGORIES.find(c => c.value === newNodeType)?.description}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {COLORS.map((color) => (
                    <label
                      key={color.value}
                      className={`flex items-center p-2 border rounded-md hover:bg-gray-50 cursor-pointer ${
                        newNodeColor === color.value ? "ring-2 ring-[#3CCED7]" : ""
                      }`}
                    >
                      <input
                        type="radio"
                        name="color"
                        value={color.value}
                        checked={newNodeColor === color.value}
                        onChange={(e) => setNewNodeColor(e.target.value)}
                        className="sr-only"
                      />
                      <span
                        className="w-4 h-4 rounded-full mr-2"
                        style={{ backgroundColor: color.value }}
                      />
                      <span className="text-sm text-gray-700">{color.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
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
            onClick={activeTab === "existing" ? handleAddExistingNode : handleCreateNewNode}
            disabled={loading || (activeTab === "existing" && !selectedExistingNode)}
            className="px-4 py-2 text-sm font-medium text-white bg-[#3CCED7] rounded-md hover:bg-[#2AB5BD] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Adding..." : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}

