import exercisesData from "@/data/exercises.json"
import {
  getCategoryLabel,
  getEquipmentLabel,
  getMuscleGroupLabel,
  isCategory,
  isEquipment,
  isMuscleGroup,
} from "@/lib/workout-domain-labels"

type SeedExercise = {
  category?: string
  equipment?: string
  muscleGroup?: string
}

const exercises = exercisesData as SeedExercise[]

const realCategories = [...new Set(exercises.map((e) => e.category).filter(Boolean))] as string[]
const realEquipment = [...new Set(exercises.map((e) => e.equipment).filter(Boolean))] as string[]
const realMuscleGroups = [...new Set(exercises.map((e) => e.muscleGroup).filter(Boolean))] as string[]

describe("workout-domain-labels covers every real seed value", () => {
  it("has at least one category, equipment and muscle group to check against", () => {
    expect(realCategories.length).toBeGreaterThan(0)
    expect(realEquipment.length).toBeGreaterThan(0)
    expect(realMuscleGroups.length).toBeGreaterThan(0)
  })

  it.each(realCategories)("category '%s' is explicitly translated (es and en)", (category) => {
    expect(isCategory(category)).toBe(true)
    expect(getCategoryLabel("es", category)).not.toHaveLength(0)
    expect(getCategoryLabel("en", category)).not.toHaveLength(0)
  })

  it.each(realEquipment)("equipment '%s' is explicitly translated (es and en)", (equipment) => {
    expect(isEquipment(equipment)).toBe(true)
    expect(getEquipmentLabel("es", equipment)).not.toHaveLength(0)
    expect(getEquipmentLabel("en", equipment)).not.toHaveLength(0)
  })

  it.each(realMuscleGroups)("muscle group '%s' is explicitly translated (es and en)", (muscleGroup) => {
    expect(isMuscleGroup(muscleGroup)).toBe(true)
    expect(getMuscleGroupLabel("es", muscleGroup)).not.toHaveLength(0)
    expect(getMuscleGroupLabel("en", muscleGroup)).not.toHaveLength(0)
  })
})
