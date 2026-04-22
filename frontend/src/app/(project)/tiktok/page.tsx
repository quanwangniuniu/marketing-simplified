'use client';

import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { toast } from 'react-hot-toast';
import AdDraftActionBar, {
  type ActionSpec,
} from '@/components/ads-draft-v2/AdDraftActionBar';
import CampaignScopeBanner from '@/components/ads-draft-v2/CampaignScopeBanner';
import PlatformBadge from '@/components/ads-draft-v2/PlatformBadge';
import SharePreviewModal from '@/components/ads-draft-v2/SharePreviewModal';
import DraftEditor, {
  type CtaMode,
  type DraftEditorValue,
} from '@/components/ads-draft-v2/tiktok/DraftEditor';
import MediaLibraryDialog from '@/components/ads-draft-v2/tiktok/MediaLibraryDialog';
import WorkspaceSidebar from '@/components/ads-draft-v2/tiktok/WorkspaceSidebar';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import TiktokPreview from '@/components/tiktok/TiktokPreview';
import BrandDialog from '@/components/tasks-v2/detail/BrandDialog';
import {
  deleteAdDraft,
  deleteAdGroup,
  getBriefInfoList,
  getCreationDetail,
  saveAdDraft,
  saveAdGroup,
  shareAdDraft,
  type AdGroupBriefInfo,
  type TiktokMaterialItem,
} from '@/lib/api/tiktokApi';
import { Share2, Save, Trash2 } from 'lucide-react';

const SECTION_CLS = 'rounded-xl bg-white shadow-sm ring-1 ring-gray-100';
const H2_CLS = 'text-[13px] font-semibold uppercase tracking-wide text-gray-900';
const EYEBROW_CLS = 'text-[11px] font-medium uppercase tracking-wide text-gray-500';
const STORAGE_KEY = 'tiktok-v2-selection';

type Placement = 'In feed' | 'Search feed';

interface EditorState extends DraftEditorValue {}

const defaultEditorState: EditorState = {
  name: '',
  adText: '',
  ctaEnabled: true,
  ctaMode: 'standard',
  ctaLabel: 'Sign up',
  primary: null,
  images: [],
};

function loadInitialSelection(): { adDraftId: string | null; groupId: string | null } {
  if (typeof window === 'undefined') return { adDraftId: null, groupId: null };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { adDraftId: null, groupId: null };
    const parsed = JSON.parse(raw);
    const adDraftId = typeof parsed?.adDraftId === 'string' ? parsed.adDraftId : null;
    const groupId = typeof parsed?.groupId === 'string' ? parsed.groupId : null;
    return { adDraftId, groupId };
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return { adDraftId: null, groupId: null };
  }
}

function persistSelection(adDraftId: string | null, groupId: string | null) {
  if (typeof window === 'undefined') return;
  if (adDraftId && groupId) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ adDraftId, groupId }));
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

function normalizeMaterial(item: any): TiktokMaterialItem | null {
  if (!item) return null;
  const typeStr = String(item.type || '').toLowerCase();
  const type: 'video' | 'image' | null = typeStr.includes('video')
    ? 'video'
    : typeStr.includes('image')
      ? 'image'
      : null;
  if (!type) return null;
  const idNum = typeof item.id === 'number' ? item.id : Number(item.id);
  return {
    id: Number.isNaN(idNum) ? Date.now() : idNum,
    type,
    url: item.url || item.previewUrl || item.preview_url || item.file_url || '',
    previewUrl: item.previewUrl || item.preview_url || item.thumbnail_url,
    fileUrl: item.fileUrl || item.file_url || item.url,
    title: item.name || item.title,
    created_at: item.created_at,
    width: item.width,
    height: item.height,
  };
}

