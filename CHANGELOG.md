# Registro de cambios — Asignaciones del Salón del Reino

Cada versión corresponde al número que también aparece dentro de
`service-worker.js` (CACHE_NAME). Si algo falla después de una
actualización, revisá primero qué se agregó en la versión más reciente.

---

## Cronómetro: a qué hora termina la reunión — 23 sep 2026 (caché asignaciones-salon-v27)

- La barra de arriba ya no suma solo las partes terminadas ("1:40 atrasada"): calcula con el reloj real **a qué hora termina la reunión** ("Termina ~21:19 · 4 min tarde"). Suma lo que le queda a la parte en curso (en vivo), las partes que faltan, 20 s por cada cambio de parte, los cánticos con oración, las palabras de conclusión, y lo compara con el fin previsto (hora de inicio de Ajustes + duración). Muestra también cuándo empezó (aprox.).
- Antes de empezar dice "Empieza 19:30 · termina 21:15". Verde a horario (±1 min), rojo si va tarde.
- Si va tarde, una ayuda para el conductor: cuánto debería durar la parte que falta, o cuánto menos cada una si faltan varias (o que ya no se llega).
- Tocando la barra se ve la cuenta completa y se ajustan la duración de la reunión (entre semana y fin de semana por separado) y el tiempo de cada cántico con oración.
- En pantalla completa, debajo del reloj: "Fin ~21:19 · +4 min".
- Arreglo: después de las 21 h (ya otro día en hora UTC), las partes tomadas dejaban de verse como tomadas y el ritmo se reiniciaba. Ahora se usa la fecha local en el cronómetro y en el resto de la app.
- Pruebas: `tests/editor/13-fin-estimado` (351 pruebas en total).

## Registro de errores, pruebas del editor y documentación al día — 23 sep 2026 (cachés asignaciones-salon-v26, ver-salon-v24)

- **Registro de errores:** si algo falla en la app de asignaciones o en la vista de la congregación, queda anotado en la nube (sin datos personales: qué pasó, dónde, rol y tipo de teléfono; máximo 10 por sesión, sin repetir). El Super Admin lo ve en Ajustes → Registro de errores, y la app le avisa cuando hay errores nuevos. Se guardan 30 días. **Requiere publicar las reglas:** `firebase deploy --only firestore:rules` desde `push-salon-2026`.
- **Pruebas del editor:** nuevas en `tests/editor/` (12 archivos, 325 pruebas) con reloj fijo para que den igual cualquier día; `node tests/editor/run.js`. Se borró `tests/app.test.js`, que era de antes del login.
- **Documentación:** README de pruebas, ROADMAP (lo hecho y lo pendiente) y la guía "?" del editor (nueva sección Anuncios, registro de errores y espacio en la nube).

## Guardado por partes: los cambios ya no se pisan — 23 sep 2026 (caché asignaciones-salon-v25)

- Antes, cada guardado subía la congregación completa. Si dos personas guardaban casi a la vez, lo del segundo podía borrar lo del primero; y si alguien editaba sin señal, al reconectarse su copia vieja pisaba todo lo que los demás habían cambiado mientras tanto.
- Ahora la app compara con la última copia recibida de la nube y sube **solo los campos que cambiaron** (por ejemplo, el Micrófono 2 del jueves 24). Dos personas pueden trabajar a la vez, incluso en la misma reunión, sin perder nada; solo si tocan exactamente el mismo puesto queda el último.
- No se sube nada "a ciegas" antes de recibir la copia de la nube, y los campos vacíos por defecto no se suben como si fueran cambios.
- Red de seguridad: si la nube rechazara el guardado por partes por un formato inesperado, se guarda completo como antes.
- Ajustes → Sincronización muestra el espacio que ocupan los datos en la nube (Firebase admite hasta 1 MB). Con el uso actual alcanza para varios años; si pasa del 70 %, al Super Admin le aparece un aviso para archivar los años viejos.
- Exportar CSV: se sacó la columna "Tema" que ya no se usa.

