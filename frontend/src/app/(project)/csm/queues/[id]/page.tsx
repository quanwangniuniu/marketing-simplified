'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import Layout from '@/components/layout/Layout';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Modal from '@/components/ui/Modal';
import TierBadge from '@/components/csm/TierBadge';
import QueueForm from '@/components/csm/QueueForm';
import { useBuildUrl } from '@/lib/buildUrl';
import { Queue, QueueAgent, QueueTeam, QueueTicketCounts } from '@/types/csm';
import CsmAPI from '@/lib/api/csmApi';
import { ArrowLeft, Plus, Trash2, Pencil, Users, AlertCircle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const QueueDetailContent: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const buildUrl = useBuildUrl();
  const queueId = String(params.id);

  const [queue, setQueue] = useState<Queue | null>(null);
  const [agents, setAgents] = useState<QueueAgent[]>([]);
  const [teams, setTeams] = useState<QueueTeam[]>([]);
  const [ticketCounts, setTicketCounts] = useState<QueueTicketCounts>({ todo: 0, in_progress: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Agent assignment
  const [agentUserId, setAgentUserId] = useState('');
  const [assigningAgent, setAssigningAgent] = useState(false);

  // Team assignment
  const [teamId, setTeamId] = useState('');
  const [assigningTeam, setAssigningTeam] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Queue is fetched by slug; nested sub-resources use the
      // resolved numeric id (their routes are id-keyed).
      const queueData = await CsmAPI.getQueue(queueId);
      const [agentsData, teamsData, counts] = await Promise.all([
        CsmAPI.getQueueAgents(queueData.id),
        CsmAPI.getQueueTeams(queueData.id),
        CsmAPI.getTicketCounts(queueData.id),
      ]);
      setQueue(queueData);
      setAgents(agentsData);
      setTeams(teamsData);
      setTicketCounts(counts);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to load queue details');
    } finally {
      setLoading(false);
    }
  }, [queueId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleAssignAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentUserId) return;
    setAssigningAgent(true);
    try {
      await CsmAPI.assignAgent(queue!.id, Number(agentUserId));
      setAgentUserId('');
      const updated = await CsmAPI.getQueueAgents(queue!.id);
      setAgents(updated);
    } catch (err: any) {
      alert(err?.response?.data?.detail || err?.response?.data?.user?.[0] || 'Failed to assign agent');
    } finally {
      setAssigningAgent(false);
    }
  };

  const handleRemoveAgent = async (assignmentId: number) => {
    if (!confirm('Remove this agent from the queue?')) return;
    try {
      await CsmAPI.removeAgent(queue!.id, assignmentId);
      setAgents((prev) => prev.filter((a) => a.id !== assignmentId));
    } catch {
      alert('Failed to remove agent');
    }
  };

  const handleAssignTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamId) return;
    setAssigningTeam(true);
    try {
      await CsmAPI.assignTeam(queue!.id, Number(teamId));
      setTeamId('');
      const updated = await CsmAPI.getQueueTeams(queue!.id);
      setTeams(updated);
    } catch (err: any) {
      alert(err?.response?.data?.detail || err?.response?.data?.team?.[0] || 'Failed to assign team');
    } finally {
      setAssigningTeam(false);
    }
  };

  const handleRemoveTeam = async (assignmentId: number) => {
    if (!confirm('Remove this team from the queue?')) return;
    try {
      await CsmAPI.removeTeam(queue!.id, assignmentId);
      setTeams((prev) => prev.filter((t) => t.id !== assignmentId));
    } catch {
      alert('Failed to remove team');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      </Layout>
    );
  }

  if (error || !queue) {
    return (
      <Layout>
        <div className="p-6">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800">
            <AlertCircle size={16} />
            {error || 'Queue not found'}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <button
            onClick={() => router.push(buildUrl('/csm/queues'))}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3"
          >
            <ArrowLeft size={14} />
            Back to Queues
          </button>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{queue.name}</h1>
              <TierBadge tier={queue.tier} />
            </div>
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Pencil size={14} />
              Edit
            </button>
          </div>
          {queue.description && (
            <p className="text-sm text-gray-500 mt-2">{queue.description}</p>
          )}
        </div>

        {/* Ticket Counts */}
        <div className="grid grid-cols-2 gap-4 max-w-md">
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            <p className="text-2xl font-bold text-gray-900">{ticketCounts.todo}</p>
            <p className="text-sm text-gray-500">To Do</p>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg text-center">
            <p className="text-2xl font-bold text-blue-700">{ticketCounts.in_progress}</p>
            <p className="text-sm text-gray-500">In Progress</p>
          </div>
        </div>

        {/* Assigned Agents */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Assigned Agents</h2>

          <form onSubmit={handleAssignAgent} className="flex items-center gap-2 mb-3">
            <input
              type="number"
              placeholder="User ID"
              value={agentUserId}
              onChange={(e) => setAgentUserId(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-32"
              disabled={assigningAgent}
            />
            <button
              type="submit"
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              disabled={assigningAgent || !agentUserId}
            >
              <Plus size={14} />
              Assign
            </button>
          </form>

          {agents.length === 0 ? (
            <p className="text-sm text-gray-500">No agents assigned yet.</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Assigned At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agents.map((agent) => (
                    <TableRow key={agent.id}>
                      <TableCell className="font-medium">{agent.user_name || `User #${agent.user}`}</TableCell>
                      <TableCell className="text-gray-500">{agent.user_email}</TableCell>
                      <TableCell className="text-gray-500 text-sm">
                        {new Date(agent.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <button
                          onClick={() => handleRemoveAgent(agent.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600"
                          title="Remove"
                        >
                          <Trash2 size={14} />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Assigned Teams */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Assigned Teams</h2>

          <form onSubmit={handleAssignTeam} className="flex items-center gap-2 mb-3">
            <input
              type="number"
              placeholder="Team ID"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-32"
              disabled={assigningTeam}
            />
            <button
              type="submit"
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              disabled={assigningTeam || !teamId}
            >
              <Users size={14} />
              Assign Team
            </button>
          </form>

          {teams.length === 0 ? (
            <p className="text-sm text-gray-500">No teams assigned yet.</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Team</TableHead>
                    <TableHead>Assigned At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teams.map((team) => (
                    <TableRow key={team.id}>
                      <TableCell className="font-medium">{team.team_name}</TableCell>
                      <TableCell className="text-gray-500 text-sm">
                        {new Date(team.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <button
                          onClick={() => handleRemoveTeam(team.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600"
                          title="Remove"
                        >
                          <Trash2 size={14} />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Edit Modal */}
        <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Edit Queue</h2>
            <QueueForm
              projectId={queue.project}
              queue={queue}
              onSuccess={() => {
                setIsEditModalOpen(false);
                fetchAll();
              }}
              onCancel={() => setIsEditModalOpen(false)}
            />
          </div>
        </Modal>
      </div>
    </Layout>
  );
};

export default function QueueDetailPage() {
  return (
    <ProtectedRoute requiredAuth={true} requireAdmin={true}>
      <QueueDetailContent />
    </ProtectedRoute>
  );
}
