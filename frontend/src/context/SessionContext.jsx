import { SessionContext } from './sessionContext.js';

export function SessionProvider({ session, children }) {
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}