## Ajustes → Acceso para listas largas — 23 sep 2026 (caché asignaciones-salon-v24)

- La lista se agrupa por rol: Super Admin, Admins, Solo anuncios y Solo ver (este último plegado, con la cantidad).
- Buscador por nombre del hermano vinculado o por email (sin importar tildes), que resalta lo que coincide.
- Filtros con cantidad: Todos, Admins, Anuncios (los que pueden publicar), Solo ver y "Sin vincular" (emails que no están asociados a ningún hermano).
- Una línea por persona: nombre, rol y email; 📢 si puede publicar anuncios; botón "Vincular" si no tiene hermano asociado.
- Al tocar una persona se abre su menú: cambiar rol, permiso de anuncios, vincular / cambiar / desvincular hermano y quitar acceso (con Deshacer).
- "+ Agregar persona" pasó arriba y el rol por defecto es "Solo ver" (antes era Super Admin).

## Permiso para publicar anuncios — 23 sep 2026 (caché asignaciones-salon-v23)

- Ajustes → Acceso: cada Admin (Equipo técnico, Acomodadores, Asignaciones) tiene un interruptor "📢 Puede publicar anuncios". Los Super Admin siempre pueden. Al agregar a alguien se puede marcar "También puede publicar anuncios".
- Rol nuevo **Solo anuncios**: entra directo a la gestión de anuncios y no ve ni puede tocar nada más.
- Quien no tiene el permiso no ve la pestaña Anuncios (los sigue viendo en la vista de la congregación).
- Los Admin que ya existían arrancan **sin** el permiso: hay que prenderlo a los hermanos aprobados.
- **Reglas del servidor** (`push-salon-2026/firestore.rules` y `storage.rules`, que se mudaron a esa carpeta para poder publicarlas con la terminal): Firebase rechaza cambios en los anuncios de quien no tiene el permiso; "Solo anuncios" solo puede cambiar los anuncios; y las listas de acceso (roles y permiso de anuncios) solo las cambia un Super Admin, así nadie se da permisos a sí mismo. Adjuntos: solo los que pueden publicar anuncios suben o borran archivos. Hay que publicarlas con `firebase deploy --only firestore:rules,storage` desde `push-salon-2026`.

## "Solo ver" va directo a la vista de la congregación — 23 sep 2026 (caché asignaciones-salon-v22)

- Si alguien con rol "Solo ver" entraba a la app de asignaciones, veía todas las pantallas como Super Admin, aunque no podía guardar nada (Firebase lo bloqueaba y aparecía un error). Ahora ve un aviso breve ("Tu acceso es de solo lectura") y se lo lleva a la vista de la congregación con el código ya puesto.

## Anuncios: nueva gestión, fecha de evento y links — 23 sep 2026 (caché asignaciones-salon-v21, ver-salon-v23)

**Para quien publica (app de asignaciones)**
- Al entrar a Anuncios se ve primero la lista, separada en Fijados, Activos y Vencidos (plegados). El formulario se abre con "+ Nuevo anuncio".
- Cada anuncio tiene un menú ⋯ con Editar, Fijar, Duplicar y Borrar. Borrar ya no pide confirmación: aparece "Deshacer" unos segundos (y lo recuperado no vuelve a notificar).
- "Duplicar" abre una copia para cambiar fecha o texto; si tiene adjunto se reutiliza el mismo archivo, que no se borra mientras algún anuncio lo use.
- Los vencidos tienen "Volver a publicar 30 días" (sin notificar de nuevo).
- Fecha y hora del evento (opcional). "Mostrar hasta" ahora ofrece: Hasta el evento, 7 días, 30 días, Otra fecha… o Siempre. Con fecha de evento, por defecto se muestra hasta ese día.
- Vista previa antes de publicar: la notificación como llega al celular y la tarjeta como la ve la congregación.