function hydrateFromAssets(rawAssets: any): { primary: TiktokMaterialItem | null; images: TiktokMaterialItem[] } {
  let assets: any = rawAssets;
  if (Array.isArray(assets) && assets.length === 1 && typeof assets[0] === 'object') {
    if (assets[0].primaryCreative || assets[0].images) assets = assets[0];
  }
  if (assets && typeof assets === 'object' && !Array.isArray(assets)) {
    const primary = assets.primaryCreative ? normalizeMaterial(assets.primaryCreative) : null;
    const images = Array.isArray(assets.images)
      ? (assets.images.map(normalizeMaterial).filter(Boolean) as TiktokMaterialItem[])
      : [];
    if (primary?.type === 'video') return { primary, images: [] };
    return { primary: primary ?? images[0] ?? null, images };
  }
  const items = (Array.isArray(assets) ? assets : [])
    .map(normalizeMaterial)
    .filter(Boolean) as TiktokMaterialItem[];
  const video = items.find((item) => item.type === 'video');
  if (video) return { primary: video, images: [] };
  const imgs = items.filter((item) => item.type === 'image');
  return { primary: imgs[0] ?? null, images: imgs };
}

function TiktokV2Content() {
  const router = useRouter();

  const [groups, setGroups] = useState<AdGroupBriefInfo[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const initialSelection = useMemo(() => loadInitialSelection(), []);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(initialSelection.adDraftId);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(initialSelection.groupId);

  const [editor, setEditor] = useState<EditorState>(defaultEditorState);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const suspendAutoSaveRef = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [placement, setPlacement] = useState<Placement>('In feed');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryForceType, setLibraryForceType] = useState<'video' | 'image' | undefined>(undefined);

  const [shareOpen, setShareOpen] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);

  const [pendingDeleteGroup, setPendingDeleteGroup] = useState<string | null>(null);
  const [pendingDeleteDraft, setPendingDeleteDraft] = useState<{ draftId: string; groupId: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refreshGroups = useCallback(async () => {
    try {
      setLoadingGroups(true);
      const response = await getBriefInfoList({ limit_groups: 200, limit_items_per_group: 100 });
      const list = response?.data?.ad_group_brief_info_list ?? [];
      setGroups(list);
      return list;
    } catch {
      toast.error('Failed to load ad groups');
      return [];
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  useEffect(() => {
    refreshGroups();
  }, [refreshGroups]);

  const loadDraft = useCallback(async (draftId: string) => {
    try {
      setLoadingDraft(true);
      suspendAutoSaveRef.current = true;
      const response = await getCreationDetail({ ad_draft_ids: [draftId] });
      const draft = response?.ad_drafts?.[0];
      if (!draft) {
        setEditor(defaultEditorState);
        return;
      }
      const { primary, images } = hydrateFromAssets(draft.assets);
      const cta = (draft as any).call_to_action as string | null | undefined;
      let ctaEnabled = true;
      let ctaMode: CtaMode = 'standard';
      let ctaLabel = 'Sign up';
      if (cta === null || typeof cta === 'undefined') {
        ctaEnabled = false;
      } else if (cta === '') {
        ctaMode = 'dynamic';
      } else {
        ctaLabel = cta;
      }
      setEditor({
        name: draft.name ?? '',
        adText: draft.ad_text ?? '',
        ctaEnabled,
        ctaMode,
        ctaLabel,
        primary,
        images,
      });
      setCurrentImageIndex(0);
      if (draft.updated_at) {
        setLastSavedAt(new Date(draft.updated_at));
      } else {
        setLastSavedAt(null);
      }
    } catch {
      toast.error('Failed to load draft');
    } finally {
      setLoadingDraft(false);
      setTimeout(() => {
        suspendAutoSaveRef.current = false;
      }, 100);
    }
  }, []);

  useEffect(() => {
    if (selectedDraftId) {
      loadDraft(selectedDraftId);
    } else {
      setEditor(defaultEditorState);
      setLastSavedAt(null);
    }
  }, [selectedDraftId, loadDraft]);

  const buildPayloadCta = useCallback(() => {
    if (!editor.ctaEnabled) return undefined;
    if (editor.ctaMode === 'dynamic') return '';
    return editor.ctaLabel || '';
  }, [editor]);

  const buildAssetsPayload = useCallback(() => {
    const assets: any = {};
    if (editor.primary?.type === 'video') {
      assets.primaryCreative = { ...editor.primary };
    }
    if (editor.images.length > 0) {
      assets.images = editor.images.map((item) => ({ ...item }));
      if (editor.primary?.type === 'image') {
        assets.primaryCreative = { ...editor.primary };
      } else if (!assets.primaryCreative) {
        assets.primaryCreative = { ...editor.images[0] };
      }
    }
    return Object.keys(assets).length > 0 ? assets : undefined;
  }, [editor]);

  const saveCurrent = useCallback(async () => {
    if (!selectedDraftId || !selectedGroupId) return;
    try {
      setIsSaving(true);
      const ctaValue = buildPayloadCta();
      const payload: any = {
        id: selectedDraftId,
        name: editor.name,
        ad_text: editor.adText,
        assets: buildAssetsPayload(),
      };
      if (typeof ctaValue !== 'undefined') {
        payload.call_to_action = ctaValue;
      } else {
        payload.call_to_action = null;
      }
      await saveAdDraft({ adgroup_id: selectedGroupId, form_data_list: [payload] });
      setLastSavedAt(new Date());
      await refreshGroups();
    } catch {
      toast.error('Auto-save failed');
    } finally {
      setIsSaving(false);
    }
  }, [selectedDraftId, selectedGroupId, editor, buildPayloadCta, buildAssetsPayload, refreshGroups]);

  useEffect(() => {
    if (!selectedDraftId || suspendAutoSaveRef.current || loadingDraft) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveCurrent();
    }, 2000);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [editor, selectedDraftId, loadingDraft, saveCurrent]);

  const handleSelect = useCallback(
    (draftId: string, groupId: string) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      suspendAutoSaveRef.current = true;
      setSelectedDraftId(draftId);
      setSelectedGroupId(groupId);
      persistSelection(draftId, groupId);
    },
    []
  );

  const openCreateGroup = () => {
    setNewGroupName('');
    setCreateGroupOpen(true);
  };

  const handleCreateGroup = async () => {
    const name = newGroupName.trim();
    if (!name) return;
    try {
      setCreatingGroup(true);
      const response = await saveAdGroup({ name });
      const newId = response?.data?.['ad-group-id'];
      toast.success('Group created');
      setCreateGroupOpen(false);
      const list = await refreshGroups();
      if (newId) {
        setSelectedGroupId(newId);
        setSelectedDraftId(null);
        persistSelection(null, null);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to create group');
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleCreateDraft = useCallback(
    async (groupId: string) => {
      try {
        const response = await saveAdDraft({
          adgroup_id: groupId,
          form_data_list: [{ name: 'New draft', ad_text: '', call_to_action: 'Sign up' } as any],
        });
        const newDraftId = response?.data?.['ad-draft-id']?.[0];
        toast.success('Draft created');
        await refreshGroups();
        if (newDraftId) {
          setSelectedDraftId(newDraftId);
          setSelectedGroupId(groupId);
          persistSelection(newDraftId, groupId);
        }
      } catch (err: any) {
        toast.error(err?.response?.data?.error ?? 'Failed to create draft');
      }
    },
    [refreshGroups]
  );

  const handleDeleteGroup = async () => {
    if (!pendingDeleteGroup) return;
    try {
      setDeleting(true);
      await deleteAdGroup([pendingDeleteGroup]);
      toast.success('Group deleted');
      if (selectedGroupId === pendingDeleteGroup) {
        setSelectedDraftId(null);
        setSelectedGroupId(null);
        persistSelection(null, null);
      }
      setPendingDeleteGroup(null);
      await refreshGroups();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to delete group');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteDraft = async () => {
    if (!pendingDeleteDraft) return;
    try {
      setDeleting(true);
      await deleteAdDraft([pendingDeleteDraft.draftId]);
      toast.success('Draft deleted');
      if (selectedDraftId === pendingDeleteDraft.draftId) {
        setSelectedDraftId(null);
        setSelectedGroupId(pendingDeleteDraft.groupId);
        persistSelection(null, null);
      }
      setPendingDeleteDraft(null);
      await refreshGroups();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to delete draft');
    } finally {
      setDeleting(false);
    }
  };

  const handleShare = async () => {
    if (!selectedDraftId) throw new Error('No draft selected');
    const result = await shareAdDraft(selectedDraftId);
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/tiktok/preview/${result.slug}`;
  };

  const handleLibraryConfirm = ({ primary, images }: { primary: TiktokMaterialItem | null; images: TiktokMaterialItem[] }) => {
    setEditor((prev) => ({ ...prev, primary, images }));
    setCurrentImageIndex(0);
  };

  const handleEditorChange = (patch: Partial<EditorState>) => {
    setEditor((prev) => ({ ...prev, ...patch }));
  };

  const previewCreative = editor.primary ?? editor.images[0] ?? null;
  const hasDraft = !!selectedDraftId;

  const actions: ActionSpec[] = [
    {
      label: isSaving ? 'Saving…' : 'Save now',
      variant: 'ghost',
      icon: Save,
      onClick: saveCurrent,
      disabled: !hasDraft || isSaving,
      loading: isSaving,
    },
    {
      label: 'Share preview',
      variant: 'primary',
      icon: Share2,
      onClick: () => setShareOpen(true),
      disabled: !hasDraft,
    },
    {
      label: 'Delete draft',
      variant: 'danger',
      icon: Trash2,
      onClick: () => {
        if (selectedDraftId && selectedGroupId) {
          setPendingDeleteDraft({ draftId: selectedDraftId, groupId: selectedGroupId });
        }
      },
      disabled: !hasDraft,
    },
  ];

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-4">
        <CampaignScopeBanner />

        <header className={`${SECTION_CLS} space-y-3 px-5 py-4`}>
          <div className="flex items-center gap-3">
            <PlatformBadge platform="tiktok" />
            <span className="text-[11px] text-gray-400">
              {hasDraft ? `Draft selected · ${selectedDraftId}` : 'No draft selected'}
            </span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-[22px] font-semibold tracking-tight text-gray-900">
                TikTok ad drafts
              </h1>
              <p className="text-xs text-gray-500">
                Organize groups, craft drafts with auto-save, and share preview links.
              </p>
            </div>
            <AdDraftActionBar actions={actions} />
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="min-h-[520px]">
            <WorkspaceSidebar
              groups={groups}
              selectedDraftId={selectedDraftId}
              selectedGroupId={selectedGroupId}
              onSelect={handleSelect}
              onCreateGroup={openCreateGroup}
              onCreateDraft={handleCreateDraft}
              onDeleteGroup={(groupId) => setPendingDeleteGroup(groupId)}
              onDeleteDraft={(draftId, groupId) => setPendingDeleteDraft({ draftId, groupId })}
              loading={loadingGroups}
            />
          </div>

          <div className="flex flex-col gap-4 lg:flex-row">
            <div className="flex-1 space-y-4">
              {hasDraft ? (
                <DraftEditor
                  {...editor}
                  disabled={loadingDraft}
                  saving={isSaving}
                  lastSavedAt={lastSavedAt}
                  onChange={handleEditorChange}
                  onOpenLibrary={(forceType) => {
                    setLibraryForceType(forceType);
                    setLibraryOpen(true);
                  }}
                />
              ) : (
                <section className={`${SECTION_CLS} p-8 text-center`}>
                  <h2 className={H2_CLS}>Select or create a draft</h2>
                  <p className="mt-2 text-xs text-gray-500">
                    Pick a draft from the left, or create a new group and draft to get started.
                  </p>
                  <button
                    type="button"
                    onClick={openCreateGroup}
                    className="mt-4 inline-flex rounded-md bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:opacity-95"
                  >
                    New ad group
                  </button>
                </section>
              )}
            </div>

            <div className="w-full shrink-0 lg:w-[380px]">
              <section className={`${SECTION_CLS} p-4`}>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className={H2_CLS}>Preview</h2>
                  <span className={EYEBROW_CLS}>{placement}</span>
                </div>
                <div className="flex flex-col items-center gap-3 [&_>div]:mx-auto [&_aside]:mx-auto">
                <TiktokPreview
                  creative={previewCreative}
                  placement={placement}
                  onPlacementChange={(value) => setPlacement(value)}
                  enablePlacementSwitch
                  text={editor.adText}
                  cta={
                    editor.ctaEnabled
                      ? { mode: editor.ctaMode, label: editor.ctaLabel }
                      : { mode: 'hidden' }
                  }
                  images={editor.images}
                  currentImageIndex={
                    editor.primary?.type === 'image'
                      ? editor.images.findIndex((item) => item.id === editor.primary?.id)
                      : currentImageIndex
                  }
                  onImageIndexChange={(nextIndex) => {
                    if (editor.images.length === 0) return;
                    const clamped = Math.max(0, Math.min(editor.images.length - 1, nextIndex));
                    setCurrentImageIndex(clamped);
                    const next = editor.images[clamped];
                    if (next) setEditor((prev) => ({ ...prev, primary: next }));
                  }}
                />
                </div>
              </section>
            </div>
          </div>
        </div>

        <MediaLibraryDialog
          open={libraryOpen}
          onOpenChange={(open) => {
            setLibraryOpen(open);
            if (!open) setLibraryForceType(undefined);
          }}
          forceType={libraryForceType}
          initialPrimary={editor.primary}
          initialImages={editor.images}
          onConfirm={handleLibraryConfirm}
        />

        <SharePreviewModal
          open={shareOpen}
          onOpenChange={setShareOpen}
          platform="tiktok"
          onShare={handleShare}
          title="Share TikTok draft"
          subtitle="Create a public link that expires in 7 days"
        />

        <BrandDialog
          open={createGroupOpen}
          onOpenChange={(open) => {
            if (!creatingGroup) setCreateGroupOpen(open);
          }}
          title="New ad group"
          subtitle="Group drafts by campaign or audience."
          width="max-w-sm"
        >
          <div>
            <label className={EYEBROW_CLS} htmlFor="tt-new-group">Group name</label>
            <input
              id="tt-new-group"
              type="text"
              value={newGroupName}
              onChange={(event) => setNewGroupName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleCreateGroup();
                }
              }}
              autoFocus
              disabled={creatingGroup}
              placeholder="e.g. Spring campaign"
              className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30"
            />
          </div>
          <div className="-mx-5 -mb-5 mt-5 flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
            <button
              type="button"
              onClick={() => setCreateGroupOpen(false)}
              disabled={creatingGroup}
              className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-gray-700 ring-1 ring-gray-200 transition hover:ring-gray-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateGroup}
              disabled={creatingGroup || !newGroupName.trim()}
              className="rounded-md bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Create group
            </button>
          </div>
        </BrandDialog>

        <BrandDialog
          open={!!pendingDeleteGroup}
          onOpenChange={(open) => {
            if (!deleting && !open) setPendingDeleteGroup(null);
          }}
          title="Delete this group?"
          subtitle="All drafts in the group will be removed."
          width="max-w-sm"
        >
          <p className="text-sm text-gray-700">Linked drafts and their share previews will be deleted.</p>
          <div className="-mx-5 -mb-5 mt-5 flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
            <button
              type="button"
              onClick={() => setPendingDeleteGroup(null)}
              disabled={deleting}
              className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-gray-700 ring-1 ring-gray-200 transition hover:ring-gray-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteGroup}
              disabled={deleting}
              className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Delete group
            </button>
          </div>
        </BrandDialog>

        <BrandDialog
          open={!!pendingDeleteDraft}
          onOpenChange={(open) => {
            if (!deleting && !open) setPendingDeleteDraft(null);
          }}
          title="Delete this draft?"
          subtitle="The draft and its share preview will be removed."
          width="max-w-sm"
        >
          <p className="text-sm text-gray-700">This action cannot be undone.</p>
          <div className="-mx-5 -mb-5 mt-5 flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
            <button
              type="button"
              onClick={() => setPendingDeleteDraft(null)}
              disabled={deleting}
              className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-gray-700 ring-1 ring-gray-200 transition hover:ring-gray-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteDraft}
              disabled={deleting}
              className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Delete draft
            </button>
          </div>
        </BrandDialog>
      </div>
    </DashboardLayout>
  );
}

export default function TiktokV2Page() {
  return (
    <ProtectedRoute>
      <TiktokV2Content />
    </ProtectedRoute>
  );
}
