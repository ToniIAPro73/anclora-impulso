import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import AdminContentPage from "@/app/admin/content/page"
import { CookieConsent } from "@/components/cookie-consent"
import esTranslations from "@/lib/translations/es.json"

jest.mock("@/components/protected-dashboard-page", () => ({
  ProtectedDashboardPage: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

jest.mock("@/lib/contexts/auth-context", () => ({
  useAuth: () => ({
    user: { id: "admin-fixture", email: "admin@fixture.local", isAdmin: true },
  }),
}))

jest.mock("@/lib/contexts/language-context", () => ({
  useLanguage: () => ({
    language: "es",
    t: esTranslations,
  }),
}))

jest.mock("@/hooks/use-editorial-content", () => {
  // Stable reference, like React Query data: the page derives effects from the identity of `summary`.
  const mockEditorialState = {
    summary: {
      total: 1,
      averageQualityScore: 65,
      byStatus: {
        ready: 0,
        review: 0,
        needs_work: 1,
      },
      exercises: [
        {
          id: "ex-1",
          name: "Press de banca inclinado con mancuernas y pausa controlada de tres segundos en descenso",
          category: "strength",
          muscleGroup: "chest",
          difficulty: "intermediate",
          equipment: "dumbbells",
          trainingEnvironments: ["gym"],
          videoUrl: null,
          imageUrl: null,
          description: "Descripción de prueba",
          instructions: ["Paso 1"],
          editorial: {
            qualityScore: 65,
            editorialStatus: "needs_work",
            editorialNotes: "Revisar técnica",
            checks: { hasDescription: true, hasEnoughInstructions: false, hasEnvironment: true, hasImage: false, hasDifficulty: true },
          },
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    },
    recipesSummary: {
      total: 1,
      averageQualityScore: 95,
      byStatus: {
        ready: 1,
        review: 0,
        needs_work: 0,
      },
      recipes: [
        {
          id: "rec-1",
          name: "Bol proteico mediterráneo de salmón al horno con quinoa y vegetales asados",
          mealType: "lunch",
          calories: 560,
          proteinG: 42,
          carbsG: 48,
          fatG: 20,
          instructions: ["Paso 1", "Paso 2"],
          servings: 2,
          tags: ["meal prep"],
          ingredients: [],
          editorial: {
            qualityScore: 95,
            editorialStatus: "ready",
            editorialNotes: null,
            checks: { hasDescription: true, hasEnoughInstructions: true, hasImage: true, hasDifficulty: true, hasMacros: true, hasTags: true, hasIngredients: true },
          },
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    },
    eventsSummary: { total: 0, counts: {} },
    isLoading: false,
    isLoadingRecipes: false,
    error: null,
    recipesError: null,
    updateExercise: jest.fn(),
    updateRecipe: jest.fn(),
    bulkUpdateExerciseEditorial: jest.fn(),
    bulkUpdateRecipeEditorial: jest.fn(),
    isUpdating: false,
    isBulkUpdating: false,
    isUpdatingRecipe: false,
    isBulkUpdatingRecipe: false,
    refetch: jest.fn(),
    refetchRecipes: jest.fn(),
  }
  return { useEditorialExercises: () => mockEditorialState }
})

jest.mock("@/lib/api", () => ({
  engagementApi: {
    // plain function: survives jest resetMocks
    getRecentDeliveries: () => Promise.resolve([
      { id: "d1", kind: "workout_reminder", channel: "email", status: "sent", subject: "Recordatorio", body: "", createdAt: "2026-01-01T00:00:00.000Z", user: { email: "a@fixture.local", fullName: "A" } },
      { id: "d2", kind: "weekly_summary", channel: "email", status: "failed", subject: "Cierre", body: "", createdAt: "2026-01-01T00:00:00.000Z", user: { email: "b@fixture.local", fullName: "B" } },
      { id: "d3", kind: "nutrition", channel: "email", status: "pending", subject: "Registro", body: "", createdAt: "2026-01-01T00:00:00.000Z", user: { email: "c@fixture.local", fullName: "C" } },
    ]),
    dispatchNow: jest.fn(),
  },
}))

describe("AdminContentPage and CookieConsent UI contracts", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("renders localized editorial labels and multi-line title clamping in AdminContentPage", async () => {
    render(<AdminContentPage />)

    const title = await screen.findByText(
      "Press de banca inclinado con mancuernas y pausa controlada de tres segundos en descenso"
    )
    expect(title.className).toContain("line-clamp-2")
    expect(title.className).not.toContain("truncate")

    const localizedNeedsWork = screen.getAllByText("Necesita revisión")
    expect(localizedNeedsWork.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole("option", { name: "Necesita revisión" })).toBeInTheDocument()
    expect(screen.queryByText("needs_work")).not.toBeInTheDocument()
  })

  it("never exposes raw editorial or delivery status enums in badges, filters or bulk actions", async () => {
    const user = userEvent.setup()
    render(<AdminContentPage />)

    // exercise item badge (real API shape: status lives under `editorial`)
    await screen.findByText("Enviado")
    expect(screen.getByText("Fallido")).toBeInTheDocument()
    expect(screen.getByText("Pendiente")).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Listo" })).toBeInTheDocument()
    // filters and row selection expose accessible names
    expect(screen.getByRole("combobox", { name: "Filtrar por estado" })).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Filtrar por incidencia" })).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Ordenar" })).toBeInTheDocument()
    expect(screen.getByRole("checkbox", { name: /^Seleccionar Press de banca/ })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "En revisión" })).toBeInTheDocument()

    await user.click(screen.getByRole("tab", { name: /recetas/i }))
    await waitFor(() => {
      expect(screen.getAllByText("Listo").length).toBeGreaterThanOrEqual(2)
    })

    for (const raw of ["ready", "review", "needs_work", "sent", "failed", "pending"]) {
      expect(screen.queryByText(raw)).not.toBeInTheDocument()
    }
  })

  it("keeps the editor dialog body scrollable instead of letting fields collapse onto each other", async () => {
    const user = userEvent.setup()
    render(<AdminContentPage />)

    await user.click(await screen.findByRole("button", { name: /editar/i }))
    const dialog = await screen.findByRole("dialog")
    const body = dialog.querySelector('[data-slot="editor-scroll-body"]')
    expect(body).not.toBeNull()
    const classes = body?.className.split(" ") ?? []
    expect(classes).toEqual(expect.arrayContaining(["min-h-0", "overflow-y-auto", "[&>*]:shrink-0"]))
    // single shrinkable column: an unbreakable title can no longer widen the dialog content
    expect(body?.parentElement?.className.split(" ")).toContain("grid-cols-1")
    expect(screen.getByRole("heading", { name: /Press de banca inclinado/ }).className).toContain("break-words")
  })

  it("lets unbreakable titles wrap instead of clipping", async () => {
    render(<AdminContentPage />)
    const title = await screen.findByText(/Press de banca inclinado/)
    expect(title.className).toContain("break-words")
    // the queue column must be allowed to shrink below its min-content width (mobile clipping regression)
    const layoutGrid = title.closest('[class*="xl:grid-cols-"]')
    expect(layoutGrid?.className.split(" ")).toContain("grid-cols-1")
  })

  it("renders balanced cookie choices and closes preferences dialog on Escape", async () => {
    const user = userEvent.setup()
    render(<CookieConsent />)

    expect(screen.getByRole("button", { name: "Aceptar todas" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Rechazar opcionales" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Configuración" }))
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument()
    })

    await user.keyboard("{Escape}")
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
  })
})
