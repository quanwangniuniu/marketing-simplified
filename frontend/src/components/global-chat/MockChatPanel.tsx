'use client';

import { useState } from 'react';
import { Bot, Send, Plus, Clock, MessageSquare, ChevronLeft, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface MockChatPanelProps {
  onClose: () => void;
  initialSession?: string | null;
}

interface MockSession {
  id: string;
  title: string;
  preview: string;
  time: string;
  unread?: boolean;
}

const mockSessions: MockSession[] = [
  { id: '1', title: 'New Dialogue', preview: '', time: 'Now', unread: true },
  { id: '2', title: 'Q2 Budget Analysis', preview: 'Total spend across all platforms is $65.5K...', time: '12m ago' },
  { id: '3', title: 'Campaign ROAS Review', preview: 'The top performer is Google Search Brand...', time: '2h ago' },
  { id: '4', title: 'Meta Ad Set Recommendations', preview: 'I recommend pausing Soul Sucking C1...', time: '1d ago' },
  { id: '5', title: 'Weekly Performance Report', preview: 'Here is your weekly summary for Apr 7-13...', time: '2d ago' },
];

interface MockMessage {
  role: 'user' | 'assistant';
  content: string;
}

const mockConversation: MockMessage[] = [
  { role: 'user', content: 'What is my total ad spend this month across all platforms?' },
  { role: 'assistant', content: 'Your total ad spend this month is **$65,593.47** across 4 campaigns.\n\n• Meta Ads: $5,240.11 (8.0%)\n• Google Ads: $15,601.40 (23.8%)\n• TikTok Ads: $5,347.20 (8.2%)\n\nBudget pacing is at 68% — you\'re slightly under target. Would you like me to analyze which campaigns are underspending?' },
  { role: 'user', content: 'Which campaigns have the worst ROAS?' },
  { role: 'assistant', content: 'Here are the **5 worst-performing campaigns** by ROAS:\n\n1. 🔴 META | FES | ADV+ | Soul Sucking — **0.07x** ($2,327 spent)\n2. 🔴 META | FES | ADV+ | NORM JOB — **0.15x** ($765 spent)\n3. 🔴 META | FES | ABO | ADV+ | Jade — **0.09x** ($1,247 spent)\n4. 🟡 META | FES | LAL 1% | POV$3k — **0.45x** ($878 spent)\n5. 🟡 META | FES-B | ABO | Soul Sucking — **0.50x** ($789 spent)\n\nAll 5 are Meta campaigns. I recommend pausing the top 3 immediately — they\'ve spent $4,339 with near-zero return.' },
];

export default function MockChatPanel({ onClose, initialSession }: MockChatPanelProps) {
  const [activeSession, setActiveSession] = useState(initialSession ?? '2');
  const [showSessions, setShowSessions] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const panelClass = isMaximized
    ? 'fixed bottom-0 right-0 w-[560px] h-[calc(100vh-24px)] m-3'
    : 'fixed bottom-20 right-6 w-[420px] h-[560px]';

  return (
    <div className={`${panelClass} z-40 bg-white border border-gray-200 rounded-xl shadow-2xl flex flex-col overflow-hidden transition-all duration-200`}>
      {/* Title bar */}
      <div className="flex items-center justify-between h-11 px-3 border-b border-gray-100 bg-gray-50/80 shrink-0">
        <div className="flex items-center gap-2">
          {showSessions ? (
            <button onClick={() => setShowSessions(false)} className="p-1 hover:bg-gray-200 rounded transition-colors">
              <ChevronLeft className="w-4 h-4 text-gray-500" />
            </button>
          ) : (
            <button onClick={() => setShowSessions(true)} className="p-1 hover:bg-gray-200 rounded transition-colors">
              <MessageSquare className="w-4 h-4 text-gray-500" />
            </button>
          )}
          <div className="flex items-center gap-1.5">
            <Bot className="w-4 h-4 text-[#3CCED7]" />
            <span className="text-sm font-medium text-gray-900">
              {showSessions ? 'Sessions' : mockSessions.find(s => s.id === activeSession)?.title || 'AI Agent'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={() => setIsMaximized(!isMaximized)} className="p-1.5 hover:bg-gray-200 rounded transition-colors">
            {isMaximized ? <Minimize2 className="w-3.5 h-3.5 text-gray-400" /> : <Maximize2 className="w-3.5 h-3.5 text-gray-400" />}
          </button>
        </div>
      </div>

      {showSessions ? (
        /* Session list view */
        <div className="flex-1 overflow-y-auto">
          <div className="p-3">
            <button className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-dashed border-[#3CCED7]/40 text-[#3CCED7] text-sm font-medium hover:bg-[#3CCED7]/5 transition-colors">
              <Plus className="w-4 h-4" />
              New Chat
            </button>
          </div>
          <div className="px-2">
            {mockSessions.map((session) => (
              <button
                key={session.id}
                onClick={() => { setActiveSession(session.id); setShowSessions(false); }}
                className={`w-full flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors mb-0.5 ${
                  activeSession === session.id ? 'bg-[#3CCED7]/8' : 'hover:bg-gray-50'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm truncate ${activeSession === session.id ? 'text-[#3CCED7] font-medium' : 'text-gray-900'}`}>
                      {session.title}
                    </span>
                    <span className="text-[10px] text-gray-400 shrink-0 ml-2">{session.time}</span>
                  </div>
                  {session.preview && (
                    <p className="text-[11px] text-gray-400 truncate mt-0.5">{session.preview}</p>
                  )}
                </div>
                {session.unread && (
                  <div className="w-1.5 h-1.5 rounded-full bg-[#3CCED7] mt-1.5 shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* Chat view */
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {mockConversation.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-[13px] leading-5 ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-br from-[#3CCED7] to-[#3CCED7]/90 text-white'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {msg.content.split('\n').map((line, j) => (
                    <p key={j} className={j > 0 ? 'mt-1.5' : ''}>
                      {line.split('**').map((segment, k) =>
                        k % 2 === 1 ? <strong key={k}>{segment}</strong> : segment
                      )}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Input bar */}
          <div className="px-3 py-2.5 border-t border-gray-100 shrink-0">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Ask about your campaigns..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="flex-1 h-9 text-sm border-gray-200 focus:border-[#3CCED7] focus:ring-[#3CCED7]/20"
              />
              <Button
                size="sm"
                className="h-9 w-9 p-0 bg-gradient-to-br from-[#3CCED7] to-[#A6E661] hover:opacity-90 border-0"
              >
                <Send className="w-4 h-4 text-white" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
