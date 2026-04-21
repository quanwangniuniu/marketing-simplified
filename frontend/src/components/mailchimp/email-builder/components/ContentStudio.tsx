"use client";
import React from "react";
import Image from "next/image";
import {
  X,
  Cloud,
  Search,
  Upload,
  ChevronDown,
  Info,
  Grid,
  List,
  Check,
} from "lucide-react";
import { Image as ImageIcon } from "lucide-react";
import { CanvasBlock, UploadedFile, SelectedFileInStudio, SelectedBlock } from "../types";

interface ContentStudioProps {
  isContentStudioOpen: boolean;
  setIsContentStudioOpen: (open: boolean) => void;
  contentStudioSource: "Uploads" | "Stock images" | "My products" | "Instagram" | "Giphy" | "Canva";
  setContentStudioSource: (source: "Uploads" | "Stock images" | "My products" | "Instagram" | "Giphy" | "Canva") => void;
  contentStudioViewMode: "grid" | "list";
  setContentStudioViewMode: (mode: "grid" | "list") => void;
  isUploadDropdownOpen: boolean;
  setIsUploadDropdownOpen: (open: boolean) => void;
  setIsImportUrlModalOpen: (open: boolean) => void;
  uploadedFiles: UploadedFile[];
  selectedFileInStudio: SelectedFileInStudio | null;
  setSelectedFileInStudio: (file: SelectedFileInStudio | null) => void;
  selectedBlock: SelectedBlock | null;
  isImageBlockSelected: boolean;
  isLogoBlockSelected: boolean;
  setCanvasBlocks: React.Dispatch<React.SetStateAction<{
    header: CanvasBlock[];
    body: CanvasBlock[];
    footer: CanvasBlock[];
  }>>;
  uploadDropdownRef: React.RefObject<HTMLDivElement>;
}

