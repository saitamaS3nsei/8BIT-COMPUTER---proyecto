// Genera hoja_pruebas.html: lo que deben mostrar los LEDs en cada pulsación de PASO, para cada programa.
// Cada valor sale de ejecutar la computadora de referencia del simulador (la misma lista de conexiones del plan).
// Los valores que arrancan al azar (registros y banderas antes de cargarlos) se detectan ejecutando con 3 semillas:
// el bit que cambia entre ejecuciones se imprime como «?».
// Uso: node herramientas/generar-hoja-pruebas.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const f of ['base', 'geometria', 'chips', 'piezas', 'datos', 'diseno', 'motor', 'verificador', 'autoarmado', 'programas']) require(path.join(raiz, 'simulador/js/nucleo', `${f}.js`));
const S = globalThis.SIM8;

// Un bit solo se imprime como conocido si vale lo mismo arrancando con todos los registros en 0, en 1 y al azar.
const EJECUCIONES = [{ semilla: 11, forzar: 0 }, { semilla: 22, forzar: 1 }, { semilla: 33, forzar: null }];
const MAX_PULSOS = 90;
const GRUPO_PDF = ['P1_SUMA', 'P2_AND', 'P2_OR', 'P2_XOR', 'P3_JZ_SALTA', 'P3_JZ_NO_SALTA'];
const GRUPO_EXTRA = ['STA_LDA', 'JMP', 'NOT_SHL_SHR', 'OVERFLOW', 'RESTA_NEG', 'ACARREO_CERO'];

// ---------------------------------------------------------------- Lectura de los LEDs
function buscador(doc, m) {
  const idx = new Map();
  for (const p of doc.parts) {
    const R = p.rol && S.diseno.roles.get(p.rol);
    if (!R) continue;
    for (const [pin, sig] of Object.entries(R.nets)) if (!idx.has(sig)) idx.set(sig, `${p.id}#${pin}`);
  }
  return sig => {
    const nodo = m.pinNodo.get(idx.get(sig));
    const v = m.val[m.red[nodo]];
    return (v === 1 || v === 5) ? '1' : (v === 0 || v === 4) ? '0' : v === 2 ? 'z' : 'x';
  };
}
const bits = (nivel, pre, n) => Array.from({ length: n }, (_, i) => nivel(`${pre}${n - 1 - i}`));
const num = arr => arr.every(b => b === '0' || b === '1') ? parseInt(arr.join(''), 2) : null;

function forzarArranque(m, v) {
  for (const c of m.comps) {
    if (!c.alimentado || !c.st) continue;
    const t = c.def.tipo;
    if (t === '74377' || t === '74374') c.st.q = v ? 255 : 0;
    else if (t === '74161') c.st.q = v ? 15 : 0;
    else if (t === '7474') c.st.q = [v, v];
    m.sucios.add(c);
  }
  m.asentar();
}
function trazar(words, { semilla, forzar }) {
  const doc = S.autoArmar(8);
  const m = new S.Motor(doc, { semilla });
  if (forzar !== null) forzarArranque(m, forzar);
  const correr = l => { for (const a of l) { const s = S.ejecutarAccion(doc, m, a); m.avanzar(s || 0.001); } };
  doc.parts.find(p => p.rol === '2:POT').props.pos = 0.1;
  doc.parts.find(p => p.rol === '2:AUTO').props.pos = 0;
  m.enlazar();
  correr(S.accionesProgramar(words));
  correr([{ tipo: 'slide', rol: '2:PROG', pos: 0 }, { tipo: 'esperar', s: 0.05 }]);
  const nivel = buscador(doc, m);
  const leer = () => ({
    BUS: bits(nivel, 'BUS', 8), A: bits(nivel, 'A', 8), B: bits(nivel, 'B', 8), IR: bits(nivel, 'IR', 8), OUT: bits(nivel, 'OUT', 8),
    PC: bits(nivel, 'PC', 3), PH: bits(nivel, 'PH', 2), F: [nivel('Vf'), nivel('Nf'), nivel('Cf'), nivel('Zf')]
  });
  const filas = [leer()];
  let extra = 0;
  for (let k = 1; k <= MAX_PULSOS; k++) {
    correr([{ tipo: 'pulsar', rol: '2:PASO', abajo: true }, { tipo: 'esperar', s: 0.02 }, { tipo: 'pulsar', rol: '2:PASO', abajo: false }, { tipo: 'esperar', s: 0.02 }]);
    filas.push(leer());
    if (S.leerCPU(doc, m).HALTED === 1 && ++extra >= 2) break;   // un pulso para detenerse y uno más para ver que ya no cambia nada
  }
  return { filas, final: S.leerCPU(doc, m) };
}

