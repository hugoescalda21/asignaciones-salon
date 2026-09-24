# Roadmap — Próxima fase
## Asignaciones del Salón del Reino

Este documento se reescribió por completo el 14 de septiembre de 2026.
La versión anterior quedó desactualizada — proponía como "el salto
grande" cosas que ya están hechas hace rato, y de hecho el proyecto
llegó bastante más lejos de lo que esa versión imaginaba.

_Actualizado el 23 de septiembre de 2026: se sumaron a "lo ya hecho" las notificaciones, los anuncios nuevos, los permisos, el guardado por partes, el registro de errores y las pruebas del editor; se sacaron de pendientes el monitoreo de errores y la notificación directa (resuelta con notificaciones push)._

---

## Lo que ya está hecho (para no repetirlo por error)

**Núcleo de asignaciones**
- Equipo técnico completo (audio, video, micrófonos, plataforma,
  acomodadores, cronometrista), con auto-asignar por equidad.
- Programa completo de la reunión — Presidente, oraciones, cánticos,
  Tesoros de la Biblia, Seamos mejores maestros (partes flexibles),
  Nuestra Vida Cristiana (partes flexibles), Estudio bíblico, y todo
  el equivalente para Fin de semana. Con numeración automática,
  minutos por parte, y sala auxiliar activable.
- Auto-asignar respeta el Programa (no duplica a alguien que ya tiene
  una parte esa reunión), con sugerencias de reemplazo cuando hay
  conflicto.
- Buscador de hermanos en todos los campos de asignación.
- Detección de conflictos con aviso visual (tarjetas en rojo).

**Sincronización y seguridad**
- Datos en la nube (Firestore), en tiempo real, entre todos los
  dispositivos.
- **Login real** — email con link sin contraseña, o "Continuar con
  Google" — no un simple código compartido.
- Control de acceso por email: lista de quién puede **editar** y
  quién solo puede **ver**, administrable desde la app.
- Reglas de seguridad de Firestore que lo hacen cumplir del lado del
  servidor (no algo que se pueda saltear desde el navegador).

**Compartir y ver**
- WhatsApp y PDF con el Programa completo, secciones y cánticos.
- Vista pública de solo lectura (`ver.html`) con: toggle Equipo
  técnico/Programa, búsqueda por nombre (encuentra ambos lados),
  colores reales por sección, día fijo al scrollear, semana pasada
  colapsada, barra de búsqueda flotante.

**Reportes y mantenimiento**
- Reporte anual de equidad, exportación CSV.
- Recordatorio local del día anterior.
- Reparación automática de datos huérfanos (hermanos borrados que
  dejaban asignaciones fantasma).
- Pruebas automáticas en `tests/` (`ver.test.js` para la vista pública,
  `app.test.js` para el editor, esta última desactualizada desde que se
  agregó el login) y `npm test` en las funciones en la nube.

**Guías de uso**
- Guía de uso corta dentro del editor (`asignaciones-salon.html`):
  botón "?" del header y "Ajustes → Guía de uso", con secciones
  plegables (Hermanos, Equipo técnico, Programa, Sala auxiliar,
  Compartir, Vista pública, Acceso, Cronómetro, Reportes/backup).
- Guía de uso corta en la vista pública (`ver.html`), agregada el 22
  de septiembre de 2026: link "Cómo usar esta app" al pie, junto a
  "Política de privacidad" — cubre Inicio, Calendario, Anuncios,
  Notificaciones, Instalar en el celular, e Iniciar sesión.

**Notificaciones y recordatorios** (funciones en la nube, `push-salon-2026/`)
- Notificación push al celular cuando a un hermano le asignan algo, y
  recordatorio el día anterior / unas horas antes (lo elige cada uno).
- Aviso de anuncio nuevo.

