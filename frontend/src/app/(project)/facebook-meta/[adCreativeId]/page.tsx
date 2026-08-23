'use client';

import {
  Check,
  ExternalLink,
  Pencil,
  Plus,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import { toast } from 'react-hot-toast';
import AdDraftActionBar, {
  type ActionSpec,
} from '@/components/ads-draft/AdDraftActionBar';
import CampaignScopeBanner from '@/components/ads-draft/CampaignScopeBanner';
import PlatformBadge from '@/components/ads-draft/PlatformBadge';
import SharePreviewModal, {
  type ShareDays,
} from '@/components/ads-draft/SharePreviewModal';
import AdDraftStatusPill from '@/components/ads-draft/pills/AdDraftStatusPill';
import type { FacebookStatus } from '@/components/ads-draft/types';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import FacebookAdPreviews from '@/components/facebook_meta/FacebookAdPreviews';
import BrandDialog from '@/components/tasks/detail/BrandDialog';
import InlineSelect from '@/components/tasks/detail/InlineSelect';
import { FacebookMetaAPI, type AdCreative } from '@/lib/api/facebookMetaApi';
import { getPhotos, uploadPhoto, deletePhoto, type PhotoData } from '@/lib/api/facebookMetaPhotoApi';
import { getVideos, uploadVideo, deleteVideo, type VideoData } from '@/lib/api/facebookMetaVideoApi';
import {
  createSharePreview,
  deleteSharePreview,
  getSharePreview,
  type SharePreviewData,
} from '@/lib/api/sharePreviewApi';
import { useBuildUrl } from '@/lib/buildUrl';

const SECTION_CLS = 'rounded-xl bg-white shadow-sm ring-1 ring-gray-100';
const EYEBROW_CLS = 'text-[11px] font-medium uppercase tracking-wide text-gray-500';
const H2_CLS = 'text-[13px] font-semibold uppercase tracking-wide text-gray-900';
const ROW_CLS = 'grid grid-cols-[96px_1fr] items-start gap-3 py-2';

const STATUS_OPTIONS: Array<{ value: FacebookStatus; label: string }> = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'IN_PROCESS', label: 'In process' },
  { value: 'WITH_ISSUES', label: 'With issues' },
  { value: 'DELETED', label: 'Deleted' },
];

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Active',
  IN_PROCESS: 'In process',
  WITH_ISSUES: 'With issues',
  DELETED: 'Deleted',
};

interface MediaFile {
  id: number;
  mediaId?: number;
  type: 'photo' | 'video';
  url?: string;
  thumbnail?: string;
  caption?: string;
}

