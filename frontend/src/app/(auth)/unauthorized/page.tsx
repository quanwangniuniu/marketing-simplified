'use client';

import { useRouter } from 'next/navigation';
import { ShieldExclamationIcon } from '@heroicons/react/24/outline';

export default function UnauthorizedPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <ShieldExclamationIcon className="mx-auto h-12 w-12 text-red-500" />
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Access Denied
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            You don't have permission to access this page. Please contact your administrator if you believe this is an error.
          </p>
        </div>
        
        <div className="mt-8 space-y-4">
          <button
            onClick={() => router.push('/campaigns')}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Go to Campaigns
          </button>
          
          <button
            onClick={() => router.push('/login')}
            className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
} 