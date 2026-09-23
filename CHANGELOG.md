# Registro de cambios — Asignaciones del Salón del Reino

Cada versión corresponde al número que también aparece dentro de
`service-worker.js` (CACHE_NAME). Si algo falla después de una
actualización, revisá primero qué se agregó en la versión más reciente.

---

## Guía de uso: ícono "?" en la cabecera — 22 de septiembre de 2026 (caché `ver-salon-v16`)
- El link "Cómo usar esta app" al pie quedaba muy escondido (había que scrollear hasta el final). Ahora es un ícono **"?"** arriba a la derecha de la cabecera, siempre visible — el mismo patrón que ya usa el editor.
- Se sacó el link del pie (queda solo "Política de privacidad").
- La guía ahora se abre como **hoja desde abajo**, igual que la ficha del día, en vez de un cartel centrado. Se cierra con ✕, tocando afuera o con Escape.

## Guía de uso corta en la vista pública — 22 de septiembre de 2026 (caché `ver-salon-v15`)
- `ver.html` (lo que ve la congregación en general) no tenía ninguna explicación de cómo usarla. Se agregó un link "Cómo usar esta app" al pie, junto a "Política de privacidad", que abre una guía corta con secciones plegables: Inicio, Calendario, Anuncios, Notificaciones, Instalar en el celular, e Iniciar sesión.
- El editor (`asignaciones-salon.html`) ya tenía su propia guía (botón "?" del header y "Ajustes → Guía de uso") desde antes — esto solo cubre el lado que le faltaba, la vista pública.

## Ícono del Tablero de Anuncios — 22 de septiembre de 2026 (caché `ver-salon-v14`)
- El ícono junto a "Tablero de Anuncios" (una etiqueta/tag) se veía como un garabato poco reconocible. Se cambió por un megáfono, más claro para representar anuncios.
- Requiere subir `ver/ver.html` y `ver/service-worker.js` a GitHub.

## Arreglo de fondo: "Compartir" con imagen daba NotAllowedError en Android — 21 de septiembre de 2026 (caché `ver-salon-v13`)
- Causa real (gracias al detalle del error que mandó Hugo): en Android, `navigator.share()` solo funciona si se llama en el mismo instante sincrónico del toque — cualquier espera de por medio, aunque sea consultar la copia guardada en el celular, hace que deje de contar como un toque directo y tire `NotAllowedError: Permission denied` en silencio.
- Ahora la app mantiene en memoria las fotos y PDFs que ya guardó sola en segundo plano, y "Compartir" los usa directo, sin esperar nada. Si el archivo todavía no está en memoria (recién publicado), comparte el texto y el link al instante en vez de fallar, y lo va guardando para la próxima vez.
- El cartel de error en pantalla que se agregó recién queda por ahora, por las dudas.
- Requiere subir `ver/ver.html` y `ver/service-worker.js` a GitHub.

## Diagnóstico temporal: "Compartir" sigue sin hacer nada en algunas fotos — 21 de septiembre de 2026 (caché `ver-salon-v12`)
- El error real de "Compartir" estaba silenciado a propósito (para no mostrar nada cuando alguien cierra el cartel sin elegir). Como sigue fallando en algunos casos, ahora **muestra el error técnico en pantalla** (temporal, para diagnosticar) además de dejarlo en la consola. Sacar esto una vez identificada la causa real.
- Requiere subir `ver/ver.html` y `ver/service-worker.js` a GitHub.

## Arreglo: "Compartir" no hacía nada en anuncios con imagen recién cargada — 21 de septiembre de 2026 (caché `ver-salon-v10`)
- Cuando el anuncio tenía una imagen que todavía no se había guardado sola en el celular, "Compartir" se quedaba esperando bajarla de internet — y para cuando terminaba, el navegador ya no consideraba que fue un toque directo (sobre todo en iPhone) y bloqueaba el cartel de compartir sin avisar nada. Ahora "Compartir" nunca espera una descarga: usa solo la copia que la app ya guardó sola en segundo plano, y si todavía no está, comparte el texto y el link al instante (la imagen se sigue bajando sola para la próxima vez).
- De paso: si el anuncio tiene título, el cartel de compartir usa ese título en vez de uno genérico.
- Requiere subir `ver/ver.html` y `ver/service-worker.js` a GitHub.

