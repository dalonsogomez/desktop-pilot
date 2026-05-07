# Desktop Pilot — Design Spec

- **Fecha:** 2026-05-04
- **Autor:** Daniel Alonso Gómez (asistido por Claude / brainstorming session)
- **Estado:** Draft — pendiente de revisión final
- **Tipo:** Diseño funcional + arquitectónico

---

## 1. Resumen ejecutivo

`desktop-pilot` es un agente de escritorio para macOS que sustituye funcionalmente a Vy
(Vercept), apagado por Anthropic en marzo de 2026 tras adquisición. La herramienta
permite a un LLM ver la pantalla del usuario y ejecutar acciones de ratón, teclado y
arrastre sobre las apps reales del Mac (Figma, Excel, Obsidian, Slack, navegadores,
etc.) con la fiabilidad necesaria para uso diario.

A diferencia de Vy, `desktop-pilot` se construye sobre componentes open-source maduros
(UI-TARS Desktop de ByteDance, Apache 2.0) e integra el agente en el ecosistema actual
del usuario: Claude Code (terminal), skills personales y wiki Obsidian.

## 2. Objetivos y no-objetivos

### Objetivos (en orden de prioridad)

1. Recuperar las capacidades clave de Vy: clicar, doble-clic, clic derecho,
   arrastrar, scroll, teclear y atajos sobre apps reales del Mac.
2. Mejorar la **fiabilidad** respecto a Vy mediante un loop verify-after-act.
3. Integrar el agente en el flujo Claude Code + Obsidian del usuario, con sesiones
   archivadas en el wiki como notas indexables.
4. Mantener una superficie de implementación pequeña: usar SDKs oficiales en vez
   de reimplementar el agent loop.

### No-objetivos (YAGNI)

- Soporte multi-OS (Windows / Linux). macOS only.
- Modo navegador puro (UI-TARS Desktop ya lo trae, no replicamos).
- Control de iOS/Android.
- Interfaz de voz en MVP (posible Fase 3).
- Sesiones multi-usuario o compartidas.
- Aprendizaje por demostración (record-and-replay) en MVP.

## 3. Contexto y decisiones de diseño

### 3.1 Por qué UI-TARS Desktop como base

Tras revisar el catálogo `Awesome-Gui-Agents`, las únicas opciones open-source de
escritorio con tracción real son **UI-TARS Desktop**, **Bytebot** y **c/ua**. La
elección recae sobre UI-TARS Desktop porque:

- **Controla el Mac real**, no un sandbox containerizado (a diferencia de Bytebot).
  Esto preserva el caso de uso principal de Vy (automatizar apps con sesiones del
  usuario).
- App nativa Electron lista para macOS, instalable vía Homebrew.
- Modelo `UI-TARS-1.5` está específicamente fine-tuneado para grounding visual de
  UIs — mejor que Claude/GPT en tareas de "clicar el botón correcto".
- Multi-provider: soporta Anthropic Claude, OpenAI, Volcengine, modelos locales.
- Mantenido activamente por ByteDance, releases mensuales.
- Apache 2.0 — uso comercial permitido.

### 3.2 Por qué backend híbrido Claude + UI-TARS local

| Backend                   | Default? | Caso de uso                              |
| ------------------------- | -------- | ---------------------------------------- |
| Claude Sonnet 4.6         | Sí       | Tareas reales, fiabilidad alta           |
| UI-TARS-1.5-7B local      | Fase 2   | Tareas con datos sensibles, modo offline |
| UI-TARS-1.5-72B Volcengine | No        | Descartado (cloud chino, sin ventaja)    |

Razones:

- Claude Sonnet 4.6 es el modelo desarrollado **por el equipo ex-Vercept** ahora en
  Anthropic — es literalmente el sucesor oficial.
- El usuario tiene 64 GB de RAM unificada, suficiente para correr UI-TARS-1.5-7B
  local con MLX. Lo dejamos disponible pero no lo activamos en MVP para simplificar
  el bootstrap.

### 3.3 Por qué bridge a Claude Code + Obsidian

Sin bridge, `desktop-pilot` sería una app standalone más. El bridge convierte el
agente en una **herramienta llamable desde el ecosistema actual del usuario**, con
memoria persistente en su wiki. Esto es estrictamente superior a Vy, que era un
silo cerrado.

