import { LoginPageContent } from "@/components/login-page-content"

// Credentials are never read from the environment or rendered into the HTML (AUD-024).
export default function LoginPage() {
  return <LoginPageContent />
}
