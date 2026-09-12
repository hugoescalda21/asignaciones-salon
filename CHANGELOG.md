# Registro de cambios — Asignaciones del Salón del Reino

Cada versión corresponde al número que también aparece dentro de
`service-worker.js` (CACHE_NAME). Si algo falla después de una
actualización, revisá primero qué se agregó en la versión más reciente.

---

## v3 — 12 de septiembre de 2026
- Aviso de "hay una versión nueva" cuando se actualiza la app.
- Recordatorio si pasaron 14 días sin exportar una copia de seguridad.
- Botón "Deshacer" al eliminar un hermano o al borrar el historial del cronómetro.
- Pantalla de bienvenida (3 pasos) la primera vez que se abre sin datos cargados.
- Se reemplazó la palabra "puesto" por "asignación" en toda la app.
- Menú "Compartir" que agrupa WhatsApp, PDF e Imprimir en un solo botón.
- Botón "Hoy" para volver rápido a la semana actual.
- Modo oscuro para la pantalla del Cronómetro (pensado para la cabina).
- Botón "Copiar semana anterior" para repetir asignaciones como punto de partida.
- Badge de "Completo" / "Faltan X asignaciones" en el navegador de semanas.
- PDF de "Hermanos por asignación" (quién puede cubrir cada puesto), descargable desde la pestaña Hermanos.
- El PDF semanal ahora muestra la semana en grande y qué asignaciones incluye, pensado para verse bien como archivo compartido en WhatsApp.
- Botón "No disponibles hoy" para excluir a alguien de una reunión puntual sin tocar su estado general.
- Cronómetro: al llegar a cero sigue contando para arriba (+MM:SS), con botón "Marcar fin y guardar" que registra el tiempo real contra el planificado, e historial descargable/compartible.

## v2 — instalación como PWA
- Se agregaron `manifest.json`, íconos y `service-worker.js` para poder instalar la app en la pantalla de inicio del celular y usarla sin conexión.
- Se cambió el guardado de datos a `localStorage` (antes no funcionaba fuera de la vista previa de Claude).

## v1 — primera versión
- App de una sola página: alta de publicadores, reuniones (Entre semana / Fin de semana), 6 asignaciones (Audio, Video, Micrófono 1, Micrófono 2, Plataforma, Cronometrista), detección de conflictos, auto-asignación equitativa, envío por WhatsApp, vista de impresión y copia de seguridad en `.json`.
