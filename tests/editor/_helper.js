// Utilidades comunes de las pruebas del editor (asignaciones-salon.html).
// Cada prueba abre el editor en un Chromium sin ventana, con datos de prueba en el
// almacenamiento local y SIN conexión a Firebase (se bloquean los scripts de gstatic),
// así nunca toca los datos reales de la congregación.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const FILE = 'file://' + path.resolve(__dirname, '../../asignaciones-salon.html');
const SHOTS = path.join(__dirname, 'capturas'); // capturas de pantalla para revisar a ojo (no se suben a git)
fs.mkdirSync(SHOTS, { recursive: true });

// Las pruebas se escribieron con "hoy" = miércoles 23 de septiembre de 2026 (hora de Argentina).
// Se fija ese reloj para que den lo mismo cualquier día que se corran; el tiempo igual avanza.
const HOY = new Date('2026-09-23T12:00:00-03:00');

async function launch() {
  const browser = await chromium.launch();
  const original = browser.newContext.bind(browser);
  browser.newContext = async (opts = {}) => {
    const { welcome, ...rest } = opts;
    const ctx = await original({ timezoneId: 'America/Argentina/Buenos_Aires', ...rest });
    await ctx.clock.install({ time: HOY });
    await ctx.route(/gstatic/, r => r.abort());
    // La bienvenida por rol se da por vista, salvo en las pruebas que la revisan ({ welcome: true }).
    if (!welcome) await ctx.addInitScript(() => { ['super', 'tecnico', 'acomodadores', 'asignaciones', 'anuncios', 'territorios', 'grupo'].forEach(r => localStorage.setItem('kh-welcome-' + r, '1')); });
    return ctx;
  };
  return browser;
}

function fixture() { return JSON.parse(JSON.stringify(require('./fixture').data)); }

module.exports = { launch, FILE, SHOTS, HOY, fixture };
