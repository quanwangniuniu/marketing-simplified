'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Modal from '@/components/ui/Modal';
import { CustomerAPI } from '@/lib/api/customerApi';
import { ExperienceGroupAPI } from '@/lib/api/experienceGroupApi';
import { Customer, CreateCustomerData, UpdateCustomerData } from '@/types/customer';
import { ExperienceGroupListItem } from '@/types/experienceGroup';
import { Plus, Pencil, Trash2, AlertCircle, X, Users, ArrowLeft } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

// ── Group selector shared between Create and Edit forms ───────────────────────

interface GroupSelectProps {
  value: number | null;
  onChange: (id: number | null) => void;
  groups: ExperienceGroupListItem[];
  disabled?: boolean;
}

const GroupSelect: React.FC<GroupSelectProps> = ({ value, onChange, groups, disabled }) => (
  <select
    value={value ?? ''}
    onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
    disabled={disabled}
    className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
  >
    <option value="">— No group assigned —</option>
    {groups.map((g) => (
      <option key={g.id} value={g.id}>
        {g.name}
      </option>
    ))}
  </select>
);

// ── Create Form ───────────────────────────────────────────────────────────────

interface CreateFormProps {
  projectId: number;
  groups: ExperienceGroupListItem[];
  onSuccess: (customer: Customer) => void;
  onCancel: () => void;
}

