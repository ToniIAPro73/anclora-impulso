import {
  CERTIFICATION_FIXTURE_WORKOUT_NAME,
  getWorkoutDisplayName,
} from "@/lib/workout-display-name"

describe("getWorkoutDisplayName", () => {
  it("uses the requested Spanish display name for the certification fixture", () => {
    expect(getWorkoutDisplayName(CERTIFICATION_FIXTURE_WORKOUT_NAME, "es")).toBe(
      "Entrenamiento de Fuerza de Cuerpo Completo",
    )
  })

  it("uses a friendly English display name for the certification fixture", () => {
    expect(getWorkoutDisplayName(CERTIFICATION_FIXTURE_WORKOUT_NAME, "en")).toBe(
      "Full-Body Strength Workout",
    )
  })

  it("preserves every non-fixture workout name", () => {
    expect(getWorkoutDisplayName("My regular workout", "es")).toBe("My regular workout")
    expect(getWorkoutDisplayName("My regular workout", "en")).toBe("My regular workout")
  })
})
