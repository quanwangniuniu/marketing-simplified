'use client';                                                                                                                        
                                                                                                                                     
  import { useState } from 'react';                                                                                                    
  import Link from 'next/link';                                                                                                      
  import { FormContainer, FormInput, FormButton, ErrorMessage } from '@/components/form';
  import toast, { Toaster } from 'react-hot-toast';
  import { authAPI } from '@/lib/api';        
                                                                                                                                       
  export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');                                                                                            
    const [loading, setLoading] = useState(false);                                                                                   
    const [submitted, setSubmitted] = useState(false);                                                                                 
    const [error, setError] = useState('');                                                                                          
                                                                                                                                       
    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();                                                                                                              
      if (!email) {                                                                                                                    
        setError('Email is required');
        return;                                                                                                                        
      }                                                                                                                              
      setLoading(true);
      setError('');                                                                                                                    
  
      try {                                                                                                                            
        await authAPI.forgotPassword(email);                                                                                         
        setSubmitted(true);
      } catch (err: any) {
        const message = err.response?.data?.error || 'Something went wrong. Please try again.';
        toast.error(message);             
      } finally {
        setLoading(false);                                                                                                             
      }                                   
    };                                                                                                                                 
                                                                                                                                       
    if (submitted) {
      return (                                                                                                                         
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-cyan-50 py-12 px-4 
  sm:px-6 lg:px-8">                           
          <FormContainer title="Check your email" subtitle={`We've sent a reset link to ${email}`}>
            <div className="text-center space-y-4">
              <p className="text-sm text-gray-600">                                                                                    
                Didn't receive it? Check your spam folder, or{' '}
                <button                                                                                                                
                  className="text-blue-600 hover:text-blue-500 font-medium"                                                            
                  onClick={() => setSubmitted(false)}                                                                                  
                >                                                                                                                      
                  try again                                                                                                          
                </button>                                                                                                              
                .                                                                                                                    
              </p>
              <Link href="/login" className="block text-sm font-medium text-blue-600 hover:text-blue-500">                             
                Back to Login                 
              </Link>                                                                                                                  
            </div>                                                                                                                   
          </FormContainer>                                                                                                             
        </div>
      );                                                                                                                               
    }                                                                                                                                
                                              
    return (                              
      <>
        <Toaster position="top-center" />                                                                                              
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-cyan-50 py-12 px-4 
  sm:px-6 lg:px-8">                                                                                                                    
          <FormContainer                                                                                                             
            title="Forgot your password?"
            subtitle="Enter your email and we'll send you a reset link"                                                                
          >                                   
            <form onSubmit={handleSubmit} className="space-y-6">                                                                       
              {error && <ErrorMessage message={error} />}                                                                            
                                                                                                                                       
              <FormInput                  
                label="Email"                                                                                                          
                type="email"                                                                                                           
                name="email"
                value={email}                                                                                                          
                onChange={(e) => setEmail(e.target.value)}                                                                           
                required
                placeholder="Enter your email"
              />                          

              <FormButton type="submit" loading={loading} disabled={loading}>                                       
                {loading ? 'Sending...' : 'Send Reset Link'}
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