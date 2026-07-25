export type AppLanguage = "es" | "en"

export const MUSCLE_GROUPS = [
  "chest",
  "back",
  "shoulders",
  "arms",
  "legs",
  "core",
  "glutes",
  "full_body",
] as const

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number]

export const EQUIPMENT_TYPES = [
  "bodyweight",
  "dumbbells",
  "barbell",
  "kettlebell",
  "resistance_bands",
  "pull_up_bar",
  "cables",
  "machine",
  "jump_rope",
  "ab_wheel",
  "assault_bike",
  "battle_ropes",
  "bench",
  "hyperextension_bench",
  "incline_bench",
  "landmine",
  "plyo_box",
  "preacher_bench",
  "smith_bar",
  "stairs",
  "t_bar",
  "weight_plate",
] as const

export type Equipment = (typeof EQUIPMENT_TYPES)[number]

export const CATEGORIES = ["strength", "cardio", "flexibility", "balance", "hiit"] as const

export type Category = (typeof CATEGORIES)[number]

const MUSCLE_GROUP_LABELS: Record<AppLanguage, Record<MuscleGroup, string>> = {
  es: {
    chest: "Pecho",
    back: "Espalda",
    shoulders: "Hombros",
    arms: "Brazos",
    legs: "Piernas",
    core: "Core",
    glutes: "Glúteos",
    full_body: "Cuerpo completo",
  },
  en: {
    chest: "Chest",
    back: "Back",
    shoulders: "Shoulders",
    arms: "Arms",
    legs: "Legs",
    core: "Core",
    glutes: "Glutes",
    full_body: "Full body",
  },
}

const EQUIPMENT_LABELS: Record<AppLanguage, Record<Equipment, string>> = {
  es: {
    bodyweight: "Peso corporal",
    dumbbells: "Mancuernas",
    barbell: "Barra",
    kettlebell: "Kettlebell",
    resistance_bands: "Bandas de resistencia",
    pull_up_bar: "Barra de dominadas",
    cables: "Poleas",
    machine: "Máquina",
    jump_rope: "Comba",
    ab_wheel: "Rueda abdominal",
    assault_bike: "Bicicleta de asalto",
    battle_ropes: "Cuerdas de batalla",
    bench: "Banco",
    hyperextension_bench: "Banco de hiperextensiones",
    incline_bench: "Banco inclinado",
    landmine: "Landmine",
    plyo_box: "Cajón pliométrico",
    preacher_bench: "Banco Scott",
    smith_bar: "Máquina Smith",
    stairs: "Escaleras",
    t_bar: "Barra T",
    weight_plate: "Disco de peso",
  },
  en: {
    bodyweight: "Bodyweight",
    dumbbells: "Dumbbells",
    barbell: "Barbell",
    kettlebell: "Kettlebell",
    resistance_bands: "Resistance bands",
    pull_up_bar: "Pull-up bar",
    cables: "Cables",
    machine: "Machine",
    jump_rope: "Jump rope",
    ab_wheel: "Ab wheel",
    assault_bike: "Assault bike",
    battle_ropes: "Battle ropes",
    bench: "Bench",
    hyperextension_bench: "Hyperextension bench",
    incline_bench: "Incline bench",
    landmine: "Landmine",
    plyo_box: "Plyo box",
    preacher_bench: "Preacher bench",
    smith_bar: "Smith machine",
    stairs: "Stairs",
    t_bar: "T-bar",
    weight_plate: "Weight plate",
  },
}

const DIFFICULTY_LABELS: Record<AppLanguage, Record<string, string>> = {
  es: {
    beginner: "Principiante",
    intermediate: "Intermedio",
    advanced: "Avanzado",
  },
  en: {
    beginner: "Beginner",
    intermediate: "Intermediate",
    advanced: "Advanced",
  },
}

const CATEGORY_LABELS: Record<AppLanguage, Record<Category, string>> = {
  es: {
    strength: "Fuerza",
    cardio: "Cardio",
    flexibility: "Flexibilidad",
    balance: "Equilibrio",
    hiit: "HIIT",
  },
  en: {
    strength: "Strength",
    cardio: "Cardio",
    flexibility: "Flexibility",
    balance: "Balance",
    hiit: "HIIT",
  },
}

function formatUnknownDomainValue(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function getMuscleGroupLabel(language: AppLanguage, muscleGroup: string) {
  if (isMuscleGroup(muscleGroup)) {
    return MUSCLE_GROUP_LABELS[language][muscleGroup as MuscleGroup]
  }

  return formatUnknownDomainValue(muscleGroup)
}

export function getEquipmentLabel(language: AppLanguage, equipment: string) {
  if (isEquipment(equipment)) {
    return EQUIPMENT_LABELS[language][equipment as Equipment]
  }

  return formatUnknownDomainValue(equipment)
}

export function getDifficultyLabel(language: AppLanguage, difficulty: string) {
  return DIFFICULTY_LABELS[language][difficulty] ?? formatUnknownDomainValue(difficulty)
}

export function getCategoryLabel(language: AppLanguage, category: string) {
  if (isCategory(category)) {
    return CATEGORY_LABELS[language][category]
  }

  return formatUnknownDomainValue(category)
}

export function isMuscleGroup(value: string): value is MuscleGroup {
  return MUSCLE_GROUPS.includes(value as MuscleGroup)
}

export function isEquipment(value: string): value is Equipment {
  return EQUIPMENT_TYPES.includes(value as Equipment)
}

export function isCategory(value: string): value is Category {
  return CATEGORIES.includes(value as Category)
}