// ---------------------------------------------------------------- Formato
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const unir = campos => campos[0].map((_, i) => campos.every(c => c[i] === campos[0][i]) ? campos[0][i] : '?');
const f8 = (b, bus) => (bus && b.every(x => x === 'z')) ? '···· ····' : [b.slice(0, 4), b.slice(4)].map(g => g.map(x => x === 'z' ? '·' : x === 'x' ? 'X' : x).join('')).join(' ');
const fN = b => b.map(x => x === 'z' ? '·' : x).join('');
const fF = b => b.join(' ');
const switches = (v, n) => { const l = []; for (let i = 0; i < n; i++) if ((v >> i) & 1) l.push(i + 1); return l.length ? l.join(', ') : 'ninguno'; };
const bin8 = v => v.toString(2).padStart(8, '0').replace(/^(\d{4})(\d{4})$/, '$1 $2');

function filasPrograma(words, traza) {
  const filas = traza[0].filas.map((_, k) => {
    const por = c => unir(traza.map(t => t.filas[k][c]));
    return { BUS: por('BUS'), A: por('A'), B: por('B'), IR: por('IR'), OUT: por('OUT'), PC: por('PC'), PH: por('PH'), F: por('F') };
  });
  let actual = 0;
  const visitadas = new Set();
  return { visitadas, filas: filas.map((r, k) => {
    const fase = num(r.PH), pc = num(r.PC);
    if (fase === 0) { actual = pc; visitadas.add(pc); }
    const texto = {
      BUS: f8(r.BUS, true), A: f8(r.A), IR: f8(r.IR), OUT: f8(r.OUT), PC: fN(r.PC), F: fF(r.F), B: f8(r.B), PH: `T${fase} · ${fN(r.PH)}`
    };
    return { k, fase, actual, orden: S.desensamblar(words[actual]), texto };
  }) };
}

