import React from 'react';
import { Grid3x3, User } from 'lucide-react';
import MobileMenu from '../MobileMenu';
import Image from 'next/image';

type HeaderSectionProps = {
  isAuthenticated: boolean;
  displayName: string;
  displayRole: string;
  onLoginClick: () => void;
  onGetStartedClick: () => void;
  onRedirectToLogin: () => void;
};

export default function HeaderSection({
  isAuthenticated,
  displayName,
  displayRole,
  onLoginClick,
  onGetStartedClick,
  onRedirectToLogin,
}: HeaderSectionProps) {
  return (
    <>
      <header className="hidden md:block fixed top-0 left-0 right-0 border-b border-gray-200 bg-white z-50">
        <div className="max-w-7xl mx-auto px-6 py-2 flex items-center justify-between">
          <div className="flex items-center gap-12">
             <div className="flex items-center">
              <Image
                src="/marketing_simplified_logo.png"
                alt="Marketing Simplified Logo"
                width={400}
                height={100}
                className="h-20 w-auto"
                priority
              />
            </div>
            <nav className="hidden lg:flex gap-6">
              <a href="#features" className="text-gray-600 hover:text-brand-teal transition border-b-2 border-transparent hover:border-brand-teal pb-0.5">Features</a>
              <a href="#solutions" className="text-gray-600 hover:text-brand-teal transition border-b-2 border-transparent hover:border-brand-teal pb-0.5">Solutions</a>
              <a href="#how-it-works" className="text-gray-600 hover:text-brand-teal transition border-b-2 border-transparent hover:border-brand-teal pb-0.5">Pricing</a>
              <a href="#testimonials" className="text-gray-600 hover:text-brand-teal transition border-b-2 border-transparent hover:border-brand-teal pb-0.5">Resources</a>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <button
                onClick={onLoginClick}
                className="max-w-[250px] px-6 py-2 text-brand-teal border border-brand-teal/40 rounded-full hover:bg-brand-teal/10 transition-all inline-flex items-center cursor-pointer"
              >
                <span className="inline-flex items-center gap-2 min-w-0">
                  <User className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{displayName}</span>
                  <span className="text-xs text-gray-500 flex-shrink-0">{displayRole}</span>
                </span>
              </button>
            ) : (
              <button
                onClick={onLoginClick}
                className="px-6 py-2 text-brand-teal border border-brand-teal/40 rounded-full hover:bg-brand-teal/10 transition-all inline-flex items-center cursor-pointer"
              >
                Log in
              </button>
            )}
            <button
              onClick={onGetStartedClick}
              className="px-6 py-2 bg-brand-gradient text-white rounded-full hover:saturate-150 transition-all glow-brand min-w-[130px]"
            >
              Get Started
            </button>
            <button
              onClick={onRedirectToLogin}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition"
            >
              <Grid3x3 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>
      {/* Spacer to offset fixed desktop header */}
      <div className="hidden md:block h-24" />

      <header className="block md:hidden fixed top-0 left-0 right-0 border-b border-gray-200 bg-white z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center">
              <Image
                src="/marketing_simplified_logo.png"
                alt="Marketing Simplified Logo"
                width={340}
                height={85}
                className="h-16 w-auto"
                priority
              />
            </div>
          <MobileMenu />
        </div>
      </header>
      {/* Spacer to offset fixed mobile header */}
      <div className="block md:hidden h-24" />
    </>
  );
}
