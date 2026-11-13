import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { render } from '@testing-library/react'
import LoginPage from '@/app/auth/login/page'

jest.mock('@/lib/contexts/language-context', () => ({
  useLanguage: jest.fn(() => ({
    t: {
      auth: {
        email: 'Email', password: 'Password', signIn: 'Sign In', signingIn: 'Signing In',
        welcomeBack: 'Welcome Back', signInMessage: 'Sign in to your account', error: 'An error occurred',
        noAccount: "Don't have an account?", signUp: 'Sign Up', showPassword: 'Show password',
        hidePassword: 'Hide password', forgotPassword: 'Forgot your password?', legalPrefix: 'By continuing you accept the',
        terms: 'Terms of service', legalMiddle: 'and the', privacy: 'Privacy policy', legalSuffix: '.',
        socialAccess: 'Social access', google: 'Google/Gmail', github: 'GitHub', socialComingSoon: 'Coming soon',
      },
    },
  })),
}))
jest.mock('next/navigation', () => ({ useRouter: jest.fn(() => ({ replace: jest.fn() })) }))
jest.mock('@/lib/api/auth', () => ({ authApi: { login: jest.fn() } }))
jest.mock('@/lib/auth/oauth', () => ({
  isAncloraIdentityEnabled: jest.fn(() => false),
  isGoogleAuthEnabled: jest.fn(() => false),
  isGithubAuthEnabled: jest.fn(() => false),
  signInWithAncloraIdentity: jest.fn(),
  signInWithGoogle: jest.fn(),
  signInWithGithub: jest.fn(),
}))

describe('login page never receives credentials from the environment (AUD-024)', () => {
  const SENTINEL_EMAIL = 'sentinel-email-do-not-render@example.test'
  const SENTINEL_PASSWORD = 'sentinel-password-do-not-render-9f3a'
  const saved = { ...process.env }

  beforeEach(() => {
    process.env.UTILIZAR_USER_TEXT = 'true'
    process.env.USER_TEXT = SENTINEL_EMAIL
    process.env.PASS_TEXT = SENTINEL_PASSWORD
  })

  afterEach(() => {
    process.env = { ...saved }
  })

  it('renders empty email and password fields even when the autofill variables are set', () => {
    const { container } = render(<LoginPage />)
    const values = Array.from(container.querySelectorAll('input')).map((input) => input.value)
    expect(values).not.toContain(SENTINEL_PASSWORD)
    expect(values).not.toContain(SENTINEL_EMAIL)
    expect(container.innerHTML).not.toContain(SENTINEL_PASSWORD)
    expect(container.innerHTML).not.toContain(SENTINEL_EMAIL)
  })

  it('does not reference any environment variable in the page source', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../../app/auth/login/page.tsx'), 'utf8')
    expect(source).not.toMatch(/process\.env/)
  })
})
