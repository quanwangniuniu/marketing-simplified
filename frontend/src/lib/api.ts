import axios from 'axios';
import { 
  LoginRequest, 
  LoginResponse, 
  RegisterRequest, 
  RegisterResponse, 
  User, 
  AuthError,
  GoogleAuthResponse,
  SetPasswordRequest
} from '../types/auth';

const DEFAULT_API_BASE_URL = '';

const API_BASE_URL =
  (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.trim()) ||
  DEFAULT_API_BASE_URL;

// Create axios instance for API calls
// indexes: null => array params serialize as repeated keys (e.g. status=A&status=B)
// so Django QueryDict.getlist('status') works; default axios uses status[]=... which Django ignores.
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/plain, */*',
  },
  paramsSerializer: {
    indexes: null,
  },
});

// Request interceptor to add auth token to requests
api.interceptors.request.use(
  (config) => {
    // Get token from Zustand store instead of localStorage
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth-storage') : null;
    let parsedToken = null;
    let userData = null;
    let organizationToken = null;
    
    if (token) {
      try {
        const authData = JSON.parse(token);
        parsedToken = authData.state?.token;
        userData = authData.state?.user;
        organizationToken = authData.state?.organizationAccessToken;
      } catch (error) {
        console.warn('Failed to parse auth storage:', error);
      }
    }
    
    if (parsedToken) {
      config.headers.Authorization = `Bearer ${parsedToken}`;
    }
    
    // Add organization access token if available
    if (organizationToken) {
      config.headers['X-Organization-Token'] = organizationToken;
    }
    
    // Add user role header if available
    if (userData && userData.roles && userData.roles.length > 0) {
      // Use the first role as the primary role
      config.headers['x-user-role'] = userData.roles[0];
    }
    
    // Add team ID header if user has a team
    // Note: This is a placeholder - you may need to get team info from user data
    // For now, we'll set it to null or get it from user data if available
    if (userData && userData.team_id) {
      config.headers['x-team-id'] = userData.team_id.toString();
    }
    
    // Allow multipart/form-data to set its own Content-Type with boundary
    if (config.data instanceof FormData) {
      // axios will set the correct Content-Type when data is FormData
      delete (config.headers as any)['Content-Type'];
    } else {
      (config.headers as any)['Content-Type'] = 'application/json';
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle auth errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url;
    const responseData = error.response?.data;

    const isGoogleDocsUrl = typeof url === 'string' && url.startsWith('/api/google-docs/');
    const googleErrorMessage = responseData?.error;
    const googleErrorCode = responseData?.error_code;
    const isGoogleIntegrationTokenError =
      googleErrorCode === 'google_token_expired' ||
      googleErrorCode === 'google_unauthorized' ||
      (typeof googleErrorMessage === 'string' && googleErrorMessage.toLowerCase().includes('google session expired'));
    const shouldBypassGlobalLogout = isGoogleDocsUrl && isGoogleIntegrationTokenError;

    if (status === 401 && url !== '/auth/login/' && !shouldBypassGlobalLogout) {
      // Clear auth data and redirect to login on unauthorized requests
      // This will be handled by the Zustand store
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth-storage');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Authentication API functions - connected to Django backend
export const authAPI = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const response = await api.post('/auth/login/', credentials);
    return response.data;
  },
  
  register: async (userData: RegisterRequest): Promise<RegisterResponse> => {
    const response = await api.post('/auth/register/', userData);
    return response.data;
  },
  
  // Email verification endpoint
  verifyEmail: async (token: string): Promise<{ message: string }> => {
    const response = await api.get(`/auth/verify/?token=${token}`);
    return response.data;
  },
  
  getCurrentUser: async (): Promise<User> => {
    const response = await api.get('/auth/me/');
    return response.data;
  },
  
  logout: async (): Promise<{ message: string }> => {
    const response = await api.post('/auth/logout/');
    return response.data;
  },
  
  // Google OAuth endpoints
  googleSetPassword: async (data: SetPasswordRequest): Promise<GoogleAuthResponse> => {
    const response = await api.post('/auth/google/set-password/', data);
    return response.data;
  },

  refreshOrganizationToken: async (): Promise<{ organization_access_token: string }> => {
    const response = await api.post('/auth/organization-token/refresh/');
    return response.data;
  },

  // Profile update endpoint (handles both JSON and FormData for avatar uploads)
  updateProfile: async (profileData: { username?: string; first_name?: string; last_name?: string } | FormData): Promise<User> => {
    const config = profileData instanceof FormData 
      ? { headers: { 'Content-Type': 'multipart/form-data' } }
      : {};
    const response = await api.patch('/auth/me/', profileData, config);
    return response.data;
  },

  // Password reset endpoints
  forgotPassword: async(email: string):Promise<{ message:string }> =>{
    const response = await api.post('/auth/forgot-password/', { email });
    return response.data;
  },

  resetPassword: async(token: string, new_password: string):Promise<{ message:string }> =>{
    const response = await api.post('/auth/reset-password/', { token, new_password });
    return response.data;
  },

  deleteAccount: async (refreshToken: string): Promise<{ message: string }> => {
    const response = await api.delete('/auth/me/delete/', {
      data: { confirm: 'DELETE MY ACCOUNT', refresh_token: refreshToken },
    });
    return response.data;
  },
};

export default api; 