'use client';

import React, { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { CampaignStatus } from '@/types/campaign';
import FilterDropdown from '@/components/ui/FilterDropdown';
import { SelectOption } from '@/types/permission';

interface CampaignFiltersProps {
  searchQuery: string;
  statusFilter: string;
  onSearchChange: (query: string) => void;
  onStatusChange: (status: string) => void;
}

const statusOptions: SelectOption[] = [
  { id: 'all', name: 'All Statuses' },
  { id: 'PLANNING', name: 'Planning' },
  { id: 'TESTING', name: 'Testing' },
  { id: 'SCALING', name: 'Scaling' },
  { id: 'OPTIMIZING', name: 'Optimizing' },
  { id: 'PAUSED', name: 'Paused' },
  { id: 'COMPLETED', name: 'Completed' },
  { id: 'ARCHIVED', name: 'Archived' },
];

export default function CampaignFilters({
  searchQuery,
  statusFilter,
  onSearchChange,
  onStatusChange,
}: CampaignFiltersProps) {
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(localSearchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [localSearchQuery, onSearchChange]);

  const handleClearSearch = () => {
    setLocalSearchQuery('');
    onSearchChange('');
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-6">
      {/* Search Input */}
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search campaigns by name or hypothesis..."
          value={localSearchQuery}
          onChange={(e) => setLocalSearchQuery(e.target.value)}
          className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-[#3CCED7]"
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

      {/* Status Filter */}
      <div className="sm:w-48">
        <FilterDropdown
          label="Status"
          value={statusFilter}
          onChange={onStatusChange}
          options={statusOptions}
          placeholder="All Statuses"
        />
      </div>
    </div>
  );
}

