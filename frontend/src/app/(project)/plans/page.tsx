'use client';

import Link from 'next/link';
import PlansSection from '@/components/plans/PlansSection';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

function PlansPageContent() {
  const renderLayout = (content: React.ReactNode) => (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col">
      <style jsx global>{`
        @keyframes scale {
          0% { opacity: 0; transform: scale(1.015) translateZ(0); }
          100% { opacity: 1; transform: scale(1) translateZ(0); }
        }
      `}</style>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white shadow-sm border-b border-gray-300 h-[85px]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
          <div className="flex justify-between items-center h-full">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Link href="/">
                  <h1 className="text-2xl font-bold text-indigo-600 cursor-pointer">Marketing Simplified</h1>
                </Link>
              </div>
            </div>
            <nav className="hidden md:flex space-x-8">
              <Link href="/campaigns" className="text-gray-500 hover:text-gray-900 px-3 py-2 text-sm font-medium">
                Campaigns
              </Link>
              <Link href="/api/docs" className="text-gray-500 hover:text-gray-900 px-3 py-2 text-sm font-medium">
                API Docs
              </Link>
              <Link href="/plans" className="text-gray-500 hover:text-gray-900 px-3 py-2 text-sm font-medium">
                Test Pages
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {content}
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 mt-auto">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h3 className="text-2xl font-bold text-white">Marketing Simplified</h3>
            <p className="mt-2 text-gray-400">Professional campaign management platform</p>
            <div className="mt-8 flex justify-center space-x-6">
              <Link href="/campaigns" className="text-gray-400 hover:text-white">Campaigns</Link>
              <Link href="/api/docs" className="text-gray-400 hover:text-white">API Documentation</Link>
            </div>
          </div>
        </div>
      </footer>
      
    </div>
  );

  return renderLayout(
    <div className="bg-white">
      <PlansSection />
    </div>
  );
}

export default function PlansPage() {
  return (
    <ProtectedRoute>
      <PlansPageContent />
    </ProtectedRoute>
  );
}


