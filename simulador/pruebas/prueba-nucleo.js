// Pruebas del núcleo del simulador con Node: arma la computadora automáticamente, revisa el armado,
// carga los 12 programas con los interruptores y compara el resultado con el de Logisim.
// Uso: node simulador/pruebas/prueba-nucleo.js
'use strict';
const path = require('path');
const dir = path.join(__dirname, '..', 'js', 'nucleo');
for (const f of ['base', 'geometria', 'chips', 'piezas', 'datos', 'diseno', 'motor', 'verificador', 'autoarmado', 'programas']) require(path.join(dir, `${f}.js`));
const S = globalThis.SIM8;

let fallos = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${msg}`); if (!cond) fallos++; };

// 1. Armado automático paso a paso: cada paso armado debe quedar completo y sin cortos.
for (let hasta = 1; hasta <= 8; hasta++) {
  const doc = S.autoArmar(hasta);
  const m = new S.Motor(doc);
  const v = S.verificar(doc, m);
  const pasos = v.pasos.filter(p => p.n <= hasta);
  const incompletos = pasos.filter(p => !p.completo).map(p => {
    const r = p.revisiones.filter(x => x.st !== 'ok' && x.def.tipo !== 'desacople').map(x => x.msg);
    const roles = p.roles.filter(x => !x.id || x.cuenta.ok + x.cuenta.pendiente < x.pines).map(x => `${x.nombre} ${JSON.stringify(x.cuenta)}`);
    return `paso ${p.n}: ${p.hechos}/${p.total} ${roles.concat(r).slice(0, 4).join(' | ')}`;
  });
  ok(!incompletos.length && !v.cortos.length && !v.entradasLibres.length,
    `Solución hasta el paso ${hasta}: ${doc.boards.length} protoboards, ${doc.parts.length} piezas, ${doc.wires.length} cables` +
    (incompletos.length ? ` | ${incompletos.join(' || ')}` : '') + (v.cortos.length ? ` | cortos: ${v.cortos.map(c => c.senales.join('+')).join(', ')}` : '') +
    (v.entradasLibres.length ? ` | entradas libres: ${v.entradasLibres.length}` : '') + (v.temporales.length ? ` | cables temporales: ${v.temporales.map(t => t.join('-')).join(', ')}` : ''));
}

// 2. Computadora completa: sin errores eléctricos.
const doc = S.autoArmar(8);
const motor = new S.Motor(doc, { semilla: 7 });
const diag = motor.diagnostico().filter(d => d.nivel !== 'info');
ok(diag.length === 0, `Computadora completa sin avisos eléctricos${diag.length ? ': ' + diag.slice(0, 5).map(d => d.texto).join(' | ') : ''}`);
const c555 = motor.comps.find(c => c.def.reloj);
ok(c555 && c555.tiempos.ok, `NE555: ${c555 && c555.tiempos.msg} (R1=${c555 && S.ohm(c555.tiempos.R1)}, R2=${c555 && S.ohm(c555.tiempos.R2)}, C=${c555 && S.faradio(c555.tiempos.C)})`);
console.log(`     Consumo estimado: ${motor.corriente().toFixed(2)} A`);

function correr(acciones) {
  for (const a of acciones) { const s = S.ejecutarAccion(doc, motor, a); motor.avanzar(s || 0.001); }
}
const pot = doc.parts.find(p => p.rol === '2:POT');
const auto = doc.parts.find(p => p.rol === '2:AUTO');

function ejecutarPrograma(nombre, prog, modo) {
  auto.props.pos = 0; motor.enlazar();
  correr(S.accionesProgramar(prog.words));
  const mem = S.leerCPU(doc, motor).memoria;
  const memOk = mem.every((w, i) => w === prog.words[i]);
  if (modo === 'auto') {
    pot.props.pos = 0.1; motor.enlazar();
    correr([{ tipo: 'slide', rol: '2:PROG', pos: 0 }]);
    auto.props.pos = 1; motor.enlazar();
    motor.avanzar(3);
  } else {
    correr([{ tipo: 'slide', rol: '2:PROG', pos: 0 }]);
    for (let i = 0; i < 60; i++) correr([{ tipo: 'pulsar', rol: '2:PASO', abajo: true }, { tipo: 'esperar', s: 0.02 }, { tipo: 'pulsar', rol: '2:PASO', abajo: false }, { tipo: 'esperar', s: 0.02 }]);
  }
  const cpu = S.leerCPU(doc, motor);
  const malos = Object.entries(prog.expect).filter(([k, v]) => v !== null && cpu[k] !== v).map(([k, v]) => `${k} esperado ${S.hex(v)} obtenido ${S.hex(cpu[k])}`);
  ok(memOk && !malos.length, `${nombre} (${modo}): OUT=${S.hex(cpu.OUT)} A=${S.hex(cpu.A)} B=${S.hex(cpu.B)} PC=${cpu.PC} FLAGS=${S.bin(cpu.FLAGS, 4)} HALTED=${cpu.HALTED}` +
    (memOk ? '' : ` | memoria ${mem.map(x => S.hex(x)).join(' ')}`) + (malos.length ? ` | ${malos.join('; ')}` : ''));
}
const t0 = Date.now();
for (const [nombre, prog] of Object.entries(S.PROGRAMAS)) ejecutarPrograma(nombre, prog, 'auto');
ejecutarPrograma('P1_SUMA', S.PROGRAMAS.P1_SUMA, 'paso a paso con rebotes');
console.log(`     Tiempo de las 13 ejecuciones: ${((Date.now() - t0) / 1000).toFixed(1)} s`);

// 3. El verificador detecta errores de armado.
{
  const d = S.autoArmar(8);
  const m = new S.Motor(d);
  const v0 = S.verificar(d, m);
  const p161 = d.parts.find(p => p.rol === '3:74LS161 PC');
  const clave = S.huella(p161).find(h => h.pin === 2).clave;
  const tira = S.geo.tira(S.geo.leerClave(clave).fila, S.geo.leerClave(clave).col);
  const enTira = w => [w.a, w.b].some(k => { const x = S.geo.leerClave(k); return x && x.agujero && x.tablero === p161.at.board && S.geo.tira(x.fila, x.col) === tira; });
  d.wires = d.wires.filter(w => !enTira(w));
  m.construir();
  const v1 = S.verificar(d, m);
  ok(v0.faltan.length === 0 && v1.faltan.some(f => f.sig === 'SYSCLK'), `Detecta un cable que falta (CLK del PC): ${v1.faltan.length} conexión(es) por hacer`);
  const pA = d.parts.find(p => p.rol === '4:74LS377 A'), pB = d.parts.find(p => p.rol === '4:74LS377 B');
  const ka = S.huella(pA).find(h => h.pin === 2).clave, kb = S.huella(pB).find(h => h.pin === 2).clave;
  const libre = k => { const x = S.geo.leerClave(k); const occ = S.ocupacion(d); return ['a', 'b', 'c', 'd'].map(f => S.geo.clave(x.tablero, f, x.col)).concat(['j', 'i', 'h', 'g'].map(f => S.geo.clave(x.tablero, f, x.col))).find(z => S.geo.tira(S.geo.leerClave(z).fila, x.col) === S.geo.tira(x.fila, x.col) && !occ.has(z)); };
  d.wires.push({ id: 'wx', a: libre(ka), b: libre(kb), color: '#f00' });
  m.construir();
  const v2 = S.verificar(d, m);
  ok(v2.cortos.some(c => c.senales.includes('A0') && c.senales.includes('B0')), 'Detecta un corto entre A0 y B0');
  const cA = m.comp(pA.id), cB = m.comp(pB.id);
  cA.st.q = 0x01; cB.st.q = 0x00; m.sucios.add(cA); m.sucios.add(cB); m.asentar();
  const conflicto = m.diagnostico().some(x => x.nivel === 'error' && x.texto.startsWith('Conflicto'));
  ok(conflicto, 'El motor marca conflicto eléctrico cuando A0 y B0 tienen valores distintos');
}
// 4. Chip con la alimentación invertida se quema.
{
  const d = S.docInicial();
  d.parts[0].props.on = true;
  const f = d.parts[0].id;
  // Chip girado 180°: el pin 7 (GND) queda arriba a la izquierda y el 14 (VCC) abajo a la derecha.
  // Se cablea como si no estuviera girado: arriba a la izquierda a +5 V y abajo a la derecha a GND.
  d.parts.push({ id: 'pc', type: '7400', at: { board: 'b1', col: 10, flip: true }, props: {} });
  d.wires.push({ id: 'w1', a: `${f}:+`, b: 'b1/T+3' }, { id: 'w2', a: `${f}:-`, b: 'b1/T-3' });
  d.wires.push({ id: 'w3', a: 'b1/a10', b: 'b1/T+4' }, { id: 'w4', a: 'b1/j16', b: 'b1/B-5' }, { id: 'w5', a: 'b1/T+5', b: 'b1/B+3' }, { id: 'w6', a: 'b1/T-5', b: 'b1/B-3' });
  const m = new S.Motor(d);
  ok(!!m.estado('pc').quemado, `Chip girado al revés se quema: ${m.estado('pc').quemado}`);
}
// 5. El latch antirrebote: sin latch, un pulsador que rebota da varios pulsos.
{
  const d = S.docInicial();
  d.parts[0].props.on = true;
  const f = d.parts[0].id;
  d.wires.push({ id: 'w1', a: `${f}:+`, b: 'b1/T+3' }, { id: 'w2', a: `${f}:-`, b: 'b1/T-3' }, { id: 'w5', a: 'b1/T+4', b: 'b1/B+3' }, { id: 'w6', a: 'b1/T-4', b: 'b1/B-3' });
  // 74LS161 contando con el reloj directo del pulsador de 2 patas (pull-up 10k, el botón lleva a GND).
  d.parts.push({ id: 'cnt', type: '74161', at: { board: 'b1', col: 10, flip: false }, props: {} });
  d.wires.push({ id: 'v', a: 'b1/a10', b: 'b1/T+5' }, { id: 'g', a: 'b1/j17', b: 'b1/B-5' });
  // /CLR (pin 1), ENP (pin 7), ENT (pin 10) y /LOAD (pin 9) a +5 V.
  d.wires.push({ id: 'clr', a: 'b1/j10', b: 'b1/B+4' }, { id: 'enp', a: 'b1/i16', b: 'b1/B+5' }, { id: 'ent', a: 'b1/b16', b: 'b1/T+6' }, { id: 'ld', a: 'b1/b17', b: 'b1/T+7' });
  d.parts.push({ id: 'btn', type: 'btn2', at: { board: 'b1', row: 'h', col: 30, flip: false }, props: {} });
  d.wires.push({ id: 'bg', a: 'b1/j31', b: 'b1/B-6' }, { id: 'clk', a: 'b1/g30', b: 'b1/i11' });
  d.parts.push({ id: 'pu', type: 'res', leads: { 1: 'b1/i30', 2: 'b1/B+7' }, props: { valor: 10000 } });
  const m = new S.Motor(d, { semilla: 3 });
  const c = m.comp('cnt');
  const antes = c.st.q;
  for (let i = 0; i < 5; i++) { m.pulsar('btn', true); m.avanzar(0.05); m.pulsar('btn', false); m.avanzar(0.05); }
  const pulsos = (c.st.q - antes + 16) % 16;
  ok(pulsos > 5, `Sin antirrebote, 5 pulsaciones cuentan ${pulsos} pulsos (rebote simulado)`);
}

// 6. Orden de cableado del modo «Cable por cable».
{
  const ref = S.autoArmar(8);
  const porId = new Map(ref.wires.map(w => [w.id, w]));
  const cables = ref.ordenCables.map(id => porId.get(id));
  ok(ref.ordenCables.length === ref.wires.length && new Set(ref.ordenCables).size === ref.wires.length && cables.every(Boolean),
    `Orden de cableado: ${ref.ordenCables.length} cables, cada uno una sola vez (con el paso de las piezas son ${ref.ordenCables.length + 1} pasos)`);
  ok(ref.wires.every(w => w.paso >= 1 && w.paso <= 7 && w.sig && ['fuente', 'riel', 'alim', 'senal'].includes(w.tipo)), 'Cada cable trae módulo, señal y tipo');
  ok(cables.every((w, i) => i === 0 || cables[i - 1].paso <= w.paso), 'El orden va por módulo del plan, de menor a mayor');
  const cuenta = {};
  for (const w of cables) cuenta[w.paso] = (cuenta[w.paso] || 0) + 1;
  console.log('     Cables por módulo:', Object.entries(cuenta).map(([k, v]) => `paso ${k}: ${v}`).join(' · '));
  ok(cables.slice(0, 2).every(w => w.tipo === 'fuente'), 'Los dos primeros cables salen de la fuente');
  let completo = true, detalle = '';
  for (let N = 2; N <= 7; N++) {
    const d = JSON.parse(JSON.stringify(ref));
    d.wires = cables.filter(w => w.paso <= N);
    const m = new S.Motor(d, { semilla: 5 });
    const chips = d.parts.filter(q => q.rol && S.CHIPS[q.type] && S.diseno.roles.get(q.rol).paso <= N);
    const sinV = chips.filter(q => !m.comp(q.id).alimentado);
    const v = S.verificar(d, m);
    if (sinV.length || v.cortos.length) { completo = false; detalle += ` paso ${N}: ${sinV.length} sin alimentar, ${v.cortos.length} cortos;`; }
    if (N === 2) { const c555 = m.comps.find(c => c.def.reloj); if (!c555 || !c555.tiempos.ok) { completo = false; detalle += ' el 555 no oscila tras el paso 2;'; } }
  }
  ok(completo, `Al terminar cada módulo (2 a 7), sus chips y los anteriores están alimentados y no hay cortos${detalle}`);
}

console.log(fallos ? `\n${fallos} prueba(s) fallaron` : '\nTodas las pruebas pasan');
process.exitCode = fallos ? 1 : 0;
