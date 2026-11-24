// Prueba de la interfaz en un navegador real sin ventana (Brave o Chrome) usando el protocolo de depuración.
// Abre index.html, hace clics como un usuario, carga la computadora completa, ejecuta el programa 1 y guarda capturas.
// Uso: node simulador/pruebas/prueba-navegador.mjs [ruta-del-navegador]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const salida = path.join(raiz, 'pruebas', 'capturas');
fs.mkdirSync(salida, { recursive: true });
const nav = process.argv[2] || ['/usr/bin/brave-browser', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(p => fs.existsSync(p));
const puerto = 9333 + Math.floor(Math.random() * 500);
const perfil = fs.mkdtempSync('/tmp/sim8-nav-');
const proc = spawn(nav, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--remote-debugging-port=${puerto}`, `--user-data-dir=${perfil}`, '--window-size=1680,1000', 'about:blank'], { stdio: 'ignore', detached: true });
// Al terminar se cierra todo el grupo de procesos (el navegador deja procesos hijos).
const cerrarNavegador = () => { try { process.kill(-proc.pid, 'SIGKILL'); } catch (e) { /* ya cerrado */ } };
process.on('exit', cerrarNavegador);
const dormir = ms => new Promise(r => setTimeout(r, ms));

let fallos = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fallos++; };

async function conectar() {
  for (let i = 0; i < 60; i++) {
    try {
      const lista = await (await fetch(`http://127.0.0.1:${puerto}/json/list`)).json();
      const pag = lista.find(t => t.type === 'page');
      if (pag) return pag.webSocketDebuggerUrl;
    } catch (e) { /* aún no arranca */ }
    await dormir(250);
  }
  throw new Error('El navegador no respondió');
}
const ws = new WebSocket(await conectar());
await new Promise(r => ws.addEventListener('open', r));
let id = 0;
const pend = new Map();
const errores = [];
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') errores.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errores.push(m.params.args.map(a => a.value ?? a.description).join(' '));
});
const cdp = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluar = async expr => {
  const r = await cdp('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
  return r.result.result.value;
};
const captura = async nombre => {
  const r = await cdp('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(salida, nombre), Buffer.from(r.result.data, 'base64'));
  console.log(`     captura: pruebas/capturas/${nombre}`);
};
const clic = async (x, y, opciones = {}) => {
  await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1, modifiers: opciones.mod || 0 });
  if (opciones.mantener) await dormir(opciones.mantener);
  await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1, modifiers: opciones.mod || 0 });
  await dormir(60);
};
// Coordenadas de pantalla de un punto del mundo.
const enPantalla = async (wx, wy) => evaluar(`(() => { const r = app.cv.getBoundingClientRect(); return { x: r.left + (${wx} - app.cam.x) * app.cam.z, y: r.top + (${wy} - app.cam.y) * app.cam.z }; })()`);
const itemPaleta = async tipo => evaluar(`(() => { const b = document.querySelector('#paleta .item[data-tipo="${tipo}"]'); b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); return { x: r.left + 20, y: r.top + r.height / 2 }; })()`);
const agujero = async (tablero, fila, col) => {
  const p = await evaluar(`(() => { const b = SIM8.tablero(app.doc, '${tablero}'); return { x: b.x + SIM8.geo.colX(${col}), y: b.y + SIM8.geo.FILA_Y['${fila}'] }; })()`);
  return enPantalla(p.x, p.y);
};

