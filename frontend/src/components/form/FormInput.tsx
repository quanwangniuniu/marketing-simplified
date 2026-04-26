import { useState } from 'react';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

interface FormInputProps {
  label: string;
  type?: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export default function FormInput({
  label,
  type = 'text',
  name,
  value,
  onChange,
  error,
  placeholder,
  required = false,
  className = ''
}: FormInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(false);

  const inputType = type === 'password' && showPassword ? 'text' : type;

  return (
    <div className={`space-y-2 ${className}`}>
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>

      <div className="relative">
        <input
          type={inputType}
          name={name}
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          className={`
            w-full h-10 px-3 border rounded-md shadow-sm transition-colors leading-6
            ${type === 'password' ? 'pr-10' : 'py-2'}
            ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' :
              focused ? 'border-[#3CCED7] focus:border-[#3CCED7] focus:ring-[#3CCED7]' :
              'border-gray-300 focus:border-[#3CCED7] focus:ring-[#3CCED7]'}
            focus:outline-none focus:ring-1
          `}
        />

        {type === 'password' && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 inset-y-0 my-auto h-10 flex items-center text-gray-400 hover:text-gray-600"
          >
            {showPassword ? (
              <EyeSlashIcon className="h-5 w-5" />
            ) : (
              <EyeIcon className="h-5 w-5" />
            )}
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
