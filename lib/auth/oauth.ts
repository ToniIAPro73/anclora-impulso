const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export function isGoogleAuthEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === 'true';
}

export function isGithubAuthEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_GITHUB_AUTH === 'true';
}

/**
 * Redirige el navegador al backend, que arma el PKCE handshake y reenvía a
 * Google/GitHub. El backend gestiona el callback completo (no Supabase).
 */
export function signInWithGoogle() {
  window.location.href = `${API_URL}/auth/google`;
}

export function signInWithGithub() {
  window.location.href = `${API_URL}/auth/github`;
}
