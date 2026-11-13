export const ANCLORA_MODAL_SURFACE_CLASS =
  "overflow-hidden border-slate-200/90 bg-white p-0 dark:border-slate-800/90 dark:bg-slate-950"

export const ANCLORA_MODAL_HEADER_CLASS = "mb-4 pr-10 text-left"

export const ANCLORA_MODAL_SECONDARY_ACTION_CLASS =
  "h-11 rounded-2xl border-slate-700/70 bg-slate-900/45 text-slate-100 hover:bg-slate-800/70 dark:border-slate-700/80 dark:bg-slate-900/45"

export const ANCLORA_MODAL_ACTIONS_CLASS =
  "grid grid-cols-1 gap-2 border-t border-slate-200/70 pt-3 dark:border-slate-800/80 sm:grid-cols-2"

export function buildResponsiveModalClass(maxWidthClass: string) {
  return `w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] ${maxWidthClass} ${ANCLORA_MODAL_SURFACE_CLASS}`
}
