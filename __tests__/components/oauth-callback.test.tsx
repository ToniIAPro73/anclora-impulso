/** @jest-environment jsdom */
import React from 'react';
import { render, waitFor } from '@testing-library/react';

const replace = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
jest.mock('@/lib/auth/navigate', () => ({ goTo: jest.fn(), replaceWith: jest.fn() }));

import * as navigate from '@/lib/auth/navigate';
import OAuthCallbackPage from '@/app/auth/callback/page';
import { apiClient } from '@/lib/api/client';
import { OAUTH_ATTEMPT_KEY } from '@/lib/auth/oauth';

const jwtFor = (userId: string) => `h.${Buffer.from(JSON.stringify({ userId })).toString('base64url')}.s`;
const attempt = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ verifier: 'v'.repeat(43), provider: 'google', startedAt: Date.now(), identity: null, ...over });

const reload = navigate.replaceWith as jest.Mock;
beforeEach(() => {
  sessionStorage.clear(); localStorage.clear(); replace.mockReset();
  reload.mockReset();
  global.fetch = jest.fn() as any;
});

const mountAt = (hash: string, search = '') => {
  window.history.replaceState(null, '', `/auth/callback${search}${hash}`);
  return render(<OAuthCallbackPage />);
};

describe('/auth/callback (F-4)', () => {
  it('foreign tokens in the fragment are never read: no storage write, error page, no request', async () => {
    mountAt('#accessToken=A.A.A&refreshToken=rt1.attacker');
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/auth/error?provider=unknown'));
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('a code without a pending attempt of this tab is refused without any request', async () => {
    mountAt('#code=' + 'c'.repeat(43) + '&provider=google');
    await waitFor(() => expect(replace).toHaveBeenCalled());
    expect(global.fetch).not.toHaveBeenCalled();
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });

  it('valid attempt + code: redeems with the verifier, installs the session once and consumes the attempt', async () => {
    sessionStorage.setItem(OAUTH_ATTEMPT_KEY, attempt());
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ user: { id: 'u', email: 'e', fullName: 'n' }, accessToken: jwtFor('u'), refreshToken: 'rt1.fresh' }) });
    mountAt('#code=' + 'c'.repeat(43) + '&provider=google');
    await waitFor(() => expect(reload).toHaveBeenCalledWith('/dashboard'));
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body).toEqual({ code: 'c'.repeat(43), verifier: 'v'.repeat(43), provider: 'google' });
    expect(localStorage.getItem('refreshToken')).toBe('rt1.fresh');
    expect(sessionStorage.getItem(OAUTH_ATTEMPT_KEY)).toBeNull();
  });

  it('refused exchange installs nothing and does not fall back to any token source', async () => {
    sessionStorage.setItem(OAUTH_ATTEMPT_KEY, attempt());
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
    mountAt('#code=' + 'c'.repeat(43) + '&provider=google&accessToken=A.A.A&refreshToken=rt1.x');
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/auth/error?provider=unknown'));
    expect(localStorage.getItem('refreshToken')).toBeNull();
    expect(reload).not.toHaveBeenCalled();
  });

  it('identity changed since the flow started (another tab signed in): refused before any request', async () => {
    localStorage.setItem('accessToken', jwtFor('someone-else'));
    sessionStorage.setItem(OAUTH_ATTEMPT_KEY, attempt({ identity: null }));
    mountAt('#code=' + 'c'.repeat(43) + '&provider=google');
    await waitFor(() => expect(replace).toHaveBeenCalled());
    expect(global.fetch).not.toHaveBeenCalled();
    expect(localStorage.getItem('accessToken')).toBe(jwtFor('someone-else'));
  });

  it('a login/logout in this tab while the exchange is in flight wins: the late result is not installed', async () => {
    sessionStorage.setItem(OAUTH_ATTEMPT_KEY, attempt());
    let resolve!: (v: unknown) => void;
    (global.fetch as jest.Mock).mockReturnValue(new Promise((r) => { resolve = r; }));
    mountAt('#code=' + 'c'.repeat(43) + '&provider=google');
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    apiClient.setToken(null); // identity-changing write in this tab (bumps the generation)
    resolve({ ok: true, json: async () => ({ user: { id: 'u', email: 'e', fullName: 'n' }, accessToken: jwtFor('u'), refreshToken: 'rt1.late' }) });
    await waitFor(() => expect(replace).toHaveBeenCalled());
    expect(localStorage.getItem('refreshToken')).toBeNull();
    expect(reload).not.toHaveBeenCalled();
  });
});
