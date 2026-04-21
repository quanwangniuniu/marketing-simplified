'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Video } from 'lucide-react';
import toast from 'react-hot-toast';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { zoomApi } from '@/lib/api/zoomApi';

interface ZoomIntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ZoomIntegrationModal({ isOpen, onClose }: ZoomIntegrationModalProps) {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    zoomApi
      .getStatus()
      .then((s) => setConnected(s.connected))
      .catch(() => setConnected(false))
      .finally(() => setLoading(false));
  }, [isOpen]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { auth_url } = await zoomApi.connect();
      window.location.href = auth_url;
    } catch {
      toast.error('Failed to initiate Zoom connection. Please try again.');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await zoomApi.disconnect();
      setConnected(false);
      toast.success('Zoom account disconnected.');
    } catch {
      toast.error('Failed to disconnect Zoom. Please try again.');
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-[#3CCED7]" />
            Zoom Integration
          </DialogTitle>
          <DialogDescription>
            Connect your Zoom account to create meetings directly from the platform.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-[#3CCED7]" />
            </div>
          ) : connected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-green-900">Zoom account connected</p>
                  <p className="text-xs text-green-700">
                    You can now create Zoom meetings from meeting panels.
                  </p>
                </div>
              </div>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="w-full rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
              >
                {disconnecting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Disconnecting…
                  </span>
                ) : (
                  'Disconnect Zoom'
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Link your Zoom account to schedule and create meetings without leaving the platform.
              </p>
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="w-full rounded-lg bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-95 disabled:opacity-50"
              >
                {connecting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Redirecting to Zoom…
                  </span>
                ) : (
                  'Connect Zoom'
                )}
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
