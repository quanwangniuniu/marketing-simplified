'use client';

import React, { useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';

interface KlaviyoImageUploadDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string;
  maxSizeMB?: number;
}

const KlaviyoImageUploadDropzone: React.FC<KlaviyoImageUploadDropzoneProps> = ({
  onFilesSelected,
  accept = 'image/*',
  maxSizeMB = 10,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSelectFiles = () => fileInputRef.current?.click();

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const fileArray = Array.from(files);
    onFilesSelected(fileArray);
  };

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

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={handleSelectFiles}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleSelectFiles();
        }
      }}
      className={`border-2 border-dashed rounded-lg h-72 flex flex-col items-center justify-center text-gray-600 ${
        isDragging ? 'border-[#3CCED7] bg-[#3CCED7]/10' : 'border-gray-300'
      } cursor-pointer select-none`}
      role="button"
      tabIndex={0}
    >
      <UploadCloud className="w-10 h-10 mb-3 text-gray-400" />
      <div className="mb-2 font-medium">Drag and drop or select image</div>
      <div className="text-sm text-gray-500 text-center px-4">
        Accepts .png, .jpg, .jpeg, .gif, and .webp file types
      </div>
      <div className="text-sm text-gray-500 mt-1">
        Maximum file size {maxSizeMB} MB
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
};

export default KlaviyoImageUploadDropzone;

