'use client';

import React, { useState } from 'react';

interface AdCreativeTableItem {
  id: string;
  name: string;
  status: 'ACTIVE' | 'IN_PROCESS' | 'WITH_ISSUES' | 'DELETED';
  call_to_action_type: string;
  object_story_spec?: {
    link_data?: {
      name?: string;
      [key: string]: any;
    };
    [key: string]: any;
  };
}

interface AdCreativeTableProps {
  creatives: AdCreativeTableItem[];
  loading?: boolean;
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  // Pagination props
  currentPage?: number;
  totalPages?: number;
  totalCount?: number;
  pageSize?: number;
  hasNext?: boolean;
  hasPrevious?: boolean;
  onNextPage?: () => void;
  onPreviousPage?: () => void;
  onPageChange?: (page: number) => void;
  // Sorting props
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (field: string) => void;
  // Filtering props
  filters?: {
    status?: string;
    call_to_action_type?: string;
  };
  onFilterChange?: (filters: { status?: string; call_to_action_type?: string }) => void;
  onClearFilters?: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800 border-green-200',
  IN_PROCESS: 'bg-[#3CCED7]/15 text-[#1a9ba3] border-[#3CCED7]/30',
  WITH_ISSUES: 'bg-red-100 text-red-800 border-red-200',
  DELETED: 'bg-gray-200 text-gray-800 border-gray-200',
};

