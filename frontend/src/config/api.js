import axios from 'axios';
const BACKEND_URL = import.meta.env?.VITE_BACKEND_URL || 'https://chatapp-backend-8lwp.onrender.com';

export const API_BASE = `${BACKEND_URL}/api`;
export const WS_URL = `${BACKEND_URL}/ws`;
// Public/auth and legacy media requests capture credentials at invocation.
// Preserve explicit credentials (notably logout presence for the old account).
// Private session requests use their own immutable client instead.
axios.interceptors.request.use((request) => {
  if (typeof window === 'undefined' || !request.url?.startsWith(API_BASE)) return request;
  const token = localStorage.getItem('auth_token');
  if (token && !request.headers.has('Authorization')) request.headers.set('Authorization', `Bearer ${token}`);
  return request;
}, undefined, { synchronous: true });
