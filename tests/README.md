# Pruebas automatizadas

**No hace falta correrlas para usar la app.** Son una herramienta para
revisar, antes de subir un cambio, que no se haya roto nada. Las puede
correr Claude en una sesión futura si le pedís "revisá que no se haya
roto nada", o vos mismo a mano.

Se corren desde la carpeta principal del proyecto
(`asignaciones-salon-main`), con Node.js instalado
([nodejs.org](https://nodejs.org), versión "LTS").

## `ver.test.js` — vista pública (`ver/ver.html`)

```
node tests/ver.test.js
```

No necesita instalar nada más. Saca del HTML las funciones de la vista
pública y las prueba con datos inventados, sin navegador ni Firebase:
Google Calendar, recordatorios, el calendario desplegable, Inicio, las
tarjetas de anuncios y la estructura del HTML. Al final muestra algo como:

```
59 pruebas OK, 0 fallaron.
```

Si alguna falla, aparece marcada con ❌ y dice qué obtuvo.

## `push-salon-2026/functions` — funciones en la nube

```
cd push-salon-2026/functions
npm test
```

Prueba la lógica de las notificaciones y los recordatorios (quién
recibe aviso, a qué hora, qué texto), sin conectarse a Firebase.

## `editor/` — app de asignaciones (`asignaciones-salon.html`)

Abren el editor en un navegador invisible (Chromium), con datos de
prueba y **sin conectarse a Firebase** (nunca tocan los datos reales), y
simulan el uso: tocar botones, asignar, publicar anuncios, etc. El reloj
se fija en el miércoles 23 de septiembre de 2026, así dan lo mismo el día
que se corran.

La primera vez hay que instalar Playwright (una sola vez):

```
npm install playwright
npx playwright install chromium
```

Después:

```
node tests/editor/run.js            (todas, tarda unos minutos)
node tests/editor/run.js anuncios   (solo las que tengan "anuncios" en el nombre)
```

Al final muestra una línea por archivo y el total, por ejemplo
`359 de 359 pruebas OK.` Si algo falla, muestra qué.

| Archivo | Qué prueba |
|---|---|
| `01-pantallas` | Que ninguna pantalla se corra de costado, en celular y computadora |
| `02-hermanos` | Pestaña Hermanos: buscador, filtros, PDF |
| `03-cronometro`, `04-cronometro-tarjeta` | Cronómetro de la reunión y el reloj en cada tarjeta |
| `05-programa` | Programa: selectores, cánticos, orador visitante |
| `06-equipo-tecnico` | Equipo técnico: conflictos, auto-asignar, menú ⋯, deshacer |
| `07-tira-reuniones` | Tira de reuniones del mes y calendario |
| `08-anuncios` | Gestión de anuncios: lista, menú, vista previa, evento, vencimiento |
| `09-roles-y-permisos` | Qué ve cada rol, permiso de anuncios, "Solo anuncios", "Solo ver" |
| `10-acceso` | Ajustes → Acceso con 170 personas: buscador, filtros, vincular |
| `11-guardado-nube` | Que se suba solo lo que cambió (dos personas a la vez no se pisan) |
| `12-registro-errores` | Registro de errores en la nube y su tarjeta en Ajustes |
| `13-fin-estimado` | Cronómetro: a qué hora termina la reunión, ayuda para recuperar tiempo |
| `14-datos-incompletos` | Que la app abra y se conecte aunque haya semanas con datos incompletos |

Las capturas de pantalla que sacan quedan en `tests/editor/capturas/`
(no se suben a git), por si querés mirarlas.
