import { apiClient } from './client';
import { clearAllOperationKeys } from '../idempotency';

export interface User {
  id: string;
  email: string;
  fullName: string;
  isAdmin?: boolean;
  createdAt?: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface RegisterData {
  email: string;
  password: string;
  fullName: string;
}

export interface LoginData {
  email: string;
  password: string;
}

/** Single place where a new session is persisted, so every caller (pages, context) gets silent refresh. */
function storeSession(response: AuthResponse) {
  apiClient.setToken(response.accessToken);
  if (typeof window !== 'undefined' && response.refreshToken) {
    localStorage.setItem('refreshToken', response.refreshToken);
  }
}

export interface LogoutInfo {
  reason: 'user_action' | 'session_invalid' | 'unspecified';
  origin: string;
}

export const authApi = {
  async register(data: RegisterData): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/register', data);
    storeSession(response);
    return response;
  },

  async login(data: LoginData): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/login', data);
    storeSession(response);
    return response;
  },

  async getCurrentUser(): Promise<User> {
    return apiClient.get<User>('/auth/me');
  },

  /**
   * Explicit sign-out: revokes the server session with the tokens about to be cleared, then clears local state.
   * `reason`/`origin` are recorded (never tokens) so every logout can be attributed.
   */
  logout(info: LogoutInfo = { reason: 'unspecified', origin: 'unspecified' }) {
    if (typeof console !== 'undefined') console.info('[auth] logout', { reason: info.reason, origin: info.origin });
    // Fire-and-forget: revoke on the server using the tokens that are about to be cleared.
    void apiClient.revokeSessionOnServer(info);
    clearAllOperationKeys();
    apiClient.setToken(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('refreshToken');
      sessionStorage.clear();
    }
  },

  /**
   * The server already REJECTED this session (401 after a failed refresh). Local cleanup only: no logout request,
   * and only if the stored refresh token is still the one the failed check used — another tab may have signed in
   * since, and its session must not be touched.
   */
  discardRejectedSession(expectedRefreshToken: string | null, origin: string) {
    const current = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;
    if (typeof console !== 'undefined') console.info('[auth] session discarded', { reason: 'session_invalid', origin });
    if (current !== null && current !== expectedRefreshToken) return false;
    clearAllOperationKeys();
    apiClient.setToken(null);
    if (typeof window !== 'undefined') localStorage.removeItem('refreshToken');
    return true;
  },
};
