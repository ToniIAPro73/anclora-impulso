# Anclora Ultra Premium App Contract

## Objetivo
Definir el contrato UX/UI de la capa más exclusiva del ecosistema. La experiencia debe transmitir lujo, control, precisión y confianza sin caer en fricción innecesaria.

Ámbito:
- `anclora-private-estates`

> **Logo Ultra Premium fuera de la familia (CHG-0014, 2026-09-25):** `anclora-portfolio`, `anclora-azure-bay-landing` y `anclora-portfolio-showcase` usan el logo Ultra Premium dorado por ser aplicaciones de muestra del vertical inmobiliario de lujo, pero su UX se sigue gobernando por `ANCLORA_PORTFOLIO_SHOWCASE_CONTRACT.md`, no por este contrato.

## Autoridad

- Registro operativo: `00-governance/registry/contracts-registry.json`
- Inventario aplicable: `00-governance/registry/ecosystem-repos.json`
- Fuente ejecutable relacionada: `anclora-design-system`

## Repos a los que aplica

- `anclora-private-estates`

## Sincronización con repos consumidores

- Contrato fuente en la bóveda: `00-governance/contracts/core/ANCLORA_ULTRA_PREMIUM_APP_CONTRACT.md`
- Target normal de propagación: `10-group/brand/`
- Dependencia de auditoría y propagación desde `00-governance/registry/contracts-registry.json`

## Piezas canónicas del design system

La capa ultra premium no autoriza implementaciones aisladas sin sistema. Debe apoyarse en `anclora-design-system` para:

- `tokens` y `themes` de firma visual
- `foundations` de tipografía editorial, spacing, radius, border y depth
- `components` base adaptados a la firma ultra premium
- `patterns` de hero, gallery, immersive sections, overlays y formularios de alto valor

Regla:
- lo ultra premium puede especializar primitives, no saltarse el design system.

## Invariantes de grupo

### 1. Dirección visual
- La app debe sentirse claramente distinta de internas y premium.
- La marca puede usar una gramática visual más ceremonial, pero la interacción debe seguir siendo clara.
- El valor percibido debe venir de composición, ritmo, materiales visuales y copy, no de complejidad arbitraria.

### 2. Botones ultra premium
- El CTA principal puede tener tratamiento de firma.
- Debe existir una familia premium dominante y una secundaria contenida.
- Las acciones destructivas nunca deben contaminar la experiencia principal.
- La microinteracción puede ser más rica, pero siempre predecible.

### 3. Cards y composiciones
- Se admiten cards de alto impacto visual, media-led y layouts editoriales.
- Requisitos obligatorios:
  - grid estable
  - lectura clara
  - contraste suficiente
  - motion medido
  - cero clipping accidental
  - cero scroll accidental dentro de cards salvo necesidad real

### 4. Modales y overlays
- Se aplica `MODAL_CONTRACT.md`.
- Los modales deben sentirse premium, pero no pueden perder disciplina operativa.
- Si una interacción merece más espacio que un modal clásico, debe escalar a sheet, full-screen dialog o página dedicada antes que forzar un modal incómodo.

### 5. Localización ultra premium
- Se aplica `LOCALIZATION_CONTRACT.md`.
- La calidad del copy debe ser comparable entre idiomas.
- No se permiten soluciones de emergencia que degraden la percepción premium en un idioma secundario.

### 6. Tema
- La app puede usar más de un modo si ambos sostienen el mismo nivel premium.
- La paleta y materiales deben conservar firma visual en cualquier modo soportado.
- Los tokens deben permitir controlar oro, neutros, fondos profundos, contrastes y superficies translúcidas sin hardcodes por componente.

### 7. Motion
- El motion puede ser más cinematográfico que en otros grupos, pero no debe interferir con tareas clave.
- Permitido:
  - reveal con ritmo
  - shimmer o light sweep contenido
  - transiciones de profundidad muy medidas
- Prohibido:
  - delays que ralenticen formularios o CTAs
  - transformaciones que compliquen la precisión del cursor o el tap

## Reglas particulares para `anclora-private-estates`

- Mantener `es/en/de/fr`.
- Mantener la firma visual oro + teal + fondos profundos.
- El botón premium puede seguir siendo una excepción aprobada del ecosistema siempre que conserve la semántica base de CTA principal.
- Los accesos a áreas privadas o subportales no deben parecer dashboards internos reetiquetados.
- Los componentes shadcn base deben adaptarse al sistema premium antes de exponerse en UI final.
- Ningún componente de alto valor puede quedarse en estado “base library + skin rápida”.

## Gate de aceptación

Una feature ultra premium no está lista si:
- parece una mezcla entre landing estándar y dashboard administrativo
- la localización degrada el tono de marca
- un modal o formulario rompe la composición premium por falta de espacio o scroll evitable
- los componentes base aparecen sin adaptación a la firma visual del producto
- la solución evita `anclora-design-system` y rehace localmente tokens, botones, cards o overlays que ya deberían vivir en la capa compartida

