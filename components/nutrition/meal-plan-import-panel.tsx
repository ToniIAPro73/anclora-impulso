"use client"

import { useState, type ChangeEvent } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileUp,
  Save,
  ShieldAlert,
  ShoppingCart,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  nutritionApi,
  type MealPlanImportCommitResponse,
  type MealPlanImportPreviewResponse,
} from "@/lib/api"

interface MealPlanImportPanelProps {
  isSpanish: boolean
  onCancel: () => void
}

export function MealPlanImportPanel({ isSpanish, onCancel }: MealPlanImportPanelProps) {
  const [rawJson, setRawJson] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isCommitting, setIsCommitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [commitError, setCommitError] = useState<string | null>(null)
  const [preview, setPreview] = useState<MealPlanImportPreviewResponse | null>(null)
  const [commitResult, setCommitResult] = useState<MealPlanImportCommitResponse | null>(null)

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      setRawJson(text)
      setErrorMessage(null)
      setCommitError(null)
      setCommitResult(null)
    } catch {
      setErrorMessage(
        isSpanish
          ? "No se pudo leer el archivo JSON seleccionado."
          : "Could not read the selected JSON file."
      )
    }
  }

  const handlePreview = async () => {
    if (!rawJson.trim()) {
      setErrorMessage(
        isSpanish
          ? "Pega un plan JSON o carga un archivo .json antes de previsualizar."
          : "Paste a JSON plan or upload a .json file before previewing."
      )
      return
    }

    setIsLoading(true)
    setErrorMessage(null)
    setCommitError(null)
    setCommitResult(null)
    try {
      const response = await nutritionApi.previewImportedMealPlan({
        rawPayload: rawJson,
      })
      setPreview(response)
    } catch (error) {
      setPreview(null)
      setErrorMessage(
        error instanceof Error
          ? error.message
          : isSpanish
            ? "Error al validar la importación del plan."
            : "Failed to validate meal plan import."
      )
    } finally {
      setIsLoading(false)
    }
  }

  const canSavePlan = Boolean(
    preview &&
      preview.canCommitToDatabase &&
      preview.canImportPreview &&
      preview.status !== "REJECTED" &&
      preview.previewHash
  )

  const targetLifecycleStatus: "DRAFT" | "ACTIVE" =
    preview?.status === "INCOMPLETE" ? "DRAFT" : "ACTIVE"

  const handleCommit = async () => {
    if (!canSavePlan || !preview?.previewHash) return

    setIsCommitting(true)
    setCommitError(null)
    try {
      const result = await nutritionApi.commitImportedMealPlan({
        rawPayload: rawJson,
        previewHash: preview.previewHash,
        requestedLifecycleStatus: targetLifecycleStatus,
      })
      setCommitResult(result)
    } catch (error) {
      setCommitError(
        error instanceof Error
          ? error.message
          : isSpanish
            ? "No se pudo guardar el plan importado. Puedes reintentar de forma segura."
            : "Failed to save imported plan. You can safely retry."
      )
    } finally {
      setIsCommitting(false)
    }
  }

  const plan = preview?.validation.normalizedPlan

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="meal-plan-import-json">
            {isSpanish
              ? "Plan nutricional JSON (contrato meal-plan-import-v1)"
              : "Meal plan JSON (meal-plan-import-v1 contract)"}
          </Label>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent">
            <FileUp className="h-3.5 w-3.5" />
            <span>{isSpanish ? "Cargar .json" : "Upload .json"}</span>
            <input
              type="file"
              accept=".json,application/json"
              className="sr-only"
              onChange={handleFileUpload}
            />
          </label>
        </div>

        <textarea
          id="meal-plan-import-json"
          value={rawJson}
          onChange={(e) => {
            setRawJson(e.target.value)
            setCommitResult(null)
            setCommitError(null)
          }}
          rows={6}
          placeholder='{ "specVersion": "meal-plan-import-v1", "title": "...", "days": [...] }'
          className="w-full rounded-xl border border-input bg-background px-3 py-2 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {errorMessage ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
        >
          {errorMessage}
        </div>
      ) : null}

      {preview ? (
        <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {preview.status === "REJECTED" ? (
                <ShieldAlert className="h-4 w-4 text-red-600" />
              ) : preview.status === "INCOMPLETE" || preview.status === "VALID_WITH_WARNINGS" ? (
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              )}
              <span className="text-sm font-semibold">
                {preview.summary.title ?? (isSpanish ? "Plan sin título" : "Untitled plan")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {preview.status !== "REJECTED" ? (
                <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {targetLifecycleStatus}
                </span>
              ) : null}
              <span
                data-testid="import-preview-status"
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  preview.status === "REJECTED"
                    ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                    : preview.status === "VALID"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                }`}
              >
                {preview.status}
              </span>
            </div>
          </div>

          {preview.status === "REJECTED" ? (
            <div
              role="alert"
              className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
            >
              <p className="font-semibold">
                {isSpanish
                  ? "Importación bloqueada por seguridad o contrato inválido."
                  : "Import blocked by safety rules or invalid contract."}
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {preview.validation.errors.map((err, idx) => (
                  <li key={`${err.code}-${idx}`}>{err.message}</li>
                ))}
                {preview.validation.safetyFlags.map((flag) => (
                  <li key={flag}>{flag}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {plan ? (
            <>
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <div className="rounded-lg border border-border bg-background p-2">
                  <p className="text-muted-foreground">{isSpanish ? "Días" : "Days"}</p>
                  <p className="font-semibold">{preview.summary.daysCount}</p>
                </div>
                <div className="rounded-lg border border-border bg-background p-2">
                  <p className="text-muted-foreground">{isSpanish ? "Comidas" : "Meals"}</p>
                  <p className="font-semibold">{preview.summary.mealsCount}</p>
                </div>
                <div className="rounded-lg border border-border bg-background p-2">
                  <p className="text-muted-foreground">
                    {isSpanish ? "Recetas únicas" : "Unique recipes"}
                  </p>
                  <p className="font-semibold">{preview.summary.recipesCount}</p>
                </div>
                <div className="rounded-lg border border-border bg-background p-2">
                  <p className="text-muted-foreground">{isSpanish ? "Protocolo" : "Protocol"}</p>
                  <p className="font-semibold">{plan.preferences.dietType}</p>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-background p-3 text-xs">
                <p className="font-medium">
                  {isSpanish
                    ? "Preferencias y restricciones detectadas"
                    : "Detected preferences & restrictions"}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {isSpanish ? "Presupuesto:" : "Budget:"} {plan.preferences.budgetTier} ·{" "}
                  {isSpanish ? "Máx. ingredientes:" : "Max ingredients:"}{" "}
                  {plan.preferences.maxMainIngredients} ·{" "}
                  {isSpanish ? "Horarios:" : "Times:"} {plan.preferences.mealTimes.join(", ")}
                </p>
                {plan.preferences.excludedEquipment.length > 0 ? (
                  <p className="mt-1 text-muted-foreground">
                    {isSpanish ? "Equipo excluido:" : "Excluded equipment:"}{" "}
                    {plan.preferences.excludedEquipment.join(", ")}
                  </p>
                ) : null}
                {(preview.summary.hasIncompleteNutrition ||
                  preview.summary.hasIncompleteIngredients) && (
                  <p className="mt-1 text-amber-700 dark:text-amber-300">
                    {isSpanish
                      ? "Contiene información nutricional o cantidades desconocidas; se guardará como DRAFT sin inventar valores."
                      : "Contains unknown nutrition or quantities; will be saved as DRAFT without inventing values."}
                  </p>
                )}
              </div>

              {preview.validation.warnings.length > 0 ||
              preview.validation.missingData.length > 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                  <p className="font-semibold">
                    {isSpanish ? "Advertencias y datos pendientes" : "Warnings and pending data"}
                  </p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">
                    {preview.validation.warnings.map((w, idx) => (
                      <li key={`w-${w.code}-${idx}`}>{w.message}</li>
                    ))}
                    {preview.validation.missingData.map((m, idx) => (
                      <li key={`m-${m.code}-${idx}`}>{m.message}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="rounded-lg border border-border bg-background p-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <ShoppingCart className="h-3.5 w-3.5" />
                    {isSpanish ? "Lista de la compra derivada" : "Derived shopping list"}
                  </span>
                  <span className="text-muted-foreground">
                    {preview.shoppingList.isExact
                      ? isSpanish
                        ? "Exacta"
                        : "Exact"
                      : isSpanish
                        ? "Parcial (unidades/cantidades pendientes)"
                        : "Partial (pending units/quantities)"}
                  </span>
                </div>
                {preview.shoppingList.aggregatedItems.length > 0 ? (
                  <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                    {preview.shoppingList.aggregatedItems.slice(0, 8).map((item) => (
                      <li key={`${item.name}-${item.unit}`} className="text-muted-foreground">
                        {item.name}: {item.totalQuantity} {item.unit}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {preview.shoppingList.unconvertibleItems.length > 0 ? (
                  <p className="mt-2 text-amber-700 dark:text-amber-300">
                    {isSpanish
                      ? `${preview.shoppingList.unconvertibleItems.length} ingrediente(s) sin conversión automática (cantidad o unidad pendiente).`
                      : `${preview.shoppingList.unconvertibleItems.length} ingredient(s) skipped from automatic aggregation (missing quantity or non-canonical unit).`}
                  </p>
                ) : null}
              </div>

              {preview.duplicateMatches.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {isSpanish
                    ? `Coincidencias de recetas existentes: ${preview.duplicateMatches.map((d) => d.importedRecipeName).join(", ")}`
                    : `Existing recipe matches: ${preview.duplicateMatches.map((d) => d.importedRecipeName).join(", ")}`}
                </p>
              ) : null}

              {!preview.canCommitToDatabase ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300">
                  {isSpanish
                    ? "Previsualización lista. El guardado definitivo en base de datos queda pendiente de la migración M28."
                    : "Preview ready. Final database persistence is pending the M28 migration."}
                </div>
              ) : null}

              {commitError ? (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
                >
                  {commitError}
                </div>
              ) : null}

              {commitResult ? (
                <div
                  data-testid="import-commit-success"
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200"
                >
                  <span>
                    {commitResult.idempotentReplay
                      ? isSpanish
                        ? `Plan ya importado anteriormente (${commitResult.lifecycleStatus}).`
                        : `Plan was already imported previously (${commitResult.lifecycleStatus}).`
                      : isSpanish
                        ? `Plan guardado correctamente como ${commitResult.lifecycleStatus} (${commitResult.mealsCount} comidas).`
                        : `Plan saved successfully as ${commitResult.lifecycleStatus} (${commitResult.mealsCount} meals).`}
                  </span>
                  <Link
                    href={`/nutrition/meal-plans/${commitResult.mealPlanId}`}
                    className="inline-flex items-center gap-1 font-semibold underline"
                  >
                    <span>{isSpanish ? "Ver plan" : "View plan"}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          {isSpanish ? "Cancelar" : "Cancel"}
        </Button>
        <Button type="button" variant="outline" onClick={handlePreview} disabled={isLoading}>
          <Sparkles className="mr-2 h-4 w-4" />
          {isLoading
            ? isSpanish
              ? "Validando..."
              : "Validating..."
            : isSpanish
              ? "Previsualizar importación"
              : "Preview import"}
        </Button>
        {canSavePlan ? (
          <Button
            type="button"
            variant="success"
            onClick={handleCommit}
            disabled={isCommitting || Boolean(commitResult)}
          >
            <Save className="mr-2 h-4 w-4" />
            {isCommitting
              ? isSpanish
                ? "Guardando..."
                : "Saving..."
              : targetLifecycleStatus === "DRAFT"
                ? isSpanish
                  ? "Guardar como borrador (DRAFT)"
                  : "Save as draft (DRAFT)"
                : isSpanish
                  ? "Confirmar y guardar plan"
                  : "Confirm & save plan"}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
