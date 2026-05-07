# desktop-pilot

Agente de escritorio para macOS que sustituye funcionalmente a Vy (Vercept,
apagado por Anthropic en marzo de 2026). Permite a un LLM ver la pantalla y
ejecutar acciones de ratón, teclado, arrastre, shell y AppleScript sobre las
apps reales del Mac.

**Estado:** Diseño aprobado. Implementación pendiente.

**Spec de diseño:** [docs/superpowers/specs/2026-05-04-desktop-pilot-design.md](docs/superpowers/specs/2026-05-04-desktop-pilot-design.md)

## Componentes

- **UI-TARS Desktop** (base) — agent loop con visión + acción nativa macOS.
- **`desktop-pilot-bridge`** — sidecar HTTP local que expone el agente a otros tools.
- **`screen-recorder`** — binary Swift con ScreenCaptureKit, grabación H.264 continua.
- **`exec_shell` / `exec_applescript`** — primitivas extendidas con guardarraíles.
- **Skill `/desktop-pilot`** — integración con Claude Code.
- **Plantilla Obsidian** — sesiones archivadas en wiki como notas indexables.

## Backend de modelo

- **Default:** Anthropic Claude Sonnet 4.6 con tool `computer_use`.
- **Fase 2:** UI-TARS-1.5-7B local vía MLX (modo privado / offline).