## 4. Arquitectura

```
┌──────────────────────────────────────────────────────────────────┐
│                       macOS host (usuario)                       │
│                                                                  │
│  Claude Code (terminal) ──► skill `/desktop-pilot`               │
│       │                                                          │
│       ▼                                                          │
│  ┌──────────────────────────────────────────────────────┐        │
│  │  Sidecar `desktop-pilot-bridge` (localhost:9991)     │        │
│  │  POST /task   GET /status/:id   GET /transcript/:id  │        │
│  │  POST /abort/:id                                     │        │
│  └────────┬─────────────────┬───────────────────────────┘        │
│           │                 │                                    │
│           │ inicia          │ usa SDK @agent-infra/ui-tars       │
│           ▼                 ▼                                    │
│  ┌──────────────┐   ┌─────────────────────────────────────┐      │
│  │ Swift binary │   │ UI-TARS Desktop (Electron)          │      │
│  │ screen-      │   │ agent loop:                         │      │
│  │ recorder     │   │   ver → planificar → actuar         │      │
│  │ (SCKit)      │   │     → verificar                     │      │
│  └──────┬───────┘   └─────────────┬───────────────────────┘      │
│         │                         │                              │
│         │ session.mp4             │ tools disponibles:           │
│         │ + timeline.json         │   GUI primitives (UI-TARS)   │
│         ▼                         │   exec_shell                 │
│  ┌──────────────┐                 │   exec_applescript           │
│  │ sessions/    │                 │                              │
│  │ <uuid>/      │                 ├─► Backend modelo: Claude API │
│  └──────────────┘                 │                              │
│                                   ▼ macOS APIs                   │
│                          (CGEvent, AX, Vision, osascript, sh)    │
│  ┌─────────────────────────────────────────────────────┐         │
│  │  Apps del usuario: Figma, Obsidian, Excel, Slack,   │         │
│  │  Chrome, Finder, Mail, Safari, Terminal, etc.       │         │
│  └─────────────────────────────────────────────────────┘         │
│                                                                  │
│  Hook PostTask → skill `guardar` → Obsidian wiki:                │
│    `wiki/sesiones-desktop-pilot/YYYY-MM-DD-<slug>.md`            │
└──────────────────────────────────────────────────────────────────┘
```

### 4.1 Componentes

| Componente                   | Implementación                          | LOC estimadas |
| ---------------------------- | --------------------------------------- | ------------- |
| UI-TARS Desktop              | brew install --cask ui-tars (existente) | 0             |
| Sidecar `desktop-pilot-bridge` | Node.js + TypeScript + Fastify          | ~300-400      |
| Skill `/desktop-pilot`       | Bash/TS frontmatter + lógica            | ~80-120       |
| Plantilla Obsidian sesión    | Markdown con frontmatter v3             | ~30           |
| Dashboard Obsidian Bases     | `.base` file declarativo                | ~40           |
| Recorder `screen-recorder`   | Swift binary con ScreenCaptureKit       | ~150-200      |
| Tool `exec_shell`            | Node.js con denylist + sandbox          | ~80-100       |
| Tool `exec_applescript`      | Node.js con allowlist apps              | ~60-80        |
| Tests (smoke + e2e + reg)    | Bash + AppleScript fixtures             | ~250          |
| Setup script bootstrap       | Bash interactivo                        | ~180          |
| **Total nuevo código**       |                                         | **~1170-1400**|

> **Live preview gratuita:** UI-TARS Desktop trae su propia ventana con
> visualización en tiempo real del estado del agente (screenshot actual +
> acción ejecutándose + razonamiento del modelo). No tenemos que construirla;
> es parte de la app oficial.

## 5. Backend de modelo

### 5.1 Default: Anthropic Claude Sonnet 4.6

- Provider: Anthropic, model `claude-sonnet-4-6`.
- Tool spec: la versión más reciente de `computer_use` disponible al iniciar
  Fase 1 (anclar versión exacta en `package.json` y monitorear changelog Anthropic).
- API key persistida en macOS Keychain bajo servicio `ai.ui-tars.anthropic`.
- Coste estimado: **$0.03–0.08 por acción** (1-3 screenshots ~1500 tokens cada uno
  + razonamiento).
