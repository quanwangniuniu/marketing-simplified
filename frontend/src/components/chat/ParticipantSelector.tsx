'use client';

import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import api from '@/lib/api';
import type { ParticipantSelectorProps, ProjectMember } from '@/types/chat';

export default function ParticipantSelector({
  projectId,
  selectedIds,
  onSelect,
  maxSelection,
  currentUserId,
}: ParticipantSelectorProps) {
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Fetch project members
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        setIsLoading(true);
        const response = await api.get(`/api/core/projects/${projectId}/members/`);
        
        // API returns paginated results (object with 'results') or direct array
        let membersList: ProjectMember[] = [];
        if (Array.isArray(response.data)) {
          membersList = response.data;
        } else if (response.data && Array.isArray(response.data.results)) {
          membersList = response.data.results;
        } else {
          console.warn('Unexpected API response format for project members:', response.data);
          membersList = [];
        }
        
        // Filter out current user from the list (ensure numeric comparison)
        const filteredMembers = membersList.filter(
          (member: ProjectMember) => member.user.id !== currentUserId
        );
        
        setMembers(filteredMembers);
      } catch (error) {
        console.error('Error fetching project members:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (projectId) {
      fetchMembers();
    }
  }, [projectId, currentUserId]);

  // Filter members by search query
  const filteredMembers = members.filter((member) => {
    const query = searchQuery.toLowerCase();
    return (
      member.user.username?.toLowerCase().includes(query) ||
      member.user.email?.toLowerCase().includes(query)
    );
  });

  // Handle toggle selection
  const handleToggle = (userId: number) => {
    if (selectedIds.includes(userId)) {
      // Unselect
      onSelect(selectedIds.filter((id) => id !== userId));
    } else {
      // Select
      if (maxSelection && selectedIds.length >= maxSelection) {
        // Replace selection if max reached (for private chat)
        onSelect([userId]);
      } else {
        onSelect([...selectedIds, userId]);
      }
    }
  };

  return (
    <div className="space-y-3">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search members..."
          className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#3CCED7] focus:border-transparent text-sm"
        />
      </div>

      {/* Member List */}
      <div className="border border-gray-300 rounded-lg max-h-60 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3CCED7]"></div>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            {searchQuery ? 'No members found' : 'No team members available'}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredMembers.map((member) => (
              <label
                key={member.id}
                className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(member.user.id)}
                  onChange={() => handleToggle(member.user.id)}
                  className="w-4 h-4 text-[#3CCED7] border-gray-300 rounded focus:ring-[#3CCED7]"
                />

                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-[#3CCED7] text-white flex items-center justify-center font-medium text-sm flex-shrink-0">
                  {member.user.username?.charAt(0)?.toUpperCase() || '?'}
                </div>

                {/* Member Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">
                    {member.user.username || 'Unknown'}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {member.user.email}
                  </p>
                </div>

                {/* Role Badge */}
                {member.role && (
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded flex-shrink-0">
                    {member.role}
                  </span>
                )}
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

