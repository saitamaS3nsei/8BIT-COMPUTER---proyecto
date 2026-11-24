// Tipos de pieza, su huella en la protoboard y los contactos de los interruptores.
// Una pieza es { id, type, rol?, at | leads | pos, props }:
//   at = { board, col, flip }         piezas DIP que cruzan el canal central (chips, DIP switch)
//   at = { board, row, col, flip }    piezas en línea de 2 o 3 patas (pulsadores, interruptor, potenciómetro)
//   leads = { pin: claveDeAgujero }   piezas de 2 patas libres (LED, resistencia, condensador)
//   pos = { x, y }                    piezas fuera de la protoboard (fuente)
(function (G) {
  'use strict';
  const S = G.SIM8, geo = S.geo;
  const T = {};
  for (const [k, ch] of Object.entries(S.CHIPS)) {
    T[k] = { cat: 'dip', chip: true, nombre: ch.nombre, desc: ch.desc, n: ch.n, cols: ch.n / 2, nombres: ch.nombres };
  }
  const nombresDip = n => {
    const o = {};
    for (let i = 1; i <= n / 2; i++) { o[i] = `Interruptor ${i}, abajo`; o[n + 1 - i] = `Interruptor ${i}, arriba`; }
    return o;
  };
  T.dip8 = { cat: 'dip', nombre: 'DIP switch 8', desc: '8 interruptores. El interruptor i une el pin i con el pin 17 − i', n: 16, cols: 8, sw: 8, nombres: nombresDip(16) };
  T.dip4 = { cat: 'dip', nombre: 'DIP switch 4', desc: '4 interruptores. El interruptor i une el pin i con el pin 9 − i', n: 8, cols: 4, sw: 4, nombres: nombresDip(8) };
  T.slide = { cat: 'inline', nombre: 'Interruptor deslizante', desc: 'Conmutador de 3 patas. En 1 une el común (2) con la pata 1; en 0, con la pata 3', patas: 3, nombres: { 1: 'Pata 1 (lado 1)', 2: 'Común', 3: 'Pata 3 (lado 0)' } };
  T.btn2 = { cat: 'inline', nombre: 'Pulsador de 2 patas', desc: 'Une sus patas mientras está presionado', patas: 2, nombres: { 1: 'Pata 1', 2: 'Pata 2' } };
  T.btnspdt = { cat: 'inline', nombre: 'Pulsador conmutado (SPDT)', desc: 'Suelto: común con NC. Presionado: común con NA', patas: 3, nombres: { 1: 'NC (normalmente cerrado)', 2: 'Común', 3: 'NA (normalmente abierto)' } };
  T.pot = { cat: 'inline', nombre: 'Potenciómetro', desc: 'Resistencia variable. Entre 1 y 2: valor × posición', patas: 3, nombres: { 1: 'Extremo 1', 2: 'Cursor', 3: 'Extremo 3' } };
  T.led = { cat: 'leads', nombre: 'LED', desc: 'Enciende si el ánodo está en 1 y el cátodo en 0. Necesita una resistencia en serie', pines: ['a', 'k'], nombres: { a: 'Ánodo (+)', k: 'Cátodo (−)' } };
  T.res = { cat: 'leads', nombre: 'Resistencia', desc: 'Pull-up, pull-down o limitadora de corriente', pines: ['1', '2'], nombres: { 1: 'Pata 1', 2: 'Pata 2' } };
  T.cap = { cat: 'leads', nombre: 'Condensador', desc: 'De desacople o de temporización del 555', pines: ['1', '2'], nombres: { 1: 'Pata 1', 2: 'Pata 2' } };
  T.fuente = { cat: 'libre', nombre: 'Fuente de laboratorio', desc: 'Fuente regulada con límite de corriente', w: 180, h: 120, bornes: { '+': [130, 96], '-': [160, 96] }, nombres: { '+': 'Borne + (rojo)', '-': 'Borne − (negro)' } };
  S.TIPOS = T;

  S.esInterruptor = t => t === 'dip8' || t === 'dip4' || t === 'slide' || t === 'btn2' || t === 'btnspdt';
  S.esPulsador = t => t === 'btn2' || t === 'btnspdt';

  S.propsIniciales = function (tipo, extra = {}) {
    const t = T[tipo];
    let p = {};
    if (t.sw) p = { sw: Array(t.sw).fill(false) };
    else if (tipo === 'slide') p = { pos: 0 };
    else if (tipo === 'pot') p = { valor: 100000, pos: 1 };
    else if (tipo === 'led') p = { color: 'rojo' };
    else if (tipo === 'res') p = { valor: 330 };
    else if (tipo === 'cap') p = { valor: 1e-7 };
    else if (tipo === 'fuente') p = { on: true, volts: 5, limite: 2 };
    else if (S.esPulsador(tipo)) p = { mantener: false };
    return Object.assign(p, extra);
  };

  // Lista de { pin, clave } de cada pata de la pieza.
  S.huella = function (p) {
    const t = T[p.type];
    if (!t) return [];
    if (t.cat === 'dip') {
      const n = t.n, m = n / 2, { board, col, flip } = p.at, out = [];
      for (let i = 1; i <= m; i++) out.push({ pin: i, clave: flip ? geo.clave(board, 'e', col + m - i) : geo.clave(board, 'f', col + i - 1) });
      for (let k = 1; k <= m; k++) out.push({ pin: m + k, clave: flip ? geo.clave(board, 'f', col + k - 1) : geo.clave(board, 'e', col + m - k) });
      return out;
    }
    if (t.cat === 'inline') {
      const { board, row, col, flip } = p.at, n = t.patas, out = [];
      for (let i = 1; i <= n; i++) out.push({ pin: i, clave: geo.clave(board, row, col + (flip ? n - i : i - 1)) });
      return out;
    }
    if (t.cat === 'leads') return t.pines.map(pin => ({ pin, clave: p.leads[pin] }));
    if (t.cat === 'libre') return Object.keys(t.bornes).map(pin => ({ pin, clave: `${p.id}:${pin}`, borne: true }));
    return [];
  };

  // Pares de pines unidos por los contactos de un interruptor en este momento.
  S.contactos = function (p, rt) {
    const t = T[p.type];
    if (t.sw) return p.props.sw.map((on, i) => on ? [i + 1, t.n - i] : null).filter(Boolean);
    if (p.type === 'slide') return [p.props.pos ? [2, 1] : [2, 3]];
    if (p.type === 'btn2') return rt && rt.c ? [[1, 2]] : [];
    if (p.type === 'btnspdt') { const c = rt ? rt.c : 'nc'; return c === 'nc' ? [[2, 1]] : c === 'no' ? [[2, 3]] : []; }
    return [];
  };

  S.docVacio = () => ({ version: 1, boards: [], parts: [], wires: [], notes: [], secciones: [], next: 1 });
  S.nuevoId = (doc, pre) => `${pre}${doc.next++}`;

  S.docInicial = function () {
    const d = S.docVacio();
    d.boards.push({ id: 'b1', x: 0, y: 0, nombre: 'Protoboard 1' });
    d.next = 2;
    d.parts.push({ id: S.nuevoId(d, 'p'), type: 'fuente', rol: '1:FUENTE', pos: { x: -240, y: 40 }, props: S.propsIniciales('fuente', { on: false }) });
    return d;
  };

  S.tablero = (doc, id) => doc.boards.find(b => b.id === id);

  // Posición en el mundo de una clave de agujero o de borne.
  S.posClave = function (doc, clave) {
    const k = geo.leerClave(clave);
    if (!k) return null;
    if (k.agujero) {
      const b = S.tablero(doc, k.tablero);
      if (!b) return null;
      return { x: b.x + geo.colX(k.col), y: b.y + geo.FILA_Y[k.fila] };
    }
    const p = doc.parts.find(q => q.id === k.parte);
    if (!p || !T[p.type] || !T[p.type].bornes) return null;
    const [dx, dy] = T[p.type].bornes[k.pin] || [0, 0];
    return { x: p.pos.x + dx, y: p.pos.y + dy };
  };

  // Qué ocupa cada agujero: una sola pata o punta de cable por agujero, como en la protoboard real.
  S.ocupacion = function (doc) {
    const m = new Map();
    for (const p of doc.parts) for (const h of S.huella(p)) if (!h.borne && h.clave) m.set(h.clave, { tipo: 'pieza', id: p.id, pin: h.pin });
    for (const w of doc.wires) {
      for (const ext of ['a', 'b']) if (geo.leerClave(w[ext])?.agujero) m.set(w[ext], { tipo: 'cable', id: w.id, ext });
    }
    return m;
  };

  // Comprueba si una pieza (o su nueva posición) cabe: agujeros válidos y libres.
  S.validarHuella = function (doc, p, ocup, ignorar) {
    const huella = S.huella(p);
    const usadas = new Set();
    for (const h of huella) {
      if (h.borne) continue;
      const k = geo.leerClave(h.clave || '');
      if (!k || !k.agujero || !S.tablero(doc, k.tablero) || !geo.agujeroValido(k.fila, k.col)) return { ok: false, msg: 'Fuera de la protoboard' };
      if (usadas.has(h.clave)) return { ok: false, msg: 'Las dos patas en el mismo agujero' };
      usadas.add(h.clave);
      const o = ocup.get(h.clave);
      if (o && o.id !== ignorar) return { ok: false, msg: 'Agujero ocupado' };
    }
    const t = T[p.type];
    if (t.cat === 'dip' && p.at.col + t.cols - 1 > geo.COLS) return { ok: false, msg: 'Fuera de la protoboard' };
    if (t.cat === 'leads') {
      const k1 = geo.leerClave(p.leads[t.pines[0]]), k2 = geo.leerClave(p.leads[t.pines[1]]);
      if (k1 && k2 && k1.tablero === k2.tablero && geo.tira(k1.fila, k1.col) === geo.tira(k2.fila, k2.col)) return { ok: true, aviso: 'Las dos patas quedan en la misma tira: la pieza queda en corto' };
    }
    return { ok: true };
  };

  // Texto corto que identifica una pieza en listas y mensajes.
  S.nombrePieza = function (p) {
    const t = T[p.type];
    if (!t) return p.type;
    const r = p.rol && S.diseno && S.diseno.roles.get(p.rol);
    if (r) return r.nombre;
    if (p.type === 'res') return `Resistencia ${S.ohm(p.props.valor)}`;
    if (p.type === 'cap') return `Condensador ${S.faradio(p.props.valor)}`;
    if (p.type === 'led') return `LED ${p.props.color}`;
    return t.nombre;
  };
  S.nombrePin = function (p, pin) {
    const t = T[p.type];
    const n = t && t.nombres ? t.nombres[pin] : null;
    return n ? `pin ${pin} (${n})` : `pin ${pin}`;
  };
})(globalThis);
