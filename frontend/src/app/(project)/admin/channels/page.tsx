'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Modal from '@/components/ui/Modal';
import {
  supportChannelApi,
  SupportChannel,
  SupportChannelPayload,
  ExperienceGroup,
  DEFAULT_OPERATING_HOURS,
} from '@/lib/api/supportChannelApi';
import { Plus, Pencil, Trash2, Power, PowerOff, MessageSquare, Mail, FileText, AlertCircle, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const CHANNEL_TYPE_LABELS: Record<string, string> = {
  live_chat_widget: 'Live Chat',
  contact_form: 'Contact Form',
  email: 'Email',
};

const CHANNEL_ICONS: Record<string, React.ElementType> = {
  live_chat_widget: MessageSquare,
  contact_form: FileText,
  email: Mail,
};

// ── Operating Hours Editor ────────────────────────────────────────────────────

function OperatingHoursEditor({
  value,
  onChange,
}: {
  value: Record<string, { open: boolean; start: string; end: string }>;
  onChange: (v: Record<string, { open: boolean; start: string; end: string }>) => void;
}) {
  return (
    <div className="space-y-2">
      {DAYS.map((day) => {
        const dayVal = value[day] ?? { open: false, start: '09:00', end: '17:00' };
        return (
          <div key={day} className="flex items-center gap-3">
            <div className="w-24 text-sm capitalize text-gray-600">{day}</div>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={dayVal.open}
                onChange={(e) => onChange({ ...value, [day]: { ...dayVal, open: e.target.checked } })}
                className="accent-indigo-600"
              />
              <span className="text-xs text-gray-500">Open</span>
            </label>
            {dayVal.open && (
              <>
                <input
                  type="time"
                  value={dayVal.start}
                  onChange={(e) => onChange({ ...value, [day]: { ...dayVal, start: e.target.value } })}
                  className="text-xs border border-gray-300 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <span className="text-xs text-gray-400">to</span>
                <input
                  type="time"
                  value={dayVal.end}
                  onChange={(e) => onChange({ ...value, [day]: { ...dayVal, end: e.target.value } })}
                  className="text-xs border border-gray-300 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </>
            )}
            {!dayVal.open && <span className="text-xs text-gray-400 italic">Closed</span>}
          </div>
        );
      })}
    </div>
  );
}

// ── Channel Form ──────────────────────────────────────────────────────────────

interface ChannelFormProps {
  projectId: number;
  experienceGroups: ExperienceGroup[];
  channelTypes: { value: string; label: string }[];
  initial?: SupportChannel | null;
  onClose: () => void;
  onSaved: (channel: SupportChannel) => void;
}

const ChannelForm: React.FC<ChannelFormProps> = ({
  projectId, experienceGroups, channelTypes, initial, onClose, onSaved,
}) => {
  const [name, setName] = useState(initial?.name ?? '');
  const [channelType, setChannelType] = useState(initial?.channel_type ?? channelTypes[0]?.value ?? '');
  const [welcomeMessage, setWelcomeMessage] = useState(initial?.welcome_message ?? '');
  const [offlineMessage, setOfflineMessage] = useState(initial?.offline_fallback_message ?? '');
  const [routingDestination, setRoutingDestination] = useState(initial?.routing_destination ?? '');
  const [operatingHours, setOperatingHours] = useState(
    initial?.operating_hours && Object.keys(initial.operating_hours).length > 0
      ? initial.operating_hours
      : DEFAULT_OPERATING_HOURS
  );
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>(
    initial?.experience_groups?.map((g) => g.id) ?? []
  );
  const [showHours, setShowHours] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const toggleGroup = (id: number) => {
    setSelectedGroupIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setServerError('Display name is required.'); return; }
    if (!channelType) { setServerError('Channel type is required.'); return; }
    setServerError(null);
    setSaving(true);
    try {
      const payload: SupportChannelPayload = {
        name: name.trim(),
        channel_type: channelType,
        welcome_message: welcomeMessage,
        offline_fallback_message: offlineMessage,
        routing_destination: routingDestination,
        operating_hours: operatingHours,
        experience_group_ids: selectedGroupIds,
        project: projectId,
      };
      const saved = initial
        ? await supportChannelApi.updateChannel(initial.id, payload)
        : await supportChannelApi.createChannel(payload);
      onSaved(saved);
    } catch (err: any) {
      setServerError(err?.response?.data?.detail || 'Failed to save channel. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-6">
      {serverError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {serverError}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">
            Display Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Main Live Chat"
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={saving}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">
            Channel Type <span className="text-red-500">*</span>
          </label>
          <select
            value={channelType}
            onChange={(e) => setChannelType(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={saving}
          >
            {channelTypes.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">Welcome Message</label>
        <textarea
          value={welcomeMessage}
          onChange={(e) => setWelcomeMessage(e.target.value)}
          rows={2}
          placeholder="Message shown to customers when they open this channel"
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          disabled={saving}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">Offline Fallback Message</label>
        <textarea
          value={offlineMessage}
          onChange={(e) => setOfflineMessage(e.target.value)}
          rows={2}
          placeholder="Message shown when channel is outside operating hours"
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          disabled={saving}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">Routing Destination</label>
        <input
          type="text"
          value={routingDestination}
          onChange={(e) => setRoutingDestination(e.target.value)}
          placeholder="e.g. Support Team, Tier 1 Queue"
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          disabled={saving}
        />
      </div>

      {/* Operating Hours */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setShowHours((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <span>Operating Hours Schedule</span>
          {showHours ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {showHours && (
          <div className="px-4 py-3">
            <OperatingHoursEditor value={operatingHours} onChange={setOperatingHours} />
          </div>
        )}
      </div>

      {/* Experience Groups */}
      {experienceGroups.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Assign to Experience Groups</label>
          <div className="flex flex-wrap gap-2">
            {experienceGroups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => toggleGroup(g.id)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  selectedGroupIds.includes(g.id)
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
                }`}
              >
                {g.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2 border-t border-gray-200">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : initial ? 'Save Changes' : 'Create Channel'}
        </button>
      </div>
    </form>
  );
};

// ── Active Badge ──────────────────────────────────────────────────────────────

const ActiveBadge: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  const styles = isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500';
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${styles}`}>
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

const ChannelsPage: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = Number(searchParams.get('project'));
  const projectValid = Number.isFinite(projectId) && projectId > 0;

  const [channels, setChannels] = useState<SupportChannel[]>([]);
  const [experienceGroups, setExperienceGroups] = useState<ExperienceGroup[]>([]);
  const [channelTypes, setChannelTypes] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<SupportChannel | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    if (!projectValid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [ch, groups, choices] = await Promise.all([
        supportChannelApi.listChannels({ project_id: projectId }),
        supportChannelApi.listExperienceGroups({ project: projectId }),
        supportChannelApi.getChoices(),
      ]);
      setChannels(ch);
      setExperienceGroups(groups.filter((g) => g.status === 'PUBLISHED'));
      setChannelTypes(choices.channel_types);
    } catch {
      setError('Failed to load support channels. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [projectId, projectValid]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaved = (channel: SupportChannel) => {
    setChannels((prev) => {
      const idx = prev.findIndex((c) => c.id === channel.id);
      return idx >= 0 ? prev.map((c) => (c.id === channel.id ? channel : c)) : [channel, ...prev];
    });
    setIsCreateModalOpen(false);
    setEditingChannel(null);
  };

  const handleToggleActive = async (channel: SupportChannel) => {
    setTogglingId(channel.id);
    setActionError(null);
    try {
      const updated = channel.is_active
        ? await supportChannelApi.deactivateChannel(channel.id)
        : await supportChannelApi.activateChannel(channel.id);
      setChannels((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } catch (err: any) {
      setActionError(err?.response?.data?.detail || 'Failed to update channel status.');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (channel: SupportChannel) => {
    if (!window.confirm(`Delete "${channel.name}"? This action cannot be undone.`)) return;
    setDeletingId(channel.id);
    setActionError(null);
    try {
      await supportChannelApi.deleteChannel(channel.id);
      setChannels((prev) => prev.filter((c) => c.id !== channel.id));
    } catch (err: any) {
      setActionError(err?.response?.data?.detail || 'Could not delete this channel.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <ProtectedRoute requiredAuth={true} fallback="/unauthorized">
      <DashboardLayout alerts={[]} upcomingMeetings={[]}>
        <div className="p-8 flex flex-col gap-6">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Support Channels</h1>
              <p className="mt-1 text-sm text-gray-500">
                Configure and manage support channels for different customer segments.
              </p>
            </div>
            <button
              onClick={() => { setEditingChannel(null); setIsCreateModalOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Channel
            </button>
          </div>

          {/* Action-level error */}
          {actionError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {actionError}
              <button
                onClick={() => setActionError(null)}
                className="ml-auto text-red-500 hover:text-red-700 text-xs underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Content */}
          {!projectValid ? (
            <div className="flex flex-col items-center justify-center min-h-[300px] gap-3 text-center">
              <p className="text-sm text-gray-600">
                Open this page from a project card to manage support channels for that project.
              </p>
              <button
                type="button"
                onClick={() => router.push('/select-project')}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
              >
                Go to projects
              </button>
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center min-h-[300px] gap-3">
              <LoadingSpinner />
              <p className="text-sm text-gray-500">Loading support channels...</p>
            </div>
          ) : error ? (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-900">Error</p>
                <p className="text-sm text-red-700">{error}</p>
              </div>
              <button
                onClick={fetchData}
                className="px-3 py-1.5 text-sm text-red-700 border border-red-300 rounded-lg hover:bg-red-100"
              >
                Retry
              </button>
            </div>
          ) : channels.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[300px] gap-4 border-2 border-dashed border-gray-200 rounded-xl">
              <p className="text-gray-400 text-sm">No support channels yet.</p>
              <button
                onClick={() => { setEditingChannel(null); setIsCreateModalOpen(true); }}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 border border-indigo-300 rounded-lg hover:bg-indigo-50"
              >
                <Plus className="h-4 w-4" />
                Create your first channel
              </button>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Name</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Type</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Experience Groups</th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {channels.map((channel) => {
                    const Icon = CHANNEL_ICONS[channel.channel_type] ?? MessageSquare;
                    return (
                      <tr key={channel.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-4 font-medium text-gray-900">{channel.name}</td>
                        <td className="px-5 py-4 text-gray-500">
                          <div className="flex items-center gap-1.5">
                            <Icon className="h-3.5 w-3.5 shrink-0" />
                            {CHANNEL_TYPE_LABELS[channel.channel_type] ?? channel.channel_type_display}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <ActiveBadge isActive={channel.is_active} />
                        </td>
                        <td className="px-5 py-4">
                          {channel.experience_groups.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {channel.experience_groups.map((g) => (
                                <span key={g.id} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full border border-gray-200">
                                  {g.name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="italic text-gray-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setEditingChannel(channel)}
                              title="Edit"
                              className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleToggleActive(channel)}
                              disabled={togglingId === channel.id}
                              title={channel.is_active ? 'Deactivate' : 'Activate'}
                              className={`p-1.5 rounded-md transition-colors disabled:opacity-40 ${
                                channel.is_active
                                  ? 'text-gray-400 hover:text-amber-600 hover:bg-amber-50'
                                  : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                              }`}
                            >
                              {channel.is_active
                                ? <PowerOff className="h-4 w-4" />
                                : <Power className="h-4 w-4" />
                              }
                            </button>
                            <button
                              onClick={() => handleDelete(channel)}
                              disabled={deletingId === channel.id}
                              title="Delete"
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-40"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Create Modal */}
        <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">New Support Channel</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Configure a new channel for customer support delivery.
              </p>
            </div>
            {projectValid && (
              <ChannelForm
                projectId={projectId}
                experienceGroups={experienceGroups}
                channelTypes={channelTypes}
                initial={null}
                onClose={() => setIsCreateModalOpen(false)}
                onSaved={handleSaved}
              />
            )}
          </div>
        </Modal>

        {/* Edit Modal */}
        <Modal
          isOpen={editingChannel !== null}
          onClose={() => setEditingChannel(null)}
          disableBackdropClose={true}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Edit Support Channel</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Update channel configuration and experience group assignments.
                </p>
              </div>
              <button
                onClick={() => setEditingChannel(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {editingChannel !== null && projectValid && (
              <ChannelForm
                projectId={projectId}
                experienceGroups={experienceGroups}
                channelTypes={channelTypes}
                initial={editingChannel}
                onClose={() => setEditingChannel(null)}
                onSaved={handleSaved}
              />
            )}
          </div>
        </Modal>
      </DashboardLayout>
    </ProtectedRoute>
  );
};

export default ChannelsPage;
