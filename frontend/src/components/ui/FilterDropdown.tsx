// src/components/ui/FilterDropdown.tsx
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { SelectOption } from '@/types/permission';

interface FilterDropdownProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  error?: string;
  loading?: boolean;
}

const FilterDropdown: React.FC<FilterDropdownProps> = ({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select...',
  disabled = false,
  className = '',
  error,
  loading = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find(option => option.id === value);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard event handling
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (disabled || loading) return;

    switch (event.key) {
      case 'Enter':
      case 'Space':
        event.preventDefault();
        setIsOpen(!isOpen);
        break;
      case 'Escape':
        setIsOpen(false);
        break;
      case 'ArrowDown':
        event.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          // Logic to move focus to next option can be implemented here
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (isOpen) {
          // Logic to move focus to previous option can be implemented here
        }
        break;
    }
  };

  const handleOptionClick = (optionId: string) => {
    if (disabled || loading) return;
    
    onChange(optionId);
    setIsOpen(false);
  };

  const handleToggle = () => {
    if (disabled || loading) return;
    setIsOpen(!isOpen);
  };

  return (
    <div className={`flex items-center w-fit gap-3 ${className}`}>
      <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
        {label}:
      </span>
      
      <div className="relative min-w-[150px]" ref={dropdownRef}>
        <button
          type="button"
          onClick={handleToggle}
          onKeyDown={handleKeyDown}
          disabled={disabled || loading}
          className={`
            relative w-full cursor-pointer rounded-lg bg-white py-2 pl-3 pr-10 text-left border transition-colors duration-200
            ${error 
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
              : 'border-gray-300 focus:border-[#3CCED7] focus:ring-[#3CCED7]'
            }
            ${disabled || loading
              ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
              : 'hover:border-gray-400'
            }
            focus:outline-none focus:ring-2 focus:ring-offset-2 sm:text-sm
          `}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-labelledby={`${label}-label`}
        >
          <span className="block truncate">
            {loading 
              ? 'Loading...' 
              : (value && selectedOption?.name) || placeholder
            }
          </span>
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#3CCED7]"></div>
            ) : (
              <ChevronDown 
                className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${
                  isOpen ? 'rotate-180' : ''
                }`} 
              />
            )}
          </span>
        </button>
        
        {/* Dropdown options */}
        {isOpen && !loading && (
          <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
            {options.length === 0 ? (
              <div className="px-4 py-2 text-sm text-gray-500">
                No options available
              </div>
            ) : (
              options.map((option) => (
                <button
                  key={option.id}
                  className={`
                    relative cursor-pointer select-none py-2 pl-10 pr-4 w-full text-left transition-colors duration-150
                    ${option.disabled 
                      ? 'text-gray-400 cursor-not-allowed' 
                      : 'text-gray-900 hover:bg-[#3CCED7]/15 hover:text-[#0f757a]'
                    }
                    ${value === option.id ? 'bg-[#3CCED7]/10 text-[#0f757a]' : ''}
                  `}
                  onClick={() => handleOptionClick(option.id)}
                  disabled={option.disabled}
                  role="option"
                  aria-selected={value === option.id}
                >
                  <span className={`block truncate ${
                    value === option.id ? 'font-medium' : 'font-normal'
                  }`}>
                    {option.name}
                  </span>
                  {value === option.id && (
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[#3CCED7]">
                      <Check className="h-5 w-5" />
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>
      
      {/* Error message */}
      {error && (
        <div className="mt-1 text-sm text-red-600">
          {error}
        </div>
      )}
    </div>
  );
};

export default FilterDropdown;