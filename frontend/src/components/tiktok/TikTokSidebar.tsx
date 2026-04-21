'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  PlusIcon,
  EllipsisVerticalIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import {
  getBriefInfoList,
  saveAdGroup,
  deleteAdGroup,
  deleteAdDraft,
  saveAdDraft,
  AdGroupBriefInfo,
  BriefInfoItem
} from '@/lib/api/tiktokApi';

interface TikTokSidebarProps {
  onSelectAd?: (adDraftId: string, groupId: string) => void;
  // Currently selected ad draft id from page (controlled selection)
  selectedAdId?: string | null;
  // When this value changes, the sidebar will refetch groups and drafts from backend
  refreshKey?: number;
}

export default function TikTokSidebar({ onSelectAd, selectedAdId: selectedAdIdProp, refreshKey }: TikTokSidebarProps) {
  const [adGroups, setAdGroups] = useState<AdGroupBriefInfo[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [selectedAdId, setSelectedAdId] = useState<string | null>(selectedAdIdProp ?? null);
  const [contextMenu, setContextMenu] = useState<{
    groupId: string;
    groupGid: string;
    x: number;
    y: number;
  } | null>(null);
  const [adContextMenu, setAdContextMenu] = useState<{
    adId: string;
    groupId: string;
    x: number;
    y: number;
  } | null>(null);
  const [renamingGroup, setRenamingGroup] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const sidebarRef = React.useRef<HTMLDivElement>(null);

  // Helper function to format local time as YYYY-MM-DD HH:MM:SS
  const formatLocalDateTime = (date: Date = new Date()): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  // Fetch brief info list
  const fetchAdGroups = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getBriefInfoList({
        limit_groups: 50,
        offset_groups: 0,
        limit_items_per_group: 20
      });

      if (response.data) {
        const list = response.data.ad_group_brief_info_list;
        setAdGroups(list);
        const effectiveSelectedId = selectedAdIdProp ?? selectedAdId;
        // If we already have a selection (from prop or internal), preserve it after refresh
        if (effectiveSelectedId) {
          const groupWithSelected = list.find(g =>
            g.creative_brief_info_item_list.some(a => a.id === effectiveSelectedId)
          );
          if (groupWithSelected) {
            // ensure the group containing the selected ad is expanded
            setExpandedGroups(prev => new Set([...prev, groupWithSelected.gid]));
            // keep internal selection in sync if needed
            if (selectedAdId !== effectiveSelectedId) {
              setSelectedAdId(effectiveSelectedId);
            }
          }
          // Do not call onSelectAd again to avoid switching
        } else {
          // Initial load: auto-select the very first ad if exists
          if (list.length > 0) {
            const firstGroup = list[0];
          if (firstGroup.creative_brief_info_item_list.length > 0) {
            const firstAd = firstGroup.creative_brief_info_item_list[0];
            setSelectedAdId(firstAd.id);
            setExpandedGroups(new Set([firstGroup.gid]));
            onSelectAd?.(firstAd.id, firstGroup.id);
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch ad groups:', error);
    } finally {
      setLoading(false);
    }
  }, [onSelectAd, selectedAdIdProp, selectedAdId]);

  // Sync internal selected id with prop changes from page
  useEffect(() => {
    if (selectedAdIdProp !== undefined) {
      setSelectedAdId(selectedAdIdProp ?? null);
    }
  }, [selectedAdIdProp]);

  useEffect(() => {
    fetchAdGroups();
  }, [fetchAdGroups, refreshKey]);

  // Close context menu when clicking outside
  useEffect(() => {
    if (!contextMenu) return;

    const handleClick = () => {
      // Small delay to allow the context menu to be set first
      setTimeout(() => setContextMenu(null), 0);
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [contextMenu]);

  // Close ad context menu when clicking outside
  useEffect(() => {
    if (!adContextMenu) return;

    const handleClick = () => {
      setTimeout(() => setAdContextMenu(null), 0);
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [adContextMenu]);

  // Toggle group expansion
  const toggleGroup = (gid: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(gid)) {
        newSet.delete(gid);
      } else {
        newSet.add(gid);
      }
      return newSet;
    });
  };

  // Add new ad group
  const handleAddGroup = async () => {
    try {
      const timestamp = formatLocalDateTime();
      const newGroupName = `Ad group ${timestamp}`;

      await saveAdGroup({ name: newGroupName });
      await fetchAdGroups();
    } catch (error) {
      console.error('Failed to add ad group:', error);
    }
  };

  // Show context menu
  const handleContextMenu = (e: React.MouseEvent, group: AdGroupBriefInfo) => {
    e.preventDefault();
    e.stopPropagation();

    // Calculate position, offsetting left to avoid edge clipping
    // Assume context menu width is ~150px
    const menuWidth = 150;
    const menuHeight = 120; // Approximate height for 3 buttons

    let x = e.clientX;
    let y = e.clientY;

    // Adjust x if too close to right edge
    if (x + menuWidth > window.innerWidth) {
      x = e.clientX - menuWidth;
    }

    // Adjust y if too close to bottom edge
    if (y + menuHeight > window.innerHeight) {
      y = e.clientY - menuHeight;
    }

    console.log('Context menu clicked', { group, x, y });
    setContextMenu({
      groupId: group.id,
      groupGid: group.gid,
      x,
      y
    });
  };

  // Start renaming
  const handleRename = (group: AdGroupBriefInfo) => {
    setRenamingGroup(group.gid);
    setRenameValue(group.name);
    setContextMenu(null);
  };

  // Confirm rename
  const handleRenameConfirm = async (group: AdGroupBriefInfo) => {
    if (!renameValue.trim()) return;

    try {
      await saveAdGroup({
        id: group.id, // Use UUID from brief info
        name: renameValue.trim(),
      });
      await fetchAdGroups();
    } catch (error) {
      console.error('Failed to rename ad group:', error);
    } finally {
      setRenamingGroup(null);
      setRenameValue('');
    }
  };

  // Add ad to group
  const handleAddAd = async (group: AdGroupBriefInfo) => {
    try {
      const timestamp = formatLocalDateTime();
      const newAdName = `${timestamp}`;

      const res = await saveAdDraft({
        adgroup_id: group.id, // Use UUID from brief info
        form_data_list: [{
          name: newAdName
        }]
      });

      // Backend returns newly created ad draft ids
      const newId = res?.data?.['ad-draft-id']?.[0];

      // Ensure the list shows latest data
      await fetchAdGroups();

      if (newId) {
        // Expand the group, select the newly created ad, and notify parent
        setExpandedGroups(prev => new Set([...prev, group.gid]));
        setSelectedAdId(newId);
        onSelectAd?.(newId, group.id);
      }
    } catch (error) {
      console.error('Failed to add ad:', error);
    }
    setContextMenu(null);
  };

  // Delete ad group
  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('Are you sure you want to delete this ad group?')) return;

    try {
      await deleteAdGroup([groupId]); // Use UUID
      await fetchAdGroups();
    } catch (error) {
      console.error('Failed to delete ad group:', error);
    }
    setContextMenu(null);
  };

  // Delete ad draft
  const handleDeleteAd = async (adId: string) => {
    if (!confirm('Are you sure you want to delete this ad draft?')) return;
    try {
      await deleteAdDraft([adId]);
      // If we deleted the currently selected ad, clear selection
      if (selectedAdId === adId) {
        setSelectedAdId(null);
      }
      await fetchAdGroups();
    } catch (error) {
      console.error('Failed to delete ad:', error);
    }
    setAdContextMenu(null);
  };

  // Select ad
  const handleSelectAd = (ad: BriefInfoItem, groupId: string) => {
    setSelectedAdId(ad.id);
    // Pass UUIDs to parent component
    onSelectAd?.(ad.id, groupId);
  };

  // Get creative type icon/color
  const getCreativeTypeStyle = (type: string) => {
    if (type.includes('VIDEO')) {
      return 'bg-purple-100 border-purple-300';
    } else if (type.includes('IMAGE')) {
      return 'bg-[#3CCED7]/15 border-blue-300';
    }
    return 'bg-gray-100 border-gray-300';
  };

  return (
    <div ref={sidebarRef} className="h-full bg-white border-l border-gray-200 flex flex-col relative">
      {/* Header with Add Button */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Ad Groups</h3>
        <button
          onClick={handleAddGroup}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          title="Add Ad Group"
        >
          <PlusIcon className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Scrollable List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-sm text-gray-500">
            Loading...
          </div>
        ) : adGroups.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500">
            No ad groups yet. Click + to create one.
          </div>
        ) : (
          <div className="py-2">
            {adGroups.map((group) => (
              <div key={group.gid} className="mb-1">
                {/* Ad Group Row */}
                <div
                  className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center justify-between group"
                  onClick={() => toggleGroup(group.gid)}
                >
                  <div className="flex items-center flex-1 min-w-0">
                    {/* Expand/Collapse Icon */}
                    <button
                      className="mr-1 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleGroup(group.gid);
                      }}
                    >
                      {expandedGroups.has(group.gid) ? (
                        <ChevronDownIcon className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronRightIcon className="w-4 h-4 text-gray-500" />
                      )}
                    </button>

                    {/* Group Name */}
                    {renamingGroup === group.gid ? (
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => handleRenameConfirm(group)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameConfirm(group);
                          if (e.key === 'Escape') setRenamingGroup(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 px-2 py-1 text-sm border border-[#3CCED7] rounded outline-none"
                        autoFocus
                      />
                    ) : (
                      <span className="text-sm font-medium text-gray-700 truncate flex-1">
                        {group.name}
                      </span>
                    )}

                    {/* Ad Count */}
                    <span className="ml-2 text-xs text-gray-400 flex-shrink-0">
                      {group.creative_brief_info_item_list.length}
                    </span>
                  </div>

                  {/* Three Dots Menu */}
                  <button
                    onClick={(e) => handleContextMenu(e, group)}
                    className="ml-2 p-1 hover:bg-gray-200 rounded flex-shrink-0"
                  >
                    <EllipsisVerticalIcon className="w-4 h-4 text-gray-600" />
                  </button>
                </div>

                {/* Expanded Ads */}
                {expandedGroups.has(group.gid) && (
                  <div className="ml-6 space-y-1">
                    {group.creative_brief_info_item_list.map((ad) => (
                      <div
                        key={ad.id}
                        onClick={() => handleSelectAd(ad, group.id)}
                        className={`px-3 py-2 cursor-pointer flex items-center space-x-2 ${
                          selectedAdId === ad.id
                            ? 'bg-[#3CCED7]/10 border-l-2 border-[#3CCED7]'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        {/* Creative Type Indicator */}
                        <div className={`w-8 h-8 flex-shrink-0 rounded border ${getCreativeTypeStyle(ad.creative_type)}`}>
                          {ad.creative_type.includes('VIDEO') ? (
                            <div className="w-full h-full flex items-center justify-center text-xs text-purple-600 font-semibold">
                              V
                            </div>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-[#3CCED7] font-semibold">
                              I
                            </div>
                          )}
                        </div>

                        {/* Ad Name */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-700 truncate">
                            {ad.name || 'Unnamed Ad'}
                          </p>
                          <p className="text-xs text-gray-400">
                            {new Date(ad.create_timestamp * 1000).toLocaleDateString()}
                          </p>
                        </div>

                        {/* Warning Icon if opt_status != 0 */}
                        {ad.opt_status !== 0 && (
                          <ExclamationTriangleIcon className="w-4 h-4 text-red-500 flex-shrink-0" />
                        )}

                        {/* Ad three-dots menu */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            // Positioning with left offset to avoid clipping near right edge
                            const menuWidth = 150;
                            const menuHeight = 60; // single item
                            let x = rect.right - menuWidth; // prefer aligning right edges
                            let y = rect.bottom + 4;
                            if (x < 0) x = 8; // minimal left padding
                            if (y + menuHeight > window.innerHeight) {
                              y = rect.top - menuHeight - 4; // open upward if near bottom
                            }
                            setAdContextMenu({ adId: ad.id, groupId: group.id, x, y });
                          }}
                          className="p-1 hover:bg-gray-200 rounded flex-shrink-0"
                          aria-label="Ad actions"
                          title="Actions"
                        >
                          <EllipsisVerticalIcon className="w-4 h-4 text-gray-600" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <>
        {console.log('Rendering context menu', contextMenu)}
        <div
          className="fixed bg-white shadow-lg rounded-lg border border-gray-200 py-1 z-50 min-w-[150px]"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              const group = adGroups.find(g => g.gid === contextMenu.groupGid);
              if (group) handleRename(group);
            }}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
          >
            Rename
          </button>
          <button
            onClick={() => {
              const group = adGroups.find(g => g.gid === contextMenu.groupGid);
              if (group) handleAddAd(group);
            }}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
          >
            Add Ad
          </button>
          <button
            onClick={() => handleDeleteGroup(contextMenu.groupId)}
            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
        </>
      )}

      {/* Ad Context Menu */}
      {adContextMenu && (
        <div
          className="fixed bg-white shadow-lg rounded-lg border border-gray-200 py-1 z-50 min-w-[150px]"
          style={{ left: `${adContextMenu.x}px`, top: `${adContextMenu.y}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => handleDeleteAd(adContextMenu.adId)}
            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
          >
            Delete Ad
          </button>
        </div>
      )}
    </div>
  );
}
