'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import useAuth from '@/hooks/useAuth';
import { FormContainer } from '@/components/form';
import toast from 'react-hot-toast';

export default function VerifyEmailPage() {
  const [verificationStatus, setVerificationStatus] = useState<'loading' | 'success' | 'error' | 'already_verified'>('loading');
  const [message, setMessage] = useState<string>('');
  const searchParams = useSearchParams();
  const router = useRouter();
  const { verifyEmail } = useAuth();

  useEffect(() => {
    const token = searchParams.get('token');
    
    if (!token) {
      setVerificationStatus('error');
      setMessage('Verification token is missing. Please check your email for the correct link.');
      return;
    }

    const handleVerification = async () => {
      try {
        const result = await verifyEmail(token);
        
        if (result.success) {
          setVerificationStatus('success');
          setMessage('Email verified successfully! You can now log in to your account.');
          
          // Redirect to login page after 3 seconds
          setTimeout(() => {
            router.push('/login');
          }, 3000);
        } else {
          setVerificationStatus('error');
          setMessage(result.error || 'Email verification failed. Please try again.');
        }
      } catch (error) {
        console.error('Verification error:', error);
        setVerificationStatus('error');
        setMessage('An unexpected error occurred during verification.');
      }
    };

    handleVerification();
  }, [searchParams, verifyEmail, router]);

  const getStatusIcon = () => {
    switch (verificationStatus) {
      case 'loading':
        return (
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
        );
      case 'success':
        return (
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100">
            <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
        );
      case 'already_verified':
        return (
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100">
            <svg className="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
        );
      case 'error':
        return (
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100">
            <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </div>
        );
      default:
        return null;
    }
  };

  const getStatusColor = () => {
    switch (verificationStatus) {
      case 'success':
        return 'text-green-600';
      case 'already_verified':
        return 'text-blue-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getTitle = () => {
    switch (verificationStatus) {
      case 'loading':
        return 'Verifying Email...';
      case 'success':
        return 'Email Verified!';
      case 'already_verified':
        return 'Already Verified';
      case 'error':
        return 'Verification Failed';
      default:
        return 'Email Verification';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-cyan-50 py-12 px-4 sm:px-6 lg:px-8">
      <FormContainer title={getTitle()} subtitle="">
        <div className="text-center space-y-6">
          {getStatusIcon()}
          
          <div className="space-y-4">
            <p className={`text-lg ${getStatusColor()}`}>
              {message}
            </p>
            
            {verificationStatus === 'loading' && (
              <p className="text-sm text-gray-500">
                Please wait while we verify your email address...
              </p>
            )}
            
            {verificationStatus === 'success' && (
              <div className="space-y-2">
                <p className="text-sm text-gray-600">
                  You will be redirected to the login page in a few seconds.
                </p>
                <div className="pt-2">
                  <Link 
                    href="/login"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  >
                    Go to Login Now
                  </Link>
                </div>
              </div>
            )}
            
            {verificationStatus === 'already_verified' && (
              <div className="pt-2">
                <Link 
                  href="/login"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  Go to Login
                </Link>
              </div>
            )}
            
            {verificationStatus === 'error' && (
              <div className="space-y-3">
                <div className="text-sm text-gray-600">
                  <p>If you're having trouble, you can:</p>
                  <ul className="mt-2 space-y-1 text-left">
                    <li>• Check your email for the correct verification link</li>
                    <li>• Make sure the link hasn't expired</li>
                    <li>• Try registering again if the problem persists</li>
                  </ul>
                </div>
                
                <div className="flex space-x-3 justify-center">
                  <Link 
                    href="/register"
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  >
                    Register Again
                  </Link>
                  <Link 
                    href="/login"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  >
                    Try Login
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </FormContainer>
    </div>
  );
} 