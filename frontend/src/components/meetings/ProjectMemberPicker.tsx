'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';

import { ProjectAPI, type ProjectMemberData } from '@/lib/api/projectApi';
import {
  formatProjectMemberLabel,
  projectMemberSearchBlob,
} from '@/components/meetings/projectMemberLabel';

export type ProjectMemberPickerProps = {
  projectId: number;
  /** User ids that cannot be chosen (e.g. already a participant). */
  excludeUserIds: number[];
  disabled?: boolean;
  className?: string;
  /**
   * Controlled: current selected user id (meeting detail — pick then press Add with role).
   * Use with onChange.
   */
  value?: number | null;
  onChange?: (userId: number | null) => void;
  /**
   * Immediate: each list choice adds this user (create meeting — chip list).
   * Do not pass value/onChange when using onPickUser.
   */
  onPickUser?: (userId: number) => void;
};

/**
 * Searchable list of active project members (SMP-484 #2).
 */
export function ProjectMemberPicker({
  projectId,
  excludeUserIds,
  disabled,
  className = '',
  value = null,
  onChange,
  onPickUser,
}: ProjectMemberPickerProps) {
  const [members, setMembers] = useState<ProjectMemberData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const immediateMode = Boolean(onPickUser);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setLoadError(null);
        const list = await ProjectAPI.getAllProjectMembers(projectId);
        if (!cancelled) {
          setMembers(list.filter((m) => m.is_active));
        }
      } catch {
        if (!cancelled) setLoadError('Could not load members');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const excludeSet = useMemo(() => new Set(excludeUserIds), [excludeUserIds]);

  const selectable = useMemo(
    () => members.filter((m) => !excludeSet.has(m.user.id)),
    [members, excludeSet],
  );

  const selectedMember = useMemo(() => {
    if (value == null) return null;
    return members.find((m) => m.user.id === value) ?? null;
  }, [members, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = selectable;
    if (!q) return pool.slice(0, 20);
    return pool.filter((m) => projectMemberSearchBlob(m).includes(q)).slice(0, 20);
  }, [selectable, query]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const handleSelect = (m: ProjectMemberData) => {
    if (onPickUser) {
      onPickUser(m.user.id);
      setQuery('');
      setOpen(false);
      return;
    }
    onChange?.(m.user.id);
    setQuery('');
    setOpen(false);
  };

  const showList = open && !disabled && !loading && !loadError;

  const inputDisplay =
    immediateMode || open
      ? query
      : selectedMember
        ? formatProjectMemberLabel(selectedMember)
        : query;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <div className="flex gap-1">
        <div className="relative min-w-0 flex-1">
          <input
            type="text"
            autoComplete="off"
            disabled={disabled || loading}
            placeholder={
              loading
                ? 'Loading members…'
                : loadError
                  ? loadError
                  : 'Search name, email, or id…'
            }
            value={inputDisplay}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              if (!immediateMode) onChange?.(null);
            }}
            onFocus={() => {
              setOpen(true);
              setQuery('');
            }}
            className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-[#3CCED7] focus:outline-none focus:ring-1 focus:ring-[#3CCED7] disabled:bg-gray-50"
            aria-expanded={open}
            aria-haspopup="listbox"
            role="combobox"
          />
          {loading ? (
            <Loader2
              className="pointer-events-none absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400"
              aria-hidden
            />
          ) : null}
        </div>
        {!immediateMode && value != null && !disabled ? (
          <button
            type="button"
            onClick={() => {
              onChange?.(null);
              setQuery('');
            }}
            className="shrink-0 rounded-md border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"
            aria-label="Clear selection"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {showList ? (
        <ul
          className="absolute z-30 mt-1 max-h-52 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg"
          role="listbox"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-500">No matching members</li>
          ) : (
            filtered.map((m) => (
              <li key={m.id} role="option">
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-[#3CCED7]/10 focus:bg-[#3CCED7]/10 focus:outline-none"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(m)}
                >
                  <span className="font-medium text-gray-900">{formatProjectMemberLabel(m)}</span>
                  {m.role ? (
                    <span className="mt-0.5 block text-xs text-gray-500">Role: {m.role}</span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
