'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Bot } from 'lucide-react';
import { AgentLayoutProvider } from './AgentLayoutContext';
import { AgentChatPage } from './chat/AgentChatPage';
import { useAgentSidePanelStore } from '@/lib/agentSidePanelStore';

const MIN_WIDTH = 280;
const MAX_WIDTH = 420;

export default function AgentSidePanel() {
  const { isOpen, close } = useAgentSidePanelStore();
  const [width, setWidth] = useState(MAX_WIDTH);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(MAX_WIDTH);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    startX.current = e.clientX;
    startWidth.current = width;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  }, [width]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = startX.current - e.clientX;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta));
      setWidth(newWidth);
    };
    const onMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  return (
    <aside
      className={`h-screen border-l border-gray-200 bg-white shrink-0 overflow-hidden flex ${
        isOpen ? '' : 'w-0'
      }`}
      style={isOpen ? { width } : undefined}
    >
      {/* Drag handle */}
      {isOpen && (
        <div
          onMouseDown={onMouseDown}
          className="w-1 h-full cursor-ew-resize hover:bg-[#3CCED7]/40 active:bg-[#3CCED7]/60 shrink-0 transition-colors"
        />
      )}

      <div className="flex-1 h-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-[#3CCED7]" />
            <span className="text-sm font-semibold text-gray-900">AI Agent</span>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#3CCED7]/15 text-[#3CCED7]">
              AI
            </span>
          </div>
          <button
            onClick={close}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Close AI Agent panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Chat content */}
        <div className="flex-1 overflow-hidden">
          <AgentLayoutProvider initialView="overview">
            <AgentChatPage />
          </AgentLayoutProvider>
        </div>
      </div>
    </aside>
  );
}