const CreateForm: React.FC<CreateFormProps> = ({ projectId, groups, onSuccess, onCancel }) => {
  const [form, setForm] = useState<CreateCustomerData>({
    email: '',
    full_name: '',
    company: '',
    phone: '',
    experience_group: null,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof CreateCustomerData, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const validate = () => {
    const next: typeof errors = {};
    if (!form.email.trim()) next.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = 'Enter a valid email.';
    if (!form.full_name.trim()) next.full_name = 'Full name is required.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setServerError(null);
    try {
      const res = await CustomerAPI.create(form, projectId);
      onSuccess(res.data);
    } catch (err: any) {
      const detail =
        err?.response?.data?.email?.[0] ||
        err?.response?.data?.detail ||
        'Failed to create customer.';
      setServerError(detail);
    } finally {
      setSubmitting(false);
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
            Full Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            placeholder="Jane Smith"
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={submitting}
          />
          {errors.full_name && <p className="text-xs text-red-600">{errors.full_name}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="jane@example.com"
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={submitting}
          />
          {errors.email && <p className="text-xs text-red-600">{errors.email}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Company</label>
          <input
            type="text"
            value={form.company}
            onChange={(e) => setForm({ ...form, company: e.target.value })}
            placeholder="Acme Corp"
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={submitting}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Phone</label>
          <input
            type="text"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+1 555 000 0000"
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={submitting}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">Experience Group</label>
        <GroupSelect
          value={form.experience_group ?? null}
          onChange={(id) => setForm({ ...form, experience_group: id })}
          groups={groups}
          disabled={submitting}
        />
      </div>

      <div className="flex justify-end gap-3 pt-2 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {submitting ? 'Creating...' : 'Create Customer'}
        </button>
      </div>
    </form>
  );
};

// ── Edit Form ─────────────────────────────────────────────────────────────────

interface EditFormProps {
  customerId: number;
  groups: ExperienceGroupListItem[];
  onSaved: (customer: Customer) => void;
  onClose: () => void;
}

const EditForm: React.FC<EditFormProps> = ({ customerId, groups, onSaved, onClose }) => {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [form, setForm] = useState<UpdateCustomerData>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fetchCustomer = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await CustomerAPI.retrieve(customerId);
      setCustomer(res.data);
      setForm({
        email: res.data.email,
        full_name: res.data.full_name,
        company: res.data.company,
        phone: res.data.phone,
        experience_group: res.data.experience_group,
        is_active: res.data.is_active,
      });
    } catch {
      setFetchError('Failed to load customer details.');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    fetchCustomer();
  }, [fetchCustomer]);

  const isDirty = customer !== null && (
    form.email !== customer.email ||
    form.full_name !== customer.full_name ||
    form.company !== customer.company ||
    form.phone !== customer.phone ||
    form.experience_group !== customer.experience_group ||
    form.is_active !== customer.is_active
  );

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await CustomerAPI.update(customerId, form);
      setCustomer(res.data);
      onSaved(res.data);
      onClose();
    } catch (err: any) {
      const detail =
        err?.response?.data?.email?.[0] ||
        err?.response?.data?.detail ||
        'Failed to save changes.';
      setSaveError(detail);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (isDirty && !window.confirm('You have unsaved changes. Close anyway?')) return;
    onClose();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3">
        <LoadingSpinner />
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    );
  }

  if (fetchError || !customer) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          <p className="text-sm text-red-700 flex-1">{fetchError || 'Customer not found.'}</p>
          <button onClick={fetchCustomer} className="px-3 py-1.5 text-sm text-red-700 border border-red-300 rounded-lg hover:bg-red-100">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-6">
      {saveError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {saveError}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Full Name</label>
          <input
            type="text"
            value={form.full_name ?? ''}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={saving}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Email</label>
          <input
            type="email"
            value={form.email ?? ''}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={saving}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Company</label>
          <input
            type="text"
            value={form.company ?? ''}
            onChange={(e) => setForm({ ...form, company: e.target.value })}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={saving}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Phone</label>
          <input
            type="text"
            value={form.phone ?? ''}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={saving}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">Experience Group</label>
        <GroupSelect
          value={form.experience_group ?? null}
          onChange={(id) => setForm({ ...form, experience_group: id })}
          groups={groups}
          disabled={saving}
        />
      </div>

      <div className="flex items-center gap-3">
        <input
          id="is_active"
          type="checkbox"
          checked={form.is_active ?? true}
          onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
          disabled={saving}
          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        <label htmlFor="is_active" className="text-sm text-gray-700">Active</label>
      </div>

      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <button
          onClick={handleClose}
          disabled={saving}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!isDirty || saving}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-40"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

const CustomersPage: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = Number(searchParams.get('project'));
  const projectValid = Number.isFinite(projectId) && projectId > 0;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [groups, setGroups] = useState<ExperienceGroupListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!projectValid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [custRes, grpRes] = await Promise.all([
        CustomerAPI.list({ project: projectId }),
        ExperienceGroupAPI.list({ project: projectId }),
      ]);
      const custData = custRes.data;
      setCustomers(Array.isArray(custData) ? custData : (custData as any).results ?? []);
      const grpData = grpRes.data;
      setGroups(Array.isArray(grpData) ? grpData : (grpData as any).results ?? []);
    } catch {
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [projectId, projectValid]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreated = (customer: Customer) => {
    setCustomers((prev) => [customer, ...prev]);
    setIsCreateModalOpen(false);
  };

  const handleSaved = (updated: Customer) => {
    setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    setEditingCustomerId(null);
  };

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`Delete customer "${name}"? This cannot be undone.`)) return;
    setDeletingId(id);
    setActionError(null);
    try {
      await CustomerAPI.destroy(id);
      setCustomers((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      setActionError(err?.response?.data?.detail || 'Could not delete this customer.');
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
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/select-project')}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
                <p className="mt-1 text-sm text-gray-500">
                  Manage external customers and their Experience Group assignments.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Customer
            </button>
          </div>

          {/* Action error */}
          {actionError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {actionError}
              <button onClick={() => setActionError(null)} className="ml-auto text-xs underline text-red-500 hover:text-red-700">
                Dismiss
              </button>
            </div>
          )}

          {/* Content */}
          {!projectValid ? (
            <div className="flex flex-col items-center justify-center min-h-[300px] gap-3 text-center">
              <p className="text-sm text-gray-600">
                Open this page from a project card to manage customers for that project.
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
              <p className="text-sm text-gray-500">Loading customers...</p>
            </div>
          ) : error ? (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
              <p className="text-sm text-red-700 flex-1">{error}</p>
              <button onClick={fetchData} className="px-3 py-1.5 text-sm text-red-700 border border-red-300 rounded-lg hover:bg-red-100">
                Retry
              </button>
            </div>
          ) : customers.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[300px] gap-4 border-2 border-dashed border-gray-200 rounded-xl">
              <Users className="h-8 w-8 text-gray-300" />
              <p className="text-gray-400 text-sm">No customers found.</p>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 border border-indigo-300 rounded-lg hover:bg-indigo-50"
              >
                <Plus className="h-4 w-4" />
                Add your first customer
              </button>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Name</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Email</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Company</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Experience Group</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {customers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4 font-medium text-gray-900">{customer.full_name}</td>
                      <td className="px-5 py-4 text-gray-500">{customer.email}</td>
                      <td className="px-5 py-4 text-gray-500">{customer.company || <span className="italic text-gray-300">—</span>}</td>
                      <td className="px-5 py-4">
                        {customer.experience_group_name ? (
                          <span className="px-2 py-0.5 text-xs font-medium bg-indigo-50 text-indigo-700 rounded-full">
                            {customer.experience_group_name}
                          </span>
                        ) : (
                          <span className="italic text-gray-300 text-xs">Unassigned</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${customer.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {customer.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setEditingCustomerId(customer.id)}
                            title="Edit"
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(customer.id, customer.full_name)}
                            disabled={deletingId === customer.id}
                            title="Delete"
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-40"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Create Modal */}
        <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Add Customer</h2>
              <p className="text-sm text-gray-500 mt-0.5">Create a new customer and optionally assign them to an experience group.</p>
            </div>
            <CreateForm
              projectId={projectId}
              groups={groups}
              onSuccess={handleCreated}
              onCancel={() => setIsCreateModalOpen(false)}
            />
          </div>
        </Modal>

        {/* Edit Modal */}
        <Modal isOpen={editingCustomerId !== null} onClose={() => setEditingCustomerId(null)} disableBackdropClose={true}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Edit Customer</h2>
                <p className="text-sm text-gray-500 mt-0.5">Update customer details or change group assignment.</p>
              </div>
              <button onClick={() => setEditingCustomerId(null)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md">
                <X className="h-4 w-4" />
              </button>
            </div>
            {editingCustomerId !== null && (
              <EditForm
                customerId={editingCustomerId}
                groups={groups}
                onSaved={handleSaved}
                onClose={() => setEditingCustomerId(null)}
              />
            )}
          </div>
        </Modal>
      </DashboardLayout>
    </ProtectedRoute>
  );
};

export default CustomersPage;
