import { useState } from 'react';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

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
}) {
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
            w-full px-3 py-2 border rounded-md shadow-sm transition-colors
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
            className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
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