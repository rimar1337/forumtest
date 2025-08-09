import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { Agent } from '@atproto/api';
import { oauthClient } from '../helpers/oauthClient';
import { type OAuthSession, TokenInvalidError, TokenRefreshError, TokenRevokedError } from '@atproto/oauth-client-browser';

type Session = OAuthSession;

interface AuthContextValue {
  agent: Agent | null;
  session: Session | null;
  status: 'loading' | 'signedIn' | 'signedOut';
  startLogin: (handle: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({} as AuthContextValue);

export const OAuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<'loading' | 'signedIn' | 'signedOut'>('loading');

  useEffect(() => {
    const initialize = async () => {
      try {
        const result = await oauthClient.init();

        if (result) {
          const { session: oauthSession } = result;
          const apiAgent = new Agent(oauthSession);

          setAgent(apiAgent);
          setSession(oauthSession);
          setStatus('signedIn');
          if ('state' in result && result.state) {
            console.log(`Successfully authenticated ${oauthSession.sub} (state: ${result.state})`);
          } else {
            console.log(`Session for ${oauthSession.sub} was restored`);
          }
        } else {
          setStatus('signedOut');
          console.log('No active session found.');
        }
      } catch (e) {
        console.error('Auth initialization failed:', e);
        setStatus('signedOut');
      }
    };

    const handleSessionDeleted = (
      event: CustomEvent<{ sub: string; cause: TokenRefreshError | TokenRevokedError | TokenInvalidError }>
    ) => {
      console.error(`Session for ${event.detail.sub} was deleted. Logging out.`, event.detail.cause);
      setAgent(null);
      setSession(null);
      setStatus('signedOut');
    };

    oauthClient.addEventListener('deleted', handleSessionDeleted as EventListener);
    initialize();

    return () => {
      oauthClient.removeEventListener('deleted', handleSessionDeleted as EventListener);
    };
  }, []);

  const startLogin = useCallback(async (handleOrPdsUrl: string) => {
    if (status !== 'signedOut') return;
    sessionStorage.setItem('postLoginRedirect', window.location.pathname + window.location.search);
    try {
      await oauthClient.signIn(handleOrPdsUrl);
    } catch (err) {
      console.error('Sign-in process aborted or failed:', err);
    }
  }, [status]);

  const logout = useCallback(async () => {
    if (!session) return;
    setStatus('loading');
    try {
      await oauthClient.revoke(session.sub);
      console.log('Successfully logged out.');
    } catch (e) {
      console.error("Logout failed:", e);
    } finally {
      setAgent(null);
      setSession(null);
      setStatus('signedOut');
    }
  }, [session]);

  return (
    <AuthContext.Provider value={{ agent, session, status, startLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);