function getBackendMediaId(value: unknown): number | undefined {
  const id = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

function extractMediaFromCreative(creative: AdCreative | null): MediaFile[] {
  if (!creative?.object_story_spec) return [];
  const media: MediaFile[] = [];
  // Dedup keys: prefer the content hash (image_hash / video_id) so multiple
  // associated rows pointing at the same file collapse into one tile, and
  // fall back to id / url for entries missing a hash.
  const seen = new Set<string>();
  const pushUnique = (key: string, item: MediaFile) => {
    if (seen.has(key)) return;
    seen.add(key);
    media.push(item);
  };

  const photoData = creative.object_story_spec.photo_data;
  if (photoData) {
    const photos = Array.isArray(photoData) ? photoData : [photoData];
    photos.forEach((photo: any, index: number) => {
      if (photo?.url) {
        const mediaId = getBackendMediaId(photo.id);
        const key = `photo:${photo.image_hash || photo.url || mediaId || index}`;
        pushUnique(key, {
          id: mediaId ?? index + 1,
          mediaId,
          type: 'photo',
          url: photo.url,
          caption: photo.caption,
        });
      }
    });
  }
  const videoData = creative.object_story_spec.video_data;
  if (videoData) {
    const videos = Array.isArray(videoData) ? videoData : [videoData];
    videos.forEach((video: any, index: number) => {
      if (video?.image_url || video?.video_id) {
        const mediaId = getBackendMediaId(video.id);
        const key = `video:${video.video_id || video.image_url || mediaId || index}`;
        pushUnique(key, {
          id: mediaId ?? 1000 + index,
          mediaId,
          type: 'video',
          url: video.image_url,
          caption: video.message || video.title,
        });
      }
    });
  }
  return media;
}

function getPrimaryText(creative: AdCreative | null): string {
  if (!creative) return '';
  return (
    creative.body ||
    creative.object_story_spec?.link_data?.message ||
    creative.object_story_spec?.text_data?.message ||
    ''
  );
}

function FacebookMetaDetailContent() {
  const router = useRouter();
  const buildUrl = useBuildUrl();
  const params = useParams<{ adCreativeId: string }>();
  const adCreativeId = params?.adCreativeId;

  const [creative, setCreative] = useState<AdCreative | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [savingName, setSavingName] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingLabels, setSavingLabels] = useState(false);

  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [labelInput, setLabelInput] = useState('');

  const [shareOpen, setShareOpen] = useState(false);
  const [sharePreview, setSharePreview] = useState<SharePreviewData | null>(null);
  const [loadingShare, setLoadingShare] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<number[]>([]);
  const [selectedVideoIds, setSelectedVideoIds] = useState<number[]>([]);
  const [savingMedia, setSavingMedia] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const loadCreative = useCallback(async () => {
    if (!adCreativeId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await FacebookMetaAPI.getAdCreative(adCreativeId);
      setCreative(data);
      setDraftName(data.name ?? '');
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to load creative');
    } finally {
      setLoading(false);
    }
  }, [adCreativeId]);

  useEffect(() => {
    loadCreative();
  }, [loadCreative]);

  const refreshMediaLibrary = useCallback(async () => {
    try {
      const [photoRes, videoRes] = await Promise.all([getPhotos(1, 48), getVideos(1, 48)]);
      setPhotos(photoRes.results ?? []);
      setVideos(videoRes.results ?? []);
    } catch (err: any) {
      toast.error('Failed to load media library');
    }
  }, []);

  useEffect(() => {
    if (mediaOpen) {
      refreshMediaLibrary();
    }
  }, [mediaOpen, refreshMediaLibrary]);

  const loadSharePreview = useCallback(async () => {
    if (!adCreativeId) return;
    try {
      setLoadingShare(true);
      const result = await getSharePreview(adCreativeId);
      if (result?.link) {
        setSharePreview(result);
      } else {
        setSharePreview(null);
      }
    } catch {
      setSharePreview(null);
    } finally {
      setLoadingShare(false);
    }
  }, [adCreativeId]);

  useEffect(() => {
    loadSharePreview();
  }, [loadSharePreview]);

  const adLabels = useMemo<string[]>(() => {
    const raw = (creative as any)?.adlabels;
    if (!Array.isArray(raw)) return [];
    return raw.map((entry: any) => (typeof entry === 'string' ? entry : entry?.name ?? '')).filter(Boolean);
  }, [creative]);

  const rawMedia = useMemo(() => extractMediaFromCreative(creative), [creative]);

  // Frontend safety net: orphan AdCreativePhotoData / AdCreativeVideoData rows
  // (DB record exists, file deleted from disk) can be returned by the detail
  // endpoint until the backend container is restarted (daphne does not
  // hot-reload). Probe each URL once and prune unreachable entries so the
  // Preview and Media sections stay consistent with the (already-filtered)
  // media library.
  const [unreachableMediaKeys, setUnreachableMediaKeys] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (rawMedia.length === 0) {
      setUnreachableMediaKeys((prev) => (prev.size === 0 ? prev : new Set()));
      return;
    }
    let cancelled = false;
    (async () => {
      const failures = await Promise.all(
        rawMedia.map(async (item) => {
          const key = `${item.type}-${item.id}`;
          if (!item.url) return key;
          try {
            const res = await fetch(item.url, { method: 'HEAD' });
            return res.ok ? null : key;
          } catch {
            // CORS / network error — assume reachable rather than prune blindly.
            return null;
          }
        })
      );
      if (cancelled) return;
      const next = new Set(failures.filter((k): k is string => Boolean(k)));
      setUnreachableMediaKeys(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [rawMedia]);

  const media = useMemo(
    () => rawMedia.filter((item) => !unreachableMediaKeys.has(`${item.type}-${item.id}`)),
    [rawMedia, unreachableMediaKeys]
  );

  // Frontend dedup safety net for the modal media library: collapse photos /
  // videos that share the same content hash so the user only ever sees one
  // tile per unique file even if the API still returns duplicates from
  // before the upload-side dedup change shipped.
  const dedupedLibraryPhotos = useMemo(() => {
    const seen = new Set<string>();
    const out: PhotoData[] = [];
    for (const photo of photos) {
      const key = photo.image_hash ? `h:${photo.image_hash}` : `i:${photo.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(photo);
    }
    return out;
  }, [photos]);

  const dedupedLibraryVideos = useMemo(() => {
    const seen = new Set<string>();
    const out: VideoData[] = [];
    for (const video of videos) {
      const key = video.video_id ? `h:${video.video_id}` : `i:${video.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(video);
    }
    return out;
  }, [videos]);

  const primaryText = useMemo(() => getPrimaryText(creative), [creative]);
  const statusValue = (creative?.status as FacebookStatus | undefined) ?? undefined;

  const handleSaveName = async () => {
    if (!adCreativeId || !creative) return;
    const trimmed = draftName.trim();
    if (!trimmed) {
      toast.error('Name cannot be empty');
      setDraftName(creative.name ?? '');
      setEditingName(false);
      return;
    }
    if (trimmed === creative.name) {
      setEditingName(false);
      return;
    }
    try {
      setSavingName(true);
      await FacebookMetaAPI.updateAdCreative(adCreativeId, { name: trimmed });
      setCreative((prev) => (prev ? { ...prev, name: trimmed } : prev));
      toast.success('Name updated');
      setEditingName(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to update name');
    } finally {
      setSavingName(false);
    }
  };

  const handleStatusChange = async (next: string) => {
    if (!adCreativeId || !creative || next === creative.status) return;
    try {
      setSavingStatus(true);
      await FacebookMetaAPI.updateAdCreative(adCreativeId, { status: next });
      setCreative((prev) => (prev ? { ...prev, status: next as any } : prev));
      toast.success(`Status set to ${STATUS_LABEL[next] ?? next}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to update status');
    } finally {
      setSavingStatus(false);
    }
  };

  const addLabel = async () => {
    if (!adCreativeId) return;
    const label = labelInput.trim();
    if (!label) return;
    if (adLabels.includes(label)) {
      setLabelInput('');
      return;
    }
    const nextLabels = [...adLabels, label];
    try {
      setSavingLabels(true);
      await FacebookMetaAPI.updateAdCreative(adCreativeId, { adlabels: nextLabels });
      setCreative((prev) => (prev ? ({ ...prev, adlabels: nextLabels } as any) : prev));
      setLabelInput('');
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to update labels');
    } finally {
      setSavingLabels(false);
    }
  };

  const removeLabel = async (label: string) => {
    if (!adCreativeId) return;
    const nextLabels = adLabels.filter((entry) => entry !== label);
    try {
      setSavingLabels(true);
      await FacebookMetaAPI.updateAdCreative(adCreativeId, { adlabels: nextLabels });
      setCreative((prev) => (prev ? ({ ...prev, adlabels: nextLabels } as any) : prev));
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to update labels');
    } finally {
      setSavingLabels(false);
    }
  };

  const handleShare = async (days?: ShareDays) => {
    if (!adCreativeId) throw new Error('Missing ad creative id');
    const result = await createSharePreview(adCreativeId, { days: days ?? 7 });
    setSharePreview(result);
    return result.link;
  };

  const revokeShare = async () => {
    if (!adCreativeId) return;
    try {
      await deleteSharePreview(adCreativeId);
      setSharePreview(null);
      toast.success('Preview link revoked');
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to revoke link');
    }
  };

  const handleDelete = async () => {
    if (!adCreativeId) return;
    try {
      setDeleting(true);
      await FacebookMetaAPI.deleteAdCreative(adCreativeId);
      toast.success('Ad creative deleted');
      router.push(buildUrl('/facebook-meta'));
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to delete');
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  const openMediaModal = () => {
    const existingPhotoIds = media
      .filter((m) => m.type === 'photo' && m.mediaId)
      .map((m) => m.mediaId as number);
    const existingVideoIds = media
      .filter((m) => m.type === 'video' && m.mediaId)
      .map((m) => m.mediaId as number);
    setSelectedPhotoIds(existingPhotoIds);
    setSelectedVideoIds(existingVideoIds);
    setMediaOpen(true);
  };

  const onPhotoFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setUploadingPhoto(true);
      const result = await uploadPhoto(file);
      toast.success('Photo uploaded');
      const uploadedPhoto = result.photo;
      if (uploadedPhoto) {
        setPhotos((prev) => [uploadedPhoto, ...prev.filter((photo) => photo.id !== uploadedPhoto.id)]);
        setSelectedPhotoIds((prev) => (
          prev.includes(uploadedPhoto.id) ? prev : [...prev, uploadedPhoto.id]
        ));
      }
      await refreshMediaLibrary();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Upload failed');
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const onVideoFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setUploadingVideo(true);
      const result = await uploadVideo(file, file.name);
      toast.success('Video uploaded');
      const uploadedVideo = result.video;
      if (uploadedVideo) {
        setVideos((prev) => [uploadedVideo, ...prev.filter((video) => video.id !== uploadedVideo.id)]);
        setSelectedVideoIds((prev) => (
          prev.includes(uploadedVideo.id) ? prev : [...prev, uploadedVideo.id]
        ));
      }
      await refreshMediaLibrary();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Upload failed');
    } finally {
      setUploadingVideo(false);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  const handleDeletePhoto = async (photoId: number) => {
    try {
      await deletePhoto(photoId);
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      setSelectedPhotoIds((prev) => prev.filter((id) => id !== photoId));
      toast.success('Photo deleted');
      await loadCreative();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to delete photo');
    }
  };

  const handleDeleteVideo = async (videoId: number) => {
    try {
      await deleteVideo(videoId);
      setVideos((prev) => prev.filter((v) => v.id !== videoId));
      setSelectedVideoIds((prev) => prev.filter((id) => id !== videoId));
      toast.success('Video deleted');
      await loadCreative();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to delete video');
    }
  };

  const saveMedia = async () => {
    if (!adCreativeId) return;
    try {
      setSavingMedia(true);
      await FacebookMetaAPI.associateMedia(adCreativeId, selectedPhotoIds, selectedVideoIds);
      toast.success('Media associated');
      setMediaOpen(false);
      await loadCreative();
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to associate media');
    } finally {
      setSavingMedia(false);
    }
  };

  const togglePhotoSelection = (id: number) => {
    setSelectedPhotoIds((prev) =>
      prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id]
    );
  };

  const toggleVideoSelection = (id: number) => {
    setSelectedVideoIds((prev) =>
      prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id]
    );
  };

  const actionBarActions: ActionSpec[] = [
    {
      label: sharePreview ? 'View share link' : 'Share preview',
      variant: 'primary',
      icon: Share2,
      onClick: () => setShareOpen(true),
    },
    {
      label: 'Delete',
      variant: 'danger',
      icon: Trash2,
      onClick: () => setDeleteOpen(true),
    },
  ];

  if (loading) {
    return (
      <DashboardLayout>
        <div className={`${SECTION_CLS} p-10 text-center text-xs text-gray-400`}>
          Loading ad creative…
        </div>
      </DashboardLayout>
    );
  }

  if (error || !creative) {
    return (
      <DashboardLayout>
        <div className={`${SECTION_CLS} space-y-3 p-10 text-center`}>
          <h2 className="text-sm font-medium text-gray-900">Unable to load ad creative</h2>
          <p className="text-xs text-gray-500">{error ?? 'Not found'}</p>
          <button
            type="button"
            onClick={() => router.push(buildUrl('/facebook-meta'))}
            className="inline-flex rounded-md bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:opacity-95"
          >
            Back to list
          </button>
        </div>
      </DashboardLayout>
    );
  }

  const objectStorySpec = creative.object_story_spec ?? {};
  const linkData = objectStorySpec.link_data ?? {};

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <CampaignScopeBanner />

        <header className={`${SECTION_CLS} space-y-3 px-5 py-4`}>
          <div className="flex items-center gap-3">
            <PlatformBadge platform="facebook_meta" />
            <AdDraftStatusPill
              platform="facebook_meta"
              status={statusValue}
              statusLabel={statusValue ? STATUS_LABEL[statusValue] : undefined}
            />
            <span className="text-[11px] text-gray-400">ID · {creative.id}</span>
          </div>
          <div className="flex items-center gap-2">
            {editingName ? (
              <>
                <input
                  ref={nameInputRef}
                  value={draftName}
                  autoFocus
                  onChange={(event) => setDraftName(event.target.value)}
                  onBlur={handleSaveName}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleSaveName();
                    }
                    if (event.key === 'Escape') {
                      setDraftName(creative.name ?? '');
                      setEditingName(false);
                    }
                  }}
                  disabled={savingName}
                  className="min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-xl font-semibold text-gray-900 outline-none focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30"
                />
              </>
            ) : (
              <>
                <h1 className="min-w-0 flex-1 truncate text-xl font-semibold text-gray-900">
                  {creative.name || 'Unnamed creative'}
                </h1>
                <button
                  type="button"
                  onClick={() => {
                    setDraftName(creative.name ?? '');
                    setEditingName(true);
                  }}
                  aria-label="Edit name"
                  title="Edit name"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </>
            )}
          </div>
          <AdDraftActionBar actions={actionBarActions} />
        </header>

        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <main className="space-y-4">
            <section className={`${SECTION_CLS} space-y-3 p-5`}>
              <div className="flex items-center justify-between">
                <h2 className={H2_CLS}>Preview</h2>
                <span className="text-[11px] text-gray-400">Facebook feed placement</span>
              </div>
              {media.length === 0 && !primaryText ? (
                <div className="rounded-md border border-dashed border-gray-200 bg-gray-50 py-10 text-center text-xs text-gray-500">
                  No media or copy yet. Associate media from the right aside to build a preview.
                </div>
              ) : (
                <div className="flex justify-center pt-2">
                  <FacebookAdPreviews
                    selectedMedia={media}
                    selectedContent="all"
                    primaryText={primaryText}
                    scale={75}
                  />
                </div>
              )}
            </section>

            <section className={`${SECTION_CLS} p-5`}>
              <h2 className={H2_CLS}>Creative content</h2>
              <p className="mt-1 text-[11px] text-gray-500">
                Content fields are read-only after creation. To change copy or media, create a new creative.
              </p>
              <dl className="mt-4 divide-y divide-gray-100 text-sm">
                <div className={ROW_CLS}>
                  <dt className={EYEBROW_CLS}>Primary text</dt>
                  <dd className="min-w-0 text-gray-900">{primaryText || <span className="text-gray-400">—</span>}</dd>
                </div>
                <div className={ROW_CLS}>
                  <dt className={EYEBROW_CLS}>Headline</dt>
                  <dd className="min-w-0 text-gray-900">{linkData.name ?? creative.body ?? <span className="text-gray-400">—</span>}</dd>
                </div>
                <div className={ROW_CLS}>
                  <dt className={EYEBROW_CLS}>Description</dt>
                  <dd className="min-w-0 text-gray-900">{linkData.description ?? <span className="text-gray-400">—</span>}</dd>
                </div>
                <div className={ROW_CLS}>
                  <dt className={EYEBROW_CLS}>Link</dt>
                  <dd className="min-w-0 break-all text-gray-900">
                    {linkData.link ? (
                      <a
                        href={linkData.link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[#3CCED7] hover:underline"
                      >
                        {linkData.link}
                        <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                      </a>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </dd>
                </div>
                <div className={ROW_CLS}>
                  <dt className={EYEBROW_CLS}>CTA type</dt>
                  <dd className="min-w-0 text-gray-900">
                    {creative.call_to_action_type ? creative.call_to_action_type.replace(/_/g, ' ') : <span className="text-gray-400">—</span>}
                  </dd>
                </div>
              </dl>
            </section>
          </main>

          <aside className="space-y-4">
            <section className={`${SECTION_CLS} p-5`}>
              <h2 className={H2_CLS}>Properties</h2>
              <div className="mt-3 space-y-3">
                <div>
                  <div className={EYEBROW_CLS}>Status</div>
                  <InlineSelect
                    ariaLabel="Status"
                    value={statusValue ?? 'ACTIVE'}
                    onValueChange={handleStatusChange}
                    disabled={savingStatus}
                    options={STATUS_OPTIONS.map((option) => ({
                      value: option.value,
                      label: option.label,
                    }))}
                  />
                </div>
                <div>
                  <div className={EYEBROW_CLS}>Labels</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {adLabels.map((label) => (
                      <span
                        key={label}
                        className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700"
                      >
                        {label}
                        <button
                          type="button"
                          onClick={() => removeLabel(label)}
                          disabled={savingLabels}
                          aria-label={`Remove label ${label}`}
                          className="text-gray-400 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <X className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </span>
                    ))}
                    <input
                      value={labelInput}
                      onChange={(event) => setLabelInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          addLabel();
                        }
                      }}
                      placeholder="Add label…"
                      disabled={savingLabels}
                      className="min-w-[100px] flex-1 rounded-md border border-gray-200 bg-white px-2 py-0.5 text-xs text-gray-900 outline-none focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30"
                    />
                  </div>
                </div>
                <div>
                  <div className={EYEBROW_CLS}>Authorization category</div>
                  <div className="mt-1 text-xs text-gray-700">
                    {(creative as any).authorization_category || <span className="text-gray-400">None</span>}
                  </div>
                </div>
                <div>
                  <div className={EYEBROW_CLS}>Object story ID</div>
                  <div className="mt-1 font-mono text-xs text-gray-700">
                    {(creative as any).object_story_id || <span className="text-gray-400 font-sans">None</span>}
                  </div>
                </div>
              </div>
            </section>

            <section className={`${SECTION_CLS} p-5`}>
              <div className="flex items-center justify-between">
                <h2 className={H2_CLS}>Media</h2>
                <button
                  type="button"
                  onClick={openMediaModal}
                  className="text-[11px] font-medium text-[#3CCED7] hover:underline"
                >
                  Change
                </button>
              </div>
              {media.length === 0 ? (
                <p className="mt-3 text-xs text-gray-500">
                  No media associated. Click <span className="font-medium">Change</span> to attach photos or videos.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {media.map((item) => (
                    <li key={`${item.type}-${item.id}`} className="flex items-center gap-3">
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-gray-100 ring-1 ring-gray-200">
                        {item.url ? (
                          item.type === 'video' ? (
                            // <img> can't render an mp4 (renders as a broken
                            // image icon). Use <video> with preload="metadata"
                            // and a #t=0.1 fragment so the browser fetches
                            // just enough to show the first frame as a poster.
                            <video
                              src={`${item.url}#t=0.1`}
                              muted
                              playsInline
                              preload="metadata"
                              className="h-full w-full object-cover"
                              aria-label={item.caption ?? 'Video thumbnail'}
                            />
                          ) : (
                            <img
                              src={item.url}
                              alt={item.caption ?? ''}
                              className="h-full w-full object-cover"
                            />
                          )
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-gray-900">
                          {item.type === 'photo' ? 'Photo' : 'Video'}
                        </div>
                        <div className="truncate text-[11px] text-gray-500">
                          {item.caption || item.url || '—'}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className={`${SECTION_CLS} p-5`}>
              <h2 className={H2_CLS}>Share</h2>
              {loadingShare ? (
                <p className="mt-3 text-xs text-gray-400">Checking share preview…</p>
              ) : sharePreview ? (
                <div className="mt-3 space-y-2 text-xs">
                  <div className={EYEBROW_CLS}>Active for {sharePreview.days_active} days</div>
                  <div className="break-all rounded-md bg-gray-50 px-2 py-1 font-mono text-[11px] text-gray-700">
                    {sharePreview.link}
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {sharePreview.days_left} day{sharePreview.days_left === 1 ? '' : 's'} remaining
                  </div>
                  <button
                    type="button"
                    onClick={revokeShare}
                    className="text-[11px] font-medium text-rose-600 hover:underline"
                  >
                    Revoke link
                  </button>
                </div>
              ) : (
                <p className="mt-3 text-xs text-gray-500">
                  No share link generated. Click <span className="font-medium">Share preview</span> in the actions above to create one.
                </p>
              )}
            </section>
          </aside>
        </div>

        <SharePreviewModal
          open={shareOpen}
          onOpenChange={(open) => {
            setShareOpen(open);
            if (!open) loadSharePreview();
          }}
          platform="facebook_meta"
          onShare={handleShare}
          title="Share Facebook creative preview"
          subtitle="Generate a public read-only link"
        />

        <BrandDialog
          open={deleteOpen}
          onOpenChange={(open) => {
            if (!deleting) setDeleteOpen(open);
          }}
          title="Delete this creative?"
          subtitle="This action cannot be undone."
          width="max-w-sm"
        >
          <p className="text-sm text-gray-700">
            The creative, its share preview, and any associated media references will be removed.
          </p>
          <div className="-mx-5 -mb-5 mt-5 flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
            <button
              type="button"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
              className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-gray-700 ring-1 ring-gray-200 transition hover:ring-gray-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Delete
            </button>
          </div>
        </BrandDialog>

        <BrandDialog
          open={mediaOpen}
          onOpenChange={(open) => {
            if (!savingMedia) setMediaOpen(open);
          }}
          title="Associate media"
          subtitle="Select photos and videos to attach to this creative."
          width="max-w-3xl"
        >
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <h3 className={EYEBROW_CLS}>Photos</h3>
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[#3CCED7] hover:underline disabled:opacity-60"
                >
                  <Plus className="h-3 w-3" aria-hidden="true" />
                  Upload photo
                </button>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onPhotoFile}
                />
              </div>
              {dedupedLibraryPhotos.length === 0 ? (
                <p className="mt-2 text-xs text-gray-500">No photos yet. Upload one to associate.</p>
              ) : (
                <ul className="mt-2 grid grid-cols-4 gap-2">
                  {dedupedLibraryPhotos.map((photo) => {
                    const selected = selectedPhotoIds.includes(photo.id);
                    return (
                      <li key={`photo-${photo.id}`} className="group relative">
                        <button
                          type="button"
                          onClick={() => togglePhotoSelection(photo.id)}
                          className={`relative block w-full overflow-hidden rounded-md ring-1 transition ${
                            selected ? 'ring-2 ring-[#3CCED7]' : 'ring-gray-200 hover:ring-gray-300'
                          }`}
                        >
                          <img
                            src={photo.url}
                            alt={photo.caption ?? ''}
                            className="aspect-square w-full object-cover"
                          />
                          {selected && (
                            <span className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-[#3CCED7] to-[#A6E661] text-white">
                              <Check className="h-3 w-3" aria-hidden="true" />
                            </span>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDeletePhoto(photo.id); }}
                          className="absolute bottom-1 left-1 hidden group-hover:flex items-center gap-0.5 rounded bg-white/90 px-1.5 py-0.5 text-[10px] text-red-500 shadow hover:bg-red-50"
                          aria-label="Delete photo"
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <h3 className={EYEBROW_CLS}>Videos</h3>
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  disabled={uploadingVideo}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[#3CCED7] hover:underline disabled:opacity-60"
                >
                  <Plus className="h-3 w-3" aria-hidden="true" />
                  Upload video
                </button>
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={onVideoFile}
                />
              </div>
              {dedupedLibraryVideos.length === 0 ? (
                <p className="mt-2 text-xs text-gray-500">No videos yet. Upload one to associate.</p>
              ) : (
                <ul className="mt-2 grid grid-cols-4 gap-2">
                  {dedupedLibraryVideos.map((video) => {
                    const selected = selectedVideoIds.includes(video.id);
                    return (
                      <li key={`video-${video.id}`} className="group relative">
                        <button
                          type="button"
                          onClick={() => toggleVideoSelection(video.id)}
                          className={`relative block w-full overflow-hidden rounded-md bg-gray-900 p-3 text-left text-[11px] text-white ring-1 transition ${
                            selected ? 'ring-2 ring-[#3CCED7]' : 'ring-gray-200 hover:ring-gray-300'
                          }`}
                        >
                          <div className="truncate font-medium">{video.title || 'Video'}</div>
                          <div className="mt-1 truncate text-[10px] text-gray-300">{video.message || video.video_id}</div>
                          {selected && (
                            <span className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-[#3CCED7] to-[#A6E661] text-white">
                              <Check className="h-3 w-3" aria-hidden="true" />
                            </span>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDeleteVideo(video.id); }}
                          className="absolute bottom-1 left-1 hidden group-hover:flex items-center gap-0.5 rounded bg-white/90 px-1.5 py-0.5 text-[10px] text-red-500 shadow hover:bg-red-50"
                          aria-label="Delete video"
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div className="-mx-5 -mb-5 mt-5 flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
            <button
              type="button"
              onClick={() => setMediaOpen(false)}
              disabled={savingMedia}
              className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-gray-700 ring-1 ring-gray-200 transition hover:ring-gray-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveMedia}
              disabled={savingMedia}
              className="rounded-md bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Save selection
            </button>
          </div>
        </BrandDialog>
      </div>
    </DashboardLayout>
  );
}

export default function FacebookMetaDetailPage() {
  return (
    <ProtectedRoute>
      <FacebookMetaDetailContent />
    </ProtectedRoute>
  );
}
