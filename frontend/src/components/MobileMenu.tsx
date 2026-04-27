'use client';

import { useState } from 'react';
import { Menu, X, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../lib/authStore';

const publicLinks = [
  { label: 'Product', href: '/docs/product' },
  { label: 'Solutions', href: '/solutions' },
  { label: 'Pricing', href: '/docs/pricing' },
  { label: 'Docs', href: '/docs' },
];

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
              {publicLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block text-gray-600 hover:text-brand-teal py-2 border-b border-gray-100 transition"
                  onClick={() => setIsOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              
              <div className="pt-4 space-y-3">
                {isAuthenticated ? (
                  <button 
                    onClick={handleLoginClick} 
                    className="block w-full px-6 py-3 text-brand-teal border border-brand-teal/40 rounded-full hover:bg-brand-teal/5 transition text-center font-medium"
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
                    className="block w-full px-6 py-3 text-brand-teal border border-brand-teal/40 rounded-full hover:bg-brand-teal/5 transition text-center font-medium"
                  >
                    Log in
                  </button>
                )}
                <button 
                  onClick={handleGetStartedClick} 
                  className="block w-full px-6 py-3 bg-brand-gradient text-white rounded-full hover:saturate-150 transition text-center font-medium glow-brand"
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
