'use client';

import React, { useEffect, useState } from 'react';
import { X, Search, ChevronDown, Upload } from 'lucide-react';
import { klaviyoImageApi, KlaviyoImageItem } from '@/lib/api/klaviyoApi';
import KlaviyoImageUploadDropzone from './KlaviyoImageUploadDropzone';

interface KlaviyoImageSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (image: KlaviyoImageItem) => void;
}

const KlaviyoImageSelectionModal: React.FC<KlaviyoImageSelectionModalProps> = ({
  isOpen,
  onClose,
  onSelect,
}) => {
  const [activeTab, setActiveTab] = useState<'library' | 'upload' | 'import-url'>('library');
  const [images, setImages] = useState<KlaviyoImageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<Array<{ file: File; progress: number; done?: boolean }>>([]);
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);

  const loadImages = async () => {
    try {
      setLoading(true);
      const res = await klaviyoImageApi.getImages({ search, sort: sortOrder });
      const list = res.results || [];
      setImages(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    if (activeTab !== 'library') return;
    loadImages();
  }, [isOpen, activeTab, search, sortOrder]);

  useEffect(() => {
    if (!showSortMenu) return;
    const onDocClick = () => setShowSortMenu(false);
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [showSortMenu]);

  const normalized = search.trim().toLowerCase();
  const filteredImages = !normalized
    ? images
    : images.filter((img) => {
        const name = (img.name || '').toString().trim().toLowerCase();
        const idStr = String(img.id || '').toLowerCase();
        return name.includes(normalized) || idStr.startsWith(normalized);
      });

  const handleFilesSelected = async (files: File[]) => {
    setUploadingFiles(files.map((f) => ({ file: f, progress: 0 })));
    for (const file of files) {
      try {
        await klaviyoImageApi.uploadImage(file, (percent) => {
          setUploadingFiles((prev) =>
            prev.map((u) => (u.file === file ? { ...u, progress: percent } : u))
          );
        });
        setUploadingFiles((prev) =>
          prev.map((u) => (u.file === file ? { ...u, progress: 100, done: true } : u))
        );
        await loadImages();
        setActiveTab('library');
      } catch (error) {
        console.error('Upload failed:', error);
        setUploadingFiles((prev) => prev.filter((u) => u.file !== file));
      }
    }
  };

  const handleImportUrl = async () => {
    if (!importUrl.trim()) return;
    try {
      setImporting(true);
      await klaviyoImageApi.importImageFromUrl(importUrl.trim());
      await loadImages();
      setImportUrl('');
      setActiveTab('library');
    } catch (error) {
      console.error('Import failed:', error);
      alert('Failed to import image from URL');
    } finally {
      setImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="absolute right-0 top-0 h-full w-full max-w-6xl bg-white shadow-xl flex flex-col">
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="text-lg font-semibold">Select image</div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-md" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* tabs */}
        <div className="px-5 pt-3">
          <div className="flex items-center gap-6 border-b">
            <button
              className={`pb-3 text-sm ${
                activeTab === 'library'
                  ? 'border-b-2 border-[#3CCED7] text-[#3CCED7]'
                  : 'text-gray-500'
              }`}
              onClick={() => setActiveTab('library')}
            >
              Image library
            </button>
            <button
              className={`pb-3 text-sm ${
                activeTab === 'upload'
                  ? 'border-b-2 border-[#3CCED7] text-[#3CCED7]'
                  : 'text-gray-500'
              }`}
              onClick={() => setActiveTab('upload')}
            >
              Upload image
            </button>
            <button
              className={`pb-3 text-sm ${
                activeTab === 'import-url'
                  ? 'border-b-2 border-[#3CCED7] text-[#3CCED7]'
                  : 'text-gray-500'
              }`}
              onClick={() => setActiveTab('import-url')}
            >
              Import URL
            </button>
          </div>
        </div>

        {/* controls - only show for library tab */}
        {activeTab === 'library' && (
          <div className="px-5 space-y-3 pt-3">
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
                      onClick={() => {
                        setSortOrder('desc');
                        setShowSortMenu(false);
                      }}
                      className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 ${
                        sortOrder === 'desc' ? 'bg-gray-100' : ''
                      }`}
                    >
                      Creation time (Most to least)
                    </li>
                    <li
                      role="option"
                      aria-selected={sortOrder === 'asc'}
                      onClick={() => {
                        setSortOrder('asc');
                        setShowSortMenu(false);
                      }}
                      className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 ${
                        sortOrder === 'asc' ? 'bg-gray-100' : ''
                      }`}
                    >
                      Creation time (Least to most)
                    </li>
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {/* content */}
        <div className="flex-1 px-5 py-10 overflow-y-auto">
          {activeTab === 'library' ? (
            loading ? (
              <div className="h-full flex items-center justify-center text-gray-500">Loading...</div>
            ) : filteredImages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500">
                <div className="w-28 h-28 bg-gray-100 rounded-xl mb-4" />
                <div>Nothing here yet</div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredImages.map((img) => {
                  const isSelected = selectedId === img.id;
                  return (
                    <button
                      key={img.id}
                      onClick={() => setSelectedId(img.id)}
                      className={`relative text-left rounded-md overflow-hidden border transition-colors ${
                        isSelected
                          ? 'border-teal-600 ring-2 ring-teal-300'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <img
                        src={img.preview_url}
                        alt={img.name || 'image'}
                        className="w-full h-36 object-cover"
                      />
                      {isSelected && (
                        <span className="absolute top-2 right-2 w-6 h-6 bg-teal-600 text-white rounded-sm flex items-center justify-center">
                          ✓
                        </span>
                      )}
                      <div className="px-2 py-2 text-xs text-gray-700 truncate">
                        {img.name || `#${img.id}`}
                      </div>
                    </button>
                  );
                })}
              </div>
            )
          ) : activeTab === 'upload' ? (
            <div className="space-y-4">
              <KlaviyoImageUploadDropzone onFilesSelected={handleFilesSelected} />
              {uploadingFiles.length > 0 && (
                <div className="space-y-2">
                  {uploadingFiles.map((upload, idx) => (
                    <div key={idx} className="border rounded-md p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-medium truncate">{upload.file.name}</div>
                        <div className="text-xs text-gray-500">
                          {upload.done ? 'Complete' : `${upload.progress}%`}
                        </div>
                      </div>
                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-teal-600 transition-all"
                          style={{ width: `${upload.progress}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="max-w-md mx-auto space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Image URL</label>
                <input
                  type="url"
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  placeholder="http://website.com/image.jpg"
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleImportUrl();
                    }
                  }}
                />
              </div>
              <button
                onClick={handleImportUrl}
                disabled={!importUrl.trim() || importing}
                className="w-full px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {importing ? 'Importing...' : 'Import image'}
              </button>
            </div>
          )}
        </div>

        {/* footer */}
        <div className="px-5 py-3 border-t flex items-center justify-end">
          <button onClick={onClose} className="px-4 py-2 border rounded-md mr-2">
            Cancel
          </button>
          {activeTab === 'library' && (
            <button
              disabled={selectedId === null}
              onClick={() => {
                const img = filteredImages.find((i) => i.id === selectedId);
                if (img) {
                  onSelect(img);
                  onClose();
                }
              }}
              className={`px-4 py-2 rounded-md ${
                selectedId !== null
                  ? 'bg-[#3CCED7] text-white hover:bg-[#2AB5BD]'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              Confirm
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default KlaviyoImageSelectionModal;

