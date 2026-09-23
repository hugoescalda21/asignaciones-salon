# Asignaciones del Salón del Reino

App web (PWA) para organizar las asignaciones de la congregación:
equipo técnico, programa de la reunión, anuncios y recordatorios.

- **`asignaciones-salon.html`** — el editor, para quienes cargan las asignaciones.
- **`ver/ver.html`** — la vista pública, de solo lectura, para toda la congregación.
- **`push-salon-2026/`** — funciones en la nube de Firebase (notificaciones y recordatorios) y las reglas de seguridad (`firestore.rules`, `storage.rules`). Se publican desde esa carpeta con `firebase deploy`.
- **`tests/`** — pruebas automatizadas: `tests/editor/` para la app de asignaciones y `tests/ver.test.js` para la vista pública ([cómo correrlas](tests/README.md)).
- **`Claude outputs/`** — mockups de diseño de cada mejora (para consulta; no forman parte de la app).
- **`CHANGELOG.md`** — qué cambió en cada versión.
- **`ROADMAP.md`** — lo que está hecho y lo que queda pendiente.

Publicada en GitHub Pages: https://hugoescalda21.github.io/asignaciones-salon/
