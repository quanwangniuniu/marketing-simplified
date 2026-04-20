'use client';

import { useEffect, useState } from 'react';
import { Calendar, CheckCircle2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { googleCalendarApi, GoogleCalendarStatus } from '@/lib/api/googleCalendarApi';

interface GoogleCalendarIntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const emptyStatus: GoogleCalendarStatus = {
  connected: false,
  needs_reconnect: false,
};

export default function GoogleCalendarIntegrationModal({
  isOpen,
  onClose,
}: GoogleCalendarIntegrationModalProps) {
  const [status, setStatus] = useState<GoogleCalendarStatus>(emptyStatus);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const loadStatus = () => {
    setLoading(true);
    googleCalendarApi
      .getStatus()
      .then((next) => setStatus(next))
      .catch(() => setStatus(emptyStatus))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!isOpen) return;
    loadStatus();
  }, [isOpen]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { auth_url } = await googleCalendarApi.connect();
      window.location.href = auth_url;
    } catch (error: unknown) {
      const apiError = (error as { response?: { data?: Record<string, unknown> } })?.response?.data;
      const missingSettings = apiError?.details as string[] | undefined;
      if (Array.isArray(missingSettings) && missingSettings.length > 0) {
        toast.error(`Missing config: ${missingSettings.join(', ')}`);
      } else {
        toast.error((apiError?.error as string) || 'Failed to start Google Calendar connection.');
      }
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await googleCalendarApi.disconnect();
      setStatus(emptyStatus);
      toast.success('Google Calendar disconnected.');
    } catch {
      toast.error('Failed to disconnect Google Calendar.');
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            Google Calendar
          </DialogTitle>
          <DialogDescription>
            Connect Google Calendar to import events and sync your primary platform calendar to Google.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          ) : status.connected ? (
            <div className="space-y-4">
              <div
                className={`flex items-center gap-3 rounded-lg border p-4 ${
                  status.needs_reconnect
                    ? 'border-amber-200 bg-amber-50'
                    : 'border-green-200 bg-green-50'
                }`}
              >
                <CheckCircle2
                  className={`h-5 w-5 shrink-0 ${status.needs_reconnect ? 'text-amber-600' : 'text-green-600'}`}
                />
                <div>
                  <p
                    className={`text-sm font-medium ${status.needs_reconnect ? 'text-amber-900' : 'text-green-900'}`}
                  >
                    {status.needs_reconnect ? 'Reconnect required' : 'Google Calendar connected'}
                  </p>
                  <p
                    className={`text-xs ${status.needs_reconnect ? 'text-amber-800' : 'text-green-700'}`}
                  >
                    {status.google_email ? `Connected as ${status.google_email}` : 'Connection is active.'}
                  </p>
                  {status.last_error_message ? (
                    <p className="mt-1 text-xs text-red-700">{status.last_error_message}</p>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
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
                  'Disconnect Google Calendar'
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Authorize Google Calendar to import events into your workspace calendar and push events from your
                primary calendar to Google.
              </p>
              <button
                type="button"
                onClick={handleConnect}
                disabled={connecting}
                className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {connecting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Redirecting to Google...
                  </span>
                ) : (
                  'Connect Google Calendar'
                )}
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