export default function AdCreativeTable({
  creatives,
  loading = false,
  onView,
  onEdit,
  onDelete,
  currentPage = 1,
  totalPages = 1,
  totalCount = 0,
  pageSize = 10,
  hasNext = false,
  hasPrevious = false,
  onNextPage,
  onPreviousPage,
  onPageChange,
  sortBy = '',
  sortOrder = 'asc',
  onSort,
  filters = {},
  onFilterChange,
  onClearFilters,
}: AdCreativeTableProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [localFilters, setLocalFilters] = useState(filters);
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const formatCallToAction = (cta: string) => {
    return cta
      .split('_')
      .map(word => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  };

  const getFieldDisplayName = (field: string) => {
    const fieldNames: Record<string, string> = {
      'name': 'Name',
      'status': 'Status',
      'call_to_action_type': 'Call to Action',
    };
    return fieldNames[field] || field;
  };

  const getSortIcon = (field: string) => {
    if (sortBy !== field) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    
    if (sortOrder === 'asc') {
      return (
        <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      );
    }
    
    return (
      <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  const handleApplyFilters = () => {
    onFilterChange?.(localFilters);
    setShowFilters(false);
  };

  const handleClearFilters = () => {
    setLocalFilters({});
    onClearFilters?.();
    setShowFilters(false);
  };

  if (loading) {
    return (
      <div className="w-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden min-h-[calc(100vh-280px)]">
        <div className="animate-pulse">
          <div className="h-14 bg-gray-100 border-b border-gray-200"></div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 border-b border-gray-100 flex items-center px-6 space-x-4">
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/3"></div>
              <div className="h-4 bg-gray-200 rounded w-1/6"></div>
              <div className="h-4 bg-gray-200 rounded w-1/5"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (creatives.length === 0) {
    return (
      <div className="w-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden min-h-[calc(100vh-280px)]">
        <div className="flex flex-col items-center justify-center h-full py-24 px-6">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-3">No Ad Creatives Found</h3>
          <p className="text-gray-500 text-center max-w-md text-base">
            Get started by creating your first Facebook Ad Creative. Click the "New Ad Creative" button above to begin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden min-h-[calc(100vh-280px)] flex flex-col">
      {/* Filter Panel */}
      {showFilters && (
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-end space-x-4">
            {/* Status Filter */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={localFilters.status || ''}
                onChange={(e) => setLocalFilters({ ...localFilters, status: e.target.value || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="IN_PROCESS">In Process</option>
                <option value="WITH_ISSUES">With Issues</option>
                <option value="DELETED">Deleted</option>
              </select>
            </div>

            {/* Call to Action Filter */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Call to Action
              </label>
              <select
                value={localFilters.call_to_action_type || ''}
                onChange={(e) => setLocalFilters({ ...localFilters, call_to_action_type: e.target.value || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">All Types</option>
                <option value="LEARN_MORE">Learn More</option>
                <option value="SHOP_NOW">Shop Now</option>
                <option value="SIGN_UP">Sign Up</option>
                <option value="DOWNLOAD">Download</option>
                <option value="BOOK_NOW">Book Now</option>
                <option value="CONTACT_US">Contact Us</option>
                <option value="APPLY_NOW">Apply Now</option>
                <option value="GET_QUOTE">Get Quote</option>
                <option value="SUBSCRIBE">Subscribe</option>
                <option value="NO_BUTTON">No Button</option>
              </select>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-2">
              <button
                onClick={handleApplyFilters}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
              >
                Apply
              </button>
              <button
                onClick={handleClearFilters}
                className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-300 transition-colors"
              >
                Clear
              </button>
              <button
                onClick={() => setShowFilters(false)}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto flex-1 max-h-96 min-h-96 overflow-y-auto">
        <table className="w-full">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-50 border-b border-gray-200">
              <th 
                className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => onSort?.('name')}
              >
                <div className="flex items-center space-x-1">
                  <span>Name</span>
                  {getSortIcon('name')}
                </div>
              </th>
              <th 
                className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => onSort?.('title')}
              >
                <div className="flex items-center space-x-1">
                  <span>Title</span>
                  {getSortIcon('title')}
                </div>
              </th>
              <th 
                className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => onSort?.('status')}
              >
                <div className="flex items-center space-x-1">
                  <span>Status</span>
                  {getSortIcon('status')}
                </div>
              </th>
              <th 
                className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => onSort?.('call_to_action_type')}
              >
                <div className="flex items-center space-x-1">
                  <span>Call to Action</span>
                  {getSortIcon('call_to_action_type')}
                </div>
              </th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {creatives.map((creative) => (
              <tr
                key={creative.id}
                className="hover:bg-gray-50 transition-colors"
              >
                {/* Name */}
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {creative.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        ID: {creative.id}
                      </div>
                    </div>
                  </div>
                </td>

                {/* Title */}
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900 max-w-xs truncate" title={creative.object_story_spec?.link_data?.name || ''}>
                    {creative.object_story_spec?.link_data?.name || '-'}
                  </div>
                </td>

                {/* Status */}
                <td className="px-6 py-4">
                  {creative.status && STATUS_COLORS[creative.status] ? (
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${
                        STATUS_COLORS[creative.status]
                      }`}
                    >
                      {creative.status}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </td>

                {/* Call to Action */}
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900">
                    {formatCallToAction(creative.call_to_action_type)}
                  </div>
                </td>


                {/* Actions */}
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end space-x-2">
                    {onView && (
                      <button
                        onClick={() => onView(creative.id)}
                        className="p-2 text-[#3CCED7] hover:bg-[#3CCED7]/10 rounded-lg transition-colors"
                        title="View"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                    )}
                    {onEdit && (
                      <button
                        onClick={() => onEdit(creative.id)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={() => onDelete(creative.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Toolbar with Filter Button */}
      {!showFilters && (onFilterChange || onClearFilters) && (
        <div className="px-6 py-3 border-t border-gray-200 bg-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowFilters(true)}
              className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <span>Filters</span>
            </button>
            
            {/* Active Filters Indicator */}
            {(filters.status || filters.call_to_action_type) && (
              <div className="flex items-center space-x-2">
                {filters.status && (
                  <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-indigo-100 text-indigo-800">
                    Status: {filters.status}
                  </span>
                )}
                {filters.call_to_action_type && (
                  <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-indigo-100 text-indigo-800">
                    CTA: {formatCallToAction(filters.call_to_action_type)}
                  </span>
                )}
                <button
                  onClick={onClearFilters}
                  className="text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
          
          {/* Sort Indicator with Clear Button */}
          {sortBy && (
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-md">
                <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                </svg>
                <span className="text-sm text-gray-700">
                  Sorted by: <span className="font-semibold text-indigo-700">{getFieldDisplayName(sortBy)}</span>
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                  {sortOrder === 'asc' ? '↑ Ascending' : '↓ Descending'}
                </span>
              </div>
              <button
                onClick={() => {
                  // Clear sorting by calling sort with empty string or reset
                  onSort?.('');
                }}
                className="flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:border-gray-400 transition-colors shadow-sm"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>Clear Sort</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Pagination Footer */}
      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-700">
              Showing{' '}
              <span className="font-semibold text-gray-900">
                {totalCount > 0 ? ((currentPage - 1) * pageSize) + 1 : 0}
              </span>
              {' '}-{' '}
              <span className="font-semibold text-gray-900">
                {Math.min(currentPage * pageSize, totalCount)}
              </span>
              {' '}of{' '}
              <span className="font-semibold text-gray-900">{totalCount}</span>
              {' '}ad creative{totalCount !== 1 ? 's' : ''}
            </div>
            
          </div>
          
          {/* Pagination Controls */}
          <div className="flex items-center space-x-2">
            {/* Previous Button */}
            <button
              onClick={onPreviousPage}
              disabled={!hasPrevious || loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            
            {/* Page Numbers */}
            <div className="flex items-center space-x-1">
              {totalPages <= 7 ? (
                // Show all pages if 7 or fewer
                [...Array(totalPages)].map((_, i) => (
                  <button
                    key={i + 1}
                    onClick={() => onPageChange?.(i + 1)}
                    className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      currentPage === i + 1
                        ? 'bg-indigo-600 text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))
              ) : (
                // Show condensed pagination for more than 7 pages
                <>
                  {currentPage > 3 && (
                    <>
                      <button
                        onClick={() => onPageChange?.(1)}
                        className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
                      >
                        1
                      </button>
                      {currentPage > 4 && <span className="px-2 text-gray-500">...</span>}
                    </>
                  )}
                  
                  {[...Array(5)].map((_, i) => {
                    const pageNum = currentPage - 2 + i;
                    if (pageNum < 1 || pageNum > totalPages) return null;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => onPageChange?.(pageNum)}
                        className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                          currentPage === pageNum
                            ? 'bg-indigo-600 text-white'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  
                  {currentPage < totalPages - 2 && (
                    <>
                      {currentPage < totalPages - 3 && <span className="px-2 text-gray-500">...</span>}
                      <button
                        onClick={() => onPageChange?.(totalPages)}
                        className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
                      >
                        {totalPages}
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
            
            {/* Next Button */}
            <button
              onClick={onNextPage}
              disabled={!hasNext || loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

