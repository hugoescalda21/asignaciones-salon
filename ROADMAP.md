# Roadmap — Próxima fase
## Asignaciones del Salón del Reino

Este documento se reescribió por completo el 14 de septiembre de 2026.
La versión anterior quedó desactualizada — proponía como "el salto
grande" cosas que ya están hechas hace rato, y de hecho el proyecto
llegó bastante más lejos de lo que esa versión imaginaba.

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
- Dos sets de pruebas automáticas (`app.test.js`, `ver.test.js`) que
  cubren todo lo anterior.

En criollo: lo que en la versión vieja de este documento se llamaba
"Fase A" y "Fase B" — ya está, y de forma más sólida de lo planteado
ahí (seguridad real, no solo un código).

---

## Lo que queda abierto, de menor a mayor esfuerzo

### 1. Guía de uso corta dentro de la app
Con todo lo que se sumó (Programa, sala auxiliar, login), alguien que
usa la app por primera vez — un cronometrista nuevo, un operador que
no la vio nunca — tiene bastante más para entender que al principio.
Una guía cortita (aparte del onboarding que ya existe) ayudaría.
*Esfuerzo: chico.*

### 2. Notificación directa a cada hermano de su asignación
Lo hablamos hace un rato: hoy WhatsApp es el canal, pero un email
automático a cada hermano cuando le asignan algo es posible. Necesita
una función en la nube (Firebase Cloud Functions) más un servicio de
envío de correos (vimos que ya tenés cuenta en Resend para otro
proyecto). Implica pasar Firebase al plan pago por uso — para el
volumen de una congregación, el costo real es prácticamente nulo,
pero deja de ser 100% gratis.
*Esfuerzo: medio.*

### 3. Multi-congregación con alta propia
Hoy cada congregación ya tiene sus datos aislados por código — eso
técnicamente ya funciona. Lo que falta, si en algún momento la
compartís con otra congregación, es que se puedan dar de alta *solas*
(un formulario simple: nombre, código, día de reunión) sin que vos
tengas que configurarles todo a mano como hiciste con San Agustín.
Solo tiene sentido si de verdad hay otra congregación interesada.
*Esfuerzo: medio-alto.*

### 4. Monitoreo de errores
*(Accesibilidad ya está hecha — Escape, foco atrapado, aria-labels,
contraste de color corregido en los dos archivos, el 14 de
septiembre.)* Queda pendiente una forma simple de enterarte si algo
se rompe en producción sin depender de que alguien te escriba.
*Esfuerzo: variable, sin apuro.*

### 5. Roles por área, con restricción real del lado del servidor
Ya armamos la versión de interfaz (cada rol ve solo lo suyo, pero
técnicamente los datos completos igual llegan al dispositivo). Para
que sea una restricción de verdad — que el servidor directamente no
le entregue a un Admin de Acomodadores nada que no sea Acomodadores —
hay que **separar los datos en varios documentos** en Firestore (uno
por Equipo técnico, uno por Acomodadores, uno por Programa, uno por
Hermanos/Ajustes) en vez del documento único de hoy. Firestore no
puede aplicar reglas más finas que "tocaste algo dentro de weeks" si
todo vive junto — es una limitación real del motor de reglas, no algo
que se arregle agregando código.

Implica: reescribir `saveData()`, `loadData()` y la sincronización en
tiempo real en los dos archivos, más migrar los datos actuales de
San Agustín a la estructura nueva sin perder nada. Es más grande que
cualquier cosa hecha hasta ahora — el login con Google, en
comparación, fue chico al lado de esto.
*Esfuerzo: alto.*

### 6. Consentimiento de uso de datos, para el resumen personal
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

Si tuviera que elegir un solo próximo paso: **la guía de uso corta**
(punto 1) — es lo más rápido, y con todo lo que creció la app desde
que arrancamos, es lo que más se nota que falta para alguien que no
fue parte de armarla con vos.

Las notificaciones por email (punto 2) son el siguiente salto real de
funcionalidad, pero conviene decidirlo con calma porque toca la
arquitectura (Cloud Functions, plan pago) — no es un cambio de una
tarde como los que veníamos haciendo.
