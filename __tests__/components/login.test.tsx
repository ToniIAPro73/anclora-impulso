import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginPage from '@/app/auth/login/page'

// Mock the language context
jest.mock('@/lib/contexts/language-context', () => ({
  useLanguage: jest.fn(() => ({
    t: {
      auth: {
        email: 'Email',
        password: 'Password',
        signIn: 'Sign In',
        signingIn: 'Signing In',
        welcomeBack: 'Welcome Back',
        signInMessage: 'Sign in to your account',
        error: 'An error occurred',
        noAccount: "Don't have an account?",
        signUp: 'Sign Up',
        showPassword: 'Show password',
        hidePassword: 'Hide password',
        forgotPassword: 'Forgot your password?',
        legalPrefix: 'By continuing you accept the',
        terms: 'Terms of service',
        legalMiddle: 'and the',
        privacy: 'Privacy policy',
        legalSuffix: '.',
        socialAccess: 'Social access',
        google: 'Google/Gmail',
        github: 'GitHub',
        socialComingSoon: 'Coming soon',
      },
    },
  })),
}))

const mockReplace = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    replace: mockReplace,
  })),
}))

jest.mock('@/lib/api/auth', () => ({
  authApi: {
    login: jest.fn(),
  },
}))

jest.mock('@/lib/auth/oauth', () => ({
  isGoogleAuthEnabled: jest.fn(() => false),
  isGithubAuthEnabled: jest.fn(() => false),
  signInWithGoogle: jest.fn(),
  signInWithGithub: jest.fn(),
}))

import { authApi } from '@/lib/api/auth'
import { isGoogleAuthEnabled, isGithubAuthEnabled, signInWithGoogle, signInWithGithub } from '@/lib/auth/oauth'

const mockLogin = authApi.login as jest.MockedFunction<typeof authApi.login>
const mockIsGoogleAuthEnabled = isGoogleAuthEnabled as jest.MockedFunction<typeof isGoogleAuthEnabled>
const mockIsGithubAuthEnabled = isGithubAuthEnabled as jest.MockedFunction<typeof isGithubAuthEnabled>
const mockSignInWithGoogle = signInWithGoogle as jest.MockedFunction<typeof signInWithGoogle>
const mockSignInWithGithub = signInWithGithub as jest.MockedFunction<typeof signInWithGithub>

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsGoogleAuthEnabled.mockReturnValue(false)
    mockIsGithubAuthEnabled.mockReturnValue(false)
  })

  it('should render login form', () => {
    render(<LoginPage />)

    expect(screen.getByText('Anclora Impulso')).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i, { selector: 'input' })).toBeInTheDocument()
  })

  it('should accept email input', async () => {
    const user = userEvent.setup()
    render(<LoginPage />)

    const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement
    await user.type(emailInput, 'test@example.com')

    expect(emailInput.value).toBe('test@example.com')
  })

  it('should accept password input', async () => {
    const user = userEvent.setup()
    render(<LoginPage />)

    const passwordInput = screen.getByLabelText(/password/i, { selector: 'input' }) as HTMLInputElement
    await user.type(passwordInput, 'password123')

    expect(passwordInput.value).toBe('password123')
  })

  it('should call login function on form submit', async () => {
    mockLogin.mockResolvedValue({} as never)

    const user = userEvent.setup()
    render(<LoginPage />)

    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/password/i, { selector: 'input' })
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'password123')
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      })
    })
  })

  it('should handle login error', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid credentials'))

    const user = userEvent.setup()
    render(<LoginPage />)

    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/password/i, { selector: 'input' })
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'wrong-password')
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
    })
  })

  it('should disable submit button while loading', async () => {
    mockLogin.mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 1000))
    )

    const user = userEvent.setup()
    render(<LoginPage />)

    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/password/i, { selector: 'input' })
    const submitButton = screen.getByRole('button', { name: /sign in/i }) as HTMLButtonElement

    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'password123')
    await user.click(submitButton)

    // Button should be disabled while loading
    expect(submitButton.disabled).toBeTruthy()
  })

  it('should redirect to dashboard after successful login', async () => {
    mockLogin.mockResolvedValue({} as never)

    const user = userEvent.setup()
    render(<LoginPage />)

    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/password/i, { selector: 'input' })
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'password123')
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('should require email field', async () => {
    render(<LoginPage />)

    const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement
    expect(emailInput.required).toBeTruthy()
  })

  it('should require password field', async () => {
    render(<LoginPage />)

    const passwordInput = screen.getByLabelText(/password/i, { selector: 'input' }) as HTMLInputElement
    expect(passwordInput.required).toBeTruthy()
  })

  it('should toggle password visibility', async () => {
    const user = userEvent.setup()
    render(<LoginPage />)

    const passwordInput = screen.getByLabelText(/password/i, { selector: 'input' }) as HTMLInputElement
    expect(passwordInput.type).toBe('password')

    const toggleBtn = screen.getByRole('button', { name: /show password/i })
    await user.click(toggleBtn)

    expect(passwordInput.type).toBe('text')
    expect(screen.getByRole('button', { name: /hide password/i })).toBeInTheDocument()
  })

  it('should render forgot password link', () => {
    render(<LoginPage />)
    expect(screen.getByRole('link', { name: /forgot your password/i })).toBeInTheDocument()
  })

  it('should render terms and privacy links', () => {
    render(<LoginPage />)
    expect(screen.getByRole('link', { name: /terms of service/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /privacy policy/i })).toBeInTheDocument()
  })

  describe('social login', () => {
    it('should always render Google and GitHub buttons, disabled when providers are not configured', () => {
      render(<LoginPage />)

      const googleButton = screen.getByRole('button', { name: /google\/gmail/i })
      const githubButton = screen.getByRole('button', { name: /github/i })

      expect(googleButton).toBeInTheDocument()
      expect(githubButton).toBeInTheDocument()
      expect(googleButton).toBeDisabled()
      expect(githubButton).toBeDisabled()
      expect(googleButton).toHaveAttribute('title', 'Coming soon')
      expect(githubButton).toHaveAttribute('title', 'Coming soon')
    })

    it('should enable Google button and start Google flow on click when Google is configured', async () => {
      mockIsGoogleAuthEnabled.mockReturnValue(true)
      const user = userEvent.setup()
      render(<LoginPage />)

      const googleButton = screen.getByRole('button', { name: /google\/gmail/i })
      expect(googleButton).not.toBeDisabled()
      expect(googleButton).not.toHaveAttribute('title')

      await user.click(googleButton)
      expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1)
    })

    it('should enable GitHub button and start GitHub flow on click when GitHub is configured', async () => {
      mockIsGithubAuthEnabled.mockReturnValue(true)
      const user = userEvent.setup()
      render(<LoginPage />)

      const githubButton = screen.getByRole('button', { name: /github/i })
      expect(githubButton).not.toBeDisabled()

      await user.click(githubButton)
      expect(mockSignInWithGithub).toHaveBeenCalledTimes(1)
    })

    it('should not affect email/password login when social providers are disabled', async () => {
      mockLogin.mockResolvedValue({} as never)
      const user = userEvent.setup()
      render(<LoginPage />)

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i, { selector: 'input' })
      const submitButton = screen.getByRole('button', { name: /sign in/i })

      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'password123')
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith({ email: 'test@example.com', password: 'password123' })
      })
    })
  })
})
