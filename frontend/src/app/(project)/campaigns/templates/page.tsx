'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/layout/Layout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { CampaignAPI } from '@/lib/api/campaignApi';
import { CampaignTemplate } from '@/types/campaign';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import FilterDropdown from '@/components/ui/FilterDropdown';
import { SelectOption } from '@/types/permission';
import { Search, X } from 'lucide-react';
import toast from 'react-hot-toast';

const sharingScopeOptions: SelectOption[] = [
  { id: 'all', name: 'All Scopes' },
  { id: 'PERSONAL', name: 'Personal' },
  { id: 'TEAM', name: 'Team' },
  { id: 'ORGANIZATION', name: 'Organization' },
];

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<CampaignTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState('all');
  const [localSearchQuery, setLocalSearchQuery] = useState('');

  // Fetch templates on mount and when filters change
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setLoading(true);
        setError(null);
        const params: any = {};
        
        if (searchQuery.trim()) {
          params.search = searchQuery.trim();
        }
        
        if (scopeFilter && scopeFilter !== 'all') {
          params.sharing_scope = scopeFilter;
        }

        const response = await CampaignAPI.getTemplates(params);
        // Handle both array response and paginated response with results
        const templatesList = Array.isArray(response.data)
          ? response.data
          : (response.data as any)?.results || response.data || [];
        setTemplates(templatesList);
      } catch (err) {
        console.error('Failed to fetch templates:', err);
        setError(err);
        toast.error('Failed to load templates');
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, [searchQuery, scopeFilter]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(localSearchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [localSearchQuery]);

  const handleClearSearch = () => {
    setLocalSearchQuery('');
    setSearchQuery('');
  };

  const handleRowClick = (template: CampaignTemplate) => {
    router.push(`/campaigns/templates/${template.id}`);
  };

  // Filter templates client-side as well (for immediate feedback)
  const filteredTemplates = templates.filter((template) => {
    // Scope filter
    if (scopeFilter && scopeFilter !== 'all' && template.sharing_scope !== scopeFilter) {
      return false;
    }

    // Search filter (name and description)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchesName = template.name?.toLowerCase().includes(query);
      const matchesDescription = template.description?.toLowerCase().includes(query);
      if (!matchesName && !matchesDescription) {
        return false;
      }
    }

    return true;
  });

  return (
    <ProtectedRoute>
      <Layout>
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Campaign Templates</h1>
              <p className="text-sm text-gray-500 mt-1">
                Reusable campaign structures and configurations
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            {/* Search Input */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search templates by name or description..."
                value={localSearchQuery}
                onChange={(e) => setLocalSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {localSearchQuery && (
                <button
                  onClick={handleClearSearch}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Scope Filter */}
            <div className="sm:w-48">
              <FilterDropdown
                label="Sharing Scope"
                value={scopeFilter}
                onChange={setScopeFilter}
                options={sharingScopeOptions}
                placeholder="All Scopes"
              />
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading templates...</span>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
              <p className="text-red-800">Failed to load templates. Please try again.</p>
            </div>
          )}

          {/* Templates Table */}
          {!loading && !error && (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Sharing Scope</TableHead>
                    <TableHead>Creator</TableHead>
                    <TableHead>Usage Count</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTemplates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-gray-500">
                        {templates.length === 0
                          ? 'No templates found. Create a template from an existing campaign.'
                          : 'No templates match your filters.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTemplates.map((template) => (
                      <TableRow
                        key={template.id}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => handleRowClick(template)}
                      >
                        <TableCell className="font-medium">
                          {template.name}
                          {template.is_archived && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              Archived
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {template.sharing_scope_display}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {template.creator?.username || template.creator?.email || 'N/A'}
                        </TableCell>
                        <TableCell>{template.usage_count}</TableCell>
                        <TableCell>v{template.version_number}</TableCell>
                        <TableCell>{formatDate(template.created_at)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}

