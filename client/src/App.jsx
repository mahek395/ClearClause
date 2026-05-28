import { Routes, Route } from 'react-router-dom';

import AppLayout from './components/layout/AppLayout';
import { Toaster } from 'react-hot-toast';
import Home from './pages/Home';
import Analysis from './pages/Analysis';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import SharedView from './pages/SharedView';

function App() {
  return (
    <AppLayout>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1e293b',
            color: '#f8fafc',
            border: '1px solid #334155',
            borderRadius: '12px',
            fontSize: '14px',
          },
          success: { iconTheme: { primary: '#fbbf24', secondary: '#1e293b' } },
          error: { iconTheme: { primary: '#f87171', secondary: '#1e293b' } },
        }}
      />
      <Routes>

        <Route
          path="/"
          element={<Home />}
        />

        <Route
          path="/analyze/:id"
          element={<Analysis />}
        />

        <Route
          path="/dashboard"
          element={<Dashboard />}
        />

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/register"
          element={<Register />}
        />

        <Route
          path="/share/:shareToken"
          element={<SharedView />}
        />

      </Routes>
    </AppLayout>
  );
}

export default App;