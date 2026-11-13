import Link from "next/link"

type AuthErrorPageProps = {
  searchParams?: {
    error?: string
    provider?: string
    reason?: string
  }
}

const REASON_MESSAGES: Record<string, string> = {
  membership_required:
    "Tu cuenta de Anclora Identity no tiene acceso habilitado a Anclora Impulso.",
  link_requires_explicit_link:
    "Ya existe una cuenta local con este correo. Inicia sesión con tu método original y vincula Anclora Identity desde tu perfil.",
  email_not_verified:
    "Tu correo electrónico en el proveedor de identidad no está verificado.",
  unavailable:
    "El servicio de Anclora Identity no está disponible en este momento. Inténtalo de nuevo en unos instantes.",
  invalid_state:
    "La sesión de autenticación ha caducado o no es válida. Vuelve a iniciar el proceso.",
  account_disabled:
    "Esta cuenta se encuentra deshabilitada.",
  account_conflict:
    "No se pudo asociar la identidad externa por un conflicto con otra cuenta.",
  access_denied:
    "Se canceló la autorización en el proveedor de identidad.",
  retry:
    "La solicitud de inicio de sesión caducó o está incompleta. Inténtalo de nuevo.",
  exchange:
    "No se pudo completar el intercambio de credenciales con el proveedor de identidad.",
}

export default function AuthErrorPage({
  searchParams,
}: AuthErrorPageProps) {
  const reasonCode = searchParams?.reason
  const mappedMessage = reasonCode ? REASON_MESSAGES[reasonCode] : undefined
  const fallbackMessage = searchParams?.error
    ? `Error: ${searchParams.error}`
    : "Se produjo un error de autenticación. Inténtalo de nuevo."

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-50 dark:from-gray-900 dark:to-gray-800 p-6">
      <div className="w-full max-w-md">
        <div className="rounded-xl py-6 shadow-xl border-0 bg-white/80 backdrop-blur-sm dark:bg-gray-900/80">
          <div className="text-center pb-8 px-6">
            <div className="mx-auto w-16 h-16 bg-gradient-to-r from-red-500 to-pink-500 rounded-2xl flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Error de autenticación</h1>
          </div>
          <div className="text-center space-y-6 px-6">
            <div role="alert" aria-live="polite" className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-200">
                {mappedMessage ?? fallbackMessage}
              </p>
            </div>
            <div className="space-y-3">
              <Link
                href="/auth/login"
                className="inline-flex h-9 w-full items-center justify-center rounded-md bg-gradient-to-r from-orange-500 to-red-500 px-4 py-2 text-sm font-medium text-white shadow-xs transition-all hover:from-orange-600 hover:to-red-600 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                Volver al inicio de sesión
              </Link>
              <Link
                href="/"
                className="inline-flex h-9 w-full items-center justify-center rounded-md border border-input bg-transparent px-4 py-2 text-sm font-medium shadow-xs transition-all hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 dark:border-input dark:bg-input/30 dark:hover:bg-input/50"
              >
                Ir al inicio
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
