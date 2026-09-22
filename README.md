# Pruebas automatizadas

Este script (`app.test.js`) revisa que las funciones principales de la
app sigan funcionando después de un cambio: guardar datos, auto-asignar,
badges que se actualizan solos, importar copias corruptas, etc.

**No hace falta correrlo para usar la app normalmente.** Es una
herramienta para revisar antes de subir un cambio grande — la puede
correr Claude en una sesión futura si le pedís "revisá que no se haya
roto nada", o vos mismo si en algún momento querés hacerlo a mano.

## Cómo correrlo (solo si querés hacerlo vos)

1. Instalar Node.js una vez: [nodejs.org](https://nodejs.org) (elegís
   la versión "LTS").
2. Abrir una terminal en esta carpeta (`tests/`).
3. La primera vez: `npm install playwright`
4. Cada vez que quieras probar: `node app.test.js`

Va a abrir un navegador invisible, simular el uso normal de la app, y
al final mostrar algo como:

```
12 pruebas OK, 0 fallaron.
```

Si alguna falla, aparece marcada con ❌ y te dice qué se esperaba.
