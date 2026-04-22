"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, ArrowLeft, Trash2 } from 'lucide-react';

type WorkspaceBlockType = 'header' | 'agenda' | 'participants' | 'artifacts' | 'custom_block';
type WorkspaceBlock = {
  id: string;
  type: WorkspaceBlockType;
  title?: string;
  content?: string;
};

export type SidebarTemplate = {
  id: string;
  name: string;
  meta?: string;
  meetingType?: string;
  layout_config?: unknown;
  /** Optional sidebar icon (system templates). */
  icon?: React.ReactNode;
  /** Tailwind classes for icon wrapper, e.g. bg-* text-* */
  tint?: string;
};

export type TemplateSidebarViewMode = 'list' | 'create';

type TemplateSidebarProps = {
  isOpen: boolean;
  blocks: WorkspaceBlock[];

  templateList: SidebarTemplate[];
  onApplyTemplate: (tpl: SidebarTemplate) => void;

  onEnterCreateMode: () => void;
  onAddDefaultBlock: (type: WorkspaceBlockType) => void;
  onCreateTemplate: (payload: { name: string; layout_config: unknown }) => Promise<SidebarTemplate>;

  onDeleteTemplate?: (id: string) => Promise<void>;

  templateDirty?: boolean;
  activeTemplateId?: string | null;
  onSaveTemplateAgendaChanges?: () => Promise<void>;

  onAfterSave?: () => void;
  /** Called when user leaves Configure Template via Back (restore parent canvas if needed). */
  onLeaveConfigureMode?: () => void;
};

