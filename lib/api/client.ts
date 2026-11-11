/** HTTP error with the status and structured details returned by the API. */
export class ApiError extends Error {
  status: number;
  details: Record<string, unknown>;

  constructor(message: string, status: number, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

// Credential-exchange endpoints never trigger a refresh (a 401 there is a real rejection). /auth/me does.
const NO_REFRESH_ENDPOINTS = new Set(['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout']);

import { API_BASE } from './base-url';

/**
 * Correlation identity of a token: its `sid` claim (stable across refresh rotation of the same server session), or
 * the opaque string itself when it cannot be decoded. Decoded WITHOUT verification: it is only used to decide whether
 * two stored credentials can belong to the same session on this client; authorization stays on the server.
 */
function identityOf(token: string | null): string | null {
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    if (payload) {
      const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      const sid = (JSON.parse(json) as { sid?: unknown }).sid;
      if (typeof sid === 'string' && sid) return `sid:${sid}`;
    }
  } catch {
    // not a JWT: fall through
  }
  return `opaque:${token}`;
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    
    // Cargar token del localStorage si existe
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('accessToken');
    }
  }

  /**
   * Session generation: bumped by every operation that changes WHICH session this tab holds (login, register,
   * OAuth callback, logout, discard) and NOT by a refresh rotation of the same session. An operation that
   * captured generation g at its start may only modify credentials, or act with them, while the generation is
   * still g; checking afterwards would be too late because the write is the effect.
   */
  private sessionGeneration = 0;

  getSessionGeneration(): number {
    return this.sessionGeneration;
  }

  /** Identity-changing write (login, register, callback, logout, discard). */
  setToken(token: string | null) {
    this.sessionGeneration += 1;
    this.writeToken(token);
  }

  private writeToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('accessToken', token);
      } else {
        localStorage.removeItem('accessToken');
      }
    }
  }

  getToken(): string | null {
    return this.token;
  }

  /**
   * True when the credentials in the shared storage no longer belong to the session this tab holds in memory
   * (another tab signed in as someone else, or signed out). Work started by this tab must then not be completed
   * on behalf of a superseded identity. A rotation of the SAME session by another tab is not drift.
   */
  hasIdentityDrifted(): boolean {
    if (typeof window === 'undefined' || !this.token) return false;
    return identityOf(localStorage.getItem('accessToken')) !== identityOf(this.token);
  }

  private refreshInFlight: Promise<boolean> | null = null;

  /**
   * Exchanges the active refresh session (HttpOnly cookie, with transition fallback for any legacy localStorage
   * refreshToken) for a new accessToken. Single-flight per tab: concurrent 401s share one refresh.
   * Never stores refreshToken in localStorage (TASK-002 / AUD-001).
   */
  private refreshSession(): Promise<boolean> {
    if (this.refreshInFlight) return this.refreshInFlight;

    this.refreshInFlight = (async () => {
      if (typeof window === 'undefined') return false;
      const accessAtStart = localStorage.getItem('accessToken');
      const legacyRefreshToken = localStorage.getItem('refreshToken');
      if (!this.token && !accessAtStart && !legacyRefreshToken) return false;
      const generation = this.sessionGeneration;
      const identity = identityOf(this.token);
      const stillSameSession = () => this.sessionGeneration === generation;

      // The stored access token must belong to the session of the request being served. If another tab has put a
      // different identity in the shared storage, that session is not ours to exchange.
      if (identityOf(accessAtStart) !== identity) return false;

      try {
        const response = await fetch(`${this.baseUrl}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(legacyRefreshToken ? { refreshToken: legacyRefreshToken } : {}),
        });

        // Another session (login/logout/discard) took over while this was in flight: touch nothing.
        if (!stillSameSession()) return false;
        // The stored credentials changed meanwhile. Never write over them. Adopt only if they provably continue THIS
        // session (same identity); a different identity is another user signing in, not a rotation.
        const currentAccess = localStorage.getItem('accessToken');
        const currentRefresh = localStorage.getItem('refreshToken');
        if (currentAccess !== accessAtStart || currentRefresh !== legacyRefreshToken) {
          if (currentAccess && identityOf(currentAccess) === identity) {
            this.token = currentAccess;
            return true;
          }
          return false;
        }

        if (!response.ok) {
          // Definitive rejection (revoked/expired): drop the dead session. Network errors keep it.
          if (response.status === 401 || response.status === 400) {
            this.writeToken(null);
            localStorage.removeItem('refreshToken');
          }
          return false;
        }
        const body = (await response.json()) as { accessToken?: string; refreshToken?: string };
        // json() is a second await: the session may have changed again
        if (
          !stillSameSession() ||
          localStorage.getItem('accessToken') !== accessAtStart ||
          localStorage.getItem('refreshToken') !== legacyRefreshToken
        ) {
          return false;
        }
        if (!body.accessToken) return false;
        this.writeToken(body.accessToken);
        localStorage.removeItem('refreshToken');
        return true;
      } catch {
        return false;
      }
    })().finally(() => {
      this.refreshInFlight = null;
    });

    return this.refreshInFlight;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    hasRetried = false
  ): Promise<T> {
    const generation = this.sessionGeneration;
    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');

    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      credentials: options.credentials ?? 'include',
      headers,
    });

    // Only the session that issued the request may refresh and replay it; a request that outlived its session
    // fails as-is instead of being replayed under another identity.
    if (response.status === 401 && !hasRetried && !NO_REFRESH_ENDPOINTS.has(endpoint) && this.token
        && generation === this.sessionGeneration) {
      if (await this.refreshSession() && generation === this.sessionGeneration) {
        return this.request<T>(endpoint, options, true);
      }
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      const { error: message, ...details } = (error ?? {}) as Record<string, unknown>;
      throw new ApiError(String(message || `HTTP ${response.status}`), response.status, details);
    }

    // Si es 204 No Content, no intentar parsear JSON
    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  /** Server-side logout (revokes the session and clears HttpOnly cookie). Best effort: local sign-out never depends on it. */
  async revokeSessionOnServer(info?: { reason: string; origin: string }): Promise<void> {
    if (typeof window === 'undefined') return;
    const legacyRefreshToken = localStorage.getItem('refreshToken');
    if (!this.token && !legacyRefreshToken) return;
    try {
      await fetch(`${this.baseUrl}/auth/logout`, {
        method: 'POST',
        keepalive: true,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
        body: JSON.stringify({
          ...(legacyRefreshToken ? { refreshToken: legacyRefreshToken } : {}),
          ...(info ? { reason: info.reason, origin: info.origin } : {}),
        }),
      });
    } catch {
      // offline or server unreachable: the local session is still cleared
    }
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any, options: { headers?: Record<string, string> } = {}): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      headers: options.headers,
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient(API_BASE);
