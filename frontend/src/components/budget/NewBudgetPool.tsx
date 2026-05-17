'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useProjectStore } from '@/lib/projectStore';

interface AdChannel { id: number; name: string; }

interface Props {
  onCreated: () => void;
  onCancel?: () => void;
}

const CURRENCIES = ['USD', 'AUD', 'EUR', 'GBP', 'CAD', 'SGD'];

const INPUT = 'w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-[#3CCED7] focus:ring-2 focus:ring-[#3CCED7]/30';

export default function NewBudgetPool({ onCreated, onCancel }: Props) {
  const activeProject = useProjectStore((s) => s.activeProject);

  const [channels, setChannels] = useState<AdChannel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [creatingChannel, setCreatingChannel] = useState(false);

  const [poolName, setPoolName] = useState('');
  const [adChannel, setAdChannel] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [error, setError] = useState('');

  const projectId = activeProject?.id;

  useEffect(() => {
    if (!projectId) return;
    setLoadingChannels(true);
    api.get('/api/budgets/ad-channels/', { params: { project_id: projectId } })
      .then((r) => setChannels(r.data || []))
      .catch(() => setChannels([]))
      .finally(() => setLoadingChannels(false));
  }, [projectId]);

  const createChannel = async () => {
    if (!newChannelName.trim() || !projectId) return;
    setCreatingChannel(true);
    try {
      const r = await api.post('/api/budgets/ad-channels/', { name: newChannelName.trim(), project: projectId });
      const ch: AdChannel = r.data;
      setChannels((prev) => [...prev, ch]);
      setAdChannel(String(ch.id));
      setNewChannelName('');
    } catch {
      setError('Failed to create ad channel');
    } finally {
      setCreatingChannel(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!projectId) { setError('No active project selected'); return; }
    if (!adChannel) { setError('Select an ad channel'); return; }
    if (!totalAmount || Number(totalAmount) <= 0) { setError('Enter a valid amount'); return; }
    setSaving(true);
    try {
      await api.post('/api/budgets/pools/', {
        project: projectId,
        ad_channel: Number(adChannel),
        total_amount: totalAmount,
        currency,
        name: poolName.trim(),
      });
      onCreated();
    } catch (e: any) {
      setError(e?.response?.data ? JSON.stringify(e.response.data) : 'Failed to create pool');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name */}
      <div>
        <label className="mb-1.5 block text-[12px] font-medium uppercase tracking-wider text-gray-500">
          Pool name <span className="text-gray-400 font-normal normal-case">(optional)</span>
        </label>
        <input
          type="text"
          value={poolName}
          onChange={(e) => setPoolName(e.target.value)}
          placeholder="e.g. Q1 Campaign, Influencer Budget…"
          className={INPUT}
        />
      </div>

      {/* Ad Channel */}
      <div>
        <label className="mb-1.5 block text-[12px] font-medium uppercase tracking-wider text-gray-500">
          Ad Channel <span className="text-rose-500">*</span>
        </label>
        {loadingChannels ? (
          <div className="text-sm text-gray-400">Loading channels…</div>
        ) : (
          <select value={adChannel} onChange={(e) => setAdChannel(e.target.value)} className={INPUT} required>
            <option value="" disabled>Select a channel…</option>
            {channels.map((ch) => (
              <option key={ch.id} value={ch.id}>{ch.name}</option>
            ))}
          </select>
        )}
        {/* Inline new channel creation */}
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={newChannelName}
            onChange={(e) => setNewChannelName(e.target.value)}
            placeholder="Or create new channel…"
            className={`${INPUT} flex-1`}
          />
          <button
            type="button"
            onClick={createChannel}
            disabled={!newChannelName.trim() || creatingChannel}
            className="rounded-md bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-40"
          >
            {creatingChannel ? 'Adding…' : 'Add'}
          </button>
        </div>
      </div>

      {/* Currency */}
      <div>
        <label className="mb-1.5 block text-[12px] font-medium uppercase tracking-wider text-gray-500">
          Currency <span className="text-rose-500">*</span>
        </label>
        <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={INPUT}>
          {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Total Amount */}
      <div>
        <label className="mb-1.5 block text-[12px] font-medium uppercase tracking-wider text-gray-500">
          Total Amount <span className="text-rose-500">*</span>
        </label>
        <input
          type="number"
          step="0.01"
          min="0.01"
          value={totalAmount}
          onChange={(e) => setTotalAmount(e.target.value)}
          placeholder="e.g. 10000"
          className={INPUT}
          required
        />
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-[#3CCED7] px-4 py-2 text-sm font-medium text-white hover:bg-[#2fb8c0] disabled:opacity-50"
        >
          {saving ? 'Creating…' : 'Create pool'}
        </button>
      </div>
    </form>
  );
}
