'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthFormWrapper from '@/components/auth/AuthFormWrapper';
import AuthFeedback from '@/components/auth/AuthFeedback';
import AuthFields from '@/components/auth/AuthFields';
import AuthSubmit from '@/components/auth/AuthSubmit';
import useAuth from '@/hooks/useAuth';
import { useAuthStore } from '@/lib/authStore';
import { validateLoginForm, hasValidationErrors } from '@/utils/validation';
import { LoginRequest, FormValidation } from '@/types/auth';
import { LOGIN_ERROR_MESSAGES, isNetworkError } from '@/lib/authMessages';
import toast, { Toaster } from 'react-hot-toast';

const SAVED_LOGIN_EMAIL_KEY = 'saved-login-email';

function LoginPageContent() {
  const router = useRouter();
  const { login } = useAuth();
  const { initialized, loading: authLoading, isAuthenticated } = useAuthStore();
  const [formData, setFormData] = useState<LoginRequest>({
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState<FormValidation>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [showEmailVerificationHelp, setShowEmailVerificationHelp] = useState<boolean>(false);

  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem(SAVED_LOGIN_EMAIL_KEY);
      if (savedEmail) {
        setFormData((prev: LoginRequest) => ({ ...prev, email: savedEmail }));
      }
    } catch {
      // ignore storage failures (private mode, disabled storage, etc.)
    }
  }, []);

  useEffect(() => {
    if (!initialized || authLoading) return;
    if (isAuthenticated) {
      router.replace('/campaigns');
    }
  }, [authLoading, initialized, isAuthenticated, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev: LoginRequest) => ({
      ...prev,
      [name]: value
    }));

    if (name === 'email') {
      try {
        localStorage.setItem(SAVED_LOGIN_EMAIL_KEY, value);
      } catch {
        // ignore storage failures
      }
    }
    
    // Clear error when user starts typing
    if (errors[name as keyof FormValidation]) {
      setErrors((prev: FormValidation) => ({
        ...prev,
        [name]: ''
      }));
    }
    
    // Clear email verification help when user starts typing
    if (showEmailVerificationHelp) {
      setShowEmailVerificationHelp(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors = validateLoginForm(formData);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    setLoading(true);

    try {
      const result = await login(formData);
      
      if (result.success) {
        try {
          localStorage.removeItem(SAVED_LOGIN_EMAIL_KEY);
        } catch {
          // ignore storage failures
        }
        toast.success('Login successful!', {
          duration: 2000,
          position: 'top-center',
        });
      } else {
        handleLoginError(result);
      }
    } catch (error: any) {
      console.error('Login error:', error);
      const message = isNetworkError(error) ? LOGIN_ERROR_MESSAGES.NETWORK : LOGIN_ERROR_MESSAGES.GENERIC;
      toast.error(message, { position: 'top-center' });
    } finally {
      setLoading(false);
    }
  };

  const handleLoginError = (result: any) => {
    const { errorCode, statusCode } = result;
    const message = result.error;

    if (errorCode === 'EMAIL_NOT_VERIFIED' || message?.includes('not verified')) {
      setShowEmailVerificationHelp(true);
      toast.error(LOGIN_ERROR_MESSAGES.EMAIL_NOT_VERIFIED, {
        duration: 4000,
        position: 'top-center',
      });
      return;
    }

    if (errorCode === 'NETWORK_ERROR') {
      toast.error(LOGIN_ERROR_MESSAGES.NETWORK, {
        duration: 4000,
        position: 'top-center',
      });
    } else if (errorCode === 'USER_NOT_FOUND' || statusCode === 404) {
      toast.error(LOGIN_ERROR_MESSAGES.EMAIL_NOT_REGISTERED, {
        duration: 4000,
        position: 'top-center',
      });
      // For invalid/unregistered email, clear both email and password fields
      setFormData((prev: LoginRequest) => ({
        ...prev,
        email: '',
        password: '',
      }));
      try {
        localStorage.removeItem(SAVED_LOGIN_EMAIL_KEY);
      } catch {
        // ignore storage failures
      }
    } else if (errorCode === 'INVALID_PASSWORD' || statusCode === 401) {
      toast.error(LOGIN_ERROR_MESSAGES.INVALID_PASSWORD, {
        duration: 4000,
        position: 'top-center',
      });
      // For invalid password, keep email but clear password so user retypes it
      setFormData((prev: LoginRequest) => ({
        ...prev,
        password: '',
      }));
    } else if (errorCode === 'PASSWORD_NOT_SET' || (statusCode === 403 && message?.toLowerCase().includes('password not set'))) {
      toast.error(LOGIN_ERROR_MESSAGES.PASSWORD_NOT_SET, {
        duration: 4000,
        position: 'top-center',
      });
    } else if (statusCode === 400) {
      toast.error(message || LOGIN_ERROR_MESSAGES.VALIDATION, {
        duration: 4000,
        position: 'top-center',
      });
    } else if (statusCode === 500) {
      toast.error(LOGIN_ERROR_MESSAGES.SERVER, {
        duration: 4000,
        position: 'top-center',
      });
    } else {
      toast.error(message || LOGIN_ERROR_MESSAGES.GENERIC, {
        duration: 4000,
        position: 'top-center',
      });
    }
    setErrors({});
  };

  const handleGoogleLogin = async (): Promise<void> => {
    try {
      // Call backend to get Google OAuth URL
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const response = await fetch(`${apiUrl}/auth/google/start/`);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = data.details || data.error || 'Failed to initiate Google sign-in';
        toast.error(message);
        return;
      }

      if (data.authorization_url) {
        // Redirect to Google OAuth page
        window.location.href = data.authorization_url;
      } else {
        toast.error('Failed to initiate Google sign-in');
      }
    } catch (error) {
      console.error('Google login error:', error);
      toast.error('Failed to initiate Google sign-in');
    }
  };

  // Disable submit button if form has validation errors (excluding general errors)
  const formHasValidationErrors = hasValidationErrors(errors);

  if (initialized && isAuthenticated) {
    return null;
  }

  return (
    <>
    <Toaster position="top-center" />
    <AuthFormWrapper title="Sign In">
      <form onSubmit={handleSubmit} className="space-y-6">
        <AuthFeedback
          generalError={errors.general}
          showEmailVerificationHelp={showEmailVerificationHelp}
          onDismissEmailVerification={() => setShowEmailVerificationHelp(false)}
        />

        <AuthFields
          fields={[
            {
              label: 'Email',
              type: 'email',
              name: 'email',
              value: formData.email,
              onChange: handleChange,
              error: errors.email,
              required: true,
              placeholder: 'Enter your email',
            },
            {
              label: 'Password',
              type: 'password',
              name: 'password',
              value: formData.password,
              onChange: handleChange,
              error: errors.password,
              required: true,
              placeholder: 'Enter your password',
            },
          ]}
          footer={
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-gray-600 hover:text-gray-500 transition-colors"
            >
              Forgot password?
            </Link>
          }
          footerAlign="end"
        />

        <AuthSubmit
          loading={loading}
          disabled={loading || formHasValidationErrors}
          onSubmitClick={() => {}}
          submitLabel="Sign in"
          auxiliary={
            <>
              <span className="text-gray-600">Don't have an account? </span>
              <Link
                href="/register"
                className="text-sm font-medium text-blue-600 hover:text-blue-500 transition-colors"
              >
                Sign up
              </Link>
            </>
          }
          dividerText="Or continue with"
          googleLabel="Sign in with Google"
          onGoogleLogin={handleGoogleLogin}
        />
      </form>
    </AuthFormWrapper>
    </>
  );
}

export default LoginPageContent;
