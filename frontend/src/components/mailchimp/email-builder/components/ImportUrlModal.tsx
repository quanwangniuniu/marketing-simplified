"use client";
import React from "react";
import { X } from "lucide-react";
import { UploadedFile } from "../types";

interface ImportUrlModalProps {
  isImportUrlModalOpen: boolean;
  setIsImportUrlModalOpen: (open: boolean) => void;
  importUrl: string;
  setImportUrl: (url: string) => void;
  isImporting: boolean;
  setIsImporting: (importing: boolean) => void;
  importError: string | null;
  setImportError: (error: string | null) => void;
  setUploadedFiles: React.Dispatch<React.SetStateAction<UploadedFile[]>>;
}

const ImportUrlModal: React.FC<ImportUrlModalProps> = ({
  isImportUrlModalOpen,
  setIsImportUrlModalOpen,
  importUrl,
  setImportUrl,
  isImporting,
  setIsImporting,
  importError,
  setImportError,
  setUploadedFiles,
}) => {
  if (!isImportUrlModalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
      onClick={() => {
        setIsImportUrlModalOpen(false);
        setImportUrl("");
        setImportError(null);
      }}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-3xl mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Import URL</h3>
          <button
            onClick={() => {
              setIsImportUrlModalOpen(false);
              setImportUrl("");
              setImportError(null);
            }}
            className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 bg-gray-50 hover:bg-gray-100 transition-colors"
            disabled={isImporting}
          >
            <X className="h-4 w-4 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Import a file from a URL:
            </label>
            <input
              type="url"
              value={importUrl}
              onChange={(e) => {
                setImportUrl(e.target.value);
                setImportError(null);
              }}
              placeholder="https://example.com/image.jpg"
              className={`w-full px-4 py-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-transparent ${
                importError ? "border-red-300" : "border-gray-300"
              }`}
              autoFocus
              disabled={isImporting}
            />
            {importError && (
              <p className="text-sm text-red-600 mt-2">{importError}</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button
            onClick={() => {
              setIsImportUrlModalOpen(false);
              setImportUrl("");
              setImportError(null);
            }}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            disabled={isImporting}
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              const url = importUrl.trim();
              if (!url) return;

              setIsImporting(true);
              setImportError(null);

              try {
                // Validate URL format
                const urlObj = new URL(url);

                // Check if it's likely an image URL
                const imageExtensions = [
                  ".jpg",
                  ".jpeg",
                  ".png",
                  ".gif",
                  ".webp",
                  ".svg",
                  ".bmp",
                ];
                const pathname = urlObj.pathname.toLowerCase();
                const isImageUrl =
                  imageExtensions.some((ext) => pathname.endsWith(ext)) ||
                  urlObj.searchParams.has("format") ||
                  url.includes("image");

                if (!isImageUrl) {
                  // Still try to load it as it might be an image without extension
                }

                // Try to load the image to verify it's accessible
                const img = document.createElement("img") as HTMLImageElement;
                img.crossOrigin = "anonymous";

                await new Promise((resolve, reject) => {
                  img.onload = () => resolve(img);
                  img.onerror = () =>
                    reject(new Error("Failed to load image from URL"));
                  img.src = url;
                });

                // Extract filename from URL
                const filename =
                  pathname.split("/").pop() || `image-${Date.now()}`;
                const fileExtension = filename.split(".").pop() || "jpg";
                const fileName = filename.includes(".")
                  ? filename
                  : `${filename}.${fileExtension}`;

                // Add to uploaded files
                const newFile: UploadedFile = {
                  id: `file-${Date.now()}`,
                  url: url,
                  name: fileName,
                  type: `image/${
                    fileExtension === "jpg" ? "jpeg" : fileExtension
                  }`,
                };

                setUploadedFiles((prev) => [newFile, ...prev]);

                // Close modal and reset
                setIsImportUrlModalOpen(false);
                setImportUrl("");
              } catch (error) {
                console.error("Error importing image:", error);
                setImportError(
                  error instanceof Error
                    ? error.message
                    : "Failed to import image. Please check the URL and try again."
                );
              } finally {
                setIsImporting(false);
              }
            }}
            className="px-4 py-2 text-sm font-medium text-white bg-[#3CCED7] rounded-lg hover:bg-[#2AB5BD] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!importUrl.trim() || isImporting}
          >
            {isImporting ? "Importing..." : "Import"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportUrlModal;