## Tocar un PDF de un anuncio ya no lo descarga solo — 21 de septiembre de 2026 (caché `ver-salon-v9`)
- Antes, si el PDF ya estaba guardado en el dispositivo (lo más común, porque la app los guarda solos al entrar a Anuncios), tocarlo lo **descargaba** en vez de abrirlo para leerlo — comportamiento distinto según si estaba guardado o no. Ahora tocar un PDF siempre lo **abre para verlo** en una pestaña nueva. Para guardar una copia está el botón "Compartir" de cada anuncio (como ya funciona con las imágenes).
- Requiere subir `ver/ver.html` y `ver/service-worker.js` a GitHub.

## Título y edición de anuncios — 21 de septiembre de 2026 (cachés `asignaciones-salon-v12` y `ver-salon-v8`)
- Los anuncios ahora pueden tener un **título opcional** (se destaca en negrita arriba del mensaje, en la lista de gestión, en la vista pública y en la notificación push).
- Se puede **editar un anuncio ya publicado**: botón "✏️ Editar" en la lista de gestión, abre el mismo formulario precargado. Guardar cambios no crea un anuncio nuevo, mantiene la fecha de publicación original y **no vuelve a notificar**. Se puede cambiar el texto, el título, el vencimiento, si está fijado, y reemplazar o quitar el archivo adjunto.
- En la lista de gestión (solo para editores) se ve quién y cuándo editó cada anuncio. En la vista pública solo aparece "· editado", sin nombre.
- Requiere subir `asignaciones-salon.html`, `service-worker.js`, `ver/ver.html` y `ver/service-worker.js` a GitHub (no toca las funciones en la nube, no hace falta `firebase deploy`).

## Funciones en la nube: Node 22 y recordatorios protegidos — 21 de septiembre de 2026 (sin cambio de caché)
- **Node 20 → 22** (Node 20 deja de permitir despliegues el 30-oct-2026). `firebase-admin` 13.10 y `firebase-functions` 7.4. Hay que actualizar `firebase-tools` (`npm i -g firebase-tools@latest`), correr `npm install` dentro de `functions` y luego `firebase deploy --only functions`.
- **`saveReminder` ya no es público sin control**: solo acepta pedidos desde `hugoescalda21.github.io`, valida el formato (código, fecha entre ayer y +120 días, largo del token), exige que el celular ya esté registrado en `pushSubscriptions` con el mismo código y publicador, y guarda el recordatorio con un id fijo (tocar dos veces "Recordar" no lo duplica). Los errores ya no devuelven detalles internos.
- La lógica pura (qué asignaciones son nuevas, qué anuncios se notifican, validación de recordatorios) pasó a `functions/lib.js` y `npm test` (`test-diff.js`, 27 pruebas) la verifica sin conexión.

## Nombre "Anuncios" — 21 de septiembre de 2026 (cachés `asignaciones-salon-v11` y `ver-salon-v7`)
- Lo que antes se llamaba "Avisos" pasa a llamarse **Anuncios** en toda la interfaz (pestaña de la vista pública, Gestión de Anuncios, botones, mensajes y textos de las notificaciones). Los datos guardados no cambian. Las notificaciones abren la pestaña con `?tab=anuncios` (el enlace viejo `?tab=avisos` sigue funcionando). Requiere `firebase deploy --only functions`.

## Vista pública (`ver.html`), rediseño con pestañas — 21 de septiembre de 2026 (caché `ver-salon-v6`)
- **Barra de pestañas abajo**: Inicio, Calendario y Avisos. Cada pantalla tiene un solo trabajo y nada empuja al calendario hacia abajo.
- **Inicio**: tarjeta destacada con "tu próxima asignación" (con cuenta regresiva: hoy / mañana / en N días), tus otras asignaciones, y las próximas dos reuniones del Salón.
- **Calendario**: el mes completo con la búsqueda y el selector Equipo técnico / Programa (igual que antes, en su propia pestaña).
- **Avisos**: el tablero completo. La pestaña muestra un número rojo con los avisos que ese celular todavía no abrió (se guarda solo en el dispositivo).
- Las notificaciones de avisos abren directo en la pestaña Avisos (`?tab=avisos`). Requiere `firebase deploy --only functions`.
- Pulido visual: íconos propios en vez de emojis, áreas táctiles de 44 px, transiciones cortas, pantalla de carga con esqueletos y **modo oscuro** automático.