export function TemplateSidebar({
  isOpen,
  blocks,
  templateList,
  onApplyTemplate,
  onEnterCreateMode,
  onAddDefaultBlock,
  onCreateTemplate,
  onDeleteTemplate,
  templateDirty,
  activeTemplateId,
  onSaveTemplateAgendaChanges,
  onAfterSave,
  onLeaveConfigureMode,
}: TemplateSidebarProps) {
  const [viewMode, setViewMode] = useState<TemplateSidebarViewMode>('list');
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setViewMode('list');
      setIsSaveDialogOpen(false);
      setTemplateName('');
      setSaving(false);
    }
  }, [isOpen]);

  const moduleCards = useMemo(
    () => [
      { type: 'header' as const, label: 'Header' },
      { type: 'agenda' as const, label: 'Agenda' },
      { type: 'participants' as const, label: 'Participants' },
      { type: 'artifacts' as const, label: 'Artifacts' },
      { type: 'custom_block' as const, label: 'Custom Block' },
    ],
    [],
  );

  const handleCreateCustomTemplateClick = () => {
    onEnterCreateMode();
    setViewMode('create');
  };

  const handleBackToList = () => {
    setViewMode('list');
    onLeaveConfigureMode?.();
  };

  const handleSaveTemplate = async () => {
    const name = templateName.trim();
    if (!name) {
      toast.error('Template name is required');
      return;
    }

    setSaving(true);
    try {
      await onCreateTemplate({
        name,
        layout_config: blocks,
      });
      setIsSaveDialogOpen(false);
      setTemplateName('');
      setViewMode('list');
      toast.success('Template saved');
      onAfterSave?.();
    } catch (err: unknown) {
      console.error('Failed to save template:', err);
      // Parent component should show a detailed toast with the backend error.
    } finally {
      setSaving(false);
    }
  };

  const systemTemplates = templateList.filter((tpl) => tpl.meetingType);
  const customTemplates = templateList.filter((tpl) => !tpl.meetingType);

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.aside
          className="fixed top-0 right-0 z-40 h-screen w-[350px] border-l border-slate-200 bg-white p-4 shadow-[0_0_30px_rgba(15,23,42,0.08)]"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        >
          <div className="flex items-center justify-between">
            {viewMode === 'create' ? (
              <button
                type="button"
                className="inline-flex items-center gap-2 text-sm text-slate-700 hover:text-slate-900"
                onClick={handleBackToList}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
            ) : (
              <p className="text-xs font-semibold tracking-wider text-gray-400 uppercase">Templates</p>
            )}
          </div>

          {viewMode === 'create' ? (
            <div className="mt-3 flex h-full flex-col">
              <h2 className="text-lg font-semibold text-slate-900">Configure Template</h2>

              <div className="mt-4 space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Add blocks
                </p>
                <div className="grid gap-2">
                  {moduleCards.map((m) => (
                    <button
                      key={m.type}
                      type="button"
                      className="flex w-full items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 text-left shadow-sm transition hover:border-slate-200 hover:bg-slate-50 hover:shadow-md"
                      onClick={() => onAddDefaultBlock(m.type)}
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                        <Plus className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1 text-center text-xs font-semibold uppercase tracking-wide text-slate-800">
                        {m.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-auto">
                <Button
                  type="button"
                  onClick={() => setIsSaveDialogOpen(true)}
                  className="w-full"
                  variant="default"
                >
                  Save Template
                </Button>
              </div>

              {/* Safety: if something else closes the sidebar, we want the canvas to stay cleared */}
              {blocks.length > 0 ? null : (
                <p className="mt-4 text-xs text-slate-500">
                  Canvas is empty. Click module cards to build.
                </p>
              )}

              <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Save Template</DialogTitle>
                    <DialogDescription>Give your template a name.</DialogDescription>
                  </DialogHeader>

                  <div className="space-y-2">
                    <label className="text-sm text-slate-700">Template Name</label>
                    <Input
                      value={templateName}
                      onChange={(e) => setTemplateName(e.currentTarget.value)}
                      placeholder="e.g. Weekly Planning"
                    />
                  </div>

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setIsSaveDialogOpen(false);
                      }}
                      disabled={saving}
                    >
                      Cancel
                    </Button>
                    <Button type="button" onClick={() => void handleSaveTemplate()} disabled={saving}>
                      {saving ? 'Saving…' : 'Save'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <button
                type="button"
                onClick={() => handleCreateCustomTemplateClick()}
                className="flex w-full items-center gap-3 rounded-xl border border-dashed border-[#3CCED7]/30 bg-[#3CCED7]/10/40 p-3 text-left transition hover:bg-[#3CCED7]/10"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#3CCED7]/15 text-[#3CCED7]">
                  <Plus className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-gray-800">Create Custom Template</span>
                  <span className="block text-xs text-gray-500">Save current layout</span>
                </span>
              </button>

              {/* System templates (read-only) */}
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">System templates</p>
                {systemTemplates.length === 0 ? (
                  <p className="text-sm text-slate-500">No system templates.</p>
                ) : (
                  systemTemplates.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onApplyTemplate(item)}
                      className="flex w-full items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 text-left shadow-sm transition hover:bg-gray-50"
                    >
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                          item.tint ?? 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {item.icon ?? <Plus className="h-4 w-4 opacity-70" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-gray-800">{item.name}</span>
                        {item.meta ? <span className="block truncate text-xs text-gray-500">{item.meta}</span> : null}
                      </span>
                    </button>
                  ))
                )}
              </div>

              {/* Custom templates with hover-delete */}
              <div className="mt-4 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Your templates</p>
                {customTemplates.length === 0 ? (
                  <p className="text-sm text-slate-500">No custom templates yet.</p>
                ) : (
                  customTemplates.map((item) => (
                    <div
                      key={item.id}
                      className="group flex w-full items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 text-left shadow-sm transition hover:bg-gray-50"
                    >
                      <button
                        type="button"
                        onClick={() => onApplyTemplate(item)}
                        className="flex flex-1 items-center gap-3 text-left"
                      >
                        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                          <Plus className="h-4 w-4 opacity-70" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-gray-800">{item.name}</span>
                          {item.meta ? (
                            <span className="block truncate text-xs text-gray-500">{item.meta}</span>
                          ) : null}
                        </span>
                      </button>
                      {onDeleteTemplate ? (
                        <button
                          type="button"
                          onClick={() => void onDeleteTemplate(item.id)}
                          className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-500 opacity-0 transition group-hover:opacity-100 hover:bg-red-100 hover:text-red-600"
                          aria-label="Delete template"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  ))
                )}
              </div>

              {templateDirty && activeTemplateId ? (
                <button
                  type="button"
                  onClick={() => (onSaveTemplateAgendaChanges ? void onSaveTemplateAgendaChanges() : null)}
                  className="mt-4 w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Save Changes
                </button>
              ) : null}
            </div>
          )}
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}

