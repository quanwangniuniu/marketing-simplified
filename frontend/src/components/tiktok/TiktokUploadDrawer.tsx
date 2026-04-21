'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { X, UploadCloud, CheckCircle2, AlertCircle } from 'lucide-react';
import { uploadTiktokImage, uploadTiktokVideo } from '@/lib/api/tiktokApi';
import TiktokCropImageDrawer from './TiktokCropImageDrawer';

interface TiktokUploadDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  accept?: string;
  onUploadBegin?: (items: Array<{ id: string; name: string; type: 'video'|'image' }>) => void;
  onUploadProgress?: (id: string, percent: number) => void;
  onUploadDone?: (id: string) => void;
  onImageCropped?: (originalFile: File, croppedFile: File, ratio: string) => void;
}

const TiktokUploadDrawer: React.FC<TiktokUploadDrawerProps> = ({ isOpen, onClose, accept = 'video/*,image/*', onUploadBegin, onUploadProgress, onUploadDone, onImageCropped }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [rows, setRows] = useState<Array<{
    id: string;
    file: File;
    type: 'video' | 'image';
    name: string;
    sizeMB: number;
    width?: number;
    height?: number;
    duration?: number;
    analyzing: boolean;
    ready: boolean;
    issues: string[];
    selected: boolean;
  }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropImageFile, setCropImageFile] = useState<File | null>(null);
  const [cropImageFiles, setCropImageFiles] = useState<File[] | null>(null);
  const [cropStartIndex, setCropStartIndex] = useState<number>(0);
  const [showCropDrawer, setShowCropDrawer] = useState(false);

  const handleSelectFiles = () => fileInputRef.current?.click();

  const handleFiles = useCallback((list: FileList | null) => {
    if (!list) return;
    const files = Array.from(list);
    const newRows = files.map((f) => {
      const t: 'image' | 'video' = f.type.startsWith('image') ? 'image' : 'video';
      return {
      id: crypto.randomUUID(),
      file: f,
      type: t,
      name: f.name,
      sizeMB: Math.round((f.size / (1024 * 1024)) * 100) / 100,
      analyzing: true,
      ready: false,
      issues: [],
      selected: true,
    };});
    setRows((prev) => [...prev, ...newRows]);

    // analyze each
    newRows.forEach((r) => analyzeFile(r));
  }, []);

  const analyzeFile = (row: { file: File; type: 'video' | 'image'; id: string; }) => {
    const maxSizeMB = 500;
    const issues: string[] = [];
    const sizeMB = row.file.size / (1024 * 1024);
    if (sizeMB > maxSizeMB) issues.push(`File size exceeds ${maxSizeMB} MB`);

    const setRow = (patch: Partial<typeof row & any> & { issues?: string[]; ready?: boolean; analyzing?: boolean }) => {
      setRows((prev) => prev.map((p) => (p.id === row.id ? { ...p, ...patch } : p)));
    };

    const allowedRatios = [16 / 9, 1 / 1, 9 / 16];

    if (row.type === 'image') {
      const img = new Image();
      const url = URL.createObjectURL(row.file);
      img.onload = () => {
        const ratio = img.width / img.height;
        const within = allowedRatios.some((a) => Math.abs(a - ratio) < 0.05);
        // Don't block images with wrong aspect ratio - allow cropping instead
        // if (!within) issues.push('Aspect ratio should be 16:9, 1:1 or 9:16');
        URL.revokeObjectURL(url);
        setRow({ width: img.width, height: img.height, analyzing: false, ready: true, issues });
      };
      img.onerror = () => {
        issues.push('Failed to read image metadata');
        setRow({ analyzing: false, ready: false, issues });
      };
      img.src = url;
    } else {
      const url = URL.createObjectURL(row.file);
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        const width = (video as any).videoWidth as number;
        const height = (video as any).videoHeight as number;
        const duration = video.duration;
        const ratio = width / height;
        const within = allowedRatios.some((a) => Math.abs(a - ratio) < 0.05);
        if (!within) issues.push('Aspect ratio should be 16:9, 1:1 or 9:16');
        if (!isFinite(duration) || duration <= 0) issues.push('Invalid video duration');
        URL.revokeObjectURL(url);
        setRow({ width, height, duration, analyzing: false, ready: issues.length === 0, issues });
      };
      video.onerror = () => {
        issues.push('Failed to read video metadata');
        setRow({ analyzing: false, ready: false, issues });
      };
      video.src = url;
    }
  };

  const canUpload = useMemo(() => {
    const selected = rows.filter((r) => r.selected);
    return selected.length > 0 && selected.every((r) => r.ready);
  }, [rows]);

  const selectedVideoCount = useMemo(() => rows.filter(r => r.selected && r.type === 'video').length, [rows]);

  const handleDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFiles(e.dataTransfer?.files || null);
  };

  const handleDragOver: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-7xl bg-white shadow-2xl flex flex-col">
        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="text-lg font-semibold">Upload creatives</div>
          <button aria-label="Close" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-md">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* content */}
        <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6">
          {/* drop area */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={handleSelectFiles}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelectFiles(); } }}
            className={`border-2 border-dashed rounded-lg h-72 flex flex-col items-center justify-center text-gray-600 ${
              isDragging ? 'border-[#3CCED7] bg-[#3CCED7]/10' : 'border-gray-300'
            } cursor-pointer select-none`}
            role="button"
            tabIndex={0}
          >
            <UploadCloud className="w-10 h-10 mb-3 text-gray-400" />
            <div className="mb-2">Drop files here, or click to upload</div>
            <input
              ref={fileInputRef}
              type="file"
              accept={accept}
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>

          {/* analysis table */}
          {rows.length > 0 && (
            <div className="border rounded-md overflow-hidden">
              <div className="grid grid-cols-12 bg-gray-50 text-sm text-gray-700 px-4 py-3">
                <div className="col-span-1"></div>
                <div className="col-span-5">File name</div>
                <div className="col-span-2">Placement requirement check</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-2">Issues to resolve</div>
              </div>
              <div>
                {rows.map((r) => (
                  <div key={r.id} className="grid grid-cols-12 items-center px-4 py-3 border-t text-sm">
                    <div className="col-span-1">
                      <input
                        type="checkbox"
                        checked={r.selected}
                        disabled={!r.ready || (!r.selected && r.type === 'video' && selectedVideoCount >= 1)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setRows((prev) => prev.map((p) => {
                            if (p.id !== r.id) {
                              // if selecting a video, ensure only one video selected
                              if (checked && r.type === 'video' && p.type === 'video') {
                                return { ...p, selected: false };
                              }
                              return p;
                            }
                            return { ...p, selected: checked };
                          }));
                        }}
                      />
                    </div>
                    <div className="col-span-5">
                      <div className="font-medium text-gray-900 truncate">{r.name}</div>
                      <div className="text-xs text-gray-500">
                        {r.duration ? `${Math.round(r.duration)}s | ` : ''}
                        {r.width && r.height ? `${r.width}×${r.height} | ` : ''}
                        {`${r.sizeMB} MB`}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <div className="w-5 h-5 rounded bg-black flex items-center justify-center text-white text-xs">t</div>
                    </div>
                    <div className="col-span-2">
                      {r.analyzing ? (
                        <div className="text-gray-500">Analyzing…</div>
                      ) : r.ready ? (
                        <div className="inline-flex items-center gap-1 text-green-600"><CheckCircle2 className="w-4 h-4" /> Ready to upload</div>
                      ) : (
                        <div className="inline-flex items-center gap-1 text-amber-600"><AlertCircle className="w-4 h-4" /> Needs attention</div>
                      )}
                    </div>
                    <div className="col-span-2 text-xs text-gray-600">
                      {r.issues.length === 0 ? '-' : (
                        <ul className="list-disc list-inside space-y-1">
                          {r.issues.map((msg, idx) => <li key={idx}>{msg}</li>)}
                        </ul>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* guidance */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-50 rounded-md border p-4">
              <div className="font-medium text-gray-900 mb-2">Guidance for videos</div>
              <div className="text-sm text-gray-700 space-y-1">
                <div>
                  <span className="font-medium">Recommended format:</span> .mp4, .mov, .mpeg, or .avi
                </div>
                <div>
                  <span className="font-medium">File Size:</span> 500 MB
                </div>
                <div>
                  <span className="font-medium">Aspect ratio requirements for all placements:</span> Horizontal(16:9) / Square(1:1) / Vertical(9:16)
                </div>
                <button className="text-[#3CCED7] text-sm hover:underline" type="button">
                  View recommended video specs
                </button>
              </div>
            </div>
            <div className="bg-gray-50 rounded-md border p-4">
              <div className="font-medium text-gray-900 mb-2">Guidance for images</div>
              <div className="text-sm text-gray-700 space-y-1">
                <div>
                  <span className="font-medium">File format:</span> .jpg, .jpeg, .png, or .webp
                </div>
                <button className="text-[#3CCED7] text-sm hover:underline" type="button">
                  View recommended image specs
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* footer */}
        <div className="px-6 py-4 border-t flex items-center justify-end">
          <div className="mr-auto text-xs text-gray-600">{rows.filter(r => r.selected).length} item(s) selected</div>
          <button onClick={onClose} className="px-4 py-2 border rounded-md mr-2">Cancel</button>
          <button
            disabled={!canUpload}
            onClick={async () => {
              const selected = rows.filter(r => r.selected && r.ready);
              if (selected.length === 0) return;
              
              // Check if any selected items are images that need cropping
              const imagesToCrop = selected.filter(r => r.type === 'image');
              if (imagesToCrop.length > 0) {
                // open cropper with all selected images
                setCropImageFiles(imagesToCrop.map(i => i.file));
                setCropStartIndex(0);
                setCropImageFile(imagesToCrop[0].file);
                setShowCropDrawer(true);
                return;
              }
              
              onUploadBegin?.(selected.map(s => ({ id: s.id, name: s.name, type: s.type })));
              for (const r of selected) {
                try {
                  if (r.type === 'image') {
                    await uploadTiktokImage(r.file, (p) => onUploadProgress?.(r.id, Math.min(100, Math.round(p.percent || 0))));
                  } else {
                    await uploadTiktokVideo(r.file, (p) => onUploadProgress?.(r.id, Math.min(100, Math.round(p.percent || 0))));
                  }
                  onUploadDone?.(r.id);
                } catch (e) {
                  // failed upload marks as issue
                }
              }
              onClose();
            }}
            className={`px-4 py-2 rounded-md ${canUpload ? 'bg-[#3CCED7] text-white hover:bg-[#2AB5BD]' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
          >
            Upload
          </button>
        </div>
        
        {/* Crop Image Drawer */}
        <TiktokCropImageDrawer
          isOpen={showCropDrawer}
          onClose={() => setShowCropDrawer(false)}
          imageFile={cropImageFile || undefined}
          imageFiles={cropImageFiles || undefined}
          initialIndex={cropStartIndex}
          onConfirm={(croppedFile, ratio, index) => {
            const original = cropImageFiles && typeof index === 'number' ? cropImageFiles[index] : cropImageFile;
            if (original) onImageCropped?.(original, croppedFile, ratio);
            setShowCropDrawer(false);
            setCropImageFile(null);
            setCropImageFiles(null);
            // Synthesize recently-uploaded banner in library by using the existing callbacks
            try {
              const fakeId = crypto.randomUUID();
              onUploadBegin?.([{ id: fakeId, name: croppedFile.name, type: 'image' } as any]);
              onUploadDone?.(fakeId);
            } catch {}
            // Close upload drawer and return to the library drawer beneath
            try { onClose(); } catch {}
          }}
        />
      </div>
    </div>
  );
};

export default TiktokUploadDrawer;


