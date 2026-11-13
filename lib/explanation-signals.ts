/**
 * Recommendation explanations arrive from the API with some signal values as raw enums
 * (e.g. the stagnation risk level "low" | "medium" | "high"). They must never reach the UI
 * as technical literals: map known enums to localized copy and leave everything else untouched.
 */
const RISK_LEVEL_LABELS: Record<string, { es: string; en: string }> = {
  low: { es: "Bajo", en: "Low" },
  medium: { es: "Medio", en: "Medium" },
  high: { es: "Alto", en: "High" },
}

export function formatExplanationSignalValue(value: string, isSpanish: boolean): string {
  const label = RISK_LEVEL_LABELS[value.trim().toLowerCase()]
  if (!label) return value
  return isSpanish ? label.es : label.en
}
