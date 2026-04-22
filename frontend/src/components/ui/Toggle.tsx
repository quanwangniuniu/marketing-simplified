import React from 'react';

interface ToggleProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  description?: string;
}

const Toggle: React.FC<ToggleProps> = ({
  id,
  label,
  checked,
  onChange,
  disabled = false,
  description
}) => {
  return (
    <div className="flex items-center justify-between py-4">
      <div className="flex-1">
        <label 
          htmlFor={id}
          className={`block text-sm font-medium ${
            disabled ? 'text-gray-400' : 'text-gray-700'
          }`}
        >
          {label}
        </label>
        {description && (
          <p className={`mt-1 text-xs ${
            disabled ? 'text-gray-300' : 'text-gray-500'
          }`}>
            {description}
          </p>
        )}
      </div>
      <div className="flex items-center">
        <button
          type="button"
          className={`
            relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer 
            rounded-full border-2 border-transparent transition-colors 
            duration-200 ease-in-out focus:outline-none focus:ring-2 
            focus:ring-[#3CCED7] focus:ring-offset-2
            ${disabled ? 'cursor-not-allowed opacity-50' : ''}
            ${checked 
              ? 'bg-[#3CCED7]' 
              : 'bg-gray-200'
            }
          `}
          role="switch"
          aria-checked={checked}
          aria-labelledby={id}
          disabled={disabled}
          onClick={() => !disabled && onChange(!checked)}
        >
          <span
            className={`
              pointer-events-none inline-block h-5 w-5 transform 
              rounded-full bg-white shadow ring-0 transition 
              duration-200 ease-in-out
              ${checked ? 'translate-x-5' : 'translate-x-0'}
            `}
          />
        </button>
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={(e) => !disabled && onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only"
        />
      </div>
    </div>
  );
};

export default Toggle; 