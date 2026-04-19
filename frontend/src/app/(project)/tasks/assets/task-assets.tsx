'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import useAuth from '@/hooks/useAuth';
import { useAssetData } from '@/hooks/useAssetData';
import { AssetAPI, AssetVersion, AssetHistory, AssetComment, Asset } from '@/lib/api/assetApi';
import { approverApi } from '@/lib/api/approverApi';
import toast from 'react-hot-toast';
import { useCallback, useEffect, useRef } from 'react';
import { useAssetSocket } from '@/hooks/useAssetSocket';

const getFileUrl = (fileUrl?: string | null): string => {
  if (!fileUrl) return '';
  const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
  if (fileUrl.startsWith('/')) return `${apiBase}${fileUrl}`;
  if (fileUrl.startsWith('http://localhost') || fileUrl.startsWith('http://127.0.0.1')) {
    if (apiBase) {
      try {
        const base = new URL(apiBase);
        const u = new URL(fileUrl);
        return `${base.origin}${u.pathname}`;
      } catch { return fileUrl; }
    }
  }
  return fileUrl;
};

function AssetVersionsPanel({ assetId, assetStatus, reloadSignal }: { assetId: number | string; assetStatus: string; reloadSignal?: number }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [versions, setVersions] = useState<AssetVersion[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const fileInputId = `upload-input-${assetId}`;
  const refreshDebounceRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await AssetAPI.getAssetVersions(String(assetId));
      setVersions(list);
    } catch (e) {
      setError('Failed to load versions');
      setVersions([]);
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => { load(); }, [load, assetId, reloadSignal]);

  // Socket: versions + scan updates
  useAssetSocket(String(assetId), {
    // Drive UI updates via WebSocket events
    onVersionUploaded: (e) => {
      console.log('[WS] versionUploaded', { assetId, event: e });
      // Prepend the newly created draft version if payload carries it; otherwise fallback to load()
      const v: any = e?.payload?.version || e?.payload;
      if (v && typeof v === 'object' && (v.id || v.version_id)) {
        const mapped = {
          ...(v as any),
          id: v.id || v.version_id,
          version_number: v.version_number || v.number || v.version || 0,
          version_status: v.version_status || v.status || 'Draft',
          scan_status: v.scan_status || v.scan || 'pending',
          created_at: v.created_at || new Date().toISOString(),
        } as AssetVersion as any;
        setVersions(prev => {
          // Avoid duplicates if load() already ran
          if (prev.some(p => String(p.id) === String(mapped.id))) return prev;
          // Insert keeping desc order by created_at or version_number
          const next = [mapped, ...prev];
          return next.sort((a: any, b: any) => (new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
        });
      } else {
        load();
      }
    },
    onVersionPublished: (e) => { console.log('[WS] versionPublished', { assetId, event: e }); load(); },
    onVersionScanStarted: (e) => {
      console.log('[WS] versionScanStarted', { assetId, event: e });
      const p: any = e?.payload || {};
      const vid = p.version_id || p.id || p.version?.id;
      if (vid) {
        setVersions(prev => prev.map(v => (String(v.id) === String(vid) ? { ...v, scan_status: 'scanning' as any } : v)));
      } else {
        load();
      }
    },
    onVersionScanCompleted: (e) => {
      console.log('[WS] versionScanCompleted', { assetId, event: e });
      const p: any = e?.payload || {};
      const vid = p.version_id || p.id || p.version?.id;
      const status = (p.scan_status || p.status || p.result || '').toLowerCase();
      const normalized: any = status && ['clean', 'infected', 'error', 'pending', 'scanning'].includes(status) ? status : 'clean';
      if (vid) {
        setVersions(prev => prev.map(v => (String(v.id) === String(vid) ? { ...v, scan_status: normalized } : v)));
      } else {
        load();
      }
    },
    onUnknownEvent: (e: any) => {
      console.log('[WS] unknown', { assetId, event: e });
      const t = String(e?.type || '').toLowerCase();
      if (/version(deleted|removed|_delete)/i.test(t)) { load(); return; }
      if (/version.*(upload|create|created|update|updated|replace|publish|published|final)/i.test(t)) { load(); }
    },
  });

  const queueRefresh = () => {};

  const scanBadgeClass = (status?: string | null) => {
    switch (status) {
      case 'clean':
        return 'bg-green-100 text-green-800';
      case 'pending':
      case 'scanning':
        return 'bg-yellow-100 text-yellow-800';
      case 'infected':
        return 'bg-red-100 text-red-800';
      case 'error':
        return 'bg-gray-200 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Compute upload availability and reason for tooltip/message
  const hasDraft = versions.some(v => v.version_status === 'Draft');
  const latest = versions.length > 0 ? versions.reduce((a, b) => (a.version_number > b.version_number ? a : b)) : null as AssetVersion | null;
  const latestFinalized = latest ? latest.version_status === 'Finalized' : true;
  const isNotSubmitted = assetStatus === 'NotSubmitted';
  const canUpload = isNotSubmitted && !hasDraft && (versions.length === 0 || latestFinalized);
  const uploadDenyReason = isNotSubmitted
    ? 'Please submit the existing version or delete it.'
    : 'This asset is in review; uploading is not allowed.';

  return (
    <div className="mt-3">
      {/* Header with title and small inline add button */}
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-medium text-gray-900">Existing Asset Versions</h3>
        <label
          htmlFor={fileInputId}
          className={`inline-flex items-center justify-center h-5 w-5 rounded text-xs transition-colors ${
            uploading
              ? 'bg-indigo-300 text-white cursor-wait'
              : (canUpload ? 'cursor-pointer bg-indigo-600 text-white hover:bg-indigo-700' : 'cursor-not-allowed bg-gray-300 text-white')
          }`}
          title={canUpload ? 'Add a new version to this asset' : uploadDenyReason}
          onClick={(e) => {
            // Guard open file dialog based on computed rules
            if (!canUpload || uploading) {
              e.preventDefault();
              if (!uploading) toast.error(uploadDenyReason);
            }
          }}
          aria-label="Add version"
        >
          <span className="leading-none">+</span>
          <span className="sr-only">Add version</span>
        </label>
        <input
          id={fileInputId}
          type="file"
          className="hidden"
          onChange={async (e) => {
            const inputEl = e.currentTarget as HTMLInputElement;
            const file = inputEl.files && inputEl.files[0];
            if (!file) return;
            // Client-side max size guard
            const maxMb = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB || '2.5');
            const maxBytes = maxMb * 1024 * 1024;
            if (file.size > maxBytes) {
              toast.error(`File too large (> ${maxMb}MB)`);
              if (inputEl) inputEl.value = '';
              return;
            }
            try {
              setUploading(true);
              setUploadProgress(0);
              await AssetAPI.createAssetVersion(String(assetId), { file }, {
                onUploadProgress: (p) => setUploadProgress(p)
              });
              // No dedicated WS event; refresh immediately so the new draft shows up
              await load();
            } finally {
              setUploading(false);
              setUploadProgress(null);
              if (inputEl) inputEl.value = '';
            }
          }}
        />
      </div>
        {loading && <div className="text-xs text-gray-500">Loading versions...</div>}
        {error && <div className="text-xs text-red-600">{error}</div>}
        {!loading && !error && versions.length === 0 && (
          <div className="text-xs text-gray-500">No versions.</div>
        )}
        {!loading && !error && versions.length > 0 && (
          <div className="space-y-2">
            {versions.map(v => (
              <div key={v.id} className="flex items-center justify-between text-xs bg-white rounded border p-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    v{v.version_number}
                    {/* NOTE: Scan display disabled - no longer needed */}
                    {/* {v.scan_status && (
                      <span className={`ml-2 px-1.5 py-0.5 rounded ${scanBadgeClass(v.scan_status)}`}>{v.scan_status}</span>
                    )} */}
                  </div>
                  <div className="text-gray-500 truncate">{new Date(v.created_at).toLocaleString()}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-gray-700 whitespace-nowrap">Status: <span className="font-mono uppercase tracking-wide">{v.version_status}</span></span>
                  {v.file && v.version_status === 'Finalized' && (
                    <a href={getFileUrl(v.file)} target="_blank" rel="noreferrer" className="text-indigo-600 hover:text-indigo-500">Download</a>
                  )}
                  {v.version_status === 'Draft' && (
                    <>
                      <label
                        htmlFor={`replace-input-${assetId}-${v.id}`}
                        className={`px-2 py-1 rounded cursor-pointer ${uploading ? 'bg-gray-300 text-white' : 'bg-gray-600 text-white hover:bg-gray-700'}`}
                      >
                        {uploading ? `Replacing ${uploadProgress ?? 0}%` : 'Replace'}
                      </label>
                      <input
                        id={`replace-input-${assetId}-${v.id}`}
                        type="file"
                        className="hidden"
                        onChange={async (e) => {
                          const inputEl = e.currentTarget as HTMLInputElement;
                          const file = inputEl.files && inputEl.files[0];
                          if (!file) return;
                          // Client-side max size guard
                          const maxMb = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB || '50');
                          const maxBytes = maxMb * 1024 * 1024;
                          if (file.size > maxBytes) {
                            toast.error(`File too large (> ${maxMb}MB)`);
                            if (inputEl) inputEl.value = '';
                            return;
                          }
                          try {
                            setUploading(true);
                            setUploadProgress(0);
                            await AssetAPI.updateAssetVersion(String(assetId), String(v.id), { file }, {
                              onUploadProgress: (p) => setUploadProgress(p)
                            });
                          } finally {
                            setUploading(false);
                            setUploadProgress(null);
                            if (inputEl) inputEl.value = '';
                          }
                        }}
                      />
                      <button
                        onClick={async () => {
                          const ok = window.confirm('Delete this draft version?');
                          if (!ok) return;
                          try {
                            setUploading(true);
                            await AssetAPI.deleteAssetVersion(String(assetId), String(v.id));
                            // UI will refresh via WebSocket event (e.g., versionDeleted)
                          } finally {
                            setUploading(false);
                          }
                        }}
                        className="px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700"
                      >
                        Delete
                      </button>
                      <button
                        onClick={async () => {
                          await AssetAPI.publishAssetVersion(String(assetId), String(v.id));
                          // Rely purely on WebSocket to reflect publish
                        }}
                        className="px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700"
                      >
                        Publish
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      
    </div>
  );
}

function AssetHistoryPanel({ assetId, reloadSignal }: { assetId: number | string; reloadSignal?: number }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<AssetHistory[]>([]);
  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await AssetAPI.getAssetHistory(String(assetId));
      setItems(list);
    } catch (e) {
      setError('Failed to load history');
      setItems([]);
    } finally { setLoading(false); }
  }, [assetId]);
  useEffect(() => { load(); }, [load, assetId, reloadSignal]);
  // newest -> oldest so latest at top
  const ordered = [...items].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const getUserLabel = (h: any): string => {
    return (
      h.user_name || h.username || (h.user && (h.user.username || h.user.email)) ||
      (typeof h.user_id === 'number' ? `User #${h.user_id}` : 'User')
    );
  };

  const renderTitle = (h: any): string => {
    const d = h.details || {};
    switch (h.type) {
      case 'asset_created':
        return 'Asset created';
      case 'version_uploaded': {
        const vnum = d.version_number || d.version || d.number || d.versionNum;
        return vnum ? `Uploaded version v${vnum}` : 'Uploaded a new version';
      }
      case 'state_transition': {
        const from = d.from_state || d.from || d.previous || d.old_state || d.old;
        const to = d.to_state || d.to || d.next || d.new_state || d.new;
        if (from && to) return `State changed from ${from} to ${to}`;
        return 'State changed';
      }
      case 'comment_added':
        return 'Comment added';
      case 'review_assigned': {
        const assignee = d.assignee_name || d.assignee || d.user_name || d.username || (d.user && (d.user.username || d.user.email));
        const role = d.role || d.assignment_role;
        if (assignee && role) return `Review assigned: ${role} → ${assignee}`;
        if (assignee) return `Review assigned to ${assignee}`;
        return 'Review assigned';
      }
      default:
        return String(h.type || 'History');
    }
  };

  return (
    <div className="mt-4">
      {/* Hide visible label text for History */}
      {loading && <div className="text-xs text-gray-500">Loading history...</div>}
      {error && <div className="text-xs text-red-600">{error}</div>}
      {!loading && !error && ordered.length === 0 && (<div className="text-xs text-gray-500">No history.</div>)}
      {!loading && !error && ordered.length > 0 && (
        <div className="relative max-h-60 overflow-y-auto pr-2">
          {/* timeline line (fixed) */}
          <div className="absolute left-3 top-0 bottom-0 w-px bg-gray-200" />
          {ordered.map((h, idx) => {
            return (
              <div key={`${h.timestamp}-${idx}`} className="relative mb-4 text-xs">
                {/* node (fixed) */}
                <span className="absolute left-2.5 top-1.5 h-2.5 w-2.5 rounded-full bg-indigo-500 ring-2 ring-white" />
                {/* content indented independently */}
                <div className="pl-10">
                  <div className="font-semibold text-gray-900">{renderTitle(h)}</div>
                  <div className="text-gray-500 text-[11px]">{new Date(h.timestamp).toLocaleString()} • {getUserLabel(h)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AssetCommentsPanel({ assetId, reloadSignal }: { assetId: number | string; reloadSignal?: number }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comments, setComments] = useState<AssetComment[]>([]);
  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try { setLoading(true); setError(null); const list = await AssetAPI.getAssetComments(String(assetId)); setComments(list); }
    catch (e) { setError('Failed to load comments'); setComments([]); }
    finally { setLoading(false); }
  }, [assetId]);

  useEffect(() => { load(); }, [load, assetId, reloadSignal]);
  const refreshDebounceRef = useRef<number | null>(null);
  const queueRefresh = () => {
    if (refreshDebounceRef.current) window.clearTimeout(refreshDebounceRef.current);
    refreshDebounceRef.current = window.setTimeout(() => { load(); }, 300);
  };
  useAssetSocket(String(assetId), {
    onCommentAdded: () => queueRefresh(),
  });

  const handleAdd = async () => {
    const text = input.trim();
    if (!text) return;
    try {
      setSubmitting(true);
      await AssetAPI.createAssetComment(String(assetId), { body: text });
      setInput('');
      // Rely on WebSocket event (commentAdded) to trigger debounced reload
    } finally {
      setSubmitting(false);
    }
  };

  // newest -> oldest so latest at top
  const ordered = [...comments].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="mt-4">
      {/* Hide visible label text for Comments */}
      {/* Input at top */}
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Add a comment..."
          className="flex-1 rounded border border-gray-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={submitting}
          className={`px-3 py-1.5 text-xs rounded text-white ${submitting ? 'bg-indigo-300' : 'bg-indigo-600 hover:bg-indigo-700'}`}
        >
          Comment
        </button>
      </div>

      {loading && <div className="text-xs text-gray-500">Loading comments...</div>}
      {error && <div className="text-xs text-red-600">{error}</div>}
      {!loading && !error && ordered.length === 0 && (<div className="text-xs text-gray-500">No comments.</div>)}
      {!loading && !error && ordered.length > 0 && (
        <div className="max-h-60 overflow-y-auto pr-2">
          {ordered.map((c, idx) => {
            const anyC: any = c as any;
            const author = anyC.user_name || anyC.username || anyC.user_display_name || (anyC.user && (anyC.user.username || anyC.user.email)) || `User #${c.user}`;
            return (
              <div key={c.id} className="text-xs">
                <div className="font-semibold text-gray-900">{author}</div>
                <div className="text-gray-500 text-[11px]">{new Date(c.created_at).toLocaleString()}</div>
                <div className="mt-1 text-gray-800 whitespace-pre-wrap break-words">{c.body}</div>
                {idx < ordered.length - 1 && (<hr className="my-3 border-gray-200" />)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AssetDetailsTabs({ assetId, reloadSignal }: { assetId: number | string; reloadSignal?: number }) {
  const [active, setActive] = useState<'comments' | 'history'>('comments');
  const [commentsTick, setCommentsTick] = useState(0);
  const [historyTick, setHistoryTick] = useState(0);

  return (
    <div className="mt-4">
      {/* Tabs header */}
      <div className="border-b border-gray-200 mb-3">
        <nav className="-mb-px flex gap-6" aria-label="Asset tabs">
          <button
            className={`whitespace-nowrap border-b-2 px-1 py-2 text-xs font-medium ${active === 'comments' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            onClick={() => setActive('comments')}
          >
            Comments
          </button>
          <button
            className={`whitespace-nowrap border-b-2 px-1 py-2 text-xs font-medium ${active === 'history' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            onClick={() => setActive('history')}
          >
            History
          </button>
        </nav>
      </div>

      {/* Content */}
      {active === 'comments' ? (
        <AssetCommentsPanel assetId={assetId} reloadSignal={0 + commentsTick} />
      ) : (
        <AssetHistoryPanel assetId={assetId} reloadSignal={0 + historyTick} />
      )}
    </div>
  );
}

export default function TaskAssets() {
  const params = useParams();
  const taskId = useMemo(() => (params?.taskId ? String(params.taskId) : ''), [params]);
  const { user } = useAuth();
  const { assets, assetsLoading, assetsError, fetchAssets, createAsset, deleteAsset, createAssetVersion, createComment, updateAssetLocal } = useAssetData({ taskId });
  const taskAssets = useMemo(() => assets.filter(a => String(a.task) === String(taskId)), [assets, taskId]);
  const [showCreate, setShowCreate] = useState(false);
  const [teamIdInput, setTeamIdInput] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Removed versionReloadTick and manual fetches; rely on WS-driven local updates

  const handleCreate = async () => {
    if (!taskId) return;
    const taskNum = Number(taskId);
    if (Number.isNaN(taskNum)) return;
    const teamNum = teamIdInput ? Number(teamIdInput) : undefined;
    if (teamIdInput && Number.isNaN(Number(teamIdInput))) return;
    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
    setSubmitting(true);
    const created = await createAsset({ task: taskNum, ...(teamNum !== undefined ? { team: teamNum } : {}), tags });
    setSubmitting(false);
    if (created) { setShowCreate(false); setTeamIdInput(''); setTagsInput(''); }
  };

  // Removed task-level socket (which used an invalid endpoint); per-asset sockets added in rows.
  // If multiple assets are shown, attach one socket per asset card below
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-end mb-4">
        {!assetsLoading && taskAssets.length === 0 && (
          <button onClick={() => setShowCreate(v => !v)} className="px-3 py-1.5 text-sm rounded bg-indigo-600 text-white hover:bg-indigo-700">{showCreate ? 'Cancel' : 'Create Asset'}</button>
        )}
      </div>

      {assetsLoading && (<div className="text-gray-600 text-sm">Loading assets...</div>)}
      {assetsError && (<div className="text-red-600 text-sm">{assetsError}</div>)}
      {!assetsLoading && !assetsError && taskAssets.length === 0 && (
        <div className="space-y-4">
          {showCreate ? (
            <div className="border rounded p-4 bg-gray-50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Team ID (optional)</label>
                  <input type="text" value={teamIdInput} onChange={(e) => setTeamIdInput(e.target.value)} placeholder="Enter team ID (number)" className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma separated)</label>
                  <input type="text" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="e.g. video, draft" className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={handleCreate} disabled={submitting} className={`px-3 py-1.5 text-sm rounded text-white ${submitting ? 'bg-indigo-300' : 'bg-indigo-600 hover:bg-indigo-700'}`}>{submitting ? 'Creating...' : 'Create'}</button>
                <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 text-sm rounded bg-gray-100 text-gray-800 hover:bg-gray-200">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="text-gray-600 text-sm">No assets found for this task.</div>
          )}
        </div>
      )}

      {!assetsLoading && !assetsError && taskAssets.length > 0 && (
        <div className="space-y-3">
          {taskAssets.map((asset) => (
            <AssetRowWrapper
              key={asset.id}
              asset={asset}
              onRefresh={async () => { /* no-op in WS mode */ }}
              onDeleted={async () => { await fetchAssets(); }}
              versionReloadTick={0}
              setVersionReloadTick={() => { /* no-op in WS mode */ }}
              updateAssetLocal={updateAssetLocal}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AssetRowWrapper(props: { asset: Asset; onRefresh: () => Promise<void>; onDeleted?: () => Promise<void>; versionReloadTick: number; setVersionReloadTick: React.Dispatch<React.SetStateAction<number>>; updateAssetLocal?: (id: string | number, patch: Partial<Asset>) => void }) {
  const { asset, onRefresh, onDeleted, updateAssetLocal } = props;
  // Each row subscribes to its own asset socket to avoid invalid WS path at task level
  useAssetSocket(String(asset.id), {
    onStatusChanged: (e) => {
      const p: any = e.payload || {};
      const next = p.to_state || p.new_status || p.status;
      if (next && updateAssetLocal) updateAssetLocal(asset.id, { status: next, updated_at: new Date().toISOString() });
    },
    onVersionPublished: () => { if (updateAssetLocal) updateAssetLocal(asset.id, { updated_at: new Date().toISOString() }); },
    onVersionUploaded: () => { if (updateAssetLocal) updateAssetLocal(asset.id, { updated_at: new Date().toISOString() }); },
  });
  // In WS-only mode, no debounced manual refresh
  return (
    <AssetRowInner asset={asset} onRefresh={onRefresh} onDeleted={onDeleted} versionReloadTick={0} setVersionReloadTick={() => {}} />
  );
}

function AssetRowInner({ asset, onRefresh, onDeleted, versionReloadTick, setVersionReloadTick }: { asset: Asset; onRefresh: () => Promise<void>; onDeleted?: () => Promise<void>; versionReloadTick: number; setVersionReloadTick: React.Dispatch<React.SetStateAction<number>> }) {

  return (
    <div className="p-3 border rounded bg-gray-50">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">Asset #{asset.id}</div>
        </div>
        <div className="flex items-center gap-2">
          {/* Delete button */}
          <DeleteAssetButton assetId={asset.id} onDeleted={onDeleted || onRefresh} />
        </div>
      </div>
      <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2 space-y-3">
          <div className="rounded border border-gray-200 bg-white p-3">
            <AssetVersionsPanel assetId={asset.id} assetStatus={asset.status} />
          </div>
          <div className="rounded border border-gray-200 bg-white p-3">
            <AssetDetailsTabs assetId={asset.id} />
          </div>
        </div>
        <div className="md:col-span-1">
          <AssetDetailsCard asset={asset} />
        </div>
      </div>
    </div>
  );
}

function SubmitAssetButton({ assetId, onSubmitted }: { assetId: number; onSubmitted?: () => void }) {
  const [hasFinalized, setHasFinalized] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const checkFinalized = useCallback(async () => {
    try {
      setLoading(true);
      const versions = await AssetAPI.getAssetVersions(String(assetId));
      setHasFinalized(versions.some(v => v.version_status === 'Finalized'));
    } catch {
      setHasFinalized(false);
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    checkFinalized();
  }, [checkFinalized]);

  // React to WebSocket events so the button appears right after a publish
  useAssetSocket(String(assetId), {
    onVersionPublished: () => {
      // Instantly enable the button on publish without waiting for API roundtrip
      setHasFinalized(true);
      // Optionally re-validate in background shortly after
      window.setTimeout(() => {
        try { checkFinalized(); } catch {}
      }, 300);
    },
  });

  // No WebSocket refresh for submit button - rely on local state updates

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      await AssetAPI.submitAsset(String(assetId));
      // Optimistically notify parent/UI to refresh immediately
      if (typeof onSubmitted === 'function') onSubmitted();
    } finally {
      setSubmitting(false);
    }
  };

  if (hasFinalized === null || loading) return null;
  if (!hasFinalized) return null;

  return (
    <button
      onClick={handleSubmit}
      disabled={submitting}
      className={`px-2 py-1 text-xs rounded ${submitting ? 'bg-indigo-300' : 'bg-indigo-600 hover:bg-indigo-700'} text-white`}
      title="Submit this asset to start the review process"
    >
      {submitting ? 'Submitting...' : 'Submit asset for review'}
    </button>
  );
}

function AssetDetailsCard({ asset }: { asset: Asset }) {
  const [assignments, setAssignments] = useState<{ approvers: number[]; reviewers: number[] }>({ approvers: [], reviewers: [] });
  const [loading, setLoading] = useState(false);
  const [userPickerOpen, setUserPickerOpen] = useState<null | 'approver' | 'reviewer'>(null);
  const [allUsers, setAllUsers] = useState<{ id: number; name?: string; email?: string }[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [localStatus, setLocalStatus] = useState<'NotSubmitted' | 'PendingReview' | 'UnderReview' | 'Approved' | 'RevisionRequired' | 'Archived'>(asset.status);
  const assignRefreshRef = useRef<number | null>(null);

  const loadAssignments = useCallback(async () => {
    try {
      setLoading(true);
      const list = await AssetAPI.getAssetAssignments(String(asset.id));
      const approvers = list.filter(a => a.role === 'approver').map(a => a.user);
      const reviewers = list.filter(a => a.role === 'reviewer').map(a => a.user);
      setAssignments({ approvers, reviewers });
    } catch {
      setAssignments({ approvers: [], reviewers: [] });
    } finally {
      setLoading(false);
    }
  }, [asset.id]);

  useEffect(() => { loadAssignments(); }, [loadAssignments]);

  const queueAssignRefresh = () => {
    if (assignRefreshRef.current) window.clearTimeout(assignRefreshRef.current);
    assignRefreshRef.current = window.setTimeout(() => { loadAssignments(); }, 300);
  };

  // Keep local status in sync with server via WebSocket (e.g., after submit)
  useAssetSocket(String(asset.id), {
    onStatusChanged: (e) => {
      const p: any = e.payload || {};
      const next = p.to_state || p.new_status || p.status;
      if (next) setLocalStatus(next);
    },
  });

  // No WebSocket refresh for assignments - rely on local state updates

  const doAction = async (action: 'start_review' | 'approve' | 'reject' | 'acknowledge_rejection' | 'archive') => {
    // Optimistic status update
    const statusMap: Record<string, 'NotSubmitted' | 'PendingReview' | 'UnderReview' | 'Approved' | 'RevisionRequired' | 'Archived'> = {
      start_review: 'UnderReview',
      approve: 'Approved',
      reject: 'RevisionRequired',
      acknowledge_rejection: 'NotSubmitted',
      archive: 'Archived',
    };
    const prev = localStatus;
    if (statusMap[action]) setLocalStatus(statusMap[action] as any);
    try {
      await AssetAPI.reviewAsset(String(asset.id), action);
      await loadAssignments(); // keep side lists in sync
    } catch (e) {
      // rollback on failure
      setLocalStatus(prev);
    }
  };

  const ownerLabel = (asset as any).owner_name || (asset as any).owner_email || (asset as any).owner || `User #${asset.owner}`;

  const actionButtons = () => {
    switch (localStatus) {
      case 'NotSubmitted':
        return (
          <SubmitAssetButton
            assetId={asset.id}
            onSubmitted={() => {
              // Optimistically update while waiting for WS statusChanged
              setLocalStatus('PendingReview');
            }}
          />
        );
      case 'PendingReview':
        return (
          <button onClick={() => doAction('start_review')} className="px-2 py-1 text-xs rounded bg-indigo-600 text-white hover:bg-indigo-700">Start Review</button>
        );
      case 'UnderReview':
        return (
          <div className="flex gap-2">
            <button onClick={() => doAction('approve')} className="px-2 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-700">Approve</button>
            <button onClick={() => doAction('reject')} className="px-2 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700">Reject</button>
          </div>
        );
      case 'RevisionRequired':
        return (
          <button onClick={() => doAction('acknowledge_rejection')} className="px-2 py-1 text-xs rounded bg-yellow-600 text-white hover:bg-yellow-700">Acknowledge</button>
        );
      case 'Approved':
        return (
          <button onClick={() => doAction('archive')} className="px-2 py-1 text-xs rounded bg-gray-600 text-white hover:bg-gray-700">Archive</button>
        );
      default:
        return null;
    }
  };

  return (
    <div className="rounded border border-gray-200 bg-white p-3 text-xs">
      <div className="font-semibold text-gray-900 mb-2">Asset Detail</div>
      <div className="space-y-2">
        <div>
          <div className="text-gray-500">Owner</div>
          <div className="text-gray-900">{ownerLabel}</div>
        </div>
        <div>
          <div className="text-gray-500">Approvers</div>
          <div className="text-gray-900">
            {assignments.approvers.length > 0
              ? assignments.approvers.map(id => `User #${id}`).join(', ')
              : (
                <button
                  type="button"
                  onClick={async () => {
                    setUserPickerOpen('approver');
                    if (allUsers.length === 0) {
                      try {
                        setLoadingUsers(true);
                        const users = await approverApi.getAllUsers();
                        setAllUsers(users as any);
                      } finally {
                        setLoadingUsers(false);
                      }
                    }
                  }}
                  className="text-gray-500 hover:bg-gray-100 px-2 py-0.5 rounded cursor-pointer"
                >
                  None
                </button>
              )}
          </div>
          {userPickerOpen === 'approver' && (
            <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 rounded p-2">
              {loadingUsers ? (
                <div className="text-gray-500">Loading users...</div>
              ) : (
                allUsers.map(u => (
                  <button
                    key={u.id}
                    className="block w-full text-left px-2 py-1 hover:bg-gray-50"
                    onClick={async () => {
                      await AssetAPI.createAssetAssignment(String(asset.id), { user: u.id, role: 'approver' });
                      setUserPickerOpen(null);
                      await loadAssignments();
                    }}
                  >
                    {u.name || u.email || `User #${u.id}`}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        <div>
          <div className="text-gray-500">Reviewers</div>
          <div className="text-gray-900">
            {assignments.reviewers.length > 0
              ? assignments.reviewers.map(id => `User #${id}`).join(', ')
              : (
                <button
                  type="button"
                  onClick={async () => {
                    setUserPickerOpen('reviewer');
                    if (allUsers.length === 0) {
                      try {
                        setLoadingUsers(true);
                        const users = await approverApi.getAllUsers();
                        setAllUsers(users as any);
                      } finally {
                        setLoadingUsers(false);
                      }
                    }
                  }}
                  className="text-gray-500 hover:bg-gray-100 px-2 py-0.5 rounded cursor-pointer"
                >
                  None
                </button>
              )}
          </div>
          {userPickerOpen === 'reviewer' && (
            <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 rounded p-2">
              {loadingUsers ? (
                <div className="text-gray-500">Loading users...</div>
              ) : (
                allUsers.map(u => (
                  <button
                    key={u.id}
                    className="block w-full text-left px-2 py-1 hover:bg-gray-50"
                    onClick={async () => {
                      await AssetAPI.createAssetAssignment(String(asset.id), { user: u.id, role: 'reviewer' });
                      setUserPickerOpen(null);
                      await loadAssignments();
                    }}
                  >
                    {u.name || u.email || `User #${u.id}`}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        <div>
          <div className="text-gray-500">Tags</div>
          {asset.tags && asset.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1 mt-1">
              {asset.tags.map((tag, i) => (
                <span
                  key={`${asset.id}-detail-tag-${i}-${tag}`}
                  className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[11px]"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-gray-900">None</div>
          )}
        </div>
        <div>
          <div className="text-gray-500">Status</div>
          <div className="text-gray-900"><span className="font-mono uppercase tracking-wide">{localStatus}</span></div>
        </div>
        <div>
          <div className="text-gray-500">Actions</div>
          <div className="mt-1">{actionButtons()}</div>
        </div>
      </div>
    </div>
  );
}

function DeleteAssetButton({ assetId, onDeleted }: { assetId: number; onDeleted?: () => Promise<void> }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    const confirmed = window.confirm('Are you sure you want to delete this asset? This action cannot be undone.');
    if (!confirmed) return;

    try {
      setDeleting(true);
      await AssetAPI.deleteAsset(String(assetId));
      if (onDeleted) {
        await onDeleted();
      }
    } catch (error) {
      console.error('Error deleting asset:', error);
      // Error is already handled by AssetAPI with toast
    } finally {
      setDeleting(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className={`px-2 py-1 text-xs rounded ${deleting ? 'bg-red-300' : 'bg-red-600 hover:bg-red-700'} text-white`}
    >
      {deleting ? 'Deleting...' : 'Delete'}
    </button>
  );
}