- Latencia esperada: 2-3 s/acción.

### 5.2 Modo privado (Fase 2): UI-TARS-1.5-7B local

- Runtime: MLX-LM en Apple Silicon.
- Modelo: `UI-TARS-1.5-7B-mlx` (~14 GB descarga).
- Latencia esperada: 1-3 s/acción según carga del sistema.
- Coste: $0 (sólo cómputo local).
- Activación: variable de entorno `DESKTOP_PILOT_MODEL=local` o flag CLI.

### 5.3 Descartados

- **UI-TARS Volcengine:** datos salen a cloud chino, no compensa frente a Claude.
- **OpenAI / Operator:** redundante con Claude, sin ventaja diferencial.

### 5.4 Primitivas extendidas (más allá del action space estándar de UI-TARS)

UI-TARS por defecto sólo expone primitivas GUI (click, drag, scroll, type, hotkey).
Para casos donde scripting es más fiable o más rápido, exponemos al agente dos
herramientas adicionales vía MCP/tool-calling:

#### `exec_shell(command, timeout=30, cwd=None)`

Ejecuta cualquier comando de shell del usuario. Casos de uso típicos:

- **Operaciones por lotes:** renombrar 200 archivos, redimensionar imágenes,
  comprimir directorios.
- **Interacción con Git/Node/Python/Brew:** clonar repos, instalar dependencias,
  correr tests.
- **Listar/crear/mover archivos:** `ls`, `find`, `mkdir`, `mv`, `cp`.
- **Pipes y composición:** `curl ... | jq ...`, `grep -r`, etc.

Captura `stdout`, `stderr`, `exit_code`. Devuelve los tres al agente.

**Guardarraíles:**

- **Denylist hardcoded** de patrones destructivos: `rm -rf /`, `rm -rf ~`,
  `sudo`, `dd if=`, `mkfs`, `:(){ :|:& };:` (fork bomb), `chmod -R 777 /`,
  `> /dev/sda`, escritura a rutas críticas (`/System`, `/usr`, `/Library`).
- **Confirmación pre-ejecución** la primera vez que el agente invoca
  `exec_shell` en cada sesión. Subsiguientes llamadas en la misma sesión sólo
  se confirman si tocan rutas fuera de `~/Documents`, `~/Downloads`, `~/Desktop`,
  `~/Code` (configurable).
- **Timeout:** 30 s por defecto, máximo configurable 5 min.
- **CWD:** por defecto el home del usuario; el agente puede cambiarlo dentro de
  rutas allowed.
- **Logging:** cada invocación queda en `transcript.jsonl` con comando exacto +
  outputs.

#### `exec_applescript(script, timeout=30)`

Ejecuta AppleScript directo, vía `osascript`. Casos de uso típicos:

- **Control determinista de apps macOS:** `tell application "Mail" to send`,
  `tell application "Calendar" to make new event ...`,
  `tell application "Pages" to save document 1`.
- **Operaciones donde clicar es frágil:** guardar, exportar, cerrar todas las
  ventanas, recargar, etc.
- **System Events para input sintético avanzado:** combinaciones de teclas
  complejas, manipulación de ventanas.

**Guardarraíles:**

- **Allowlist de apps** que el AppleScript puede `tell`: configurable en
  `~/.config/desktop-pilot/applescript-allowlist.yaml`. Default incluye apps
  comunes (Finder, Mail, Safari, Notes, Calendar, Reminders, Pages, Numbers,
  Keynote, TextEdit, Music, Photos, Preview, Terminal). NO incluye Keychain
  Access, 1Password, ni apps de banca.
- **Bloqueo de `do shell script`** dentro del AppleScript — si el agente
  necesita shell debe usar `exec_shell` y pasar por sus guardarraíles.
- **Bloqueo de `do JavaScript`** en Safari (vector de exfiltración silenciosa).
- **Timeout:** 30 s por defecto.
- **Logging:** script completo + output en `transcript.jsonl`.

#### Política de elección entre primitivas

El agente recibe en su system prompt una guía de prioridad:

1. Si la tarea se resuelve fiablemente con **AppleScript** → usar `exec_applescript`.
2. Si la tarea es **batch / filesystem / cli** → usar `exec_shell`.
3. En cualquier otro caso → usar primitivas **GUI** de UI-TARS (click, drag, etc.).

