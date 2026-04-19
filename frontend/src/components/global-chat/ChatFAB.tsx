'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, X, Plus, History } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import MockChatPanel from './MockChatPanel';

// --- Radial menu config (supports up to 5 actions) ---

interface RadialAction {
  id: string;
  icon: LucideIcon;
  label: string;
  handler?: string;
}

const radialActions: RadialAction[] = [
  { id: 'new', icon: Plus, label: 'New Chat', handler: 'new' },
  { id: 'resume', icon: History, label: 'Resume Last', handler: 'resume' },
  // Future slots:
  // { id: 'summary', icon: Zap, label: 'Quick Summary', handler: 'summary' },
  // { id: 'report', icon: FileText, label: 'Generate Report', handler: 'report' },
  // { id: 'analyze', icon: BarChart3, label: 'Analyze Page', handler: 'analyze' },
];

// Distribute buttons evenly on an arc from 15° to 75°
// Angle 0 = straight up from FAB, clockwise
const ARC_START = 15;
const ARC_END = 75;
const RING_RADIUS = 79; // visual radius: 72px base * 2.2 scale / 2

function getActionAngle(index: number, total: number): number {
  if (total === 1) return (ARC_START + ARC_END) / 2;
  return ARC_START + (ARC_END - ARC_START) * (index / (total - 1));
}

function getPosition(angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: -Math.sin(rad) * RING_RADIUS, y: -Math.cos(rad) * RING_RADIUS };
}

// --- Spring presets (from Agent animationConfig.ts patterns) ---

const SPRING = {
  ring: { type: 'spring' as const, stiffness: 550, damping: 30 },
  button: { type: 'spring' as const, stiffness: 480, damping: 25 },
  panel: { type: 'spring' as const, stiffness: 380, damping: 30 },
};

// --- FAB center position (from viewport bottom-right) ---
// FAB: bottom-6 (24px) right-6 (24px), size 48px → center at 48px from each edge
const FAB_CENTER = 48;
const BTN_SIZE = 40;
const BTN_OFFSET = FAB_CENTER - BTN_SIZE / 2; // 28px

export default function ChatFAB() {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const keepOpen = useCallback(() => {
    if (leaveTimer.current) { clearTimeout(leaveTimer.current); leaveTimer.current = null; }
    if (!isOpen) setIsHovered(true);
  }, [isOpen]);

  const scheduleClose = useCallback(() => {
    leaveTimer.current = setTimeout(() => setIsHovered(false), 120);
  }, []);

  const handleAction = (actionId: string) => {
    setActiveSession(actionId === 'resume' ? '2' : null);
    setIsOpen(true);
    setIsHovered(false);
  };

  const showRadial = isHovered && !isOpen;
  const total = radialActions.length;

  return (
    <>
      {/* --- Radial ring + action buttons --- */}
      <AnimatePresence>
        {showRadial && (
          <>
            {/* Ring */}
            <motion.div
              className="fixed z-50 pointer-events-none rounded-full border border-[#3CCED7]/12 bg-[#3CCED7]/3"
              style={{
                bottom: FAB_CENTER - 36,
                right: FAB_CENTER - 36,
                width: 72,
                height: 72,
                transformOrigin: 'center',
              }}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 2.2, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={SPRING.ring}
            />

            {/* Action buttons on ring */}
            {radialActions.map((action, i) => {
              const angle = getActionAngle(i, total);
              const pos = getPosition(angle);
              return (
                <motion.button
                  key={action.id}
                  className="fixed z-50 rounded-full bg-white shadow-md border border-gray-200/80 flex items-center justify-center hover:border-[#3CCED7]/50 hover:shadow-lg transition-all group"
                  style={{ bottom: BTN_OFFSET, right: BTN_OFFSET, width: BTN_SIZE, height: BTN_SIZE }}
                  initial={{ x: 0, y: 0, opacity: 0, scale: 0.3 }}
                  animate={{ x: pos.x, y: pos.y, opacity: 1, scale: 1 }}
                  exit={{ x: 0, y: 0, opacity: 0, scale: 0.3 }}
                  transition={{ ...SPRING.button, delay: i * 0.02 }}
                  onClick={() => handleAction(action.id)}
                  onMouseEnter={keepOpen}
                  onMouseLeave={scheduleClose}
                  title={action.label}
                >
                  <action.icon className="w-[18px] h-[18px] text-gray-500 group-hover:text-[#3CCED7] transition-colors" />
                </motion.button>
              );
            })}
          </>
        )}
      </AnimatePresence>

      {/* --- FAB button --- */}
      <motion.button
        className={`fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-colors duration-200 ${
          isOpen
            ? 'bg-gray-900 hover:bg-gray-800'
            : 'bg-gradient-to-br from-[#3CCED7] to-[#A6E661] hover:shadow-xl'
        }`}
        onClick={() => { setIsOpen(!isOpen); setIsHovered(false); }}
        onMouseEnter={keepOpen}
        onMouseLeave={scheduleClose}
        whileTap={{ scale: 0.95 }}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.12 }}>
              <X className="w-5 h-5 text-white" />
            </motion.div>
          ) : (
            <motion.div key="bot" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.12 }}>
              <Bot className="w-5 h-5 text-white" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* --- Chat panel (NO motion.div wrapper to avoid transform breaking fixed) --- */}
      {isOpen && (
        <MockChatPanel onClose={() => setIsOpen(false)} initialSession={activeSession} />
      )}
    </>
  );
}
