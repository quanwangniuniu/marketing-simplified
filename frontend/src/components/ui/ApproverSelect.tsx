import React, { useState, useMemo, useRef } from 'react';
import { ChevronsUpDown, Check, X } from 'lucide-react';
import { ApproverUser } from '@/types/approver';

interface ApproverSelectProps {
  users: ApproverUser[];
  value: ApproverUser[];
  onChange: (value: ApproverUser[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const ApproverSelect: React.FC<ApproverSelectProps> = ({
  users,
  value,
  onChange,
  placeholder = 'Search for user...',
  className = '',
  disabled = false,
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredUsers = useMemo(() => {
    if (!query) return users;
    const q = query.toLowerCase();
    return users.filter(user =>
      user.username?.toLowerCase().includes(q) ||
      user.email?.toLowerCase().includes(q)
    );
  }, [users, query]);

  const handleSelect = (user: ApproverUser) => {
    if (value.some(u => u.id === user.id)) {
      // remove user
      onChange(value.filter(u => u.id !== user.id));
    } else {
      // add user
      onChange([...value, user]);
    }
    setQuery('');
    setIsOpen(false);
    if (inputRef.current) inputRef.current.blur();
  };

  const handleRemove = (userId: number) => {
    onChange(value.filter(u => u.id !== userId));
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          className="border rounded px-2 py-1 w-full"
          placeholder={placeholder}
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 150)}
          disabled={disabled}
        />
        <span className="absolute inset-y-0 right-0 flex items-center pr-2">
          <ChevronsUpDown className="h-5 w-5 text-gray-400" aria-hidden="true" />
        </span>
        {isOpen && (
          <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
            {filteredUsers.length === 0 && query && (
              <li className="relative cursor-default select-none py-2 px-4 text-gray-700">
                No users found.
              </li>
            )}
            {filteredUsers.map(user => (
              <li
                key={user.id}
                className={`relative cursor-pointer select-none py-2 pl-10 pr-4 ${
                  value.some(u => u.id === user.id) ? 'bg-[#3CCED7]/15 text-[#0f757a]' : 'text-gray-900'
                }`}
                onMouseDown={e => {
                  e.preventDefault();
                  handleSelect(user);
                }}
              >
                <span className={`block truncate ${value.some(u => u.id === user.id) ? 'font-medium' : 'font-normal'}`}>
                  {user.username || 'Unknown'}
                  <span className="text-xs text-gray-400">
                    ({user.email || 'No email'})
                  </span>
                </span>
                {value.some(u => u.id === user.id) && (
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[#3CCED7]">
                    <Check className="h-5 w-5" aria-hidden="true" />
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {/* Chosen user list */}
      <div className="mt-2">
        {value.length > 0 && (
          <div className="text-sm text-gray-600 mb-1">
            Selected users ({value.length}):
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {value.map(user => (
            <span key={user.id} className="inline-flex items-center rounded bg-[#3CCED7]/15 px-2 py-1 text-xs text-[#1a9ba3]">
              {user.username || 'Unknown'}
              <button
                type="button"
                className="ml-1 text-[#3CCED7] hover:text-[#1a9ba3]"
                onClick={() => handleRemove(user.id)}
                disabled={disabled}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ApproverSelect;