## Vista pública (`ver.html`) — 21 de septiembre de 2026 (caché `ver-salon-v5`)
- **Sin conexión**: la vista pública guarda una copia local de los datos y de los avisos vigentes (texto, imágenes y PDF), y muestra "Sin conexión · mostrando la última copia guardada". Los archivos de avisos que vencen se borran solos del dispositivo. Los archivos se guardan solo si el almacenamiento tiene CORS habilitado (ver instrucciones en la conversación / Cloud Shell).
- **Compartir un aviso** (botón en cada aviso y en la imagen ampliada): manda el archivo real (foto o PDF) más el texto por WhatsApp u otra app; si no se puede mandar el archivo, comparte el texto y el link a la app.
- **Imagen ampliada**: tocar la foto de un aviso la abre a pantalla completa, con zoom con dos dedos.

## v10 — 21 de septiembre de 2026
- **Avisos desde el celular**: nuevo botón "Avisos" en la barra inferior (antes solo estaba en la barra de arriba, que se oculta en pantallas angostas, así que solo se podía publicar desde la PC).
- **Fotos optimizadas antes de subir**: se reducen a 1600 px de lado (JPEG 85 %), pasan de varios MB a unos cientos de KB. Sube más rápido con datos móviles y ya no se rechazan fotos por pasar los 10 MB. Los PDF se suben tal cual.

## v9 — 21 de septiembre de 2026
- **Avisos con notificación**: al publicar un aviso hay un casillero "Avisar por notificación" (marcado por defecto). Si está marcado, les llega un push a todos los dispositivos suscriptos de la congregación ("📢 Nuevo aviso" + las primeras palabras; "📎 con archivo adjunto" si lo tiene). Borrar o fijar un aviso no notifica.
- **Vencimiento automático**: cada aviso tiene "Mostrar hasta" (7, 30 o 90 días, o sin vencimiento). Al vencer sale del tablero público; el editor lo sigue viendo en Gestión de Avisos, marcado, y puede borrarlo.
- **Fijar arriba** (📌): un aviso fijado queda primero aunque haya otros más nuevos; se puede fijar/quitar desde Gestión de Avisos.
- **Tablero público más compacto**: 3 avisos a la vista y el resto plegado en "Ver anteriores (N)"; imágenes en miniatura (160 px); PDF con el nombre cortado en una línea; texto largo recortado a 3 líneas con "Ver más"; etiqueta "nuevo" durante 48 horas.
- Requiere `firebase deploy --only functions` (push de avisos).

## v8 — 21 de septiembre de 2026
- **Avisos con archivo adjunto, arreglado**: la subida de fotos y PDF se quedaba en 0% porque Firebase Storage nunca se había iniciado en el proyecto. Ya está activo y funciona.
- La subida ya no se corta a los 15 segundos fijos: solo se cancela si pasa 45 segundos sin avanzar, así un PDF grande con datos móviles puede terminar.
- Los errores al publicar un aviso ahora dicen la causa real (sin permiso, sesión vencida, sin conexión, archivo muy pesado o de tipo no permitido) en vez de culpar siempre a CORS.
- Se valida antes de subir: solo fotos o PDF, hasta 10 MB.
- Nuevo `storage.rules` (hay que pegarlo a mano en Firebase → Storage → Reglas), y `firestore.rules` actualizado con el bloque de notificaciones push que ya estaba publicado en la consola.
- **Notificaciones push corregidas** (función en la nube, se publica aparte con `firebase deploy --only functions`): los avisos de equipo técnico decían "tienes una asignación: Asignación"; ahora dicen el puesto real (Consola de audio, Video y Zoom, Micrófono de pasillo N, Acomodador N, Cronometrista). Al tocar el aviso se abre la vista pública en vez de una página inexistente, y el ícono chico ya no apunta a una ruta rota.
- **Vista pública, suscripción que se repara sola:** si el permiso de notificaciones ya está concedido, cada vez que se abre `ver.html` se vuelve a guardar el registro del celular, así no hace falta volver a tocar "Sí, avisame" si el registro se perdió.
- **Vista pública, avisos con la app abierta:** el aviso de asignación nueva se muestra como cartel dentro de la página (antes en Android quedaba solo como una campanita en la barra de estado y, en algunos casos, no se veía).
- Nueva función `onPushSubscriptionDeleted` que deja anotado en los registros cuándo se borra el registro de un celular, para diagnosticar pérdidas de suscripción.

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
