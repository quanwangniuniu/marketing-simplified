'use client';

import { X, Bot } from 'lucide-react';
import { AgentLayoutProvider } from './AgentLayoutContext';
import { AgentChatPage } from './chat/AgentChatPage';
import { useAgentSidePanelStore } from '@/lib/agentSidePanelStore';

export default function AgentSidePanel() {
  const { isOpen, close } = useAgentSidePanelStore();

  return (
    <aside
      className={`h-screen border-l border-gray-200 bg-white shrink-0 transition-all duration-300 overflow-hidden ${
        isOpen ? 'w-[420px]' : 'w-0'
      }`}
    >
      <div className="w-[420px] h-full flex flex-col">
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
