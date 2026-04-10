'use client';

import { useState } from 'react';
import { Menu, X, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../lib/authStore';

export default function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const { initialized, isAuthenticated, user } = useAuthStore();

  const displayName = user?.username || user?.email || 'User';
  const displayRole = user?.roles?.[0] || 'Member';

  const handleLoginClick = () => {
    if (!initialized) return;
    if (isAuthenticated) {
      router.push('/profile');
      return;
    }
    router.push('/login');
  };

  const handleGetStartedClick = () => {
    if (!initialized) return;
    if (isAuthenticated) {
      router.push('/tasks');
      return;
    }
    router.push('/login');
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition"
        aria-label="Toggle menu"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            onClick={() => setIsOpen(false)}
          />
          
          <div className="absolute top-full left-0 right-0 bg-white/95 backdrop-blur-xl border-b border-gray-200 shadow-2xl z-50">
            <nav className="px-6 py-4 space-y-4">
              <a 
                href="#" 
                className="block text-gray-600 hover:text-gray-900 py-2 border-b border-gray-100 transition"
                onClick={() => setIsOpen(false)}
              >
                Features
              </a>
              <a 
                href="#" 
                className="block text-gray-600 hover:text-gray-900 py-2 border-b border-gray-100 transition"
                onClick={() => setIsOpen(false)}
              >
                Solutions
              </a>
              <a 
                href="#" 
                className="block text-gray-600 hover:text-gray-900 py-2 border-b border-gray-100 transition"
                onClick={() => setIsOpen(false)}
              >
                Pricing
              </a>
              <a 
                href="#" 
                className="block text-gray-600 hover:text-gray-900 py-2 border-b border-gray-100 transition"
                onClick={() => setIsOpen(false)}
              >
                Resource
              </a>
              
              <div className="pt-4 space-y-3">
                {isAuthenticated ? (
                  <button 
                    onClick={handleLoginClick} 
                    className="block w-full px-6 py-3 text-indigo-600 border border-indigo-300 rounded-full hover:bg-indigo-50 transition text-center font-medium"
                  >
                    <span className="inline-flex items-center gap-2 justify-center">
                      <User className="w-4 h-4" />
                      <span>{displayName}</span>
                      <span className="text-xs text-gray-500">{displayRole}</span>
                    </span>
                  </button>
                ) : (
                  <button 
                    onClick={handleLoginClick} 
                    className="block w-full px-6 py-3 text-indigo-600 border border-indigo-300 rounded-full hover:bg-indigo-50 transition text-center font-medium"
                  >
                    Log in
                  </button>
                )}
                <button 
                  onClick={handleGetStartedClick} 
                  className="block w-full px-6 py-3 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-full hover:from-indigo-600 hover:to-violet-600 transition text-center font-medium glow-indigo"
                >
                  Get Started
                </button>
              </div>
            </nav>
          </div>
        </>
      )}
    </>
  );
}