Esto reduce errores en operaciones donde clicar es frágil (selección de texto,
guardar, exportar) y libera al modelo de tareas que el shell hace en una línea.

## 6. Instalación y permisos

Flujo en 7 pasos atómicos. Cada paso es verificable; si falla, parar y arreglar.

| Paso | Acción                                  | Verificación                   |
| ---- | --------------------------------------- | ------------------------------ |
| 1    | Pre-flight checks (macOS, RAM, disk)    | `desktop-pilot doctor`         |
| 2    | `brew install --cask ui-tars`           | App abre sin errores           |
| 3    | Permisos: Accessibility + Screen Recording + Automation + Input Monitoring | Test capture+click; panic key responde |
| 4    | API key Claude → Keychain               | Ping API responde 200          |
| 5    | (Opcional Fase 2) Modelo local MLX      | `mlx-lm chat` responde         |
| 6    | Smoke test (10 casos + video + shell + applescript) | Todos pasan         |
| 7    | Atajo global configurable + panic key   | Atajo invoca; Esc x3 aborta    |
| 8    | Build + sign del binary `screen-recorder` (Swift) | Graba 5s sin frame drops |

> **Nota sobre el atajo global (paso 7):** `Cmd+Shift+Space` lo usa Quick Note de
> Apple Notes; `Cmd+Space` lo usa Spotlight. Por defecto sugerimos
> `Ctrl+Opt+Cmd+P` (libre de conflictos), pero el atajo es configurable en
> `~/.config/desktop-pilot/config.yaml`.

> **Nota sobre Input Monitoring (paso 3):** el panic key (`Esc` x3) requiere un
> CGEvent global tap, que en macOS Sonoma+ exige permiso de **Input Monitoring**
> (System Settings → Privacy & Security → Input Monitoring), separado de
> Accessibility. El bootstrap script lo solicita explícitamente.

### 6.1 Smoke test obligatorio

13 casos que se deben pasar antes de declarar la instalación completa:

**GUI (UI-TARS):**

1. Clic simple sobre menú de app.
2. Doble clic abre carpeta en Finder.
3. Triple clic selecciona párrafo en TextEdit.
4. Clic derecho despliega menú contextual.
5. Drag intra-app: mover archivo entre carpetas en Finder.
6. Drag inter-app: arrastrar archivo a Mail como adjunto.
7. Drag para selección de texto: 3 palabras concretas en TextEdit.
8. Tipear Unicode: "ñáéíóú €" sin pérdida de caracteres.
9. Atajos: `Cmd+Tab`, `Cmd+Space`, `Cmd+W`.
10. Scroll preciso: localizar elemento concreto en Safari.

**Primitivas extendidas:**

11. **`exec_shell`:** `ls ~ | wc -l` devuelve número de items > 0; comando
    bloqueado (`rm -rf /`) es rechazado por denylist.
12. **`exec_applescript`:** `tell application "TextEdit" to make new document`
    crea documento; tell a app fuera de allowlist es rechazado.

**Recording:**

13. **Video:** una sesión de 30 s genera `session.mp4` válido (decodifica con
    `ffprobe`), con timeline JSON sincronizado a screenshots de cada acción.

Output esperado: `~/Library/Logs/UI-TARS/smoke-test-2026-05-04.log` con
pass/fail por cada caso.

## 7. Bridge Claude Code + Obsidian

### 7.1 Sidecar `desktop-pilot-bridge`

Servicio HTTP local en `localhost:9991`. Implementación:

- **Lenguaje:** TypeScript / Node.js 20+.
- **Framework:** Fastify (mínimo, performante).
- **SDK agente:** `@agent-infra/ui-tars` (oficial UI-TARS Desktop).
- **Persistencia:** filesystem en `~/Library/Application Support/DesktopPilot/`.
- **Arranque:** `launchd` agent (`~/Library/LaunchAgents/ai.desktop-pilot.bridge.plist`).
- **Suspensión:** `launchctl bootout gui/$(id -u) <plist>`.

#### Endpoints

```
POST /task
  body: { prompt: string, allowlist?: string[], timeout?: number }
  response: { id: uuid, status: "queued" }

GET /status/:id
  response: { status, progress, lastScreenshot, actionCount, elapsed }

GET /transcript/:id
  response: full JSONL transcript + metadata

POST /abort/:id
  response: { aborted: boolean }
```

