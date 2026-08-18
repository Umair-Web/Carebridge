import { createContext, useContext, useState, useEffect } from 'react';
import { API_BASE } from '../../config';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    window.location.href = '/login'; // Force redirect to login on logout
  };

  useEffect(() => {
    let timeoutId = null;
    let cancelled = false;

    // Silently swap the about-to-expire access token for a fresh one using the
    // refresh token. The user stays logged in — we only force a logout if the
    // refresh token itself is gone or rejected (e.g. account suspended).
    const refreshAccessToken = async () => {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        logout();
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        const data = await res.json();
        if (!data.success || !data.data?.accessToken) {
          throw new Error(data.message || 'Refresh failed');
        }
        if (cancelled) return;
        localStorage.setItem('token', data.data.accessToken);
        // Rolling refresh token — keep the newest one so the session slides forward.
        if (data.data.refreshToken) {
          localStorage.setItem('refreshToken', data.data.refreshToken);
        }
        // Updating token state re-runs this effect, which reschedules the next refresh.
        setToken(data.data.accessToken);
      } catch (e) {
        console.error('Silent token refresh failed:', e);
        logout();
      }
    };

    const scheduleProactiveRefresh = (expSeconds) => {
      const currentTime = Date.now() / 1000;
      // Refresh ~1 minute before expiry (or right away if already inside that window).
      const msUntilRefresh = Math.max(0, (expSeconds - currentTime - 60) * 1000);
      timeoutId = setTimeout(refreshAccessToken, msUntilRefresh);
    };

    const initializeAuth = () => {
      if (!token) {
        setUser(null);
        setIsInitializing(false);
        return;
      }
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const currentTime = Date.now() / 1000;

        if (payload.exp && payload.exp < currentTime) {
          // Expired access token on load — silently refresh instead of logging out.
          // Stay on the loading screen until we have a fresh token (or refresh fails).
          refreshAccessToken();
          return;
        }

        setUser({
          id: payload.id || payload._id,
          role: payload.role,
          name: payload.name,
          createdBy: payload.createdBy,
        });

        // Proactively refresh before expiry so the user is never kicked out mid-session.
        if (payload.exp) {
          scheduleProactiveRefresh(payload.exp);
        }
        setIsInitializing(false);
      } catch (e) {
        console.error('Session restore failed:', e);
        setToken(null);
        setUser(null);
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        setIsInitializing(false);
      }
    };

    initializeAuth();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [token]);

  const login = async (email, password) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (data.success) {
        setToken(data.data.accessToken);
        localStorage.setItem('token', data.data.accessToken);
        if (data.data.refreshToken) {
          localStorage.setItem('refreshToken', data.data.refreshToken);
        }
        // Set user immediately so it's available without waiting for useEffect
        setUser(data.data.user);
        return { success: true, user: data.data.user };
      }
      return {
        success: false,
        message: data.message,
        needsEmailVerification: data.needsEmailVerification,
        email: data.email,
      };
    } catch {
      return { success: false, message: 'Server error' };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      const data = await response.json();
      return {
        success: data.success,
        message: data.message || data.error || 'Registration failed',
        email: data.data?.email,
      };
    } catch {
      return { success: false, message: 'Server error' };
    } finally {
      setIsLoading(false);
    }
  };

  const isConsultant = user?.role === 'consultant';
  const isHospital = user?.role === 'hospital';
  const isAdmin = user?.role === 'admin';
  const hasRole = (roles = []) => !!user && roles.includes(user.role);

  // Do not render children until initial token parsing is done
  if (isInitializing) {
    return null; // Or a loading spinner
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        register,
        logout,
        isConsultant,
        isHospital,
        isAdmin,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
