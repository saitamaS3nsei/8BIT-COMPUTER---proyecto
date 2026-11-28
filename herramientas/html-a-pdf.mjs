// Convierte un HTML en PDF usando Brave o Chrome sin ventana (respeta el tamaño de página de @page).
// Uso: node herramientas/html-a-pdf.mjs entrada.html salida.pdf [ruta-del-navegador]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [entrada, salida, nav0] = process.argv.slice(2);
if (!entrada || !salida) { console.error('Uso: node herramientas/html-a-pdf.mjs entrada.html salida.pdf [navegador]'); process.exit(2); }
const nav = nav0 || ['/usr/bin/brave-browser', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(p => fs.existsSync(p));
if (!nav) { console.error('No encontré Brave, Chrome ni Chromium.'); process.exit(2); }
const puerto = 9400 + Math.floor(Math.random() * 400), perfil = fs.mkdtempSync('/tmp/sim8-nav-');
const proc = spawn(nav, ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${puerto}`, `--user-data-dir=${perfil}`, 'about:blank'], { stdio: 'ignore', detached: true });
const dormir = ms => new Promise(r => setTimeout(r, ms));
const cerrar = () => { try { process.kill(-proc.pid, 'SIGKILL'); } catch (e) { /* ya cerrado */ } };
process.on('exit', cerrar);
try {
  let url;
  for (let i = 0; i < 80 && !url; i++) {
    try { url = (await (await fetch(`http://127.0.0.1:${puerto}/json/list`)).json()).find(t => t.type === 'page')?.webSocketDebuggerUrl; } catch (e) { /* aún no arranca */ }
    await dormir(250);
  }
  if (!url) throw new Error('El navegador no respondió');
  const ws = new WebSocket(url);
  await new Promise(r => ws.addEventListener('open', r));
  let id = 0; const pend = new Map();
  ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
  const cdp = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await cdp('Page.enable');
  await cdp('Page.navigate', { url: 'file://' + path.resolve(entrada) });
  await dormir(1500);
  const r = await cdp('Page.printToPDF', { preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false });
  if (r.error) throw new Error(r.error.message);
  fs.writeFileSync(salida, Buffer.from(r.result.data, 'base64'));
  ws.close();
  console.log(`PDF escrito: ${salida} (${(fs.statSync(salida).size / 1024).toFixed(0)} KB)`);
} finally {
  cerrar();
  await dormir(300);
  fs.rmSync(perfil, { recursive: true, force: true });
}
process.exit(0);