const ContentStudio: React.FC<ContentStudioProps> = ({
  isContentStudioOpen,
  setIsContentStudioOpen,
  contentStudioSource,
  setContentStudioSource,
  contentStudioViewMode,
  setContentStudioViewMode,
  isUploadDropdownOpen,
  setIsUploadDropdownOpen,
  setIsImportUrlModalOpen,
  uploadedFiles,
  selectedFileInStudio,
  setSelectedFileInStudio,
  selectedBlock,
  isImageBlockSelected,
  isLogoBlockSelected,
  setCanvasBlocks,
  uploadDropdownRef,
}) => {
  if (!isContentStudioOpen) return null;

  const contentSources = [
    {
      key: "Uploads" as const,
      label: "Uploads",
      icon: Cloud,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/40"
      onClick={() => setIsContentStudioOpen(false)}
    >
      <div
        className="mt-auto bg-white rounded-t-3xl shadow-2xl border-t border-gray-200 h-[95vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 flex-shrink-0">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Content Studio
            </h2>
            <p className="text-sm text-gray-500">
              Manage and upload images for your email
            </p>
          </div>
          <button
            onClick={() => setIsContentStudioOpen(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Left Sidebar */}
          <div className="w-64 border-r border-gray-200 bg-gray-50 flex flex-col flex-shrink-0">
            <div className="flex-1 overflow-y-auto py-4">
              {contentSources.map((source) => {
                const Icon = source.icon;
                const isActive = contentStudioSource === source.key;
                return (
                  <button
                    key={source.key}
                    onClick={() => setContentStudioSource(source.key)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                      isActive
                        ? "bg-white text-[#1a9ba3] border-r-2 border-[#2AB5BD]"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="flex-1 text-sm font-medium">
                      {source.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Content Area */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Top Toolbar */}
            <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0 space-y-4">
              <div className="flex items-center gap-4">
                {/* Search */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search files"
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7]"
                  />
                </div>

                {/* Upload Button with Dropdown */}
                <div className="relative" ref={uploadDropdownRef}>
                  <div className="inline-flex items-center rounded-lg overflow-hidden bg-[#3CCED7]">
                    <button
                      onClick={() => {
                        setIsUploadDropdownOpen(false);
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#3CCED7] text-white text-sm font-medium hover:bg-[#2AB5BD] transition-colors"
                    >
                      <Upload className="h-4 w-4" />
                      Upload
                    </button>
                    <button
                      onClick={() =>
                        setIsUploadDropdownOpen(!isUploadDropdownOpen)
                      }
                      className="px-2 py-2 bg-[#3CCED7] text-white hover:bg-[#2AB5BD] transition-colors border-l border-[#2AB5BD]"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Dropdown Menu */}
                  {isUploadDropdownOpen && (
                    <div className="absolute right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[180px] z-50 overflow-hidden">
                      <button
                        onClick={() => {
                          setIsUploadDropdownOpen(false);
                          setIsImportUrlModalOpen(true);
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        Import from URL
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Info Banner */}
              <div className="flex items-start gap-2 p-3 bg-[#3CCED7]/10 border border-[#3CCED7]/30 rounded-lg">
                <Info className="h-4 w-4 text-[#3CCED7] flex-shrink-0 mt-0.5" />
                <p className="text-xs text-[#1a9ba3]">
                  Any file uploaded to Mailchimp&apos;s Content Studio can be
                  accessed by anyone with the link. Do not upload sensitive or
                  private information.
                </p>
              </div>

              {/* Filters and View */}
              <div className="flex items-center gap-4">
                <select className="border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7]">
                  <option>Filter</option>
                </select>
                <select className="border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7]">
                  <option>Folder</option>
                </select>
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-sm text-gray-600">Sort by</span>
                  <select className="border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7]">
                    <option>Newest first</option>
                    <option>Oldest first</option>
                    <option>Name A-Z</option>
                    <option>Name Z-A</option>
                  </select>
                </div>
                <div className="flex items-center border border-gray-200 rounded-md overflow-hidden">
                  <button
                    onClick={() => setContentStudioViewMode("grid")}
                    className={`p-2 ${
                      contentStudioViewMode === "grid"
                        ? "bg-gray-100 text-gray-900"
                        : "text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    <Grid className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setContentStudioViewMode("list")}
                    className={`p-2 border-l border-gray-200 ${
                      contentStudioViewMode === "list"
                        ? "bg-gray-100 text-gray-900"
                        : "text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    <List className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* File Display Area */}
            <div className="flex-1 overflow-y-auto p-6">
              {uploadedFiles.length === 0 ? (
                contentStudioViewMode === "grid" ? (
                  <div className="grid grid-cols-4 gap-4">
                    <div className="aspect-square bg-gray-100 border border-gray-200 rounded-lg flex items-center justify-center cursor-pointer hover:border-[#3CCED7] transition-colors">
                      <div className="text-center">
                        <div className="h-16 w-16 mx-auto border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center mb-2">
                          <ImageIcon className="h-8 w-8 text-gray-400" />
                        </div>
                        <p className="text-xs text-gray-500">No files yet</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <div className="w-16 h-16 bg-gray-100 border border-gray-200 rounded flex items-center justify-center flex-shrink-0">
                        <ImageIcon className="h-8 w-8 text-gray-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          No files yet
                        </p>
                        <p className="text-xs text-gray-500">
                          Upload your first file
                        </p>
                      </div>
                    </div>
                  </div>
                )
              ) : contentStudioViewMode === "grid" ? (
                <div className="grid grid-cols-4 gap-4">
                  {uploadedFiles.map((file) => {
                    const isSelected = selectedFileInStudio?.id === file.id;
                    return (
                      <div
                        key={file.id}
                        onClick={() => {
                          setSelectedFileInStudio({
                            id: file.id,
                            url: file.url,
                            name: file.name,
                          });

                          if (selectedBlock && (isImageBlockSelected || isLogoBlockSelected)) {
                            setCanvasBlocks((prev) => {
                              const sectionBlocks = [
                                ...prev[
                                  selectedBlock.section as keyof typeof prev
                                ],
                              ];
                              const blockIndex = sectionBlocks.findIndex(
                                (b) => b.id === selectedBlock.id
                              );
                              if (blockIndex !== -1) {
                                sectionBlocks[blockIndex] = {
                                  ...sectionBlocks[blockIndex],
                                  imageUrl: file.url,
                                };
                                return {
                                  ...prev,
                                  [selectedBlock.section]: sectionBlocks,
                                };
                              }
                              return prev;
                            });
                            setIsContentStudioOpen(false);
                          }
                        }}
                        className={`aspect-square bg-gray-100 border rounded-lg overflow-hidden cursor-pointer hover:border-[#3CCED7] transition-colors group relative ${
                          isSelected
                            ? "border-[#3CCED7] border-2"
                            : "border-gray-200"
                        }`}
                      >
                        <Image
                          src={file.url}
                          alt={file.name}
                          fill
                          className="object-cover"
                          unoptimized
                          onError={() => {}}
                        />
                        {isSelected && (
                          <div className="absolute top-2 right-2 bg-[#3CCED7] rounded-full p-1">
                            <Check className="h-4 w-4 text-white" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <span className="text-white text-xs font-medium bg-black/50 px-2 py-1 rounded">
                            {file.name}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2">
                  {uploadedFiles.map((file) => {
                    const isSelected = selectedFileInStudio?.id === file.id;
                    return (
                      <div
                        key={file.id}
                        onClick={() => {
                          setSelectedFileInStudio({
                            id: file.id,
                            url: file.url,
                            name: file.name,
                          });

                          if (selectedBlock && (isImageBlockSelected || isLogoBlockSelected)) {
                            setCanvasBlocks((prev) => {
                              const sectionBlocks = [
                                ...prev[
                                  selectedBlock.section as keyof typeof prev
                                ],
                              ];
                              const blockIndex = sectionBlocks.findIndex(
                                (b) => b.id === selectedBlock.id
                              );
                              if (blockIndex !== -1) {
                                sectionBlocks[blockIndex] = {
                                  ...sectionBlocks[blockIndex],
                                  imageUrl: file.url,
                                };
                                return {
                                  ...prev,
                                  [selectedBlock.section]: sectionBlocks,
                                };
                              }
                              return prev;
                            });
                            setIsContentStudioOpen(false);
                          }
                        }}
                        className={`flex items-center gap-4 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors ${
                          isSelected
                            ? "border-[#3CCED7] bg-[#3CCED7]/10"
                            : "border-gray-200"
                        }`}
                      >
                        <div className="w-16 h-16 bg-gray-100 border border-gray-200 rounded flex items-center justify-center flex-shrink-0 overflow-hidden relative">
                          <Image
                            src={file.url}
                            alt={file.name}
                            fill
                            className="object-cover"
                            unoptimized
                            onError={() => {}}
                          />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {file.name}
                          </p>
                          <p className="text-xs text-gray-500">{file.type}</p>
                        </div>
                        {isSelected && (
                          <Check className="h-5 w-5 text-[#3CCED7]" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContentStudio;

