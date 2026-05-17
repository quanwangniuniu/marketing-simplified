import { Sparkles } from 'lucide-react';
import type { AgendaItem } from '@/types/meeting';
import { Button } from '@/components/ui/button';

interface AgendaSectionProps {
  orderedAgenda: AgendaItem[];
  addingAgenda: boolean;
  newAgendaText: string;
  newAgendaPriority: boolean;
  onNewAgendaTextChange: (value: string) => void;
  onNewAgendaPriorityChange: (value: boolean) => void;
  onAddAgendaItem: () => void;
  onUseTemplate: () => void;
  isDragging: boolean;
  children: React.ReactNode;
}

export function AgendaSection({
  orderedAgenda,
  addingAgenda,
  newAgendaText,
  newAgendaPriority,
  onNewAgendaTextChange,
  onNewAgendaPriorityChange,
  onAddAgendaItem,
  onUseTemplate,
  isDragging,
  children,
}: AgendaSectionProps) {
  void addingAgenda;
  void newAgendaText;
  void newAgendaPriority;
  void onNewAgendaTextChange;
  void onNewAgendaPriorityChange;
  void onAddAgendaItem;
  void isDragging;
  return (
    <section className="overflow-visible py-1">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xl font-bold text-slate-900">Agenda</h3>
        <Button type="button" size="sm" variant="ghost" onClick={onUseTemplate} className="text-slate-700">
          <Sparkles className="h-3.5 w-3.5" />
          Use Template
        </Button>
      </div>
      <div className="mt-2 grid gap-2">
        {orderedAgenda.length === 0 ? (
          <div className="p-2 text-sm text-slate-500">
            No agenda items yet.
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