**Para la congregación (vista pública)**
- Los anuncios con evento muestran un recuadro con el día, la hora, cuánto falta y el botón "+ Calendar" para Google Calendar. Al compartir, se incluye la fecha.
- Los links del texto se pueden tocar (los emails no se tocan).

## Tira de reuniones y sin "tema" — 23 sep 2026 (caché asignaciones-salon-v20, ver-salon-v22)

- Programa: en lugar de elegir semana y después "Entre semana / Fin de semana", arriba hay una tira con todas las reuniones del mes. Cada una muestra si está completa (✓), cuánto le falta o si está vacía; las pasadas se ven atenuadas y la próxima dice "PRÓXIMA".
- ‹ › cambian de mes; tocando el mes (📅) se abre un calendario con los días de reunión coloreados según su estado.
- La app abre directamente en la próxima reunión. Las subpestañas dicen cuánto falta en cada una ("Equipo técnico · faltan 2", "Programa · ✓").
- Se quitó el "tema de la reunión": ya no se carga ni aparece en listas, PDF, WhatsApp, cronómetro ni en la vista pública.

## Equipo técnico: compacto, selector con ayuda, conflictos de un toque — 23 de septiembre de 2026 (caché `asignaciones-salon-v19`)
- **Una fila por puesto** dentro de una sola lista, agrupada por sección y con sus colores (antes, tarjetas altas en dos columnas). El equipo completo entra en una pantalla del celular. Los puestos con conflicto quedan en rojo y dicen por qué.
- **Selector con ayuda:** solo los habilitados para ese puesto, agrupados en *Disponibles* (primero quien hace más tiempo que no lo hace: "micrófonos: hace 5 sem." / "nunca"), *Ya tienen algo en esta reunión* (con qué) y *No disponibles*. Al elegir, los demás selectores se actualizan.
- **Aviso de conflictos en una línea** ("⚠ 3 puestos a revisar") con **"Usar sugeridos"** (aplica todos los reemplazos, con Deshacer) y "Ver" para el detalle.
- **Menú ⋯ en cada puesto:** reemplazo sugerido ("Si no llega") con "Usar", "Elegir otro", "Ver sus próximas asignaciones" y "Quitar asignación" (con Deshacer). "Si no llega" queda a la vista solo en los puestos con conflicto.
- **Auto-asignar más justo:** evita repetir a quien hizo ese mismo puesto la semana anterior; después elige por menos veces en el puesto, hace más tiempo que no lo hace y menos carga total. Lo que completó queda resaltado con el motivo hasta cambiar de semana, y el aviso tiene **Deshacer**.
- **Tema de la reunión** en una barra "Tema" debajo de Entre semana / Fin de semana, visible en Equipo técnico y en Programa.

## Programa: orador visitante, selector que ayuda a elegir y privilegios — 23 de septiembre de 2026 (cachés `asignaciones-salon-v18` y `ver-salon-v21`)
- **Orador de otra congregación** (fin de semana): "+ Viene de otra congregación" abre dos campos, nombre y congregación. Se guarda en `program.oradorVisitante` y aparece como "Nombre (Congregación)" en la vista pública, WhatsApp, PDF, el resumen del mes y el cronómetro. "← Es de esta congregación" vuelve al selector.
- **Selector de hermanos con ayuda:** al elegir quién tiene una parte, la lista viene agrupada: *Disponibles* (primero quien hace más tiempo que no tiene una parte del programa, con "nunca tuvo parte" / "última: hace 3 sem."), *Ya tienen algo en esta reunión* (con qué), *Sin este privilegio marcado* y *No disponibles*. Al cambiar una asignación, los demás selectores se actualizan. Buscar por nombre sigue funcionando igual.
- **Privilegios del programa en Hermanos** (opcional): Presidente, Oraciones, Discursos, Lector, Estudiante. Si ningún hermano tiene nada marcado, no se filtra; si hay, los que no lo tienen van al grupo "Sin este privilegio marcado" (nunca se bloquea a nadie). Se muestran como etiquetas en la lista de Hermanos.
- **Temas sugeridos** en las partes de estudiante (Empiece conversaciones, Haga revisitas, Haga discípulos, Explique sus creencias, Discurso); se puede seguir escribiendo otro.
- **Minutos vacíos:** al lado del campo avisa "Sin cargar: el cronómetro usa 5 min" (15 en Vida Cristiana).
- **Cánticos:** el campo dice "N.°" (antes se cortaba) y abre el teclado numérico.
- ⚠ Hasta que todos los dispositivos que editan se actualicen, uno con la versión anterior podría borrar los privilegios del programa al guardar. Conviene cargarlos después de abrir la app actualizada en esos dispositivos.