// ---------------------------------------------------------------- Programas
function programa(clave, extra) {
  const prog = S.PROGRAMAS[clave];
  const traza = EJECUCIONES.map(e => trazar(prog.words, e));
  if (new Set(traza.map(t => t.filas.length)).size !== 1) throw new Error(`${clave}: las ejecuciones con distinta semilla no coinciden en número de pulsos`);
  // Comprobación: el estado final debe ser el esperado.
  const fin = traza[0].final;
  for (const [k, v] of Object.entries(prog.expect)) if (v !== null && fin[k] !== v) throw new Error(`${clave}: ${k} esperado ${v}, obtenido ${fin[k]}`);
  const { filas, visitadas } = filasPrograma(prog.words, traza);
  // Cruce con la lectura directa de los registros del simulador.
  const ult = traza[0].filas.at(-1);
  if (num(ult.OUT) !== fin.OUT || num(ult.A) !== fin.A || num(ult.PC) !== fin.PC) throw new Error(`${clave}: lo leído de los LEDs no coincide con los registros`);

  const pulsosHastaHlt = filas.findIndex(r => r.orden === 'HLT' && r.fase === 3 && r.k > 0);
  let h = `<section class="programa"><h2>${esc(prog.title)}${extra ? ' <span class="extra">extra</span>' : ''}</h2>`;
  h += `<p class="meta"><b>Resultado esperado:</b> OUT = <span class="mono">${bin8(prog.expect.OUT)}</span> (${prog.expect.OUT}) · ` +
    `V N C Z = <span class="mono">${fF(unir(traza.map(t => t.filas.at(-1).F)))}</span> · PC = <span class="mono">${fN(traza[0].filas.at(-1).PC)}</span> · el programa llega a HLT en <b>${pulsosHastaHlt} pulsos</b></p>`;
  h += '<h3>Carga previa (PROG en 1)</h3><table class="carga"><thead><tr><th>Cajón</th><th>Contenido</th><th>Qué es</th><th>DIP de dirección: subir</th><th>DIP de datos: subir</th><th>☐</th></tr></thead><tbody>';
  // Qué cajones usan como dato las órdenes que sí se ejecutan.
  const dato = new Set(), destino = new Set();
  for (const d of visitadas) { const w = prog.words[d], op = w >> 4; if (op === 8 || op === 9) dato.add(w & 7); if (op === 10) destino.add(w & 7); }
  prog.words.forEach((w, dir) => {
    let que, nota = '';
    if (visitadas.has(dir)) que = S.desensamblar(w);
    else if (destino.has(dir) && w === 0) que = 'se llena con STA'; 
    else if (dato.has(dir)) que = `dato ${w}`;
    else if (w === 0) { que = 'sin uso'; nota = ' <small>(no hace falta escribirlo)</small>'; }
    else { que = `${S.desensamblar(w)} <small>(no se ejecuta si el salto sale bien)</small>`; }
    const omitible = que === 'sin uso' || que === 'se llena con STA';
    h += `<tr${omitible ? ' class="omitible"' : ''}><td>${dir}</td><td class="mono">${bin8(w)}</td><td>${que.includes('<') ? que : esc(que)}${nota}</td><td>${omitible ? '—' : switches(dir, 3)}</td><td>${omitible ? '—' : switches(w, 8)}</td><td class="chk">${omitible ? '' : '☐'}</td></tr>`;
  });
  h += '</tbody></table>';
  h += '<h3>Después de cada pulso de PASO</h3><table class="traza"><thead><tr><th>☐</th><th>Pulso</th><th>Fase<br><small>(PH1 PH0)</small></th><th>Orden</th><th>BUS</th><th>A</th><th>IR</th><th>OUT</th><th>PC</th><th>V N C Z</th><th class="opc">B <small>(sin LED)</small></th></tr></thead><tbody>';
  filas.forEach((r, i) => {
    const ant = i ? filas[i - 1].texto : null;
    const celda = (col, extra = '') => `<td class="mono${extra}${ant && ant[col] !== r.texto[col] ? ' cambia' : ''}">${r.texto[col]}</td>`;
    const inicio = r.fase === 0 ? ' class="inst"' : '';
    h += `<tr${inicio}><td class="chk">☐</td><td>${i === 0 ? 'inicio' : i}</td><td>${r.texto.PH}</td><td class="orden">${esc(r.orden)}</td>` +
      celda('BUS') + celda('A') + celda('IR') + celda('OUT') + celda('PC') + celda('F') + celda('B', ' opc') + '</tr>';
  });
  h += '</tbody></table>';
  h += `<p class="final">☐ Terminó con OUT = <b class="mono">${bin8(prog.expect.OUT)}</b> y se detuvo (los pulsos siguientes ya no cambian nada).</p></section>`;
  return { html: h, pulsos: filas.length - 1, hlt: pulsosHastaHlt };
}

