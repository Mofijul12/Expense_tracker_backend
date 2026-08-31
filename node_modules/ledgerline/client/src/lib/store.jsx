import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { toMonthKey } from './format.js';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [categories, setCategories] = useState([]);
  const [month, setMonth] = useState(() => toMonthKey(new Date()));
  const [bootError, setBootError] = useState(null);
  const [toast, setToast] = useState(null);
  // Bumping this re-runs every useApi hook, so a save on one screen refreshes
  // the numbers on all the others.
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  const notify = useCallback((message) => {
    setToast(message);
    setTimeout(() => setToast((current) => (current === message ? null : current)), 2600);
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([api.settings.get(), api.categories.list({ month })])
      .then(([s, c]) => {
        if (!alive) return;
        setSettings(s);
        setCategories(c.items);
        setBootError(null);
      })
      .catch((err) => alive && setBootError(err.message));
    return () => {
      alive = false;
    };
  }, [month, version]);

  const saveSettings = useCallback(
    async (patch) => {
      const next = await api.settings.save(patch);
      setSettings(next);
      refresh();
      return next;
    },
    [refresh]
  );

  const value = useMemo(
    () => ({
      settings,
      categories,
      month,
      setMonth,
      refresh,
      version,
      bootError,
      saveSettings,
      toast,
      notify,
    }),
    [settings, categories, month, refresh, version, bootError, saveSettings, toast, notify]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}

/**
 * Runs `fetcher` whenever its deps or the global version change.
 * Returns { data, loading, error, reload }.
 */
export function useApi(fetcher, deps = []) {
  const { version } = useApp();
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [localVersion, setLocalVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    Promise.resolve(fetcher())
      .then((data) => alive && setState({ data, loading: false, error: null }))
      .catch((error) => alive && setState({ data: null, loading: false, error: error.message }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version, localVersion]);

  const reload = useCallback(() => setLocalVersion((v) => v + 1), []);
  return { ...state, reload };
}
