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
51 pruebas OK, 0 fallaron.
```

Si alguna falla, aparece marcada con ❌ y dice qué obtuvo.

## `push-salon-2026/functions` — funciones en la nube

```
cd push-salon-2026/functions
npm test
```

Prueba la lógica de las notificaciones y los recordatorios (quién
recibe aviso, a qué hora, qué texto), sin conectarse a Firebase.

## `app.test.js` — editor (`asignaciones-salon.html`)

Es la prueba más vieja: abre el editor en un navegador invisible y
simula su uso. Necesita `npm install playwright` la primera vez y se
corre con `node tests/app.test.js`. **Ojo:** se escribió antes de que
el editor pidiera iniciar sesión, así que probablemente haya que
actualizarla antes de volver a usarla.