// ---------------------------------------------------------------- Documento
const css = `
@page { size: A4 landscape; margin: 10mm 10mm 12mm 10mm; }
* { box-sizing: border-box; }
body { font: 9pt/1.25 "DejaVu Sans", Arial, sans-serif; color: #111; margin: 0; }
h1 { font-size: 18pt; margin: 0 0 2mm; } h2 { font-size: 14pt; margin: 0 0 1mm; border-bottom: 2px solid #222; padding-bottom: 1mm; }
h3 { font-size: 9pt; margin: 2mm 0 0.8mm; text-transform: uppercase; letter-spacing: .4px; color: #333; }
.mono { font-family: "DejaVu Sans Mono", "Courier New", monospace; white-space: nowrap; }
.extra { font-size: 8pt; background: #ddd; border-radius: 3px; padding: 0 4px; vertical-align: 2pt; font-weight: normal; }
.programa { page-break-before: always; }
.meta { margin: 0.5mm 0 1mm; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 0.6pt solid #666; padding: 0.4mm 1.4mm; text-align: left; }
th { background: #e6e6e6; font-size: 8pt; }
th small { font-weight: normal; color: #444; }
table.traza td { padding: 0.3mm 1.3mm; vertical-align: middle; font-size: 8.5pt; }
table.traza td.mono, table.traza th { text-align: center; }
table.traza tr.inst td { border-top: 1.4pt solid #000; }
table.traza td.orden { font-weight: bold; white-space: nowrap; }
table.traza td.cambia { background: #d6d6d6; font-weight: bold; }
.opc { color: #666; background: #f5f5f5; } table.traza td.cambia.opc { background: #e2e2e2; }
td.chk, th.chk { text-align: center; width: 8mm; font-size: 11pt; }
thead { display: table-header-group; } tr { page-break-inside: avoid; }
table.carga td, table.carga th { font-size: 8pt; padding: 0.25mm 1.4mm; }
table.carga tr.omitible td { color: #777; }
.final { margin-top: 1.5mm; font-size: 9pt; }
.intro p, .intro li { margin: 0.8mm 0; } .intro ol { margin: 1mm 0 1mm 5mm; padding: 0; }
.caja { border: 1pt solid #444; border-radius: 2mm; padding: 1.5mm 3mm; margin: 2mm 0; }
.leyenda td { border: none; padding: 0.4mm 3mm 0.4mm 0; }
`;