### 7.2 Skill `/desktop-pilot`

Ubicación: `~/.claude/skills/desktop-pilot/`.

- Trigger: `/desktop-pilot <prompt>` (alias corto: `/dp`).
- Streaming: muestra progreso en tiempo real (último screenshot + acción actual).
- Al terminar: invoca skill `guardar` para archivar la sesión.

### 7.3 Plantilla de sesión Obsidian

Archivo: `wiki/_templates/sesion-desktop-pilot.md`.

```markdown
---
fecha: {{date:YYYY-MM-DD}}
hora: {{time:HH:mm}}
tarea: {{prompt}}
duracion_segundos: {{duration}}
acciones_total: {{action_count}}
exito: {{success}}
modelo: {{backend_model}}
coste_usd: {{api_cost}}
apps_usadas: {{apps_list}}
etiquetas: [sesion, desktop-pilot, automatización]
estado: archivada
tipo: sesion-agente
---

# {{title}}

## Prompt original
{{prompt}}

## Resumen
{{ai_generated_summary}}

## Acciones
{{step_list_with_screenshots_embedded}}

## Resultado
{{final_state_screenshot}}

## Notas
- Coste API: ${{api_cost}}
- Errores recuperados: {{recovered_errors}}
- Reintentos: {{retries}}
```

### 7.4 Dashboard Obsidian Bases

Archivo: `wiki/dashboards/desktop-pilot.base`.

Vistas:

- **Tabla:** todas las sesiones, ordenables por fecha/duración/coste.
- **Tarjetas:** últimas 10 sesiones con screenshot final.
- **Resumen mensual:** total acciones, coste agregado, success rate, app top.

## 8. Guardarraíles, errores y testing

### 8.1 Guardarraíles de seguridad

| Guardarraíl                    | Implementación                              |
| ------------------------------ | ------------------------------------------- |
| Allowlist de apps (GUI)        | `~/.config/desktop-pilot/allowlist.yaml`    |
| Allowlist de apps (AppleScript)| `~/.config/desktop-pilot/applescript-allowlist.yaml` |
| Denylist crítica (hardcoded)   | Keychain Access, 1Password, banking apps, Messages-send, Apple Wallet |
| Denylist shell hardcoded       | `rm -rf /`, `rm -rf ~`, `sudo`, `dd if=`, `mkfs`, fork bombs, `chmod -R 777 /`, escrituras a `/System`, `/usr`, `/Library` |
| Bloqueo `do shell script` en AS | Detector regex en cada AppleScript antes de ejecutar |
| Bloqueo `do JavaScript` en AS  | Detector regex (vector de exfiltración Safari) |
| Confirmación pre-destructiva   | Detector de keywords (Send, Delete, Pay, Submit, Borrar, Enviar, Pagar) → pausa + screenshot + espera "y" del usuario |
| Confirmación primera-shell     | Primer `exec_shell` de cada sesión pide "y/n"; siguientes confirman sólo si tocan rutas fuera del allowlist (`~/Documents`, `~/Downloads`, `~/Desktop`, `~/Code`) |
| Sensitive zone masking (Fase 2) | Vision framework OCR + regex (password, credit card, API key) → blur antes de persistir screenshot al wiki |
| Time budget                    | 5 min por tarea por defecto, configurable   |
| Rate limit acciones            | Máx 3 acciones/segundo                      |
| Panic key                      | `Esc` x3 rápido (CGEvent global tap, requiere Input Monitoring) → abort + log + stop recording |

> **Política de screenshots en Fase 1 (sin masking):** mientras el masking no
> esté implementado (Fase 2), las screenshots de cada acción se persisten
> localmente en `~/Library/Application Support/DesktopPilot/sessions/<uuid>/` pero
> **no se copian automáticamente al wiki**. La nota de sesión Obsidian incluye
> sólo (a) un resumen textual y (b) la screenshot final. Para promover una
> sesión completa al wiki con todas las acciones embebidas, el usuario lo hace
> manualmente con un flag (`--archive-full`) tras revisar visualmente que no
> hay datos sensibles. Esto evita filtraciones hasta que el masking automático
> esté disponible.

