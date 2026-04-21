"use client";

import { useWorkflowGraph } from "@/hooks/useWorkflowGraph";
import { ChevronRight, Plus, Trash2, Edit2 } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

interface ConnectionEditorProps {
  connectionId: number;
  workflowId: number;
}

const EVENT_TYPES = [
  { value: "manual_transition", label: "Manual Transition" },
  { value: "issue_created", label: "Issue Created" },
  { value: "issue_updated", label: "Issue Updated" },
  { value: "issue_commented", label: "Issue Commented" },
  { value: "issue_assigned", label: "Issue Assigned" },
  { value: "issue_resolved", label: "Issue Resolved" },
];

export default function ConnectionEditor({ connectionId, workflowId }: ConnectionEditorProps) {
  const { connections, nodes, updateConnection } = useWorkflowGraph();
  const [rulesOpen, setRulesOpen] = useState({
    restrict: false,
    validate: false,
    perform: false,
  });
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  
  // Edit states
  const [isEditingPath, setIsEditingPath] = useState(false);
  const [editedFromNodeId, setEditedFromNodeId] = useState<number | null>(null);
  const [editedToNodeId, setEditedToNodeId] = useState<number | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  
  // Property management
  const [isAddingProperty, setIsAddingProperty] = useState(false);
  const [newPropertyKey, setNewPropertyKey] = useState("");
  const [newPropertyValue, setNewPropertyValue] = useState("");

  const connection = connections.find((c) => c.id === connectionId);
  const sourceNode = nodes.find((n) => n.id === connection?.source_node_id);
  const targetNode = nodes.find((n) => n.id === connection?.target_node_id);

  if (!connection) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500">Connection not found</p>
      </div>
    );
  }

  // Handle event type update (optimistic)
  const handleEventUpdate = (newEvent: string) => {
    // Optimistic update - no await
    updateConnection(workflowId, connectionId, { event_type: newEvent });
    // Store will handle rollback if API fails
  };

  // Handle name update (optimistic)
  const handleNameUpdate = () => {
    // Optimistic update - no await
    updateConnection(workflowId, connectionId, { 
      name: editedName.trim() || undefined  // Send undefined to clear custom name and use default
    });
    
    // Immediately close edit mode
    setIsEditingName(false);
    // Store will handle rollback if API fails
  };

  const startEditingName = () => {
    setEditedName(connection.name || "");
    setIsEditingName(true);
  };

  // Handle path update (optimistic)
  const handlePathUpdate = () => {
    if (!editedFromNodeId || !editedToNodeId) {
      toast.error("Please select both source and destination nodes");
      return;
    }

    if (editedFromNodeId === editedToNodeId && connection.connection_type !== "loop") {
      toast.error("Source and destination cannot be the same (unless it's a loop)");
      return;
    }

    // Optimistic update - no await
    updateConnection(workflowId, connectionId, {
      source_node_id: editedFromNodeId,
      target_node_id: editedToNodeId,
    });
    
    // Immediately close edit mode
    setIsEditingPath(false);
    // Store will handle rollback if API fails
  };

  const startEditingPath = () => {
    setEditedFromNodeId(connection.source_node_id);
    setEditedToNodeId(connection.target_node_id);
    setIsEditingPath(true);
  };

  // Handle property add (optimistic)
  const handleAddProperty = () => {
    if (!newPropertyKey.trim()) {
      toast.error("Property key cannot be empty");
      return;
    }

    const updatedProperties = {
      ...(connection.properties || {}),
      [newPropertyKey]: newPropertyValue,
    };

    // Optimistic update - no await
    updateConnection(workflowId, connectionId, {
      properties: updatedProperties,
    });
    
    // Immediately reset form and close
    setNewPropertyKey("");
    setNewPropertyValue("");
    setIsAddingProperty(false);
    // Store will handle rollback if API fails
  };

  // Handle property delete (optimistic)
  const handleDeleteProperty = (key: string) => {
    const updatedProperties = { ...(connection.properties || {}) };
    delete updatedProperties[key];

    // Optimistic update - no await
    updateConnection(workflowId, connectionId, {
      properties: updatedProperties,
    });
    // Store will handle rollback if API fails
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Connection</h2>
          <button className="text-gray-400 hover:text-gray-600">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Connections link nodes as actions that move work through your flow.
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
            <div className="space-y-2">
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                placeholder={`${sourceNode?.label} → ${targetNode?.label}`}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
              />
              <p className="text-xs text-gray-500">
                Leave empty to use default name (From → To)
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleNameUpdate}
                  className="flex-1 px-3 py-2 text-sm font-medium text-white bg-[#3CCED7] rounded-md hover:bg-[#2AB5BD]"
                >
                  Update
                </button>
                <button
                  onClick={() => setIsEditingName(false)}
                  className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-900">
              {connection.name || `${sourceNode?.label} → ${targetNode?.label}`}
            </div>
          )}
        </div>

        {/* Path Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">Path</label>
            {!isEditingPath && (
              <button
                onClick={startEditingPath}
                className="text-gray-400 hover:text-gray-600"
              >
                <Edit2 className="h-4 w-4" />
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500 mb-2">From node → To node</p>
          {isEditingPath ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-600 mb-1 block">From:</label>
                <select
                  value={editedFromNodeId || ""}
                  onChange={(e) => setEditedFromNodeId(Number(e.target.value) || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                >
                  <option value="">Select source node</option>
                  {nodes.filter(node => node.node_type !== "done").map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.label} ({node.node_type})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">To:</label>
                <select
                  value={editedToNodeId || ""}
                  onChange={(e) => setEditedToNodeId(Number(e.target.value) || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                >
                  <option value="">Select destination node</option>
                  {nodes.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.label} ({node.node_type})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handlePathUpdate}
                  className="flex-1 px-3 py-2 text-sm font-medium text-white bg-[#3CCED7] rounded-md hover:bg-[#2AB5BD]"
                >
                  Update
                </button>
                <button
                  onClick={() => setIsEditingPath(false)}
                  className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div>
                <label className="text-xs text-gray-600">From:</label>
                <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-900">
                  {sourceNode?.label}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-600">To:</label>
                <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-900">
                  {targetNode?.label}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Event Section */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Event</label>
          <p className="text-xs text-gray-500 mb-2">Trigger event for this transition</p>
          <select
            value={connection.event_type || "manual_transition"}
            onChange={(e) => handleEventUpdate(e.target.value)}
            className="w-full rounded-lg border-gray-300 bg-white px-3 py-2 text-sm border focus:border-[#3CCED7] focus:ring-[#3CCED7]"
          >
            {EVENT_TYPES.map((event) => (
              <option key={event.value} value={event.value}>
                {event.label}
              </option>
            ))}
          </select>
        </div>

        {/* Properties Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Properties
              <span className="ml-1 inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium bg-[#3CCED7]/15 text-[#1a9ba3] rounded">
                {Object.keys(connection.properties || {}).length}
              </span>
            </label>
            <button
              className="text-[#3CCED7] hover:text-[#1a9ba3] transition-colors"
              onClick={() => setPropertiesOpen(!propertiesOpen)}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-gray-500 mb-3">Custom properties for this transition</p>

          {propertiesOpen && (
            <div className="mt-3 space-y-2">
              {Object.keys(connection.properties || {}).length === 0 ? (
                <div className="text-center py-4 text-sm text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  No properties yet
                </div>
              ) : (
                Object.entries(connection.properties || {}).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-gray-600">Key:</span>
                        <span className="text-sm font-medium text-gray-900 truncate">{key}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-600">Value:</span>
                        <span className="text-sm text-gray-700 truncate">{String(value)}</span>
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

        {/* Rules Section */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">Rules</label>

          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
              <button
                onClick={() => setRulesOpen({ ...rulesOpen, restrict: !rulesOpen.restrict })}
                className="flex flex-1 items-center gap-2 text-left"
              >
                <ChevronRight
                  className={`h-4 w-4 transition-transform ${
                    rulesOpen.restrict ? "rotate-90" : ""
                  }`}
                />
                <div>
                  <div className="text-sm font-medium text-gray-900">Restrict connection</div>
                  <div className="text-xs text-gray-500">
                    Hide this connection when these aren't met
                  </div>
                </div>
              </button>
              <Plus className="h-4 w-4 text-gray-400" />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
              <button
                onClick={() => setRulesOpen({ ...rulesOpen, validate: !rulesOpen.validate })}
                className="flex flex-1 items-center gap-2 text-left"
              >
                <ChevronRight
                  className={`h-4 w-4 transition-transform ${
                    rulesOpen.validate ? "rotate-90" : ""
                  }`}
                />
                <div>
                  <div className="text-sm font-medium text-gray-900">Validate details</div>
                  <div className="text-xs text-gray-500">
                    Validate details before moving the issue
                  </div>
                </div>
              </button>
              <Plus className="h-4 w-4 text-gray-400" />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
              <button
                onClick={() => setRulesOpen({ ...rulesOpen, perform: !rulesOpen.perform })}
                className="flex flex-1 items-center gap-2 text-left"
              >
                <ChevronRight
                  className={`h-4 w-4 transition-transform ${
                    rulesOpen.perform ? "rotate-90" : ""
                  }`}
                />
                <div>
                  <div className="text-sm font-medium text-gray-900">Perform actions</div>
                  <div className="text-xs text-gray-500">
                    Perform actions and move issue to "{targetNode?.label}"
                  </div>
                </div>
              </button>
              <Plus className="h-4 w-4 text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 px-6 py-4">
        <button className="text-sm text-gray-400 hover:text-red-600">Delete connection</button>
      </div>
    </div>
  );
}
