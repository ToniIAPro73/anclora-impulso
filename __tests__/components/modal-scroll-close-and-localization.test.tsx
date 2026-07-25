import fs from "node:fs"
import path from "node:path"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { ExerciseLibrary } from "@/components/exercise-library"
import { OnboardingDialog } from "@/components/onboarding-dialog"
import { WorkoutGenerator } from "@/components/workout-generator"

const mockUpdateProfile = jest.fn()
const mockGenerateWorkout = jest.fn()
let mockLanguage: "es" | "en" = "es"

const completeProfile = {
  sex: "female",
  age: 42,
  heightCm: 168,
  weightKg: 74,
  targetWeightKg: 68,
  timeframeWeeks: 16,
  trainingDaysPerWeek: 4,
  trainingGoal: "recomposition",
  preferredTrainingEnvironment: "gym",
  experienceLevel: "intermediate",
  limitations: [],
  onboardingCompletedAt: null,
}

const longExercise = {
  id: "exercise-1",
  name: "Long Push-up",
  category: "strength",
  muscleGroup: "chest",
  equipment: "dumbbells",
  trainingEnvironments: ["gym", "home"],
  difficulty: "beginner",
  description:
    "Long exercise description that should remain readable inside the dialog body without clipping.",
  instructions: Array.from({ length: 18 }, (_, index) => `Controlled instruction ${index + 1}`),
  imageUrl: null,
  videoUrl: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
}

jest.mock("@/lib/contexts/language-context", () => ({
  useLanguage: () => ({
    language: mockLanguage,
    setLanguage: jest.fn(),
    t: {},
  }),
}))

jest.mock("@/lib/contexts/auth-context", () => ({
  useAuth: () => ({
    user: { id: "user-1", email: "test@example.com", fullName: "Test User" },
    profile: completeProfile,
    updateProfile: mockUpdateProfile,
    isLoading: false,
  }),
}))

jest.mock("@/hooks/use-exercises", () => ({
  useExercises: () => ({
    exercises: [longExercise],
    isLoading: false,
    error: null,
  }),
}))

jest.mock("@/hooks/use-workouts", () => ({
  useWorkouts: () => ({
    workouts: [],
    generateWorkout: mockGenerateWorkout,
    deleteWorkout: jest.fn(),
    isDeleting: false,
  }),
}))

jest.mock("@/lib/product-events", () => ({
  trackProductEvent: jest.fn().mockResolvedValue(undefined),
}))

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}))

describe("modal scrolling, close behavior, and workout localization", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLanguage = "es"
    mockUpdateProfile.mockResolvedValue(undefined)
    mockGenerateWorkout.mockResolvedValue({
      id: "workout-1",
      userId: "user-1",
      name: "Generated workout",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      exercises: [],
    })
  })

  it("renders onboarding with a named dialog, scrollable step body, and stable actions", () => {
    render(<OnboardingDialog open onOpenChange={jest.fn()} />)

    expect(screen.getByRole("dialog", { name: /onboarding inteligente/i })).toBeInTheDocument()
    expect(screen.getByTestId("onboarding-step-scroll-body")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /más tarde/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /continuar/i })).toBeInTheDocument()
  })

  it("keeps onboarding completion reachable and closes after saving", async () => {
    const user = userEvent.setup()
    const onOpenChange = jest.fn()

    render(<OnboardingDialog open onOpenChange={onOpenChange} />)

    await user.click(screen.getByRole("button", { name: /continuar/i }))
    await user.click(screen.getByRole("button", { name: /continuar/i }))

    expect(screen.getByTestId("onboarding-step-scroll-body")).toHaveTextContent(/objetivo/i)
    await user.click(screen.getByRole("button", { name: /finalizar onboarding/i }))

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalled()
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  it("uses a bounded scroll body and visible Close button in exercise detail dialogs", async () => {
    const user = userEvent.setup()
    render(<ExerciseLibrary />)

    await user.click(screen.getByText("Flexión larga"))

    const dialog = screen.getByRole("dialog", { name: /flexión larga/i })
    expect(within(dialog).getByTestId("exercise-detail-scroll-body")).toHaveTextContent(
      "Controlled instruction 18",
    )
    expect(within(dialog).getByRole("button", { name: /cerrar/i })).toBeInTheDocument()
  })

  it("closes the exact exercise detail dialog through the visible Close button", async () => {
    const user = userEvent.setup()
    render(<ExerciseLibrary />)

    await user.click(screen.getByText("Flexión larga"))
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /cerrar/i }))

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
  })

  it("does not use global DOM queries to close exercise dialogs", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "components/exercise-library.tsx"),
      "utf8",
    )

    expect(source).not.toContain("document.querySelector")
    expect(source).not.toContain("dialog-close")
  })

  it("shows Spanish workout muscle and equipment labels without exposing canonical keys", () => {
    render(<WorkoutGenerator />)

    expect(screen.getByLabelText("Pecho")).toBeInTheDocument()
    expect(screen.getByLabelText("Mancuernas")).toBeInTheDocument()
    expect(screen.queryByLabelText("chest")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("dumbbells")).not.toBeInTheDocument()
  })

  it("shows English workout muscle and equipment labels", () => {
    mockLanguage = "en"

    render(<WorkoutGenerator />)

    expect(screen.getByLabelText("Chest")).toBeInTheDocument()
    expect(screen.getByLabelText("Dumbbells")).toBeInTheDocument()
  })

  it("keeps canonical workout values in the generated payload", async () => {
    const user = userEvent.setup()
    render(<WorkoutGenerator />)

    const chest = screen.getByLabelText("Pecho")
    const dumbbells = screen.getByLabelText("Mancuernas")

    if (!chest.getAttribute("aria-checked")?.includes("true")) {
      await user.click(chest)
    }

    if (!dumbbells.getAttribute("aria-checked")?.includes("true")) {
      await user.click(dumbbells)
    }

    await user.click(screen.getByRole("button", { name: /generar entrenamiento con ia/i }))

    await waitFor(() => {
      expect(mockGenerateWorkout).toHaveBeenCalledWith(
        expect.objectContaining({
          targetMuscles: expect.arrayContaining(["chest"]),
          equipment: expect.arrayContaining(["dumbbells"]),
        }),
      )
    })
  })
})