### 8.2 Manejo de errores

Patrón verify-after-act:

1. Modelo emite acción.
2. Sidecar ejecuta vía macOS APIs.
3. Screenshot post-acción.
4. Modelo verifica: ¿el estado cambió como se esperaba?
   - Sí → siguiente acción.
   - No → reintento con backoff exponencial (3 intentos máx).
   - Si tras 3 reintentos sigue fallando → fallback a teclado/atajo equivalente.
   - Si fallback también falla → pausa + pide intervención del usuario.

Errores explícitos manejados:

- Modal inesperado (popup, alerta) → `Esc` y reintento.
- App no responde → ping AppleScript, abort si 5 s sin respuesta.
- Coordenadas fuera de pantalla → re-grounding con screenshot fresco.
- API rate limit → backoff exponencial + downgrade a Haiku 4.5.
- Permisos macOS revocados → detect + pausa + recordatorio al usuario.

### 8.3 Testing

| Nivel       | Comando                              | Frecuencia | Duración |
| ----------- | ------------------------------------ | ---------- | -------- |
| Smoke       | `desktop-pilot test:smoke`           | Tras cada upgrade | ~2 min |
| Regression  | `desktop-pilot test:regression`      | Semanal vía launchd | ~10 min |
| E2E         | `desktop-pilot test:e2e`             | Tras cambios en sidecar/skill | ~5 min |

### 8.4 Observabilidad

Por sesión, en `~/Library/Application Support/DesktopPilot/sessions/<uuid>/`:

- `transcript.jsonl` — turno modelo↔ejecutor (incluye llamadas a `exec_shell` y
  `exec_applescript` con sus outputs completos).
- `screenshots/NNN-{action}.png` — uno por acción.
- `session.mp4` — **grabación H.264 continua** de la sesión completa,
  ScreenCaptureKit, ~1-5 MB/min a 1080p. Capturada en background sin afectar
  la latencia del agente.
- `timeline.json` — sincronización entre frames del video y acciones del
  transcript: `[{ frame_offset_ms, action_index, screenshot_filename }]`.
  Permite saltar a "el frame exacto donde el agente clicó X".
- `metrics.json` — duración, acciones, success/fail, coste API, tamaño video,
  comandos shell ejecutados, AppleScripts ejecutados.
- `summary.md` — resumen humano-legible autogenerado.

**Política de retención de video:**

- Video se guarda local por defecto **30 días**, luego se borra automáticamente
  vía launchd cron (configurable).
- Video NO se copia al wiki Obsidian sin acción explícita del usuario
  (`--archive-video` flag).
- Tamaño total estimado: 50 sesiones de 5 min/mes = ~625 MB-3 GB/mes.
  Aceptable en disco moderno; ajustable si causa presión.

Métricas agregadas en dashboard Bases (sección 7.4).

## 9. Roadmap por fases

### Fase 1 — MVP (target: ~2-3 semanas full-time, ampliado por video + tools)

- [ ] Bootstrap script: instalación UI-TARS, permisos, API key.
- [ ] Smoke test (13 casos) automatizado.
- [ ] Sidecar `desktop-pilot-bridge` con endpoints básicos.
- [ ] Skill `/desktop-pilot` con streaming.
- [ ] Plantilla de sesión Obsidian + integración con skill `guardar`.
- [ ] Guardarraíles: allowlist, denylist, panic key, time budget.
- [ ] Verify-after-act loop.
- [ ] **Recorder Swift binary `screen-recorder`** con ScreenCaptureKit + timeline JSON.
- [ ] **Tool `exec_shell`** con denylist + confirmación primera-uso por sesión.
- [ ] **Tool `exec_applescript`** con allowlist apps + bloqueo do-shell-script.
- [ ] System prompt del agente con guía de elección de primitiva (GUI vs shell vs AS).
- [ ] Documentación de instalación.

### Fase 2 — Robustez y privacidad (target: +1 semana)

- [ ] Modelo local UI-TARS-1.5-7B con MLX.
- [ ] Sensitive zone masking.
- [ ] Dashboard Obsidian Bases.
- [ ] Test:regression automatizado semanal.
- [ ] Métricas agregadas + alertas de drift.

### Fase 3 — Avanzado (no comprometido)

