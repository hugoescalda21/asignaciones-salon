// Corre todas las pruebas del editor, una por una, y muestra el resumen.
//   node tests/editor/run.js            → todas
//   node tests/editor/run.js anuncios   → solo las que tengan "anuncios" en el nombre
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const filtro = (process.argv[2] || '').toLowerCase();
const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js') && f.toLowerCase().includes(filtro)).sort();
let total = 0, fallas = 0;
const resumen = [];
for (const f of files) {
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], { encoding: 'utf8', timeout: 5 * 60 * 1000 });
  const out = (r.stdout || '') + (r.stderr || '');
  const m = out.match(/(\d+) OK, (\d+) fallaron\s*$/);
  const ok = m ? +m[1] : 0, bad = m ? +m[2] : 1;
  total += ok + bad; fallas += bad;
  resumen.push(`${bad || !m ? '❌' : '✅'} ${f.replace('.test.js', '').padEnd(24)} ${m ? `${ok} OK, ${bad} fallaron` : 'no terminó'}`);
  if (bad || !m) console.log(`\n—— ${f} ——\n` + out.split('\n').filter(l => /❌|Error|error/.test(l)).slice(0, 15).join('\n'));
}
console.log('\n' + resumen.join('\n'));
console.log(`\n${total - fallas} de ${total} pruebas OK${fallas ? ` — ${fallas} fallaron` : ''}.`);
process.exitCode = fallas ? 1 : 0;
