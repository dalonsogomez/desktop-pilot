---
fecha: {{date:YYYY-MM-DD}}
hora: {{time:HH:mm}}
tarea: "{{prompt}}"
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

> {{prompt}}

## Resumen

{{ai_generated_summary}}

## Acciones

{{step_list_with_screenshots_embedded}}

## Resultado final

![[{{final_state_screenshot}}]]

## Notas

- **Coste API:** ${{api_cost}}
- **Errores recuperados:** {{recovered_errors}}
- **Reintentos:** {{retries}}
- **Sesión completa local:** `~/Library/Application Support/DesktopPilot/sessions/{{session_id}}/`
- **Video:** `session.mp4` (no archivado por defecto; usar `--archive-full` en sesión para incluirlo)