- [ ] Multi-monitor support.
- [ ] Aprendizaje por demostración (record-and-replay).
- [ ] Voz como input adicional.
- [ ] Recetas pre-construidas para casos comunes (RPA, web scraping).

## 10. Criterios de éxito (MVP)

- Smoke test **13/13** verde en el Mac del usuario.
- Latencia media por acción < 3 s con backend Claude.
- Tasa de éxito en tareas multi-paso (3-10 acciones) > 80% en regression suite.
- Coste API medio por sesión < $0.50.
- Cero filtraciones de datos sensibles al wiki — en Fase 1 garantizado por
  política manual (no auto-archivar full); en Fase 2 garantizado por OCR masking
  automático auditable.
- Skill `/desktop-pilot` invocable desde Claude Code y devuelve resultado +
  sesión archivada en menos de 2 s tras finalizar la tarea del agente.
- **Video `session.mp4` generado en cada sesión**, decodificable por `ffprobe`
  y sincronizado con timeline JSON apuntando a las acciones del transcript.
- **Overhead de grabación < 10% CPU** medido durante una sesión típica.
- **`exec_shell` rechaza el 100%** de los comandos de la denylist en una
  batería de tests adversariales.
- **`exec_applescript` rechaza el 100%** de scripts con `do shell script` o
  `do JavaScript` o `tell` a apps fuera de allowlist.

## 11. Riesgos y mitigaciones

| Riesgo                                       | Probabilidad | Impacto | Mitigación                              |
| -------------------------------------------- | ------------ | ------- | --------------------------------------- |
| macOS revoca permisos silenciosamente        | Media        | Alto    | Detector al arrancar app + recordatorio |
| Anthropic cambia el spec computer_use        | Baja-media   | Medio   | Pinning de versión, monitor de releases |
| ByteDance discontinua UI-TARS Desktop        | Baja         | Alto    | Sidecar puede invocar otros providers; arquitectura desacoplada |
| Modelo alucina coordenadas, daña archivos    | Media        | Alto    | Verify-after-act + guardarraíles + denylist |
| API rate limit en horas pico                 | Media        | Bajo    | Backoff + fallback a Haiku              |
| Coste API se dispara en bucles infinitos     | Baja         | Medio   | Rate limit + time budget + alerta de coste |
| Usuario revoca Screen Recording en Sequoia   | Media        | Alto    | Recordatorio semanal automático          |
| **`exec_shell` ejecuta comando destructivo** | Media        | **Crítico** | Denylist hardcoded + confirmación primera-uso + logging total + panic key |
| **AppleScript con `do shell script` bypass** | Baja         | Alto    | Detector regex pre-ejecución bloquea el patrón |
| **Storage de videos llena disco**            | Media        | Bajo    | Retención 30 días automática vía launchd cron + alerta a >5 GB |
| **Video captura datos sensibles del Mac**    | Alta         | Medio   | Video sólo local, no auto-archivado al wiki, retención 30 días, panic key detiene grabación |
| **ScreenCaptureKit añade lag perceptible**   | Baja         | Bajo    | Test de overhead en bootstrap; si >10% CPU, downgrade a frame rate menor |

## 12. Decisiones abiertas (pre-implementación)

- Ubicación final del repo del proyecto: `/Users/dalonsogomez/desktop-pilot/`
  (asumido, confirmar con usuario).
- Inicialización git: pendiente confirmación del usuario.
- Versión exacta de UI-TARS Desktop a anclar: la última estable al iniciar Fase 1.
- Versión exacta de Node.js: 20.x LTS asumido.

## 13. Referencias

- Vy by Vercept (acqui-hire Anthropic, feb 2026): <https://techcrunch.com/2026/02/25/anthropic-acquires-vercept-ai-startup-agents-computer-use-founders-investors/>
- UI-TARS Desktop: <https://github.com/bytedance/UI-TARS-desktop>
- UI-TARS modelo: <https://github.com/bytedance/UI-TARS>
- Bytebot (alternativa sandbox descartada): <https://github.com/bytebot-ai/bytebot>
- Awesome-Gui-Agents: <https://github.com/supernalintelligence/Awesome-Gui-Agents>
- Anthropic Computer Use API: <https://docs.anthropic.com/en/docs/build-with-claude/computer-use>