try {
  await cdp('Page.enable'); await cdp('Runtime.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1000, deviceScaleFactor: 1, mobile: false });
  await cdp('Page.navigate', { url: 'file://' + path.join(raiz, 'index.html') });
  await dormir(1500);
  ok(await evaluar('typeof app === "object" && app.doc.boards.length === 1'), 'La página carga con una protoboard y la fuente');
  await evaluar('window.confirm = () => true; app.cam = { x: -320, y: -60, z: 1.6 }; app.sucio = true;');
  await dormir(200);
  await captura('1-inicio.png');

  // Paso 1 con el ratón: encender la fuente y tirar dos cables de la fuente a los rieles.
  await evaluar(`app.encuadrar(-260, -20, 420, 230, 3)`);
  await dormir(150);
  const f = await evaluar(`(() => { const p = app.doc.parts.find(x => x.type === 'fuente'); return p.pos; })()`);
  const boton = await enPantalla(f.x + 16, f.y + 96);
  await clic(boton.x, boton.y);
  ok(await evaluar(`app.doc.parts.find(x => x.type === 'fuente').props.on === true`), 'Clic en el botón de la fuente la enciende');
  await evaluar(`app.cambiarHerramienta('cable')`);
  const mas = await enPantalla(f.x + 130, f.y + 96), menos = await enPantalla(f.x + 160, f.y + 96);
  await clic(mas.x, mas.y); await clic(...Object.values(await agujero('b1', 'T+', 3)));
  await clic(menos.x, menos.y); await clic(...Object.values(await agujero('b1', 'T-', 3)));
  await evaluar(`app.colorCable = '#d9312b'`);
  await clic(...Object.values(await agujero('b1', 'T+', 4))); await clic(...Object.values(await agujero('b1', 'B+', 4)));
  await clic(...Object.values(await agujero('b1', 'T-', 5))); await clic(...Object.values(await agujero('b1', 'B-', 5)));
  ok(await evaluar('app.doc.wires.length') === 4, 'Se tiran 4 cables con la herramienta Cable');
  ok(await evaluar(`app.verif.pasos[0].completo`), 'La guía marca el paso 1 como completo');

  // Colocar un 74LS00 desde la paleta y revisar que se alimenta al cablear VCC y GND.
  await evaluar(`app.cambiarHerramienta('seleccionar')`);
  const item = await itemPaleta('7400');
  await clic(item.x, item.y);
  const destino = await enPantalla(SIMX(13), 105);
  function SIMX(c) { return 25 + (c - 1) * 10; }
  await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: destino.x, y: destino.y });
  await dormir(80);
  await clic(destino.x, destino.y);
  const chip = await evaluar(`(() => { const p = app.doc.parts.find(x => x.type === '7400'); return p ? p.at : null; })()`);
  ok(!!chip, `Se coloca un 74LS00 con el ratón ${chip ? `(columnas ${chip.col} a ${chip.col + 6})` : ''}`);
  await evaluar(`app.cambiarHerramienta('cable'); app.colorCable = '#d9312b'`);
  await clic(...Object.values(await agujero('b1', 'a', chip.col))); await clic(...Object.values(await agujero('b1', 'T+', 9)));
  await evaluar(`app.colorCable = '#1e1e1e'`);
  await clic(...Object.values(await agujero('b1', 'j', chip.col + 6))); await clic(...Object.values(await agujero('b1', 'B-', 21)));
  ok(await evaluar(`(() => { const p = app.doc.parts.find(x => x.type === '7400'); return app.motor.comp(p.id).alimentado; })()`), 'El 74LS00 queda alimentado tras cablear VCC (pin 14) y GND (pin 7)');
  await evaluar(`app.cambiarHerramienta('seleccionar'); app.sel = { tipo: 'pieza', id: app.doc.parts.find(x => x.type === '7400').id }; app.paneles.mostrar('props'); app.encuadrar(-260, -20, 420, 230, 3);`);
  await dormir(300);
  await captura('2-paso1-y-chip.png');
  await evaluar('app.deshacer()');
  ok(await evaluar('app.doc.wires.length') === 5, 'Deshacer quita el último cable');

  // Interacción con el ratón: guía, arrastre, LED, resistencia, DIP, potenciómetro, pulsador, punta y borrar.
  await evaluar(`app.encuadrar(-260, -20, 680, 230, 3); app.pasoGuia = 3; app.paneles.mostrar('guia');`);
  await dormir(200);
  const bColocar = await evaluar(`(() => { const b = document.querySelector('[data-colocar="3:74LS161 PC"]'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  ok(!!bColocar, 'La guía del paso 3 ofrece «Colocar» para el 74LS161 PC');
  await clic(bColocar.x, bColocar.y);
  let d = await enPantalla(25 + 33 * 10, 105);
  await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: d.x, y: d.y }); await dormir(60);
  await clic(d.x, d.y);
  const pc = await evaluar(`(() => { const p = app.doc.parts.find(x => x.rol === '3:74LS161 PC'); return p ? { id: p.id, col: p.at.col } : null; })()`);
  ok(!!pc, `«Colocar» pone el 74LS161 con su función asignada (columna ${pc && pc.col})`);
  // Arrastrar el chip 5 columnas a la derecha.
  const c0 = await evaluar(`(() => { const c = SIM8.UI.caja(app.doc, app.doc.parts.find(x => x.id === '${pc.id}')); return { x: c.x + c.w / 2, y: c.y + c.h / 2 }; })()`);
  const a0 = await enPantalla(c0.x, c0.y), a1 = await enPantalla(c0.x + 50, c0.y);
  await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: a0.x, y: a0.y });
  await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: a0.x, y: a0.y, button: 'left', clickCount: 1 });
  for (let k = 1; k <= 6; k++) { await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: a0.x + (a1.x - a0.x) * k / 6, y: a0.y, buttons: 1 }); await dormir(20); }
  await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: a1.x, y: a1.y, button: 'left', clickCount: 1 });
  await dormir(80);
  const col2 = await evaluar(`app.doc.parts.find(x => x.id === '${pc.id}').at.col`);
  ok(col2 === pc.col + 5, `Arrastrar el chip lo mueve de la columna ${pc.col} a la ${col2}`);
  // LED: ánodo en b55, cátodo en b56. Resistencia de 330 Ω de c56 al riel − de arriba (columna 57).
  const pLed = await itemPaleta('led');
  await clic(pLed.x, pLed.y);
  await clic(...Object.values(await agujero('b1', 'b', 55))); await clic(...Object.values(await agujero('b1', 'b', 56)));
  const led = await evaluar(`(() => { const p = app.doc.parts.find(x => x.type === 'led'); return p ? p.leads : null; })()`);
  ok(led && led.a === 'b1/b55' && led.k === 'b1/b56', `LED colocado con dos clics: ánodo ${led && led.a}, cátodo ${led && led.k}`);
  const pRes = await itemPaleta('res');
  await clic(pRes.x, pRes.y);
  await clic(...Object.values(await agujero('b1', 'c', 56))); await clic(...Object.values(await agujero('b1', 'T-', 57)));
  ok(await evaluar(`app.doc.parts.some(x => x.type === 'res' && x.props.valor === 330)`), 'Resistencia de 330 Ω colocada con dos clics');
  // Cable del ánodo del LED a QA (pin 14) del contador; alimentar el contador.
  const colQA = col2 + 2, colVCC = col2, colGND = col2 + 7;
  await evaluar(`app.cambiarHerramienta('cable'); app.colorCable = '#3fae4a'`);
  await clic(...Object.values(await agujero('b1', 'a', 55))); await clic(...Object.values(await agujero('b1', 'a', colQA)));
  await evaluar(`app.colorCable = '#d9312b'`);
  await clic(...Object.values(await agujero('b1', 'a', colVCC))); await clic(...Object.values(await agujero('b1', 'T+', 33 + (colVCC >= 33 ? 6 : 0))));
  await evaluar(`app.colorCable = '#1e1e1e'`);
  await clic(...Object.values(await agujero('b1', 'j', colGND))); await clic(...Object.values(await agujero('b1', 'B-', 45)));
  const est = await evaluar(`(() => { const c = app.motor.comp('${pc.id}'); const l = app.motor.leds[0]; return { alim: c.alimentado, qa: c.st ? c.st.q & 1 : null, led: app.motor.estadoLed(l).on }; })()`);
  ok(est.alim && (est.qa === 1) === est.led, `El LED sigue a QA del contador (QA = ${est.qa}, LED ${est.led ? 'encendido' : 'apagado'})`);
  // DIP switch: colocar y hacer clic en el interruptor 1.
  await evaluar(`app.cambiarHerramienta('seleccionar')`);
  const pDip = await itemPaleta('dip8');
  await clic(pDip.x, pDip.y);
  d = await enPantalla(25 + 23 * 10, 105);
  await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: d.x, y: d.y }); await dormir(60);
  await clic(d.x, d.y);
  const dip = await evaluar(`(() => { const p = app.doc.parts.find(x => x.type === 'dip8'); return p ? { id: p.id, col: p.at.col } : null; })()`);
  ok(!!dip, `DIP switch colocado (columnas ${dip && dip.col} a ${dip && dip.col + 7})`);
  const lev = await enPantalla(25 + (dip.col - 1) * 10, 105);
  await clic(lev.x, lev.y);
  ok(await evaluar(`app.doc.parts.find(x => x.id === '${dip.id}').props.sw[0] === true`), 'Clic en el interruptor 1 del DIP lo pone en ON');
  // Potenciómetro con la rueda del ratón.
  const pPot = await itemPaleta('pot');
  await clic(pPot.x, pPot.y);
  d = await enPantalla(25 + 5 * 10, 160);
  await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: d.x, y: d.y }); await dormir(60);
  await clic(d.x, d.y);
  const pot = await evaluar(`(() => { const p = app.doc.parts.find(x => x.type === 'pot'); if (!p) return null; const c = SIM8.UI.caja(app.doc, p); return { id: p.id, pos: p.props.pos, x: c.x + c.w / 2, y: c.y + c.h / 2 - 2 }; })()`);
  const kp = await enPantalla(pot.x, pot.y);
  await cdp('Input.dispatchMouseEvent', { type: 'mouseWheel', x: kp.x, y: kp.y, deltaX: 0, deltaY: 100 });
  await dormir(80);
  const pos2 = await evaluar(`app.doc.parts.find(x => x.id === '${pot.id}').props.pos`);
  ok(pos2 < pot.pos, `La rueda sobre la perilla gira el potenciómetro (${pot.pos} → ${pos2})`);
  // Pulsador: se mantiene presionado mientras el botón del ratón está abajo.
  const pBtn = await itemPaleta('btn2');
  await clic(pBtn.x, pBtn.y);
  d = await enPantalla(25 + 20 * 10, 160);
  await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: d.x, y: d.y }); await dormir(60);
  await clic(d.x, d.y);
  const btn = await evaluar(`(() => { const p = app.doc.parts.find(x => x.type === 'btn2'); const c = SIM8.UI.caja(app.doc, p); return { id: p.id, x: c.x + c.w / 2, y: c.y + c.h / 2 }; })()`);
  const kb = await enPantalla(btn.x, btn.y);
  await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: kb.x, y: kb.y });
  await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: kb.x, y: kb.y, button: 'left', clickCount: 1 });
  await dormir(150);
  const durante = await evaluar(`app.motor.rt.get('${btn.id}').presionado && app.motor.rt.get('${btn.id}').c === 1`);
  await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: kb.x, y: kb.y, button: 'left', clickCount: 1 });
  await dormir(150);
  const despues = await evaluar(`app.motor.rt.get('${btn.id}').c === 0`);
  ok(durante && despues, 'El pulsador cierra el contacto mientras se mantiene y lo abre al soltar');
  // Punta lógica en el riel +.
  await evaluar(`app.cambiarHerramienta('punta')`);
  await clic(...Object.values(await agujero('b1', 'T+', 15)));
  ok(await evaluar(`app.redFijada >= 0 && app.motor.valorRed(app.redFijada) === SIM8.V.H`), 'La punta lógica mide 5 V en el riel +');
  await dormir(150);
  const est2 = await evaluar(`(() => { const c = app.motor.comp('${pc.id}'); const l = app.motor.leds[0]; return { alim: c.alimentado, q: c.st ? c.st.q : null, led: app.motor.estadoLed(l).on, clk: app.motor.valorRed(app.motor.redDePin('${pc.id}', 2)), clr: app.motor.valorRed(app.motor.redDePin('${pc.id}', 1)) }; })()`);
  ok((est2.q & 1) === (est2.led ? 1 : 0), `El LED sigue a QA después de usar las demás piezas (${JSON.stringify(est2)})`);
  await captura('2b-interaccion.png');
  // Borrar el LED con la herramienta Borrar.
  await evaluar(`app.cambiarHerramienta('borrar')`);
  const cl = await evaluar(`(() => { const p = app.doc.parts.find(x => x.type === 'led'); const c = SIM8.UI.caja(app.doc, p); return { x: c.cx, y: c.cy }; })()`);
  const kl = await enPantalla(cl.x, cl.y);
  await clic(kl.x, kl.y);
  ok(await evaluar(`!app.doc.parts.some(x => x.type === 'led')`), 'La herramienta Borrar quita el LED');
  // Recargar la página: el armado se conserva.
  await dormir(700);
  const antes = await evaluar(`JSON.stringify({ p: app.doc.parts.length, w: app.doc.wires.length })`);
  await cdp('Page.reload');
  await dormir(1500);
  await evaluar('window.confirm = () => true');
  const despuesRec = await evaluar(`JSON.stringify({ p: app.doc.parts.length, w: app.doc.wires.length })`);
  ok(antes === despuesRec, `Al recargar la página el armado se conserva (${despuesRec})`);
  await evaluar(`app.cambiarHerramienta('seleccionar')`);

  // Solución del paso 2 con un cable quitado: la guía debe señalar la conexión que falta.
  await evaluar(`app.cargarSolucion(2); app.pasoGuia = 2; app.paneles.mostrar('guia');`);
  await dormir(300);
  const quitado = await evaluar(`(() => {
    const p = app.doc.parts.find(x => x.rol === '2:74LS74 bandera HLT');
    const k = SIM8.huella(p).find(h => h.pin === 3).clave, x = SIM8.geo.leerClave(k), tira = SIM8.geo.tira(x.fila, x.col);
    const w = app.doc.wires.find(w => [w.a, w.b].some(c => { const y = SIM8.geo.leerClave(c); return y && y.agujero && y.tablero === x.tablero && SIM8.geo.tira(y.fila, y.col) === tira; }));
    app.editar(doc => { doc.wires = doc.wires.filter(z => z.id !== w.id); });
    app.paneles.actualizar();
    const r = app.verif.pasos[1];
    const b = SIM8.tablero(app.doc, 'b1');
    app.encuadrar(b.x, b.y - 30, b.x + 670, b.y + 210, 3);
    return { faltan: r.faltan.map(f => f.sig), completo: r.completo };
  })()`);
  ok(!quitado.completo && quitado.faltan.includes('nCLKsrc'), `Al quitar un cable, la guía del paso 2 lo marca como pendiente (${quitado.faltan.join(', ')})`);
  await dormir(300);
  await captura('2c-paso2-falta-un-cable.png');

  // Computadora completa.
  await evaluar(`app.cargarSolucion(8)`);
  await dormir(500);
  const n = await evaluar(`({ tableros: app.doc.boards.length, piezas: app.doc.parts.length, cables: app.doc.wires.length, completo: app.verif.pasos.every(p => p.completo) })`);
  ok(n.completo, `Solución completa cargada: ${n.tableros} protoboards, ${n.piezas} piezas, ${n.cables} cables, todos los pasos completos`);
  await evaluar(`app.paneles.mostrar('guia'); app.pasoGuia = 8; app.paneles.actualizar();`);
  await dormir(400);
  await captura('3-computadora-completa.png');

  // Programa 1 cargado con los interruptores y ejecutado.
  await evaluar(`app.programar('P1_SUMA')`);
  for (let i = 0; i < 40 && await evaluar('!!app.acciones'); i++) await dormir(250);
  const mem = await evaluar(`SIM8.leerCPU(app.doc, app.motor).memoria`);
  ok(JSON.stringify(mem) === JSON.stringify([0x86, 0x97, 0, 0xd0, 0xe0, 0, 5, 3]), `Memoria programada con los interruptores: ${mem.map(x => (x ?? 0).toString(16).padStart(2, '0')).join(' ')}`);
  await evaluar(`app.doc.parts.find(p => p.rol === '2:POT').props.pos = 0.1; app.motor.enlazar(); app.ejecutar()`);
  for (let i = 0; i < 40 && !(await evaluar('SIM8.leerCPU(app.doc, app.motor).HALTED === 1')); i++) await dormir(250);
  const cpu = await evaluar(`SIM8.leerCPU(app.doc, app.motor)`);
  ok(cpu.OUT === 8 && cpu.HALTED === 1, `Programa 1 en la interfaz: OUT = ${cpu.OUT}, HALTED = ${cpu.HALTED}`);
  const leds = await evaluar(`(() => { const m = app.motor; const sig = SIM8.diseno; const out = []; for (const l of m.leds) { const s = m.estadoLed(l); out.push(s.on ? 1 : 0); } return out.reduce((a, b) => a + b, 0); })()`);
  console.log(`     LEDs encendidos: ${leds}`);
  await dormir(300);
  await captura('4-programa1-terminado.png');
  // Acercamiento al registro OUT.
  await evaluar(`(() => { const p = app.doc.parts.find(x => x.rol === '4:74LS377 OUT'); const c = SIM8.UI.caja(app.doc, p); app.centrarEn(c.x + 120, c.y + 30, 2.6); app.sel = { tipo: 'pieza', id: p.id }; app.paneles.mostrar('props'); })()`);
  await dormir(400);
  await captura('5-registro-out.png');
  // Punta lógica sobre un agujero del bus.
  await evaluar(`app.cambiarHerramienta('punta')`);
  const pAg = await evaluar(`(() => { const p = app.doc.parts.find(x => x.rol === '2:NE555'); const c = SIM8.UI.caja(app.doc, p); app.centrarEn(c.x + 40, c.y, 2.4); return { x: c.x, y: c.y }; })()`);
  await dormir(200);
  const s555 = await enPantalla(pAg.x + 6, pAg.y - 4);
  await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: s555.x, y: s555.y });
  await dormir(300);
  await captura('6-reloj-555.png');
  // Rótulos de las protoboards: nombre con el módulo, secciones y mapa en la guía.
  const rot = await evaluar(`(() => {
    const nombres = app.doc.boards.map(b => b.nombre);
    const mapa = document.querySelector('details.mapa');
    const b4 = app.doc.boards[3]; app.irATablero(b4.id);
    return { nombres, filas: mapa ? mapa.querySelectorAll('li').length : 0, secciones: app.doc.secciones.length };
  })()`);
  ok(rot.nombres.every(n => / · /.test(n)) && rot.filas === rot.nombres.length && rot.secciones > 12, `Cada protoboard dice qué módulo lleva (${rot.nombres[0]} … ${rot.nombres[11]}) y el mapa de la guía las lista`);
  await dormir(400);
  await captura('3b-protoboard-4-rotulada.png');

  // Página de la computadora armada: abre con todo armado y guarda aparte del armado propio.
  await dormir(600);
  const cablesPropio = await evaluar('app.doc.wires.length');
  await cdp('Page.navigate', { url: 'file://' + path.join(raiz, 'computadora-armada.html') });
  await dormir(2500);
  const arm = await evaluar(`({ hash: location.hash, tableros: app.doc.boards.length, piezas: app.doc.parts.length, cables: app.doc.wires.length, completo: app.verif.pasos.every(p => p.completo), paso: app.pasoGuia })`);
  ok(arm.hash === '#completa' && arm.tableros === 12 && arm.completo && arm.paso === 8, `computadora-armada.html abre la computadora completa (${arm.tableros} protoboards, ${arm.piezas} piezas, ${arm.cables} cables, guía en el paso ${arm.paso})`);
  await evaluar(`window.confirm = () => true; app.doc.parts.find(p => p.rol === '2:POT').props.pos = 0.1; app.motor.enlazar(); app.programar('P2_XOR')`);
  for (let i = 0; i < 40 && await evaluar('!!app.acciones'); i++) await dormir(250);
  await evaluar('app.ejecutar()');
  for (let i = 0; i < 40 && !(await evaluar('SIM8.leerCPU(app.doc, app.motor).HALTED === 1')); i++) await dormir(250);
  const cpu2 = await evaluar('SIM8.leerCPU(app.doc, app.motor)');
  ok(cpu2.OUT === 0x0a && cpu2.HALTED === 1, `En la computadora armada, 0F XOR 05 da OUT = ${(cpu2.OUT ?? 0).toString(16).toUpperCase().padStart(2, '0')}`);
  await dormir(300);
  await captura('7-computadora-armada.png');
  await evaluar(`app.editar(doc => { doc.wires.pop(); })`);
  await dormir(700);
  await cdp('Page.navigate', { url: 'file://' + path.join(raiz, 'index.html') });
  await dormir(1500);
  ok(await evaluar('app.doc.wires.length') === cablesPropio, 'Los cambios en la computadora armada no tocan el armado propio de index.html');
  await cdp('Page.navigate', { url: 'file://' + path.join(raiz, 'computadora-armada.html') });
  await dormir(2500);
  const tras = await evaluar(`({ hash: location.hash, cables: app.doc.wires.length, guardado: (JSON.parse(localStorage.getItem('sim8.protoboard.v1:completa') || 'null') || { doc: { wires: [] } }).doc.wires.length })`);
  ok(tras.hash === '#completa' && tras.cables === arm.cables - 1, `La computadora armada recuerda sus propios cambios al recargar (${JSON.stringify(tras)})`);

  const rendimiento = await evaluar(`(() => { const t0 = performance.now(); for (let i = 0; i < 20; i++) app.dib.dibujar(); return (performance.now() - t0) / 20; })()`);
  console.log(`     Tiempo de dibujo de la computadora completa: ${rendimiento.toFixed(1)} ms por cuadro`);
  ok(errores.length === 0, `Sin errores de JavaScript${errores.length ? ': ' + errores.slice(0, 3).join(' | ') : ''}`);
} catch (e) {
  console.log('FAIL', e.stack || e.message);
  fallos++;
  if (errores.length) console.log(errores.slice(0, 5).join('\n'));
} finally {
  ws.close();
  cerrarNavegador();
  await dormir(500);
  fs.rmSync(perfil, { recursive: true, force: true });
}
console.log(fallos ? `\n${fallos} prueba(s) fallaron` : '\nTodas las pruebas de la interfaz pasan');
process.exit(fallos ? 1 : 0);
