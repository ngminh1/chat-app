import axios from 'axios';
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://chatapp-backend-8lwp.onrender.com';

export const API_BASE = `${BACKEND_URL}/api`;
export const WS_URL = `${BACKEND_URL}/ws`;
// Một cấu hình xác thực chung cho mọi REST request tới Dispatch.
axios.interceptors.request.use((request) => {
  if (typeof window === 'undefined' || !request.url?.startsWith(API_BASE)) return request;
  const token = localStorage.getItem('auth_token');
  if (token) request.headers.set('Authorization', `Bearer ${token}`);
  return request;
});
