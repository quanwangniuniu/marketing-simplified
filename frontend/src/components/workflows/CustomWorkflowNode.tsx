"use client";

import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";

/**
 * Custom Workflow Node with 4 connection handles (top, right, bottom, left)
 * Handles are shown on hover for cleaner visual appearance
 * Each handle can be both source and target
 */
const CustomWorkflowNode = memo(({ data, selected }: NodeProps) => {
  return (
    <div
      className={`px-4 py-2 rounded-lg border-2 shadow-md transition-all ${
        selected ? "ring-2 ring-[#3CCED7] ring-offset-2" : ""
      }`}
      style={{
        backgroundColor: data.backgroundColor || "#3b82f6",
        borderColor: data.borderColor || "#3b82f6",
        color: data.color || "#ffffff",
        minWidth: "120px",
        minHeight: "40px",
      }}
    >
      {/* Top Handle - can be both source and target */}
      <Handle
        type="source"
        position={Position.Top}
        id="top-source"
        isConnectable={true}
        className="!w-3 !h-3 !bg-[#3CCED7] !border-2 !border-white hover:!w-4 hover:!h-4 transition-all opacity-0 hover:opacity-100 !cursor-pointer"
        style={{ top: -6, zIndex: 10 }}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="top-target"
        isConnectable={true}
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-white hover:!w-4 hover:!h-4 transition-all opacity-0 hover:opacity-100 !cursor-pointer"
        style={{ top: -6, zIndex: 10 }}
      />

      {/* Right Handle - can be both source and target */}
      <Handle
        type="source"
        position={Position.Right}
        id="right-source"
        isConnectable={true}
        className="!w-3 !h-3 !bg-[#3CCED7] !border-2 !border-white hover:!w-4 hover:!h-4 transition-all opacity-0 hover:opacity-100 !cursor-pointer"
        style={{ right: -6, zIndex: 10 }}
      />
      <Handle
        type="target"
        position={Position.Right}
        id="right-target"
        isConnectable={true}
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-white hover:!w-4 hover:!h-4 transition-all opacity-0 hover:opacity-100 !cursor-pointer"
        style={{ right: -6, zIndex: 10 }}
      />

      {/* Bottom Handle - can be both source and target */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom-source"
        isConnectable={true}
        className="!w-3 !h-3 !bg-[#3CCED7] !border-2 !border-white hover:!w-4 hover:!h-4 transition-all opacity-0 hover:opacity-100 !cursor-pointer"
        style={{ bottom: -6, zIndex: 10 }}
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="bottom-target"
        isConnectable={true}
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-white hover:!w-4 hover:!h-4 transition-all opacity-0 hover:opacity-100 !cursor-pointer"
        style={{ bottom: -6, zIndex: 10 }}
      />

      {/* Left Handle - can be both source and target */}
      <Handle
        type="source"
        position={Position.Left}
        id="left-source"
        isConnectable={true}
        className="!w-3 !h-3 !bg-[#3CCED7] !border-2 !border-white hover:!w-4 hover:!h-4 transition-all opacity-0 hover:opacity-100 !cursor-pointer"
        style={{ left: -6, zIndex: 10 }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left-target"
        isConnectable={true}
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-white hover:!w-4 hover:!h-4 transition-all opacity-0 hover:opacity-100 !cursor-pointer"
        style={{ left: -6, zIndex: 10 }}
      />

      {/* Node Content */}
      <div className="text-center font-medium text-sm">
        {data.label || "Node"}
      </div>
    </div>
  );
});

CustomWorkflowNode.displayName = "CustomWorkflowNode";

export default CustomWorkflowNode;

