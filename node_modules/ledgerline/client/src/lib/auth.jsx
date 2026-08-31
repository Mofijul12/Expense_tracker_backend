import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // `checking` covers the first "am I signed in?" round trip, so protected
  // routes can wait instead of bouncing a signed-in visitor to the login page.
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let alive = true;
    api.auth
      .me()
      .then((res) => alive && setUser(res.user))
      .catch(() => alive && setUser(null))
      .finally(() => alive && setChecking(false));
    return () => {
      alive = false;
    };
  }, []);

  // api.js raises this when any data call comes back 401.
  useEffect(() => {
    const onSignedOut = () => setUser(null);
    window.addEventListener('ledgerline:signed-out', onSignedOut);
    return () => window.removeEventListener('ledgerline:signed-out', onSignedOut);
  }, []);

  const login = useCallback(async (credentials) => {
    const res = await api.auth.login(credentials);
    setUser(res.user);
    return res.user;
  }, []);

  const register = useCallback(async (details) => {
    const res = await api.auth.register(details);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } finally {
      // Drop the local session even if the request failed — the cookie is
      // gone or expired either way.
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, checking, login, register, logout }),
    [user, checking, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
