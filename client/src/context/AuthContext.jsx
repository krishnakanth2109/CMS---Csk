import { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext(null);

const API_URL     = import.meta.env.VITE_API_URL;
const FB_API_KEY  = import.meta.env.VITE_FIREBASE_API_KEY;
const SESSION_KEY = 'currentUser';

// ─────────────────────────────────────────────────────────────────────────────
// 9-HOUR SESSION
// ─────────────────────────────────────────────────────────────────────────────
const SESSION_DURATION_MS = 9 * 60 * 60 * 1000;

const getTokenExpiry = (token) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000;
  } catch {
    return 0;
  }
};

const isSessionExpired = (session) => {
  if (!session?.sessionExpiry) return true;
  return Date.now() > session.sessionExpiry;
};

const refreshFirebaseToken = async () => {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (!stored) return null;

    const session = JSON.parse(stored);

    if (isSessionExpired(session)) {
      console.warn('[Auth] 9-hour session expired. Clearing session.');
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }

    const { refreshToken } = session;
    if (!refreshToken) return null;

    const res = await fetch(
      `https://securetoken.googleapis.com/v1/token?key=${FB_API_KEY}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
      }
    );

    if (!res.ok) {
      console.warn('[Auth] Firebase token refresh failed — re-login required.');
      return null;
    }

    const data = await res.json();
    const newIdToken      = data.id_token;
    const newRefreshToken = data.refresh_token;

    const updated = { ...session, idToken: newIdToken, refreshToken: newRefreshToken };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(updated));
    console.log('[Auth] Firebase ID token refreshed silently.');
    return newIdToken;
  } catch (err) {
    console.error('[Auth] Token refresh error:', err.message);
    return null;
  }
};

const getValidToken = async () => {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (!stored) return null;

    const session = JSON.parse(stored);

    if (isSessionExpired(session)) {
      console.warn('[Auth] 9-hour session expired. Clearing session.');
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }

    const { idToken } = session;
    if (!idToken) return null;

    const expiresAt    = getTokenExpiry(idToken);
    const FIVE_MINUTES = 5 * 60 * 1000;

    if (Date.now() >= expiresAt - FIVE_MINUTES) {
      console.log('[Auth] Firebase token expiring soon — refreshing silently...');
      return await refreshFirebaseToken();
    }

    return idToken;
  } catch {
    return null;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// AuthProvider
// ─────────────────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (!stored) return null;
      const session = JSON.parse(stored);
      if (isSessionExpired(session)) {
        sessionStorage.removeItem(SESSION_KEY);
        return null;
      }
      return session;
    } catch {
      return null;
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // FIX: REMOVED the internal `loading` state from AuthProvider entirely.
  //
  // WHY THIS WAS THE BUG:
  //   The old code had `setLoading(true/false)` inside AuthContext's login().
  //   When login failed, the sequence was:
  //     1. Firebase throws → catch in Login.jsx sets local error state
  //     2. AuthContext's finally → setLoading(false) → triggers AuthProvider re-render
  //     3. AuthProvider re-render caused Login.jsx to re-render BEFORE error painted
  //     4. Result: page appeared to "refresh" with no error message visible
  //
  // THE FIX:
  //   Login.jsx manages its own loading state (it already did this correctly).
  //   AuthContext.login() is now a pure async function — it throws on failure,
  //   resolves with user data on success. No internal state changes during login.
  //   This means only Login.jsx's state changes on error → clean error display.
  // ─────────────────────────────────────────────────────────────────────────

  // ── login ────────────────────────────────────────────────────────────────
  // Throws on ANY failure so Login.jsx catch block always fires correctly.
  // Does NOT manage loading state — Login.jsx owns that.
  const login = useCallback(async (email, password) => {
    // ── Step 1: Firebase REST API sign-in ──────────────────────────────────
    let firebaseData;
    try {
      const firebaseRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FB_API_KEY}`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ email, password, returnSecureToken: true }),
        }
      );
      firebaseData = await firebaseRes.json();

      if (!firebaseRes.ok) {
        // Extract Firebase error code and throw with BOTH .code and .message set
        // so Login.jsx getFriendlyError() works on either field
        const code  = firebaseData?.error?.message || 'UNKNOWN_ERROR';
        const error = new Error(code);
        error.code  = code;
        throw error;
      }
    } catch (err) {
      // Re-throw Firebase errors as-is (they already have .code set above)
      // Also handles network failures (err.message will contain 'fetch' or 'Failed to fetch')
      if (err.code) throw err; // Already a Firebase error — rethrow directly

      // Network-level error (no .code) — wrap it cleanly
      const networkError = new Error('NETWORK_REQUEST_FAILED');
      networkError.code  = 'NETWORK_REQUEST_FAILED';
      throw networkError;
    }

    const { idToken, refreshToken } = firebaseData;

    // ── Step 2: Verify with backend ────────────────────────────────────────
    let userData;
    try {
      const backendRes = await fetch(`${API_URL}/api/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ idToken }),
      });

      userData = await backendRes.json();

      if (!backendRes.ok) {
        // Backend errors: "User not registered." / "Account deactivated."
        // These should show the exact backend message to the user
        throw new Error(userData.message || 'Login failed. Please try again.');
      }
    } catch (err) {
      // If it's our thrown Error from above, rethrow it
      if (err.message && !err.code) throw err;

      // Network failure reaching backend
      const networkError = new Error('NETWORK_REQUEST_FAILED');
      networkError.code  = 'NETWORK_REQUEST_FAILED';
      throw networkError;
    }

    // ── Step 3: Persist session (only reached on full success) ─────────────
    const sessionData = {
      ...userData,
      idToken,
      refreshToken,
      sessionExpiry: Date.now() + SESSION_DURATION_MS,
    };

    sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    setCurrentUser(sessionData); // Only state change — happens AFTER success

    const expiryTime = new Date(sessionData.sessionExpiry).toLocaleTimeString();
    console.log(`[Auth] Login successful. Session expires at ${expiryTime} (9 hours).`);

    return sessionData;
  }, []);

  // ── logout ───────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setCurrentUser(null);
    console.log('[Auth] User logged out — session cleared.');
  }, []);

  // ── getIdToken ───────────────────────────────────────────────────────────
  const getIdToken = useCallback(async () => {
    return await getValidToken();
  }, []);

  // ── authHeaders ──────────────────────────────────────────────────────────
  // ⚠️  ASYNC — must be awaited at every call site
  const authHeaders = useCallback(async () => {
    const token = await getValidToken();
    if (!token) {
      console.warn('[Auth] authHeaders: no valid token — request will be unauthorized.');
      return {};
    }
    return { Authorization: `Bearer ${token}` };
  }, []);

  const value = {
    currentUser,
    login,
    logout,
    getIdToken,
    authHeaders,
    isAuthenticated: !!currentUser,
    userRole: currentUser?.role || null,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}