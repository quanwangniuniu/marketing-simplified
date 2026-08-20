'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import Layout from '@/components/layout/Layout';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Modal from '@/components/ui/Modal';
import TierBadge from '@/components/csm/TierBadge';
import QueueForm from '@/components/csm/QueueForm';
import { Queue, QueueTicketCounts } from '@/types/csm';
import CsmAPI from '@/lib/api/csmApi';
import { useRouter } from 'next/navigation';
import { useActiveProjectForFlatRoute } from '@/lib/useActiveProjectForFlatRoute';
import { useBuildUrl } from '@/lib/buildUrl';
import { Plus, Pencil, Trash2, AlertCircle, ArrowLeft } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const QueuesPageContent: React.FC = () => {
  const router = useRouter();
  const buildUrl = useBuildUrl();
  const { activeProject } = useActiveProjectForFlatRoute();
  const projectId = Number(activeProject?.id ?? 0);
  const projectValid = projectId > 0;

  const [queues, setQueues] = useState<Queue[]>([]);
  const [ticketCounts, setTicketCounts] = useState<Record<number, QueueTicketCounts>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingQueue, setEditingQueue] = useState<Queue | null>(null);

  const fetchQueues = useCallback(async () => {
    if (!projectValid) return;
    setLoading(true);
    setError(null);
    try {
      const data = await CsmAPI.getQueues();
      setQueues(Array.isArray(data) ? data : []);
      const counts: Record<number, QueueTicketCounts> = {};
      await Promise.all(
        data.map(async (q) => {
          try {
            counts[q.id] = await CsmAPI.getTicketCounts(q.id);
          } catch {
            counts[q.id] = { todo: 0, in_progress: 0 };
          }
        })
      );
      setTicketCounts(counts);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to load queues');
    } finally {
      setLoading(false);
    }
  }, [projectId, projectValid]);

  useEffect(() => {
    fetchQueues();
  }, [fetchQueues]);

  const handleDelete = async (queue: Queue) => {
    if (!confirm(`Are you sure you want to delete "${queue.name}"?`)) return;
    try {
      await CsmAPI.deleteQueue(queue.id);
      fetchQueues();
    } catch {
      alert('Failed to delete queue');
    }
  };

  if (!projectValid) {
    return (
      <Layout>
        <div className="p-6 text-center text-gray-500">No active project selected.</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/select-project')}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Queues</h1>
              <p className="text-sm text-gray-500 mt-1">
                Manage support queues and agent assignments
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
          >
            <Plus size={16} />
            New Queue
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-800">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : queues.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg font-medium">No queues yet</p>
            <p className="text-sm mt-1">Create your first queue to start organizing tickets.</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Organisation</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead className="text-center">To Do</TableHead>
                  <TableHead className="text-center">In Progress</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queues.map((queue) => {
                  const counts = ticketCounts[queue.id] || { todo: 0, in_progress: 0 };
                  return (
                    <TableRow key={queue.id}>
                      <TableCell>
                        <a
                          href={buildUrl(`/csm/queues/${queue.slug}`)}
                          className="font-medium text-indigo-600 hover:text-indigo-800"
                        >
                          {queue.name}
                        </a>
                        {queue.description && (
                          <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">
                            {queue.description}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        {queue.organisation_name ? (
                          <span className="px-2 py-0.5 text-xs font-medium bg-purple-50 text-purple-700 rounded-full">
                            {queue.organisation_name}
                          </span>
                        ) : (
                          <span className="italic text-gray-300 text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <TierBadge tier={queue.tier} />
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-sm font-medium">
                          {counts.todo}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-sm font-medium text-blue-700">
                          {counts.in_progress}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setEditingQueue(queue)}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 rounded"
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(queue)}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Create Modal */}
        <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Create Queue</h2>
            <QueueForm
              projectId={projectId}
              onSuccess={() => {
                setIsCreateModalOpen(false);
                fetchQueues();
              }}
              onCancel={() => setIsCreateModalOpen(false)}
            />
          </div>
        </Modal>

        {/* Edit Modal */}
        <Modal isOpen={!!editingQueue} onClose={() => setEditingQueue(null)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Edit Queue</h2>
            {editingQueue && (
              <QueueForm
                projectId={projectId}
                queue={editingQueue}
                onSuccess={() => {
                  setEditingQueue(null);
                  fetchQueues();
                }}
                onCancel={() => setEditingQueue(null)}
              />
            )}
          </div>
        </Modal>
      </div>
    </Layout>
  );
};

export default function QueuesPage() {
  return (
    <ProtectedRoute requiredAuth={true} requireAdmin={true}>
      <QueuesPageContent />
    </ProtectedRoute>
  );
}
