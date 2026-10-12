# 41 — Plan de medición para decidir P2 de la CSP (v1, 2026-10-13)

> Prepara la decisión 2 de `40-design-csp-hardening-v1.md` §6 (¿renderizado dinámico global?). No cambia producción ni `development`.
> La rama experimental **no se ha subido** a GitHub todavía.

> **DECISIÓN DE TONI (2026-10-13): P2 se aplaza hasta que haya usuarios.** La rama experimental **no se sube** y la medición del
> experimento **no se ejecuta**. Se conservan la línea base (§2), el script de medición y el plan para retomarlo. Motivo: hoy no hay
> tráfico real, y pasar a renderizado dinámico solo compensa con usuarios y datos de uso. La rama local `experiment/csp-p2-dynamic`
> (un commit, nunca subido) se mantiene solo como referencia reproducible; puede borrarse con `git branch -D experiment/csp-p2-dynamic`.

## 1. Qué se mide y por qué

Forzar renderizado dinámico es el único requisito técnico de P2 (los *nonces* solo se estampan en renderizado por petición,
`40-…` §4). La decisión depende de dos cosas que aún no están medidas:

| Pregunta | Métrica |
|---|---|
| ¿Funciona el *nonce* de extremo a extremo? | Nº de `<script>` con y sin `nonce` en el HTML, y si el `nonce` del HTML coincide con el de la cabecera `Report-Only` |
| ¿Desaparecen las violaciones de la política estricta? | Informes `[csp-report]` en los logs de Vercel de la rama experimental |
| ¿Qué cuesta el renderizado dinámico? | TTFB y tiempo total (mediana, p90, máximo) por página, frente a la línea base estática |
| ¿Se rompe algo? | Recorrido autenticado con la cuenta QA: consola, errores, peticiones bloqueadas |

## 2. Línea base (ya medida, `development`, `2e2d251`, 10 muestras por página tras 1 calentamiento)

Preview `anclora-impulso-amvus4wk1-pmi140979-6354s-projects.vercel.app`, páginas **estáticas**, `x-vercel-cache: HIT`.

| Página | TTFB mediana / p90 / máx (ms) | Total mediana (ms) | `<script>` | con nonce | sin nonce |
|---|---|---|---|---|---|
| `/` | 150 / 158 / 160 | 151 | 17 | 0 | 17 |
| `/landing` | 145 / 164 / 172 | 146 | 17 | 0 | 17 |
| `/auth/login` | 144 / 175 / 194 | 145 | 17 | 0 | 17 |
| `/legal` | 142 / 152 / 198 | 145 | 14 | 0 | 14 |
| `/privacy` | 141 / 161 / 184 | 142 | 14 | 0 | 14 |
| `/terms` | 149 / 164 / 199 | 151 | 14 | 0 | 14 |

Lectura: ninguna etiqueta de script lleva *nonce* en las páginas estáticas, como se esperaba. La latencia medida incluye la ruta
del cliente (equipo de Toni → Vercel) y la comprobación del token de protección.

## 3. Experimento

| Elemento | Valor |
|---|---|
| Rama (local, sin subir) | `experiment/csp-p2-dynamic`, un commit sobre `development` |
| Cambio | `export const dynamic = "force-dynamic"` en `app/layout.tsx` (4 líneas con comentario) |
| Build aislado | Verde. **Todas las páginas pasan de `○` (estáticas) a `ƒ` (dinámicas)**; el tamaño de los *bundles* no cambia |
| Qué no cambia | La política que se **aplica** (sigue con `unsafe-inline`); solo se observa la estricta |

## 4. Procedimiento (cuando se autorice subir la rama)

1. `git push origin experiment/csp-p2-dynamic` (Vercel genera un preview; no afecta a `main` ni a producción).
2. Esperar `Deployment has completed` y obtener la URL del preview (`gh api repos/.../commits/<sha>/status`).
3. Ejecutar `node scripts/csp/measure-preview.mjs <url-preview> --label=dynamic --samples=10 --out=artifacts/csp-measure/dynamic.json`.
4. Recorrido autenticado con `agent-browser` (cuenta QA) y lectura de logs de Vercel para esa rama.
5. Comparar con la línea base y registrar en este documento.
6. **Borrar la rama remota** al terminar (`git push origin --delete experiment/csp-p2-dynamic`), salvo decisión contraria.

## 5. Criterios para decidir (propuestos, de Toni la decisión final)

| Resultado | Decisión sugerida |
|---|---|
| Todos los `<script>` con `nonce` coincidente, 0 violaciones, y TTFB ≤ ~2× la línea base | Avanzar a P2 (enforce) por fases |
| *Nonce* correcto pero TTFB mucho mayor (> ~3× o > 500 ms de mediana) | Valorar coste frente a beneficio; considerar limitar la política estricta a rutas autenticadas |
| *Nonce* no coincide o siguen violaciones propias | No avanzar; investigar la causa |
| Cualquier regresión funcional del recorrido | No avanzar |

## 6. Límites

- La línea base y el experimento se miden desde **un solo punto de red** y contra previews; producción (dominio propio, otra caché)
  puede diferir.
- El renderizado dinámico en el plan de Vercel de Toni puede tener coste/ límites que no se miden aquí.
- Sin datos de usuarios reales: no hay tráfico en producción.