## Cronómetro: el reloj vive en la tarjeta de la parte — 23 de septiembre de 2026 (caché `asignaciones-salon-v17`)
- Ya no hay un panel de reloj aparte arriba: la parte en curso se abre como reloj **dentro de la lista** (número, parte, quién la tiene, tiempo planeado, reloj grande y botón "Iniciar / Terminó"). Las demás quedan como filas chicas; las ya tomadas, compactas con ✓ y su diferencia.
- Al abrir la pestaña, la primera parte que falta tomar ya viene abierta. Al tocar "Terminó", se abre la siguiente y la pantalla se desplaza sola para dejarla a la vista. La línea "Reunión: … atrasada" queda fija arriba al desplazarse.
- El borde de la tarjeta cambia de color con el tiempo (verde, ámbar en el último minuto, rojo pasado). Tocar otra fila con el reloj quieto la abre; si está corriendo, avisa que primero hay que terminar o pausar.
- "Ajustar tiempo" cambia los minutos de la parte sin perderla. Elegir un tiempo estándar en "Otras partes" pone el reloj arriba, fuera de la lista.
- **Arreglo:** si llegaba un cambio de la nube en plena reunión (otro editor guardando algo, o tocar una opción del cronómetro), el reloj que estaba corriendo se reiniciaba. Ahora solo se reinicia si está quieto.
- El reloj ya no se pone ámbar antes de arrancar en las partes de 1 minuto (como el consejo).

## Cronómetro mejorado — 23 de septiembre de 2026 (caché `asignaciones-salon-v16`)
- **Un solo botón grande:** "▶ Iniciar" → "■ Terminó" (dice qué guarda y cuál sigue). Guarda el tiempo y deja lista la parte siguiente, sin arrancarla. En pausa pasa a "▶ Seguir" y aparece "Terminó" chico. "Pausar", "Reiniciar" y "Ajustar tiempo" (minutos a mano) quedan como botones chicos.
- **Cómo va la reunión:** arriba, "Reunión: 1:40 atrasada" / "adelantada" / "a tiempo", sumando las diferencias de las partes ya tomadas. Cada parte tomada muestra su diferencia (+0:50 / −0:10).
- **Pantalla completa:** reloj enorme con fondo verde, ámbar (último minuto) o rojo (pasado). Un toque pausa o sigue; ✕ o Escape sale. La pantalla no se apaga.
- **Vibración faltando 1 minuto** (se puede apagar).
- **Aviso de minutos faltantes:** si a una parte le faltan los minutos en el Programa, lo dice ("sin minutos cargados · usa 5") en vez de ponerlos en silencio.
- **Consejo opcional** (apagado por defecto, vale para toda la congregación): agrega "Consejo · 1 min" después de la Lectura de la Biblia y de cada parte de "Seamos mejores maestros", con el nombre del presidente. Se guarda en el historial como "Consejo (nombre de la parte)".
- Los botones de sonido, probar campanilla y modo flotante pasaron a una sección "Opciones" al final de la pestaña. Se actualizó la guía de uso.