const intro = `
<section class="intro">
<h1>Hoja de pruebas pulso a pulso</h1>
<p>Computadora de 8 bits. Para cada programa, esta hoja dice <b>qué deben mostrar los LEDs después de cada pulsación de PASO</b>. Marca cada casilla ☐ cuando lo que ves coincide. <b>En la primera fila que no coincida, detente</b>: ahí está el problema.</p>
<div class="caja"><b>Cómo se usa</b>
<ol>
<li>Con <b>PROG en 1</b>, escribe los cajones del programa (tabla «Carga previa»: dirección en el DIP de dirección, dato en el DIP de datos, y pulsa ESCRIBIR).</li>
<li>Pon <b>PROG en 0</b> y <b>AUTO en 0</b>. La computadora queda en la fila <b>inicio</b>: PC = 000 y fase T0.</li>
<li>Compara los LEDs con la fila «inicio» y marca. Luego da <b>un pulso</b> (pulsa PASO; si es un interruptor deslizante, pásalo a B y devuélvelo a A) y compara con la fila siguiente.</li>
<li>Cada orden dura 4 pulsos (T0, T1, T2, T3). La línea gruesa separa una orden de la siguiente.</li>
<li>Para repetir el programa sin volver a escribir la memoria: pulsa <b>RESET</b>. La memoria no se borra.</li>
</ol></div>
<table class="leyenda"><tr><td><b>Cómo leer las filas</b></td><td></td></tr>
<tr><td class="mono" style="background:#d6d6d6;font-weight:bold">0000 0011</td><td>Sombreado y en negrita: <b>cambió</b> respecto a la fila anterior. Es lo que debes ver cambiar al pulsar.</td></tr>
<tr><td class="mono">0000 ?1??</td><td><b>?</b> = ese bit arranca con un valor al azar (los chips encienden con lo que sea). No lo compares.</td></tr>
<tr><td class="mono">···· ····</td><td>Nadie maneja el bus en esa fase: los 8 LEDs del bus están <b>apagados</b>.</td></tr>
<tr><td>Orden de los LEDs</td><td>De izquierda a derecha, del bit 7 (vale 128) al bit 0 (vale 1). 1 = encendido, 0 = apagado. Banderas: V N C Z.</td></tr>
<tr><td>Columna B</td><td>El registro B <b>no tiene LEDs</b> en la protoboard: es opcional; compruébalo con la punta lógica o con el multímetro.</td></tr></table>
<h3>Dónde buscar si una fila no coincide</h3>
<table><thead><tr><th>Lo que no coincide</th><th>Qué revisar</th></tr></thead><tbody>
<tr><td>El <b>BUS</b> en la fase T1 no muestra la orden esperada</td><td>El cajón quedó mal escrito (repítelo con PROG en 1), o la dirección: MAR, selector 74LS157 y decodificador 74LS138 de lectura</td></tr>
<tr><td>El <b>IR</b> no cambia después del pulso de T1</td><td>La señal <span class="mono">nT1</span> en el pin 1 del IR, o el reloj <span class="mono">SYSCLK</span> en su pin 11</td></tr>
<tr><td>El <b>PC</b> no sube después de T1</td><td>74LS161 del PC: pines ENP y ENT (<span class="mono">T1</span>), CLK y /CLR</td></tr>
<tr><td>El <b>PC</b> no salta (JMP, JZ)</td><td><span class="mono">nPC_LOAD</span> (pin 9 del PC), IR0 a IR2 en los pines A, B y C, y la bandera Z</td></tr>
<tr><td><b>A</b> no cambia después de LDA, o queda con otro valor</td><td>Si el bus en T3 no muestra el dato: cajón del dato mal escrito, o MAR en T2. Si el bus es correcto: <span class="mono">nA_LD</span> o el registro A</td></tr>
<tr><td>El resultado de la <b>ALU</b> es incorrecto con el bus en orden</td><td>74LS283, los XOR de la resta, el 74LS151 de ese bit, o IR4 a IR6 hacia los 74LS151</td></tr>
<tr><td>Las <b>banderas</b> no coinciden</td><td>Registro de banderas 74LS377 (<span class="mono">nALU_OUT</span>), 74LS30 (cero) o la lógica de V</td></tr>
<tr><td><b>PH0 / PH1</b> no cuentan 00, 01, 10, 11</td><td>74LS161 de fases: CLK, /CLR (<span class="mono">nRST_TOTAL</span>) y ENP, ENT, /LOAD a +5 V</td></tr>
<tr><td>No se detiene en HLT</td><td>Flip-flop 74LS74 de HLT y la compuerta que une <span class="mono">CLKsrc</span> con <span class="mono">nHALTQ</span></td></tr>
</tbody></table>
<p style="margin-top:2mm"><b>Programas de esta hoja:</b> los 3 del PDF del proyecto (suma, operaciones lógicas y salto condicional), y 6 más como extra para probar resta, banderas, memoria, saltos y desplazamientos.</p>
<p style="font-size:8.5pt;color:#444">Los valores salen de ejecutar la computadora de referencia del simulador con los mismos chips y conexiones del plan. Es una simulación ideal: en la protoboard los chips tardan unos nanosegundos y los LEDs cargan las salidas, así que si un valor no coincide por poco, revisa primero cables y contactos.</p>
</section>`;

let cuerpo = intro;
const resumen = [];
for (const k of [...GRUPO_PDF, ...GRUPO_EXTRA]) {
  const r = programa(k, GRUPO_EXTRA.includes(k));
  cuerpo += r.html;
  resumen.push(`${k}: ${r.pulsos} filas, HLT en el pulso ${r.hlt}`);
}
const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Hoja de pruebas pulso a pulso</title><style>${css}</style></head><body>${cuerpo}</body></html>`;
fs.writeFileSync(path.join(raiz, 'hoja_pruebas.html'), html);
console.log('hoja_pruebas.html escrita.\n  ' + resumen.join('\n  '));
