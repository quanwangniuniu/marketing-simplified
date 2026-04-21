'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, FileText, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { googleDocsApi } from '@/lib/api/googleDocsApi';

interface GoogleDocsIntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GoogleDocsIntegrationModal({
  isOpen,
  onClose,
}: GoogleDocsIntegrationModalProps) {
  const [status, setStatus] = useState<{ connected: boolean; google_email?: string | null }>({
    connected: false,
  });
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    googleDocsApi
      .getStatus()
      .then((next) => setStatus(next))
      .catch(() => setStatus({ connected: false }))
      .finally(() => setLoading(false));
  }, [isOpen]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { auth_url } = await googleDocsApi.connect();
      window.location.href = auth_url;
    } catch (error: any) {
      const apiError = error?.response?.data;
      const missingSettings = apiError?.details?.missing_settings;
      if (Array.isArray(missingSettings) && missingSettings.length > 0) {
        toast.error(`Missing config: ${missingSettings.join(', ')}`);
      } else {
        toast.error(apiError?.error || 'Failed to start Google Docs connection.');
      }
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await googleDocsApi.disconnect();
      setStatus({ connected: false, google_email: null });
      toast.success('Google Docs disconnected.');
    } catch {
      toast.error('Failed to disconnect Google Docs.');
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#3CCED7]" />
            Google Docs Integration
          </DialogTitle>
          <DialogDescription>
            Connect Google Docs so you can import external docs and export decisions.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-[#3CCED7]" />
            </div>
          ) : status.connected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-green-900">Google Docs connected</p>
                  <p className="text-xs text-green-700">
                    {status.google_email ? `Connected as ${status.google_email}` : 'Connection is active.'}
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
                    Disconnecting...
                  </span>
                ) : (
                  'Disconnect Google Docs'
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Connect your Google account to import docs and export decision content.
              </p>
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="w-full rounded-lg bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-95 disabled:opacity-50"
              >
                {connecting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Redirecting to Google...
                  </span>
                ) : (
                  'Connect Google Docs'
                )}
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
