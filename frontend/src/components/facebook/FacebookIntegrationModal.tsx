'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Facebook, Loader2, RefreshCcw } from 'lucide-react';
import toast from 'react-hot-toast';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { facebookApi, type FacebookStatus } from '@/lib/api/facebookApi';

interface FacebookIntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FacebookIntegrationModal({
  isOpen,
  onClose,
}: FacebookIntegrationModalProps) {
  const [status, setStatus] = useState<FacebookStatus>({ connected: false });
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    facebookApi
      .getStatus()
      .then((next) => setStatus(next))
      .catch(() => setStatus({ connected: false }))
      .finally(() => setLoading(false));
  }, [isOpen]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { authorize_url } = await facebookApi.connect();
      window.location.href = authorize_url;
    } catch (error: any) {
      toast.error(
        error?.response?.data?.detail || 'Failed to start Facebook connection.'
      );
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await facebookApi.disconnect();
      setStatus({ connected: false });
      toast.success('Meta disconnected.');
    } catch {
      toast.error('Failed to disconnect Meta.');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleRefresh = async () => {
    setSyncing(true);
    try {
      const next = await facebookApi.sync();
      setStatus(next);
      toast.success('Refreshed ad accounts from Meta.');
    } catch {
      toast.error('Refresh failed. Token may have expired.');
    } finally {
      setSyncing(false);
    }
  };

  const adAccounts = status.ad_accounts ?? [];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Facebook className="h-5 w-5 text-[#1877F2]" />
            Meta / Facebook Integration
          </DialogTitle>
          <DialogDescription>
            Connect your Meta business account to pull campaign, ad, and insight data into MediaJira.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-[#3CCED7]" />
            </div>
          ) : status.connected ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-green-900">
                    {status.business_name
                      ? `Connected · ${status.business_name}`
                      : 'Meta connected'}
                  </p>
                  <p className="mt-0.5 text-xs text-green-700">
                    {status.fb_user_name
                      ? `Authorized as ${status.fb_user_name}`
                      : 'Connection is active.'}
                  </p>
                  {status.token_expires_at && (
                    <p className="mt-0.5 text-[11px] text-green-600/80">
                      Token expires {new Date(status.token_expires_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>

              {adAccounts.length > 0 && (
                <div className="rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50">
                    <span className="text-xs font-semibold text-gray-700">
                      Accessible ad accounts ({adAccounts.length})
                    </span>
                    <button
                      onClick={handleRefresh}
                      disabled={syncing}
                      className="flex items-center gap-1 text-[11px] text-[#1a9ba3] hover:text-[#3CCED7] disabled:opacity-50"
                    >
                      {syncing ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCcw className="h-3 w-3" />
                      )}
                      Refresh
                    </button>
                  </div>
                  <ul className="divide-y divide-gray-100 max-h-60 overflow-y-auto">
                    {adAccounts.map((a) => (
                      <li key={a.id} className="px-3 py-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium text-gray-900">
                              {a.name || `act_${a.meta_account_id}`}
                            </div>
                            <div className="truncate text-[11px] text-gray-500">
                              {a.meta_account_id} · {a.currency || '—'} · {a.timezone_name || '—'}
                            </div>
                          </div>
                          {a.is_owned && (
                            <span className="shrink-0 rounded-full bg-[#3CCED7]/10 px-2 py-0.5 text-[10px] font-medium text-[#1a9ba3]">
                              owned
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

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
                  'Disconnect Meta'
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                You will be redirected to Facebook to choose which business and ad accounts to authorize. This uses Meta&apos;s official Business Login.
              </p>
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="w-full rounded-lg bg-gradient-to-r from-[#3CCED7] to-[#A6E661] px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-95 disabled:opacity-50"
              >
                {connecting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Redirecting to Facebook...
                  </span>
                ) : (
                  'Connect with Meta'
                )}
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
