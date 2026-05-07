import { useCallback, useEffect, useMemo, useReducer, type ReactNode } from "react";
import {
  loginRequest,
  registerRequest,
  fetchMe,
  setToken,
  clearToken,
  type AuthUser,
} from "../lib/api";
import { AuthContext, type AuthContextValue, type AuthState } from "./auth";

/* ------------------------------------------------------------------ */
/*  State machine                                                      */
/* ------------------------------------------------------------------ */

type AuthAction =
  | { type: "AUTH_LOADING" }
  | { type: "AUTH_SUCCESS"; user: AuthUser; token: string }
  | { type: "AUTH_FAILURE"; error: string }
  | { type: "LOGOUT" };

const initializer = (token: string | null): AuthState => ({
  user: null,
  token,
  loading: !!token,
  error: null,
});

function reducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "AUTH_LOADING":
      return { ...state, loading: true, error: null };
    case "AUTH_SUCCESS":
      return { user: action.user, token: action.token, loading: false, error: null };
    case "AUTH_FAILURE":
      return { ...state, loading: false, error: action.error };
    case "LOGOUT":
      return initializer(null);
    default:
      return state;
  }
}

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

export default function AuthProvider({ children }: { children: ReactNode }) {
  const savedToken = useMemo(() => {
    try {
      return localStorage.getItem("coldmail_token");
    } catch {
      return null;
    }
  }, []);

  const [state, dispatch] = useReducer(reducer, savedToken, initializer);

  // On mount, verify token validity by calling /api/auth/me
  useEffect(() => {
    if (!savedToken) return;

    let cancelled = false;
    dispatch({ type: "AUTH_LOADING" });

    fetchMe()
      .then((res) => {
        if (!cancelled) {
          dispatch({ type: "AUTH_SUCCESS", user: res.data.user, token: savedToken });
        }
      })
      .catch(() => {
        if (!cancelled) {
          clearToken();
          dispatch({ type: "LOGOUT" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [savedToken]);

  const login = useCallback(async (email: string, password: string) => {
    dispatch({ type: "AUTH_LOADING" });
    const res = await loginRequest(email, password);
    setToken(res.data.token);
    dispatch({ type: "AUTH_SUCCESS", user: res.data.user, token: res.data.token });
  }, []);

  const register = useCallback(async (email: string, password: string, name?: string) => {
    dispatch({ type: "AUTH_LOADING" });
    const res = await registerRequest(email, password, name);
    setToken(res.data.token);
    dispatch({ type: "AUTH_SUCCESS", user: res.data.user, token: res.data.token });
  }, []);

  const logout = useCallback(() => {
    clearToken();
    dispatch({ type: "LOGOUT" });
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: "AUTH_FAILURE", error: "" });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, register, logout, clearError }),
    [state, login, register, logout, clearError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}