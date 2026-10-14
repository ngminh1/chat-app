import { createContext, useContext } from 'react';

export const SessionContext = createContext(null);

export function useAuthSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('Authenticated components require a session');
  return session;
}

export function useSessionApi() {
  return useAuthSession().api;
}
