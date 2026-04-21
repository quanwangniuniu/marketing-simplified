'use client';

import { useState, useEffect } from 'react';
import { BudgetAPI } from '@/lib/api/budgetApi';
import toast from 'react-hot-toast';
import ConfirmModal from '@/components/ui/ConfirmModal';

interface BudgetPool {
  id: number;
  project: number;
  ad_channel: number;
  total_amount: string;
  used_amount: string;
  available_amount: string;
  currency: string;
}

interface BudgetPoolListProps {
  projectId?: number | null; // Optional, not used for filtering anymore
  onCreatePool?: () => void;
  refreshTrigger?: number;
}

export default function BudgetPoolList({
  projectId, // Keep for backwards compatibility but not used
  onCreatePool,
  refreshTrigger
}: BudgetPoolListProps) {
  const [budgetPools, setBudgetPools] = useState<BudgetPool[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [poolToDelete, setPoolToDelete] = useState<number | null>(null);

  useEffect(() => {
    const fetchBudgetPools = async () => {
      try {
        setLoading(true);
        // Fetch all budget pools without project filter
        const response = await BudgetAPI.getBudgetPools({});
        const pools = response.data.results || response.data || [];
        setBudgetPools(pools);
      } catch (error) {
        console.error('Error fetching budget pools:', error);
        toast.error('Failed to load budget pools');
        setBudgetPools([]);
      } finally {
        setLoading(false);
      }
    };

    fetchBudgetPools();
  }, [refreshTrigger]);

  const handleDeleteClick = (poolId: number) => {
    setPoolToDelete(poolId);
    setConfirmModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!poolToDelete) return;

    try {
      setDeleting(poolToDelete);
      await BudgetAPI.deleteBudgetPool(poolToDelete);
      toast.success('Budget pool deleted successfully');

      // Remove from local state
      setBudgetPools(prev => prev.filter(pool => pool.id !== poolToDelete));
    } catch (error: any) {
      console.error('Error deleting budget pool:', error);
      const errorMsg = error.response?.data?.error || error.response?.data?.message || 'Failed to delete budget pool';
      toast.error(errorMsg);
    } finally {
      setDeleting(null);
      setPoolToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setConfirmModalOpen(false);
    setPoolToDelete(null);
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading budget pools...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-h-[60vh] overflow-auto">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">
          All Budget Pools
        </h3>
        <button
          onClick={onCreatePool}
          className="px-3 py-1.5 text-sm rounded text-white bg-indigo-600 hover:bg-indigo-700"
        >
          Create New Pool
        </button>
      </div>

      {/* Budget Pools List */}
      {budgetPools.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No budget pools found</p>
          <button
            onClick={onCreatePool}
            className="mt-4 px-4 py-2 text-sm rounded text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
          >
            Create your first budget pool
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {budgetPools.map((pool) => (
            <div
              key={pool.id}
              className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-gray-900">
                      Budget Pool #{pool.id}
                    </span>
                    <span className="px-2 py-0.5 text-xs rounded-full bg-[#3CCED7]/15 text-[#1a9ba3]">
                      {pool.currency}
                    </span>
                    <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-800">
                      Channel #{pool.ad_channel}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Total Amount</p>
                      <p className="font-medium text-gray-900">
                        {parseFloat(pool.total_amount).toLocaleString()} {pool.currency}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Used Amount</p>
                      <p className="font-medium text-gray-900">
                        {parseFloat(pool.used_amount).toLocaleString()} {pool.currency}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Available</p>
                      <p className="font-medium text-green-600">
                        {parseFloat(pool.available_amount).toLocaleString()} {pool.currency}
                      </p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-3">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-indigo-600 h-2 rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, (parseFloat(pool.used_amount) / parseFloat(pool.total_amount)) * 100)}%`
                        }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {((parseFloat(pool.used_amount) / parseFloat(pool.total_amount)) * 100).toFixed(1)}% used
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleDeleteClick(pool.id)}
                    disabled={deleting === pool.id}
                    className="px-3 py-1 text-xs rounded text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-50"
                  >
                    {deleting === pool.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={confirmModalOpen}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        title="Delete Budget Pool"
        message="Are you sure you want to delete this budget pool? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
        loading={deleting !== null}
      />
    </div>
  );
}
