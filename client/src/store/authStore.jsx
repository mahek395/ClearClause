import { createContext, useContext, useEffect, useState } from 'react';
import api from '../utils/axiosInstance';
import { tokenStore } from '../utils/tokenStore';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true); // true while restoring session on page load

  // ---------------------------------------------------
  // Restore session on every page load/refresh
  // The httpOnly cookie is sent automatically by the browser.
  // If it's valid → we get a new access token and user back.
  // If it's missing/expired → 401 → user is logged out.
  // ---------------------------------------------------

  useEffect(() => {
    async function restoreSession() {
      try {
        const { data } = await api.post('/auth/refresh');
        tokenStore.set(data.accessToken);
        setUser(data.user);
      } catch {
        // No valid session — user must log in
        tokenStore.clear();
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    restoreSession();
  }, []);

  // ---------------------------------------------------
  // Register
  // ---------------------------------------------------

  async function register(email, password) {
    const { data } = await api.post('/auth/register', { email, password });
    tokenStore.set(data.accessToken);
    setUser(data.user);
    return data;
  }

  // ---------------------------------------------------
  // Login
  // ---------------------------------------------------

  async function login(email, password) {
    const { data } = await api.post('/auth/login', { email, password });
    tokenStore.set(data.accessToken);
    setUser(data.user);
    return data;
  }

  // ---------------------------------------------------
  // Logout
  // ---------------------------------------------------

  async function logout() {
    try {
      await api.post('/auth/logout'); // clears httpOnly cookie on server
    } catch {
      // even if server call fails, clear client state
    } finally {
      tokenStore.clear();
      setUser(null);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        register,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  return useContext(AuthContext);
}