**Anuncios**
- Lista por estado (fijados, activos, vencidos plegados con "Volver a
  publicar"), menú ⋯ con Editar / Fijar / Duplicar / Borrar con
  Deshacer, vista previa de la notificación y de la tarjeta.
- Fecha de evento opcional con botón a Google Calendar, vencimiento
  "hasta el evento" u otra fecha, links clickeables.
- Permiso aparte para publicar: Super Admin siempre; los Admin solo si
  tienen "📢 Puede publicar anuncios"; rol "Solo anuncios" (por ejemplo,
  el coordinador). Lo hacen cumplir las reglas del servidor.

**Programa**
- Tira con las reuniones del mes (estado de cada una: ✓ / faltan N /
  vacía), calendario del mes y apertura en la próxima reunión.
- Se quitó el "tema de la reunión".

**Acceso y seguridad**
- Ajustes → Acceso pensado para 170+ personas: grupos por rol,
  buscador por nombre o email, filtros ("Sin vincular"), menú por
  persona, vincular con el hermano.
- Solo un Super Admin puede cambiar roles y permisos (lo exige el
  servidor). "Solo ver" va directo a la vista de la congregación.
- Permisos por área controlados por el servidor: cada Admin solo puede
  guardar en su parte de cada reunión (reglas de Firestore + función
  guardRoles, que deshace lo que no corresponde y lo anota).

**Datos y mantenimiento**
- Guardado por partes: se sube solo lo que cambió, así dos personas
  trabajando a la vez (o alguien sin señal) no se pisan.
- Indicador del espacio usado en la nube (límite de Firebase: 1 MB
  por documento) con aviso al Super Admin al pasar el 70 %.
- Registro de errores: si algo falla en cualquier teléfono queda
  anotado (sin datos personales) y el Super Admin lo ve en Ajustes.
- Pruebas del editor al día en `tests/editor/` (325 pruebas) y de la
  vista pública en `tests/ver.test.js`.

En criollo: lo que en la versión vieja de este documento se llamaba
"Fase A" y "Fase B" — ya está, y de forma más sólida de lo planteado
ahí (seguridad real, no solo un código).

---

## Lo que queda abierto

### 1. Archivar los años viejos (cuando haga falta)
Todo vive en un solo documento de Firestore, que admite hasta 1 MB. Con
el uso actual alcanza para varios años (se estimó ~130 KB por año). El
indicador de Ajustes → Sincronización muestra cuánto se usa y avisa al
pasar el 70 %: recién ahí conviene pasar las semanas de más de un año a
documentos aparte (sin perder los reportes).
*Esfuerzo: medio. Sin apuro.*

### 2. Multi-congregación con alta propia
Cada congregación ya tiene sus datos aislados por código. Lo que falta,
si alguna vez la usa otra congregación, es que se puedan dar de alta
solas (nombre, código, día de reunión) sin configurarles todo a mano.
Solo tiene sentido si de verdad hay otra congregación interesada.
*Esfuerzo: medio-alto.*

### 3. Consentimiento de uso de datos, para el resumen personal
Pendiente de una decisión de fondo primero: si el consentimiento de
uso de datos que los publicadores ya firmaron en papel (el de la
organización) alcanza para esta app externa, o si hace falta pedir
uno propio — eso hay que charlarlo con quien maneja los temas de
cumplimiento en la congregación, no es algo que se resuelva acá.

Si deciden que sí hace falta, el diseño ya quedó pensado y con
mockups armados (14 de septiembre de 2026):

- **No es obligatorio para usar la app en general** — el calendario
  compartido y el buscador siguen funcionando igual para todos, hayan
  aceptado o no. Es obligatorio únicamente para ver el **resumen
  personal** (la tarjeta "Hola, X — tus asignaciones" en `ver.html`),
  porque es la única función que depende del dato nuevo (el email
  vinculado).
- **Cuándo se pide**: en el mismo lugar donde iría la tarjeta
  personal, la primera vez que alguien entra con un email vinculado —
  antes aparece un cartelito chico ("Podemos mostrarte tu resumen
  personal...") con un botón para abrir el consentimiento completo.
  No bloquea nada del resto de la pantalla.
- **El texto del consentimiento** tiene que aclarar explícitamente
  que el nombre y las asignaciones son visibles para cualquier otra
  persona de la congregación con acceso a la app — no es información
  privada solo de esa persona, es el mismo calendario que ya se
  comparte hoy en el salón.
- **Link a una política completa**, en lenguaje simple: qué es la
  app (aclarando que no es un sistema oficial de la organización,
  sino una herramienta armada por la congregación), qué datos guarda,
  quién los puede ver, y cómo pedir que se borren.
- **Registro del consentimiento**: hay que guardar, por cada persona
  que acepta, su email, la fecha y hora exacta, y qué versión del
  texto aceptó — el equivalente digital de la firma, aclaración y
  fecha del papel. Sin esto no hay forma de demostrar que alguien
  realmente aceptó si hace falta más adelante. Falta diseñar dónde
  se consulta ese registro (probablemente una tarjeta nueva en
  Ajustes, visible solo para Super Admin).
- Mockups guardados: `mockup-consentimiento-datos.html`,
  `mockup-consentimiento-y-politica.html`,
- **Link a la política completa, siempre accesible**: al pie de
  `ver.html` (junto al texto "Se actualiza solo — generado con..."),
  no en el encabezado — accesible en cualquier momento, no solo
  cuando aparece el cartelito de consentimiento.
- Mockups guardados: `mockup-consentimiento-datos.html`,
  `mockup-consentimiento-y-politica.html`,
  `mockup-cartelito-inicial-consentimiento.html`,
  `mockup-link-privacidad-encabezado.html` (con las dos opciones de
  ubicación — quedó elegida la del pie).

*Esfuerzo: medio.*

---

## Recomendación

Lo más valioso ahora es **usar la app unas semanas y juntar lo que
comenten los hermanos**: las próximas mejoras van a salir de ese uso
real. Mientras tanto, conviene mirar de vez en cuando Ajustes →
Registro de errores (la app avisa sola si aparecen errores nuevos) y el
indicador de espacio. Antes de subir cualquier cambio grande, correr
las pruebas (`node tests/editor/run.js` y `node tests/ver.test.js`).
