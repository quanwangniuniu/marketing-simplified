'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, MessageSquare, Mail, FileText, Power, PowerOff, Pencil, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useProjectStore } from '@/lib/projectStore';
import toast from 'react-hot-toast';
import {
  supportChannelApi,
  SupportChannel,
  SupportChannelPayload,
  ExperienceGroup,
  DEFAULT_OPERATING_HOURS,
} from '@/lib/api/supportChannelApi';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const CHANNEL_ICONS: Record<string, React.ElementType> = {
  live_chat_widget: MessageSquare,
  contact_form: FileText,
  email: Mail,
};

const CHANNEL_COLORS: Record<string, string> = {
  live_chat_widget: 'bg-[#3CCED7]/10 text-[#3CCED7] border-[#3CCED7]/20',
  contact_form: 'bg-purple-50 text-purple-600 border-purple-200',
  email: 'bg-amber-50 text-amber-600 border-amber-200',
};

// ── Operating Hours Editor ─────────────────────────────────────────────────

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
                className="accent-[#3CCED7]"
              />
              <span className="text-xs text-gray-500">Open</span>
            </label>
            {dayVal.open && (
              <>
                <input
                  type="time"
                  value={dayVal.start}
                  onChange={(e) => onChange({ ...value, [day]: { ...dayVal, start: e.target.value } })}
                  className="text-xs border border-gray-200 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-[#3CCED7]/50"
                />
                <span className="text-xs text-gray-400">to</span>
                <input
                  type="time"
                  value={dayVal.end}
                  onChange={(e) => onChange({ ...value, [day]: { ...dayVal, end: e.target.value } })}
                  className="text-xs border border-gray-200 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-[#3CCED7]/50"
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

// ── Channel Form Modal ─────────────────────────────────────────────────────

interface ChannelFormProps {
  projectId: number;
  experienceGroups: ExperienceGroup[];
  channelTypes: { value: string; label: string }[];
  initial?: SupportChannel | null;
  onClose: () => void;
  onSaved: (channel: SupportChannel) => void;
}

function ChannelForm({ projectId, experienceGroups, channelTypes, initial, onClose, onSaved }: ChannelFormProps) {
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
  const [error, setError] = useState('');

  const toggleGroup = (id: number) => {
    setSelectedGroupIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Display name is required.'); return; }
    if (!channelType) { setError('Channel type is required.'); return; }
    setError('');
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
      toast.success(initial ? 'Channel updated.' : 'Channel created.');
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to save channel.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {initial ? 'Edit Channel' : 'New Support Channel'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Display Name *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Main Live Chat"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7]/40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Channel Type *</label>
              <select
                value={channelType}
                onChange={(e) => setChannelType(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7]/40"
              >
                {channelTypes.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Welcome Message</label>
            <textarea
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              rows={2}
              placeholder="Message shown to customers when they open this channel"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7]/40 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Offline Fallback Message</label>
            <textarea
              value={offlineMessage}
              onChange={(e) => setOfflineMessage(e.target.value)}
              rows={2}
              placeholder="Message shown when channel is outside operating hours"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7]/40 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Routing Destination</label>
            <input
              value={routingDestination}
              onChange={(e) => setRoutingDestination(e.target.value)}
              placeholder="e.g. Support Team, Tier 1 Queue"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3CCED7]/40"
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
              {showHours ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showHours && (
              <div className="px-4 py-3">
                <OperatingHoursEditor value={operatingHours} onChange={setOperatingHours} />
              </div>
            )}
          </div>

          {/* Experience Groups */}
          {experienceGroups.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                Assign to Experience Groups
              </label>
              <div className="flex flex-wrap gap-2">
                {experienceGroups.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => toggleGroup(g.id)}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                      selectedGroupIds.includes(g.id)
                        ? 'bg-[#3CCED7] text-white border-[#3CCED7]'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-[#3CCED7]/50'
                    }`}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-[#3CCED7] rounded-lg hover:bg-[#3CCED7]/80 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : initial ? 'Save Changes' : 'Create Channel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Channel Card ───────────────────────────────────────────────────────────

function ChannelCard({
  channel,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  channel: SupportChannel;
  onEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  const Icon = CHANNEL_ICONS[channel.channel_type] ?? MessageSquare;
  const badgeClass = CHANNEL_COLORS[channel.channel_type] ?? 'bg-gray-100 text-gray-600 border-gray-200';

  return (
    <div className={`rounded-xl border bg-white p-4 flex flex-col gap-3 transition-all ${
      channel.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${badgeClass}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-900 truncate">{channel.name}</div>
            <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full border mt-0.5 ${badgeClass}`}>
              {channel.channel_type_display}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
            channel.is_active
              ? 'bg-green-50 text-green-600 border-green-200'
              : 'bg-gray-100 text-gray-500 border-gray-200'
          }`}>
            {channel.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {channel.welcome_message && (
        <p className="text-xs text-gray-500 line-clamp-2">{channel.welcome_message}</p>
      )}

      {channel.routing_destination && (
        <div className="text-xs text-gray-400">
          <span className="font-medium text-gray-500">Routes to:</span> {channel.routing_destination}
        </div>
      )}

      {/* Experience Groups */}
      {channel.experience_groups.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-wider text-gray-400 mb-1.5">Experience Groups</div>
          <div className="flex flex-wrap gap-1.5">
            {channel.experience_groups.map((g) => (
              <span key={g.id} className="text-[11px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full border border-gray-200">
                {g.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1 border-t border-gray-100 mt-auto">
        <button
          onClick={onEdit}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#3CCED7] transition-colors"
        >
          <Pencil className="w-3 h-3" /> Edit
        </button>
        <button
          onClick={onToggleActive}
          className={`flex items-center gap-1 text-xs transition-colors ${
            channel.is_active
              ? 'text-gray-500 hover:text-amber-600'
              : 'text-gray-400 hover:text-green-600'
          }`}
        >
          {channel.is_active ? <PowerOff className="w-3 h-3" /> : <Power className="w-3 h-3" />}
          {channel.is_active ? 'Deactivate' : 'Activate'}
        </button>
        <button
          onClick={onDelete}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors ml-auto"
        >
          <Trash2 className="w-3 h-3" /> Delete
        </button>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

function ChannelsContent() {
  const { activeProject } = useProjectStore();
  const projectId = activeProject?.id;

  const [channels, setChannels] = useState<SupportChannel[]>([]);
  const [experienceGroups, setExperienceGroups] = useState<ExperienceGroup[]>([]);
  const [channelTypes, setChannelTypes] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterActive, setFilterActive] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<SupportChannel | null>(null);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [ch, groups, choices] = await Promise.all([
        supportChannelApi.listChannels({ project_id: projectId }),
        supportChannelApi.listExperienceGroups({ project_id: projectId }),
        supportChannelApi.getChoices(),
      ]);
      setChannels(ch);
      setExperienceGroups(groups);
      setChannelTypes(choices.channel_types);
    } catch {
      toast.error('Failed to load channels.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const handleSaved = (channel: SupportChannel) => {
    setChannels((prev) => {
      const idx = prev.findIndex((c) => c.id === channel.id);
      return idx >= 0 ? prev.map((c) => (c.id === channel.id ? channel : c)) : [...prev, channel];
    });
    setModalOpen(false);
    setEditingChannel(null);
  };

  const handleToggleActive = async (channel: SupportChannel) => {
    try {
      const updated = channel.is_active
        ? await supportChannelApi.deactivateChannel(channel.id)
        : await supportChannelApi.activateChannel(channel.id);
      setChannels((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      toast.success(updated.is_active ? 'Channel activated.' : 'Channel deactivated.');
    } catch {
      toast.error('Failed to update channel status.');
    }
  };

  const handleDelete = async (channel: SupportChannel) => {
    if (!confirm(`Delete "${channel.name}"? This cannot be undone.`)) return;
    try {
      await supportChannelApi.deleteChannel(channel.id);
      setChannels((prev) => prev.filter((c) => c.id !== channel.id));
      toast.success('Channel deleted.');
    } catch {
      toast.error('Failed to delete channel.');
    }
  };

  const filtered = channels.filter((c) => {
    if (filterType !== 'all' && c.channel_type !== filterType) return false;
    if (filterActive === 'active' && !c.is_active) return false;
    if (filterActive === 'inactive' && c.is_active) return false;
    return true;
  });

  return (
    <Layout>
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Support Channels</h1>
            <p className="text-sm text-gray-500 mt-0.5">Configure and manage support channels for customers</p>
          </div>
          <button
            onClick={() => { setEditingChannel(null); setModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#3CCED7] rounded-lg hover:bg-[#3CCED7]/80 transition-colors"
          >
            <Plus className="w-4 h-4" /> New Channel
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-5 flex-wrap">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#3CCED7]/40"
          >
            <option value="all">All Types</option>
            {channelTypes.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <select
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#3CCED7]/40"
          >
            <option value="all">All Status</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>
          <span className="text-sm text-gray-400 self-center">{filtered.length} channel{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-gray-100 bg-white p-4 h-40 animate-pulse">
                <div className="flex gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-gray-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-100 rounded w-3/4" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 py-16 flex flex-col items-center text-center">
            <MessageSquare className="w-10 h-10 text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-500">No channels found</p>
            <p className="text-xs text-gray-400 mt-1">Create your first support channel to get started</p>
            <button
              onClick={() => { setEditingChannel(null); setModalOpen(true); }}
              className="mt-4 flex items-center gap-1.5 text-sm font-medium text-[#3CCED7] hover:underline"
            >
              <Plus className="w-4 h-4" /> New Channel
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((channel) => (
              <ChannelCard
                key={channel.id}
                channel={channel}
                onEdit={() => { setEditingChannel(channel); setModalOpen(true); }}
                onToggleActive={() => handleToggleActive(channel)}
                onDelete={() => handleDelete(channel)}
              />
            ))}
          </div>
        )}
      </div>

      {modalOpen && projectId && (
        <ChannelForm
          projectId={projectId}
          experienceGroups={experienceGroups}
          channelTypes={channelTypes}
          initial={editingChannel}
          onClose={() => { setModalOpen(false); setEditingChannel(null); }}
          onSaved={handleSaved}
        />
      )}
    </Layout>
  );
}

export default function ChannelsPage() {
  return (
    <ProtectedRoute>
      <ChannelsContent />
    </ProtectedRoute>
  );
}
