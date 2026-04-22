"use client";

import { AlertTriangle, Info, Trash2, XCircle } from "lucide-react";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  type?: "warning" | "danger" | "info";
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  type = "warning",
  confirmText = "OK",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const iconMap = {
    warning: <AlertTriangle className="h-6 w-6 text-yellow-600" />,
    danger: <Trash2 className="h-6 w-6 text-red-600" />,
    info: <Info className="h-6 w-6 text-[#3CCED7]" />,
  };

  const buttonColorMap = {
    warning: "bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500",
    danger: "bg-red-600 hover:bg-red-700 focus:ring-red-500",
    info: "bg-[#3CCED7] hover:bg-[#2AB5BD] focus:ring-[#3CCED7]",
  };

  const bgColorMap = {
    warning: "bg-yellow-50",
    danger: "bg-red-50",
    info: "bg-[#3CCED7]/10",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="bg-white rounded-lg overflow-hidden shadow-xl w-full max-w-md mx-4 animate-in fade-in zoom-in duration-200">
        {/* Icon and Title */}
        <div className={`flex items-start gap-4 px-6 py-5 ${bgColorMap[type]} border-b`}>
          <div className="flex-shrink-0 mt-0.5">
            {iconMap[type]}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">
              {title}
            </h3>
          </div>
          <button
            onClick={onCancel}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        {/* Message */}
        <div className="px-6 py-4">
          <p className="text-sm text-gray-600 leading-relaxed">
            {message}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 border-t">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${buttonColorMap[type]}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
