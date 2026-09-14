import type { AppLanguage } from "@/lib/workout-domain-labels"

export const CERTIFICATION_FIXTURE_WORKOUT_NAME = "CERT-FIXTURE-20260914-4EX-3SET"

const CERTIFICATION_FIXTURE_DISPLAY_NAMES: Record<AppLanguage, string> = {
  es: "Entrenamiento de Fuerza de Cuerpo Completo",
  en: "Full-Body Strength Workout",
}

export function getWorkoutDisplayName(name: string, language: AppLanguage) {
  if (name !== CERTIFICATION_FIXTURE_WORKOUT_NAME) {
    return name
  }

  return CERTIFICATION_FIXTURE_DISPLAY_NAMES[language]
}
