import { getLocalizedExerciseCopy } from "@/lib/localized-exercise-copy"

const baseExercise = {
  name: "Leg Raises",
  description: "Elevaciones de piernas para el abdomen bajo.",
  instructions: ["Acuéstate boca arriba con las piernas extendidas"],
}

describe("getLocalizedExerciseCopy", () => {
  it("returns Spanish exercise names and keeps available Spanish copy", () => {
    expect(getLocalizedExerciseCopy(baseExercise, "es")).toEqual({
      name: "Elevaciones de piernas",
      description: "Elevaciones de piernas para el abdomen bajo.",
      instructions: ["Acuéstate boca arriba con las piernas extendidas"],
    })
  })

  it("returns English exercise names and available English copy", () => {
    expect(getLocalizedExerciseCopy(baseExercise, "en")).toEqual(
      expect.objectContaining({
        name: "Leg Raises",
        description: "Leg raises for the lower abs.",
        instructions: expect.arrayContaining(["Lie on your back with your legs extended"]),
      }),
    )
  })

  it("localizes generated exercise names without mutating canonical values", () => {
    const exercise = {
      name: "Alternating Banded Glute Bridge March",
      description: "Puente con banda sobre rodillas para glúteo mayor y medio con baja agresividad.",
      instructions: [],
    }

    const localized = getLocalizedExerciseCopy(exercise, "es")

    expect(localized.name).toBe("Marcha alterna en puente de glúteos con banda")
    expect(exercise.name).toBe("Alternating Banded Glute Bridge March")
  })
})
