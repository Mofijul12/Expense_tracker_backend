import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './lib/store.jsx';
import { AuthProvider, useAuth } from './lib/auth.jsx';
import { Sidebar, ErrorState, Loading } from './components/Shell.jsx';

import Home from './pages/Home.jsx';
import { Login, Register } from './pages/Auth.jsx';
import Overview from './pages/Overview.jsx';
import Expenses from './pages/Expenses.jsx';
import AddExpense from './pages/AddExpense.jsx';
import ExpenseDetail from './pages/ExpenseDetail.jsx';
import Budgets from './pages/Budgets.jsx';
import Reports from './pages/Reports.jsx';
import Categories from './pages/Categories.jsx';
import Settings from './pages/Settings.jsx';

function Toast() {
  const { toast } = useApp();
  if (!toast) return null;
  return (
    <div className="toast">
      <i className="ph ph-check-circle" />
      {toast}
    </div>
  );
}

function FullPage({ children }) {
  return (
    <div className="app">
      <main className="main">{children}</main>
    </div>
  );
}

/** Sends signed-out visitors to the login page, remembering where they wanted. */
function RequireAuth({ children }) {
  const { user, checking } = useAuth();
  const location = useLocation();

  // Wait for the session check, or a signed-in reload would bounce to /login.
  if (checking) return <FullPage><Loading label="Checking your session" /></FullPage>;
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return children;
}

function AppShell() {
  const { settings, bootError } = useApp();

  if (bootError) {
    return (
      <FullPage>
        <ErrorState
          message={`Can't reach the API — ${bootError}. Is the server running on port 4000?`}
          onRetry={() => window.location.reload()}
        />
      </FullPage>
    );
  }

  if (!settings) {
    return (
      <FullPage>
        <Loading label="Starting Ledgerline" />
      </FullPage>
    );
  }

  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        <Routes>
          <Route index element={<Overview />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="expenses/new" element={<AddExpense />} />
          <Route path="expenses/:id" element={<ExpenseDetail />} />
          <Route path="expenses/:id/edit" element={<AddExpense />} />
          <Route path="budgets" element={<Budgets />} />
          <Route path="reports" element={<Reports />} />
          <Route path="categories" element={<Categories />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </main>
      <Toast />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/app/*"
          element={
            <RequireAuth>
              {/* AppProvider only mounts once signed in, so its first calls
                  never fire without a session. */}
              <AppProvider>
                <AppShell />
              </AppProvider>
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
