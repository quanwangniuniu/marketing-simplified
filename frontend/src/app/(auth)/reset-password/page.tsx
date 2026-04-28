'use client';

  import { useState, useEffect } from 'react';
  import { useRouter, useSearchParams } from 'next/navigation';
  import Link from 'next/link';
  import { FormContainer, FormInput, FormButton, ErrorMessage } from '@/components/form';
  import toast, { Toaster } from 'react-hot-toast';
  import { authAPI } from '@/lib/api';

  interface FormData {
    password: string;
    confirmPassword: string;
  }

  interface FormErrors {
    password?: string;
    confirmPassword?: string;
    general?: string;
  }

  export default function ResetPasswordPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [token, setToken] = useState('');
    const [formData, setFormData] = useState<FormData>({ password: '', confirmPassword: '' });
    const [errors, setErrors] = useState<FormErrors>({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
      const tokenFromUrl = searchParams.get('token');
      if (!tokenFromUrl) {
        toast.error('Invalid or missing token');
        router.push('/login');
        return;
      }
      setToken(tokenFromUrl);
    }, [searchParams, router]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      setFormData(prev => ({ ...prev, [name]: value }));
      if (errors[name as keyof FormErrors]) {
        setErrors(prev => ({ ...prev, [name]: '' }));
      }
    };

    const validate = (): boolean => {
      const newErrors: FormErrors = {};
      if (!formData.password) {
        newErrors.password = 'Password is required';
      } else if (formData.password.length < 8) {
        newErrors.password = 'Password must be at least 8 characters';
      }
      if (!formData.confirmPassword) {
        newErrors.confirmPassword = 'Please confirm your password';
      } else if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!validate()) return;

      setLoading(true);
      try {
        await authAPI.resetPassword(token, formData.password);
        toast.success('Password reset successful!');
        router.push('/login');
      } catch (err: any) {
        const errorData = err.response?.data;
        if (errorData?.details && Array.isArray(errorData.details)) {
          setErrors({ password: errorData.details.join('. ') });
        } else {
          const message = errorData?.error || 'Failed to reset password. The link may have expired.';
          setErrors({ general: message });
          toast.error(message);
        }
      } finally {
        setLoading(false);
      }
    };

    const hasFieldErrors = Object.keys(errors).some(k => k !== 'general' && errors[k as keyof FormErrors]);

    return (
      <>
        <Toaster position="top-center" />
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-cyan-50 py-12 px-4
  sm:px-6 lg:px-8">
          <FormContainer
            title="Reset your password"
            subtitle="Enter a new password for your account"
          >
            <form onSubmit={handleSubmit} className="space-y-6">
              {errors.general && <ErrorMessage message={errors.general} />}

              <FormInput
                label="New Password"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                error={errors.password}
                required
                placeholder="Create a new password (min 8 characters)"
              />

              <FormInput
                label="Confirm Password"
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                error={errors.confirmPassword}
                required
                placeholder="Confirm your new password"
              />

              <FormButton
                type="submit"
                loading={loading}
                disabled={loading || hasFieldErrors}
              >
                {loading ? 'Resetting...' : 'Reset Password'}
              </FormButton>

              <div className="text-center">
                <Link href="/login" className="text-sm font-medium text-blue-600 hover:text-blue-500 transition-colors">
                  Back to Login
                </Link>
              </div>
            </form>
          </FormContainer>
        </div>
      </>
    );
  }
