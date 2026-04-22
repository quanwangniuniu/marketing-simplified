'use client';

import React, { useEffect, useState, useRef } from 'react';
import { X, Search, ChevronDown, Upload } from 'lucide-react';
import { getTiktokMaterials, TiktokMaterialItem } from '@/lib/api/tiktokApi';
import TiktokUploadDrawer from './TiktokUploadDrawer';

interface CreativeLibraryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: (selected: TiktokMaterialItem | null) => void;
  // When provided, the drawer will lock to this type and hide the switch
  forceType?: 'video' | 'image';
}

const CreativeLibraryDrawer: React.FC<CreativeLibraryDrawerProps> = ({ isOpen, onClose, onConfirm, forceType }) => {
  const [activeTab, setActiveTab] = useState<'posts' | 'library'>('library');
  const [materials, setMaterials] = useState<TiktokMaterialItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [type, setType] = useState<'video' | 'image'>('video');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleUploadClick = () => fileInputRef.current?.click();
  const [showUpload, setShowUpload] = useState(false);
  const [recentUploads, setRecentUploads] = useState<Array<{ id: string; name: string; type: 'video'|'image'; progress: number; done?: boolean }>>([]);
  const [showRecentBanner, setShowRecentBanner] = useState(false);
  // Clear transient recently-uploaded state when抽屉关闭或重新打开
  useEffect(() => {
    if (!isOpen) {
      setRecentUploads([]);
      setShowRecentBanner(false);
    }
  }, [isOpen]);

  // reusable loader so we can refresh after upload completes
  const loadMaterials = async () => {
    try {
      setLoading(true);
      const res = await getTiktokMaterials({ type });
      const list = (res.results || []).slice();
      list.sort((a, b) => {
        const aTime = a.created_at ? Date.parse(a.created_at) : 0;
        const bTime = b.created_at ? Date.parse(b.created_at) : 0;
        const cmp = (aTime || 0) - (bTime || 0);
        return sortOrder === 'asc' ? cmp : -cmp;
      });
      setMaterials(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    if (activeTab !== 'library') return;
    loadMaterials();
  }, [isOpen, activeTab, type, search, sortOrder]);

  // Lock type based on forceType
  useEffect(() => {
    if (forceType && type !== forceType) {
      setType(forceType);
    }
  }, [forceType]);

  useEffect(() => {
    if (!showSortMenu) return;
    const onDocClick = () => setShowSortMenu(false);
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [showSortMenu]);

  const normalized = search.trim().toLowerCase();
  const filteredMaterials = !normalized ? materials : materials.filter((m) => {
    const name = (m.title || '').toString().trim().toLowerCase();
    const idStr = String(m.id || '').toLowerCase();
    return name.startsWith(normalized) || idStr.startsWith(normalized);
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* drawer */}
      <div className="absolute right-0 top-0 h-full w-full max-w-6xl bg-white shadow-xl flex flex-col">
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="text-lg font-semibold">Add creatives</div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-md" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* tabs */}
        <div className="px-5 pt-3">
          <div className="flex items-center gap-6 border-b">
            <button
              className={`pb-3 text-sm ${activeTab === 'posts' ? 'border-b-2 border-[#3CCED7] text-[#3CCED7]' : 'text-gray-500'}`}
              onClick={() => setActiveTab('posts')}
            >
              TikTok posts
            </button>
            <button
              className={`pb-3 text-sm ${activeTab === 'library' ? 'border-b-2 border-[#3CCED7] text-[#3CCED7]' : 'text-gray-500'}`}
              onClick={() => setActiveTab('library')}
            >
              Creative library
            </button>
          </div>
        </div>

        {/* Recently uploaded (single, above search) */}
        {(recentUploads.some(u => !u.done) || showRecentBanner) && (
          <div className="px-5 pt-3">
            <div className="text-sm font-semibold text-gray-900 mb-2">Recently uploaded</div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {recentUploads.some(u => !u.done) ? (
                (() => {
                  const u = recentUploads.find(x => !x.done)!;
                  return (
                    <div key={u.id} className="relative rounded-lg border border-gray-300 p-4">
                      <div className="h-28 bg-gray-100 rounded-md mb-3 flex items-center justify-center text-xs text-gray-500">Uploading...</div>
                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-teal-600" style={{ width: `${Math.round(u.progress)}%` }} />
                      </div>
                      <div className="mt-2 text-xs text-gray-700 truncate">{u.name}</div>
                    </div>
                  );
                })()
              ) : (
                (() => {
                  const m = filteredMaterials[0];
                  return m ? (
                    <button
                      key={`recent-${m.id}`}
                      onClick={() => setSelectedId(prev => prev === m.id ? null : m.id)}
                      className={`relative text-left rounded-md overflow-hidden border transition-colors ${selectedId === m.id ? 'border-teal-600 ring-2 ring-teal-300' : 'border-gray-300 hover:border-gray-400'}`}
                    >
                      {m.type === 'image' ? (
                        <img src={(m as any).preview_url || m.url} alt={m.title || 'material'} className="w-full h-28 object-cover" />
                      ) : (
                      <video
                        src={(m as any).preview_url || m.url}
                        className="w-full h-28 object-cover"
                        muted
                        loop
                        playsInline
                        preload="metadata"
                        onMouseEnter={(e) => { try { (e.currentTarget as HTMLVideoElement).play(); } catch {} }}
                        onMouseLeave={(e) => { const v = e.currentTarget as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
                      />
                      )}
                      {selectedId === m.id && (
                        <span className="absolute top-2 right-2 w-6 h-6 bg-teal-600 text-white rounded-sm flex items-center justify-center">✓</span>
                      )}
                      <div className="px-2 py-2 text-xs text-gray-700 truncate">{m.title || `#${m.id}`}</div>
                    </button>
                  ) : (
                    <div className="text-xs text-gray-500">Nothing here yet</div>
                  );
                })()
              )}
            </div>
          </div>
        )}

        {/* controls */}
        <div className="px-5 space-y-3">
          {/* row 1: search + upload */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or ID"
                className="w-full pl-9 pr-3 py-2.5 border rounded-md text-sm"
              />
            </div>
            <button
              onClick={() => setShowUpload(true)}
              className="px-3 py-2 border rounded-md text-sm flex items-center gap-2 hover:bg-gray-50"
            >
              <Upload className="w-4 h-4" /> Upload
            </button>
            <input ref={fileInputRef} type="file" className="hidden" />
          </div>

          {/* row 2: sort + switch */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setShowSortMenu((v) => !v)}
                className="px-3 py-2 border rounded-md text-sm flex items-center gap-2 hover:bg-gray-50"
                aria-haspopup="listbox"
                aria-expanded={showSortMenu}
              >
                Sort by: Creation time ({sortOrder === 'desc' ? 'Most to least' : 'Least to most'})
                <ChevronDown className="w-4 h-4" />
              </button>
              {showSortMenu && (
                <ul
                  role="listbox"
                  className="absolute z-50 mt-1 w-[260px] bg-white border rounded-md shadow-lg overflow-hidden"
                >
                  <li
                    role="option"
                    aria-selected={sortOrder === 'desc'}
                    onClick={() => { setSortOrder('desc'); setShowSortMenu(false); }}
                    className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 ${sortOrder === 'desc' ? 'bg-gray-100' : ''}`}
                  >
                    Creation time (Most to least)
                  </li>
                  <li
                    role="option"
                    aria-selected={sortOrder === 'asc'}
                    onClick={() => { setSortOrder('asc'); setShowSortMenu(false); }}
                    className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 ${sortOrder === 'asc' ? 'bg-gray-100' : ''}`}
                  >
                    Creation time (Least to most)
                  </li>
                </ul>
              )}
            </div>
            <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Showing:</span>
            {forceType ? (
              <span className="text-sm font-medium">{forceType === 'video' ? 'Videos only' : 'Images only'}</span>
            ) : (
              <button
                type="button"
                aria-checked={type === 'image'}
                role="switch"
                onClick={() => setType(type === 'video' ? 'image' : 'video')}
                className="relative w-28 h-10 flex items-center rounded-full border border-gray-300 bg-gray-100 shadow-inner cursor-pointer"
              >
                <span
                  className={`absolute left-1 top-1 bottom-1 w-12 rounded-full bg-white shadow transition-transform duration-200 ${type === 'video' ? 'translate-x-0' : 'translate-x-14'}`}
                />
                <span className={`flex-1 text-center z-10 text-sm font-medium px-2 ${type === 'video' ? 'text-[#3CCED7]' : 'text-gray-500'}`}>Videos</span>
                <span className={`flex-1 text-center z-10 text-sm font-medium px-2 ${type === 'image' ? 'text-[#3CCED7]' : 'text-gray-500'}`}>Images</span>
              </button>
            )}
          </div>
          </div>
        </div>

        {/* Upload drawer */}
        <TiktokUploadDrawer
          isOpen={showUpload}
          onClose={() => setShowUpload(false)}
          accept={type === 'video' ? 'video/*' : 'image/*'}
          onUploadBegin={(items) => {
            setRecentUploads((prev) => ([...items.map((i: any) => ({ id: i.id, name: i.name, type: i.type, progress: 0 })), ...prev]));
          }}
          onUploadProgress={(id, percent) => {
            setRecentUploads(prev => prev.map(u => u.id === id ? { ...u, progress: percent } : u));
          }}
          onUploadDone={(id) => {
            setRecentUploads(prev => prev.map(u => u.id === id ? { ...u, progress: 100, done: true } : u));
            // refresh list so the new item appears in library & recently uploaded
            loadMaterials();
            setShowRecentBanner(true);
          }}
        />

        {/* Recently uploaded below section removed per new requirement */}

        {/* content */}
        <div className="flex-1 px-5 py-10 overflow-y-auto">
          {activeTab === 'posts' ? (
            <div className="h-full flex items-center justify-center text-gray-500 text-sm">
              TikTok posts tab is not available yet.
            </div>
          ) : loading ? (
            <div className="h-full flex items-center justify-center text-gray-500">Loading...</div>
          ) : filteredMaterials.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500">
              <div className="w-28 h-28 bg-gray-100 rounded-xl mb-4" />
              <div>Nothing here yet</div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredMaterials.map((m) => {
                const isSelected = selectedId === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedId(prev => prev === m.id ? null : m.id)}
                    className={`relative text-left rounded-md overflow-hidden border transition-colors ${isSelected ? 'border-teal-600 ring-2 ring-teal-300' : 'border-gray-300 hover:border-gray-400'}`}
                  >
                    {m.type === 'image' ? (
                      <img src={m.url} alt={m.title || 'material'} className="w-full h-36 object-cover" />
                    ) : (
                      <video
                        src={m.url}
                        className="w-full h-36 object-cover"
                        muted
                        loop
                        playsInline
                        preload="metadata"
                        onMouseEnter={(e) => { try { (e.currentTarget as HTMLVideoElement).play(); } catch {} }}
                        onMouseLeave={(e) => { const v = e.currentTarget as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
                      />
                    )}
                    {isSelected && (
                      <span className="absolute top-2 right-2 w-6 h-6 bg-teal-600 text-white rounded-sm flex items-center justify-center">✓</span>
                    )}
                    <div className="px-2 py-2 text-xs text-gray-700 truncate">{m.title || `#${m.id}`}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* footer */}
        <div className="px-5 py-3 border-t flex items-center justify-end">
          <button onClick={onClose} className="px-4 py-2 border rounded-md mr-2">Cancel</button>
          <button
            disabled={selectedId === null}
            onClick={() => {
              const mat = filteredMaterials.find(m => m.id === selectedId) || materials.find(m => m.id === selectedId) || null;
              onConfirm?.(mat);
              onClose();
            }}
            className={`px-4 py-2 rounded-md ${selectedId !== null ? 'bg-[#3CCED7] text-white hover:bg-[#2AB5BD]' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreativeLibraryDrawer;
