# Registro de cambios — Asignaciones del Salón del Reino

Cada versión corresponde al número que también aparece dentro de
`service-worker.js` (CACHE_NAME). Si algo falla después de una
actualización, revisá primero qué se agregó en la versión más reciente.

---

## v6 — 14 de septiembre de 2026
- **Login con Google** ("Continuar con Google"), junto al link por email — un toque, sin esperar el correo. Usa ventana emergente para evitar un problema conocido de Chrome con la redirección.
- **Reparación automática de asignaciones fantasma**: si borrabas a un hermano que ya tenía algo asignado, esa asignación quedaba "viva" pero invisible, y Auto-asignar la saltaba sin avisar. Ahora se limpia sola al cargar, y borrar a alguien de ahí en más limpia sus asignaciones viejas en el momento.
- **Auto-asignar ahora respeta el Programa**: evita poner en el equipo técnico a quien ya tiene una parte del Programa esa reunión.
- El aviso de doble asignación ahora **sugiere un reemplazo concreto** por cada puesto en conflicto (con botón "Usar"), y si no hay nadie libre, te dice en qué está ocupado cada capacitado.
- Las tarjetas en conflicto se ven **en rojo de verdad** (antes se confundían con el verde de "completo" por un problema de orden en el CSS).
- **"Equipo técnico" y "Programa" pasan a ser pestañas arriba de todo**, con un puntito de color que indica si esa sección está completa — separado de las pastillas de día, para que no se confundan.
- **Vista pública, rediseño completo**: los tres colores reales de sección (Tesoros de la Biblia, Seamos mejores maestros, Nuestra Vida Cristiana, sacados de la plantilla real de la congregación), íconos SVG en vez de emoji, el día queda fijo al costado mientras scrolleás esa reunión, la reunión ya pasada del mes arranca colapsada, y la barra de búsqueda queda flotando arriba sin duplicarse.

## v5 — 14 de septiembre de 2026 (cambio importante de infraestructura)
- **Acceso con cuenta real (Firebase Authentication)**, en reemplazo del código PIN de la versión anterior. Cada persona inicia sesión con su email — sin contraseña, le llega un link — y Firestore verifica del lado del servidor que esté autorizada antes de entregar cualquier dato. Esto sí es seguridad real, a diferencia del PIN anterior.
- Nueva pantalla **Ajustes → Acceso**, con dos listas separadas: quién puede **editar** y quién solo puede **ver**. Sacar a alguien de la lista le corta el acceso al instante.
- Quien crea una congregación nueva queda agregado solo como su primer editor.
- **`firestore.rules` nuevo** (hay que pegarlo a mano en la consola de Firebase — Anthropic no tiene acceso a ese proyecto) — exige sesión iniciada y email autorizado tanto para leer como para editar.
- La app principal y `ver.html` ahora piden iniciar sesión antes de mostrar nada, salvo que Firebase no esté disponible (por ejemplo, sin internet) — ahí siguen funcionando en modo local como siempre, para no perder esa resistencia.
- Se sacó el sistema de PIN de 4 dígitos de la versión anterior (quedó superado por este).

**Pendiente de tu lado, fuera de la app:** activar "Email link (passwordless)" en Firebase Authentication, agregar tu dominio de GitHub Pages a los dominios autorizados, y publicar `firestore.rules`. Sin esos tres pasos en la consola de Firebase, el login no va a funcionar todavía.

## v4 — 14 de septiembre de 2026
- **Acomodadores** como nuevo puesto del equipo técnico (cantidad configurable en Ajustes), integrado en tarjetas, calendario, auto-asignar, PDF, WhatsApp y CSV.
- **Programa completo de la reunión** (nueva subpestaña "Programa" dentro de cada reunión): Presidente, oraciones, Tesoros de la Biblia, Perlas escondidas, Lectura de la Biblia, partes de estudiante flexibles ("Seamos mejores maestros"), Nuestra Vida Cristiana (también flexible), Estudio bíblico de la congregación, y para Fin de semana: Discurso público con tema, Atalaya y oraciones.
- **Sala auxiliar activable** (Ajustes): duplica Lectura de la Biblia y las partes de estudiante en Auditorio principal / Sala auxiliar, y agrega Consejero de la sala auxiliar. Apagarla no borra lo ya cargado.
- **Minutos por parte** en Seamos mejores maestros y Nuestra Vida Cristiana, con acceso rápido en el Cronómetro ("Partes de esta semana") para no tipear el tiempo a mano.
- **Numeración automática** de las partes (1 al 10) igual que la guía oficial, recalculada sola según cuántas partes haya cargadas.
- **Tres cánticos** (inicial, intermedio, final) con su número, sin nombre de persona asociado.
- El Programa ahora aparece también en **WhatsApp** y el **PDF semanal**, con títulos de sección (Tesoros de la Biblia / Seamos mejores maestros / Nuestra Vida Cristiana) y cánticos incluidos.
- **Buscador de hermanos** en todos los campos de asignación (Equipo técnico y Programa), en reemplazo de la lista desplegable larga — escribís y filtra al toque, con navegación por teclado.
- Los campos ya asignados se marcan en **verde**, y las tarjetas totalmente completas quedan resaltadas.
- **Vista pública (`ver.html`)**: interruptor para ver "Equipo técnico" o "Programa"; la búsqueda por nombre ahora también encuentra asignaciones del Programa (mostrando estudiante y ayudante juntos cuando corresponde); se sumaron los Acomodadores, que faltaban ahí desde que se agregaron a la app principal.
- **Calendario mensual**: nuevo anillo violeta por día (hueco = Programa incompleto, relleno = completo), sin tocar los puntos de colores del equipo técnico.
- Corregido: cambiar algo en el Programa no refrescaba el calendario en vivo.
- Corregido: el fondo blanco de las tarjetas de "Seamos mejores maestros" y "Nuestra Vida Cristiana" no se veía bien en algunos estados.

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