## Hermanos: filtros como botoncitos — 22 de septiembre de 2026 (caché `asignaciones-salon-v15`)
- Completa lo que había quedado afuera del mockup: en el celular, el buscador y "PDF" van en un mismo renglón y los filtros son botoncitos deslizables (Todos, Audio, Video, Micrófonos, Plataforma, Acomodadores, Cronometrista, Sin email) en vez del desplegable. En la computadora sigue el desplegable.

## Mejoras del editor — 22 de septiembre de 2026 (caché `asignaciones-salon-v14`)
**Errores arreglados**
- Programa: los campos de cántico y de minutos se salían de la tarjeta en el celular y la pantalla se corría de costado. Ahora tienen el ancho justo.
- Hermanos en el celular: la tabla dejaba el email, "Este mes" y el botón de editar fuera de la pantalla. En pantallas angostas ahora cada hermano es una tarjeta con todo a la vista y "✎ Editar"; tocar la tarjeta también abre la edición. "+ Agregar hermano" queda flotando abajo. En la computadora sigue la tabla.
- Las hojas que suben desde abajo en el celular ("Compartir" y el nuevo "Más") quedaban tapadas en parte por la barra de pestañas. Ahora quedan por encima.

**Mejoras**
- Programa (celular): los botones entran en un renglón. "Copiar semana anterior" y "No disponibles hoy" pasaron al menú "Más ▾". En la computadora siguen igual.
- Resumen del mes plegable: cerrado de entrada en el celular y abierto en la computadora; recuerda lo que elegiste. La lista del mes usa filas desplegables con equipo técnico y programa juntos (como la vista pública) y avisa cuántos puestos faltan. La impresión del mes no cambia.
- Cronómetro: el reloj pasó arriba de todo y muestra la parte y quién la tiene. Debajo, las partes de la reunión en orden con su tiempo y el nombre (salen del Programa); tocar una la carga en el reloj. "Marcar fin y guardar" la marca con ✓ y deja lista la siguiente. Los tiempos estándar siguen en "Otras partes".
- Ajustes agrupados (Congregación, Avisos, Reportes y datos, Este dispositivo, Ayuda), todas las tarjetas cerradas y con una línea que dice qué hay adentro. Congregación va primero. "Recordatorio del día anterior" pasó a llamarse "Aviso de puestos sin cubrir".

## Pruebas de la vista pública guardadas en el proyecto — 22 de septiembre de 2026 (sin cambio de caché)
- Nuevo `tests/ver.test.js` (51 pruebas, sin dependencias): Google Calendar, recordatorios, calendario desplegable, Inicio, anuncios y estructura del HTML. Se corre con `node tests/ver.test.js`.
- `app.test.js` y su README pasaron a la carpeta `tests/`, donde el propio README decía que estaban (el script buscaba la app una carpeta más arriba). Se aclara que `app.test.js` quedó desactualizado desde que el editor pide login.
- Nuevo `README.md` en la raíz, con una descripción corta del proyecto (es lo que se ve al abrir el repositorio en GitHub).

## Mejoras en Inicio y Anuncios — 22 de septiembre de 2026 (caché `ver-salon-v20`)
**Inicio**
- "Próximas reuniones" usa el mismo formato que el Calendario: filas desplegables con técnico y programa juntos, la próxima abierta (o "HOY" si es hoy).
- Arriba de todo aparece una tarjeta con el anuncio nuevo ("Anuncio nuevo" / "3 anuncios nuevos"), o el fijado si no hay nada sin leer. "Ver" lleva a la pestaña Anuncios.
- Si alguien entra con un email que no está vinculado a ningún hermano, se le explica cómo pedir que lo vinculen (se puede cerrar).

