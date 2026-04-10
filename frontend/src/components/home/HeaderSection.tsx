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
      <header className="hidden md:block border-b border-gray-200 bg-white/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-12">
             <div className="flex items-center">
              <Image
                    src="/homepage_logo_square.jpeg"
                    alt="Marketing Simplified Logo"
                    width={278}
                    height={69}
                    className="h-16 w-auto"
                    priority
                  />
              <h1 className="text-3xl font-bold">
                <span className="text-indigo-600">Marketing</span>
                <span className="text-gray-900"> Simplified</span>
              </h1>
            </div>
            <nav className="hidden lg:flex gap-6">
              <a href="#features" className="text-gray-600 hover:text-gray-900 transition">Features</a>
              <a href="#solutions" className="text-gray-600 hover:text-gray-900 transition">Solutions</a>
              <a href="#how-it-works" className="text-gray-600 hover:text-gray-900 transition">Pricing</a>
              <a href="#testimonials" className="text-gray-600 hover:text-gray-900 transition">Resources</a>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <button
                onClick={onLoginClick}
                className="px-6 py-2 text-indigo-600 border border-indigo-300 rounded-full hover:bg-indigo-50 transition inline-flex items-center cursor-pointer"
              >
                <span className="inline-flex items-center gap-2">
                  <User className="w-4 h-4" />
                  <span>{displayName}</span>
                  <span className="text-xs text-gray-500">{displayRole}</span>
                </span>
              </button>
            ) : (
              <button
                onClick={onLoginClick}
                className="px-6 py-2 text-indigo-600 border border-indigo-300 rounded-full hover:bg-indigo-50 transition inline-flex items-center cursor-pointer"
              >
                Log in
              </button>
            )}
            <button
              onClick={onGetStartedClick}
              className="px-6 py-2 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-full hover:from-indigo-600 hover:to-violet-600 transition glow-indigo"
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

      <header className="block md:hidden border-b border-gray-200 bg-white/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center">
              <Image
                    src="/homepage_logo_square.jpeg"
                    alt="Marketing Simplified Logo"
                    width={278}
                    height={69}
                    className="h-16 w-auto"
                    priority
                  />
              <h1 className="text-2xl font-bold">
                <span className="text-indigo-600">Marketing</span>
                <span className="text-gray-900"> Simplified</span>
              </h1>
            </div>
          <MobileMenu />
        </div>
      </header>
    </>
  );
}
