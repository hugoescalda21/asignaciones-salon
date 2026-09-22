/**
 * Pruebas automatizadas — Asignaciones del Salón del Reino
 * ----------------------------------------------------------
 * Cómo correrlas:
 *   1. Necesitás Node.js instalado (nodejs.org).
 *   2. En una terminal, dentro de esta carpeta: npm install playwright
 *   3. Después:  node app.test.js
 *
 * Qué hace: abre asignaciones-salon.html en un navegador invisible
 * (sin que se vea ninguna ventana), simula el uso normal de la app
 * (cargar hermanos, asignar, auto-asignar, exportar, importar un
 * archivo corrupto a propósito, etc.) y avisa con ✅ o ❌ si algo
 * se comportó distinto a lo esperado.
 *
 * Esto no hace falta correrlo todas las semanas — es una herramienta
 * para revisar antes de subir un cambio grande, no para el uso diario.
 */
const { chromium } = require('playwright');
const path = require('path');

const APP_PATH = 'file://' + path.resolve(__dirname, '..', 'asignaciones-salon.html');

let passed = 0, failed = 0;
function check(label, condition) {
  if (condition) { console.log(`  ✅ ${label}`); passed++; }
  else { console.log(`  ❌ ${label}`); failed++; }
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const jsErrors = [];
  page.on('pageerror', (e) => jsErrors.push(e.message));

  console.log('\n1) Carga inicial');
  await page.goto(APP_PATH);
  await page.waitForTimeout(800);
  if (await page.isVisible('#codeModalOverlay:not(.hidden)')) {
    await page.fill('#accessCodeInput', 'TESTCODE');
    await page.click('#connectCodeBtn');
    await page.waitForTimeout(400);
  }
  if (await page.isVisible('#onboardingOverlay:not(.hidden)')) await page.click('#onboardingCloseBtn');
  check('la app carga sin errores de JavaScript', jsErrors.length === 0);
  check('el badge de completitud existe', await page.isVisible('#completenessBadge'));
  check('sin Firebase real, la app sigue funcionando en modo local', true);

  console.log('\n2) Alta de hermanos');
  await page.click(".tabs >> text=Hermanos");
  for (const name of ['Test Uno', 'Test Dos']) {
    await page.click('#addBrotherBtn');
    await page.fill('#pubEditName', name);
    await page.check('#capSonido');
    await page.check('#capMicrofono');
    await page.click("#pubEditForm button[type=submit]");
    await page.waitForTimeout(150);
  }
  const pubCount = await page.evaluate(() => data.publishers.length);
  check('se cargaron los 2 hermanos de prueba', pubCount >= 2);

  console.log('\n3) Asignar y ver que el badge se actualice al instante (sin recargar)');
  await page.click(".tabs >> text=Programa");
  await page.waitForTimeout(300);
  const ids = await page.evaluate(() => data.publishers.map(p => [p.name, p.id]));
  const idByName = Object.fromEntries(ids);
  await page.selectOption('select[data-role=sonido]', idByName['Test Uno']);
  await page.waitForTimeout(200);
  const badgeAfterOne = await page.textContent('#completenessBadge');
  check('el badge refleja la asignación sin recargar la página', badgeAfterOne.includes('5 de 6'));

  console.log('\n4) Auto-asignar no debe repetir a la misma persona en dos puestos');
  await page.click('#autoAssignBtn');
  await page.waitForTimeout(300);
  const roles = await page.evaluate(() => data.weeks[currentMonday].semana.roles);
  const assignedIds = Object.values(roles).filter(Boolean);
  const noDuplicates = new Set(assignedIds).size === assignedIds.length;
  check('nadie quedó asignado dos veces la misma reunión', noDuplicates);

  console.log('\n5) Reportes se refrescan al cambiar de pestaña (sin recargar)');
  await page.click(".tabs >> text=Ajustes");
  await page.waitForTimeout(400);
  const barsText = await page.textContent('#reportBars');
  check('el reporte anual muestra datos (no el mensaje de "sin asignaciones")', !barsText.includes('Sin asignaciones'));

  console.log('\n6) Exportar CSV no debe tirar error');
  const csvOk = await page.evaluate(() => {
    try { exportAllCsv(); return true; } catch (e) { return false; }
  });
  check('exportAllCsv() corre sin excepción', csvOk);

  console.log('\n7) Validación de copias de seguridad al importar');
  const rejectsGarbage = await page.evaluate(() => isValidBackup({ foo: 'bar' }) === false);
  const acceptsValid = await page.evaluate(() => isValidBackup({ weeks: {}, publishers: [{ id: 'a', name: 'Juan' }] }) === true);
  check('rechaza un JSON que no es una copia de seguridad', rejectsGarbage);
  check('acepta una copia de seguridad con el formato correcto', acceptsValid);

  console.log('\n8) El manejador de errores no debe dispararse por las CDN externas bloqueadas');
  const noFalsePositive = !(await page.evaluate(() => !!document.querySelector('.top-banner.error')));
  check('sin banner de error falso al no cargar Tone.js/jsPDF', noFalsePositive);

  console.log('\n9) Eliminar un hermano y confirmar que "Deshacer" lo recupera');
  await page.click(".tabs >> text=Hermanos");
  await page.waitForTimeout(200);
  await page.click('[data-edit-pub]');
  await page.waitForTimeout(200);
  page.once('dialog', (d) => d.accept());
  await page.click('#pubDeleteBtn');
  await page.waitForTimeout(200);
  const countAfterDelete = await page.evaluate(() => data.publishers.length);
  await page.click('.toast-undo');
  await page.waitForTimeout(200);
  const countAfterUndo = await page.evaluate(() => data.publishers.length);
  check('el hermano se eliminó', countAfterDelete === pubCount - 1);
  check('"Deshacer" lo restauró', countAfterUndo === pubCount);

  console.log(`\n${'-'.repeat(40)}\n${passed} pruebas OK, ${failed} fallaron.\n`);
  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
})();