**Anuncios**
- Fechas legibles: "Recién", "Hace 20 min", "Hace 3 h", "Ayer", "18 sept" (la fecha exacta queda al mantener el dedo o pasar el mouse). Si el anuncio vence, dice "Vence hoy / mañana / el sáb 26".
- Cada anuncio es una tarjeta propia; los fijados, con borde dorado. Se sacó el título "Tablero de Anuncios" (repetía el nombre de la pestaña). "Compartir" pasó abajo a la derecha.
- Si "Compartir" falla, aparece un aviso normal que se va solo ("No se pudo compartir este anuncio…") en vez del cartel con el detalle técnico, que queda solo en la consola.

## Calendario: Equipo técnico y Programa juntos — 22 de septiembre de 2026 (caché `ver-salon-v19`)
- Se sacó el interruptor "Equipo técnico / Programa" de la pestaña Calendario, que obligaba a mirar dos vistas para saber quién hacía qué.
- Ahora cada reunión es una fila que se despliega. La **próxima aparece abierta** (con la etiqueta "PRÓXIMA") y las demás cerradas, con una línea de resumen ("Presidente: …" o "Discurso: …"). Si tenés algo en esa reunión, la fila cerrada lo avisa ("Vos: Acomodador 1").
- Al abrir una reunión se ve todo junto, en formato puesto → nombre: el Equipo técnico en dos columnas y el Programa con sus secciones de colores. Tus asignaciones quedan resaltadas con ✓.
- Si está cargado el horario de la reunión, aparece al lado del tipo ("Entre semana · 19:30").
- El buscador, las reuniones pasadas plegadas y la ficha del día desde Inicio siguen igual. La guía de uso se actualizó.

## Google Calendar: se ve cuáles ya agregaste — 22 de septiembre de 2026 (caché `ver-salon-v18`)
- En "Tus otras asignaciones", después de tocar el botón de calendario de una asignación, el ícono pasa a un ✓ verde y queda así la próxima vez que abras la app. Se puede volver a tocar para agregarla otra vez.
- Límites: marca que se abrió Google Calendar, no que se guardó (Google no se lo avisa a la app), y queda guardado solo en ese celular. Las fechas pasadas se limpian solas.
- Se descartó la suscripción automática al calendario: con los recordatorios nuevos quedaba casi redundante, y Google puede tardar hasta un día en reflejar cambios. El mockup queda en `Claude outputs/mockup-suscripcion-calendario.html` por si se retoma.

## Recordatorios automáticos y horario de reunión — 22 de septiembre de 2026 (cachés `asignaciones-salon-v13` y `ver-salon-v17`) — **requiere `firebase deploy --only functions`**
- **Editor → Ajustes → Congregación:** dos campos nuevos y opcionales, "Hora — Entre semana" y "Hora — Fin de semana". Sin horario, todo sigue como antes.
- **Vista pública → Inicio:** nueva fila "🔔 Recordatorios" debajo de tus asignaciones. "Cambiar" abre una hoja con tres opciones combinables: el día anterior (20:00), el mismo día a la mañana (8:00) y unas horas antes (1, 2 o 3 h; solo aparece si hay horario cargado). Si las notificaciones no están activadas, la fila ofrece "Activar".
- **Automático para todos:** quien tiene las notificaciones activadas recibe el aviso del día anterior sin configurar nada.
- **El aviso dice qué asignación es y a qué hora** ("Mañana: Micrófono de pasillo 1 · jueves 24 a las 19:30"). Si hay varias el mismo día, llegan juntas.
- **Siempre con datos actuales:** nueva función `sendScheduledReminders` que corre cada media hora; si te sacaron una asignación, no te avisa. Cada aviso enviado se anota en `sentReminders` para no repetirlo (se limpia solo).
- Con horario cargado, la tarjeta de la próxima asignación muestra la hora y el botón de Google Calendar crea el evento de 19:30 a 21:15 en vez de todo el día.
- Se sacaron los botones "Recordar 1/3 días antes" de la notificación de asignación nueva. Los recordatorios que ya estaban pedidos con esos botones se siguen mandando hasta que se cumplan.

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
