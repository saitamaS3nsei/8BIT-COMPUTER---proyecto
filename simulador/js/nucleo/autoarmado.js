// Arma automáticamente los pasos 1 a N: coloca cada pieza en la protoboard y tira los cables.
// Sirve como solución de referencia y como prueba de extremo a extremo del simulador.
(function (G) {
  'use strict';
  const S = G.SIM8, geo = S.geo;

  const COLOR = {
    VCC: '#d9312b', GND: '#1e1e1e', BUS: '#e8c51e', RELOJ: '#f2f2f2', CONTROL: '#2f6fd6', DIR: '#16a085', DATO: '#3fae4a', OTRO: '#e67e22'
  };
  S.COLORES_CABLE = [
    ['#d9312b', 'Rojo'], ['#1e1e1e', 'Negro'], ['#e8c51e', 'Amarillo'], ['#2f6fd6', 'Azul'],
    ['#3fae4a', 'Verde'], ['#e67e22', 'Naranja'], ['#f2f2f2', 'Blanco'], ['#8e44ad', 'Morado']
  ];
  function colorSenal(s) {
    if (s === 'VCC') return COLOR.VCC;
    if (s === 'GND') return COLOR.GND;
    if (/^BUS\d$/.test(s)) return COLOR.BUS;
    if (/CLK|SYSCLK/.test(s)) return COLOR.RELOJ;
    if (/^(MAR|ADDR|PC|DIPA)\d|^MARD\d/.test(s)) return COLOR.DIR;
    if (/^(A|B|IR|OUT|MDR|RES|S|Bx|AND|OR|XOR|NOT|DIPD)\d$/.test(s)) return COLOR.DATO;
    if (/^n|^T\d|_|^PH|^(LDX|JZ|STA|HLT|ALUC|SUB|CARRY|C4A|Zn|Vn|Zf|Cf|Nf|Vf)$/.test(s)) return COLOR.CONTROL;
    return COLOR.OTRO;
  }
  S.colorSenal = colorSenal;

  // Grupo de un LED por su señal: 'BUS3' → grupo BUS, bit 3.
  function grupoLed(sig) {
    const f = { Vf: 3, Nf: 2, Cf: 1, Zf: 0 };
    if (sig in f) return { nombre: 'banderas V N C Z', orden: f[sig], etiqueta: sig[0] };
    const m = /^([A-Z]+)(\d)$/.exec(sig);
    if (m) return { nombre: m[1] === 'PH' ? 'fase' : m[1], orden: +m[2], etiqueta: sig };
    return { nombre: sig, orden: 0, etiqueta: sig };
  }
  S.VERSION_ARMADO = 2;

  S.autoArmar = function (hasta = 8) {
    const dis = S.diseno;
    const doc = S.docVacio();
    doc.secciones = [];
    doc.armado = S.VERSION_ARMADO;
    const nid = pre => S.nuevoId(doc, pre);
    const ocup = new Set();
    const tableros = [];
    let b = null, arriba = 1, abajo = 1;

    function nuevoTablero() {
      const i = tableros.length;
      b = { id: `b${i + 1}`, x: (i % 2) * 720, y: Math.floor(i / 2) * 270, nombre: `Protoboard ${i + 1}` };
      tableros.push(b); doc.boards.push(b);
      arriba = 2; abajo = 2;
      return b;
    }
    const ocupar = p => { for (const h of S.huella(p)) if (!h.borne) ocup.add(h.clave); };
    function colocarDip(tipo, rol, props) {
      const cols = S.TIPOS[tipo].cols;
      let ini = Math.max(arriba, abajo);
      if (!b || ini + cols - 1 > 62) { nuevoTablero(); ini = 2; }
      const p = { id: nid('p'), type: tipo, rol, at: { board: b.id, col: ini, flip: false }, props: S.propsIniciales(tipo, props) };
      doc.parts.push(p); ocupar(p);
      arriba = abajo = ini + cols + 1;
      return p;
    }
    function reservarMitad(cols) {
      if (cols > 61) throw new Error('Grupo demasiado ancho');
      let mitad = arriba <= abajo ? 'U' : 'L';
      let ini = mitad === 'U' ? arriba : abajo;
      if (ini + cols - 1 > 62) {
        mitad = mitad === 'U' ? 'L' : 'U'; ini = mitad === 'U' ? arriba : abajo;
        if (ini + cols - 1 > 62) { nuevoTablero(); mitad = 'U'; ini = 2; }
      }
      if (mitad === 'U') arriba = ini + cols + 1; else abajo = ini + cols + 1;
      return { mitad, ini, board: b.id };
    }
    function colocarLinea(tipo, rol, props) {
      const n = S.TIPOS[tipo].patas;
      const r = reservarMitad(n);
      const p = { id: nid('p'), type: tipo, rol, at: { board: r.board, row: r.mitad === 'U' ? 'c' : 'h', col: r.ini, flip: false }, props: S.propsIniciales(tipo, props) };
      doc.parts.push(p); ocupar(p);
      return p;
    }

    // Agujero libre de una tira, empezando por la fila más lejana del chip.
    function libreEnTira(board, tira) {
      const filas = tira[0] === 'U' ? ['a', 'b', 'c', 'd', 'e'] : ['j', 'i', 'h', 'g', 'f'];
      const col = +tira.slice(1);
      for (const f of filas) { const k = geo.clave(board, f, col); if (!ocup.has(k)) { ocup.add(k); return k; } }
      throw new Error(`Sin agujeros libres en ${board}/${tira}`);
    }
    function libreEnRiel(board, riel, cerca) {
      const cols = [...geo.COLS_RIEL].sort((x, y) => Math.abs(x - cerca) - Math.abs(y - cerca));
      for (const c of cols) { const k = geo.clave(board, riel, c); if (!ocup.has(k)) { ocup.add(k); return k; } }
      throw new Error(`Riel ${riel} lleno en ${board}`);
    }
    const tiraDe = clave => { const k = geo.leerClave(clave); return { board: k.tablero, tira: geo.tira(k.fila, k.col), col: k.col, mitad: geo.mitad(k.fila) }; };
    const clavePin = (p, pin) => S.huella(p).find(h => String(h.pin) === String(pin)).clave;
    const cable = (a, bb, color, extra = {}) => doc.wires.push(Object.assign({ id: nid('w'), a, b: bb, color }, extra));
    const rielDe = (mitad, pol) => (mitad === 'U' ? 'T' : 'B') + pol;
    function aRiel(t, pol, color, extra) {
      const a = libreEnTira(t.board, t.tira);
      cable(a, libreEnRiel(t.board, rielDe(t.mitad, pol), t.col), color, extra);
    }
    function pieza2(tipo, k1, k2, props) {
      const t = S.TIPOS[tipo];
      const p = { id: nid('p'), type: tipo, leads: { [t.pines[0]]: k1, [t.pines[1]]: k2 }, props: S.propsIniciales(tipo, props) };
      doc.parts.push(p);
      return p;
    }
    const resA = (t, pol, ohm) => pieza2('res', libreEnTira(t.board, t.tira), libreEnRiel(t.board, rielDe(t.mitad, pol), t.col), { valor: ohm });

    // ---------------------------------------------------------------- Colocación
    const fuente = { id: nid('p'), type: 'fuente', rol: '1:FUENTE', pos: { x: -250, y: 40 }, props: S.propsIniciales('fuente') };
    doc.parts.push(fuente);
    nuevoTablero();
    const extras = [];   // LEDs con la señal que muestran
    const pasoDe = new Map();
    for (let paso = 2; paso <= Math.min(hasta, 7); paso++) {
      const def = dis.pasos[paso - 1];
      if (paso > 2) { arriba += 1; abajo += 1; }
      const rolesChip = def.roles.filter(r => S.TIPOS[dis.roles.get(r).tipo].cat === 'dip');
      const rolesLinea = def.roles.filter(r => S.TIPOS[dis.roles.get(r).tipo].cat === 'inline');
      for (const rol of rolesChip) {
        const R = dis.roles.get(rol);
        const props = R.tipo === 'dip8' || R.tipo === 'dip4' ? {} : undefined;
        const p = colocarDip(R.tipo, rol, props);
        pasoDe.set(p.id, paso);
      }
      for (const rol of rolesLinea) {
        const R = dis.roles.get(rol);
        const props = rol === '2:PROG' ? { pos: 1 } : rol === '2:POT' ? { pos: 0.5 } : undefined;
        const p = colocarLinea(R.tipo, rol, props);
        pasoDe.set(p.id, paso);
      }
      // LEDs: cada registro en una sola fila, del bit más alto (izquierda) al más bajo (derecha),
      // para leer el número tal como se escribe.
      const grupos = new Map();
      for (const r of def.revisiones) {
        if (r.tipo !== 'led') continue;
        const g = grupoLed(r.sig);
        if (!grupos.has(g.nombre)) grupos.set(g.nombre, []);
        grupos.get(g.nombre).push(Object.assign({ sig: r.sig }, g));
      }
      for (const [nombre, lista] of grupos) {
        lista.sort((x, y) => y.orden - x.orden);
        const res = reservarMitad(lista.length * 2);
        const fila = res.mitad === 'U' ? 'b' : 'i';
        lista.forEach((x, i) => {
          const ka = geo.clave(res.board, fila, res.ini + 2 * i), kk = geo.clave(res.board, fila, res.ini + 2 * i + 1);
          ocup.add(ka); ocup.add(kk);
          const led = pieza2('led', ka, kk, { color: dis.colorLed(x.sig), etiqueta: x.etiqueta });
          pasoDe.set(led.id, paso);
          extras.push({ led, sig: x.sig });
        });
        doc.secciones.push({ board: res.board, col0: res.ini, col1: res.ini + lista.length * 2 - 1, lado: res.mitad === 'U' ? 'arriba' : 'abajo', texto: `LEDs ${nombre}`, paso, detalle: true });
      }
    }

    // ---------------------------------------------------------------- Cableado
    const colocadas = doc.parts.filter(p => p.rol && dis.roles.has(p.rol) && p.type !== 'fuente');
    const ordenTablero = new Map(tableros.map((t, i) => [t.id, i]));
    const puntos = new Map();
    const agregarPunto = (sig, clave, orden, paso) => {
      if (!puntos.has(sig)) puntos.set(sig, []);
      puntos.get(sig).push(Object.assign(tiraDe(clave), { orden, paso }));
    };
    for (const p of colocadas) {
      const R = dis.roles.get(p.rol);
      for (const [pin, sig] of Object.entries(R.nets)) agregarPunto(sig, clavePin(p, pin), 0, pasoDe.get(p.id));
    }
    for (const { led, sig } of extras) agregarPunto(sig, led.leads.a, 1, pasoDe.get(led.id));
    // Cables temporales de los pasos que aún no están armados.
    const temporales = [];
    if (hasta >= 2 && hasta < 7) temporales.push('HALT_D');
    if (hasta >= 5 && hasta < 7) temporales.push('MEM_RD');

    for (const [sig, lista] of puntos) {
      // Puntos repetidos en la misma tira ya están unidos por la protoboard.
      const unicos = [...new Map(lista.map(x => [`${x.board}/${x.tira}`, x])).values()];
      if (sig === 'VCC' || sig === 'GND') {
        for (const x of unicos) aRiel(x, sig === 'VCC' ? '+' : '-', colorSenal(sig), { sig, paso: x.paso, tipo: 'alim' });
        continue;
      }
      unicos.sort((x, y) => ordenTablero.get(x.board) - ordenTablero.get(y.board) || x.orden - y.orden || x.col - y.col);
      for (let i = 1; i < unicos.length; i++) cable(libreEnTira(unicos[i - 1].board, unicos[i - 1].tira), libreEnTira(unicos[i].board, unicos[i].tira), colorSenal(sig), { sig, paso: Math.max(unicos[i - 1].paso, unicos[i].paso), tipo: 'senal' });
      if (temporales.includes(sig)) aRiel(unicos[0], '-', COLOR.OTRO, { sig, paso: unicos[0].paso, tipo: 'senal', temporal: true });
    }
    // Entradas sin usar a GND.
    for (const p of colocadas) {
      const def = S.CHIPS[p.type];
      if (!def) continue;
      const nets = dis.roles.get(p.rol).nets;
      for (const pin of def.ent) if (nets[pin] === undefined) aRiel(tiraDe(clavePin(p, pin)), '-', COLOR.GND, { sig: 'GND', paso: pasoDe.get(p.id), tipo: 'alim', sinUso: true });
    }
    // Pasivos.
    const porRol = rol => colocadas.find(p => p.rol === rol);
    const tiraPin = (rol, pin) => tiraDe(clavePin(porRol(rol), pin));
    if (porRol('2:NE555')) {
      pieza2('res', libreEnTira(tiraPin('2:NE555', 7).board, tiraPin('2:NE555', 7).tira), libreEnRiel(tiraPin('2:NE555', 7).board, 'T+', tiraPin('2:NE555', 7).col), { valor: 1000 });
      pieza2('res', libreEnTira(tiraPin('2:NE555', 7).board, tiraPin('2:NE555', 7).tira), libreEnTira(tiraPin('2:POT', 1).board, tiraPin('2:POT', 1).tira), { valor: 1000 });
      const t2 = tiraPin('2:NE555', 2), t5 = tiraPin('2:NE555', 5);
      pieza2('cap', libreEnTira(t2.board, t2.tira), libreEnRiel(t2.board, rielDe(t2.mitad, '-'), t2.col), { valor: 1e-6 });
      pieza2('cap', libreEnTira(t5.board, t5.tira), libreEnRiel(t5.board, rielDe(t5.mitad, '-'), t5.col), { valor: 1e-8 });
    }
    for (const paso of dis.pasos) {
      if (paso.n > hasta) break;
      for (const r of paso.revisiones) {
        if (r.tipo !== 'res' || r.valor !== 10000) continue;
        const sigMiembro = r.a === 'VCC' || r.a === 'GND' ? r.b : r.a, pol = (r.a === 'VCC' || r.b === 'VCC') ? '+' : '-';
        const pt = (puntos.get(sigMiembro) || [])[0];
        if (pt) resA(pt, pol, 10000);
      }
    }
    for (const { led } of extras) {
      const t = tiraDe(led.leads.k);
      resA(t, '-', 330);
    }
    // Desacople: uno por chip con reloj o salida al bus, y uno cada dos chips de lógica (44 en total).
    let logica = 0;
    for (const p of colocadas) {
      if (!S.CHIPS[p.type]) continue;
      const fuerte = ['74161', '74377', '74374', '74245', '7474', 'ne555'].includes(p.type);
      if (!fuerte && (logica++ % 2)) continue;
      const col = p.at.col + 1;
      pieza2('cap', libreEnRiel(p.at.board, 'T+', col), libreEnRiel(p.at.board, 'T-', col), { valor: 1e-7 });
    }

    // Rieles: arriba con abajo en cada protoboard, cada protoboard con la siguiente y la primera con la fuente.
    // Todos llevan paso 1 (alimentación) y un número de orden para el cableado: primero la fuente, y luego,
    // protoboard por protoboard, el cable que viene de la anterior y el que une el riel de arriba con el de abajo.
    tableros.forEach((t, i) => {
      cable(libreEnRiel(t.id, 'T+', 1), libreEnRiel(t.id, 'B+', 1), COLOR.VCC, { sig: 'VCC', paso: 1, tipo: 'riel', ord: 10 + i * 10 + 2 });
      cable(libreEnRiel(t.id, 'T-', 1), libreEnRiel(t.id, 'B-', 1), COLOR.GND, { sig: 'GND', paso: 1, tipo: 'riel', ord: 10 + i * 10 + 3 });
    });
    for (let i = 1; i < tableros.length; i++) {
      const a = tableros[i - 1].id, c = tableros[i].id;
      cable(libreEnRiel(a, 'T+', 63), libreEnRiel(c, 'T+', 1), COLOR.VCC, { sig: 'VCC', paso: 1, tipo: 'riel', cadena: true, ord: 10 + i * 10 });
      cable(libreEnRiel(a, 'T-', 63), libreEnRiel(c, 'T-', 1), COLOR.GND, { sig: 'GND', paso: 1, tipo: 'riel', cadena: true, ord: 10 + i * 10 + 1 });
    }
    cable(`${fuente.id}:+`, libreEnRiel(tableros[0].id, 'T+', 1), COLOR.VCC, { sig: 'VCC', paso: 1, tipo: 'fuente', ord: 0 });
    cable(`${fuente.id}:-`, libreEnRiel(tableros[0].id, 'T-', 1), COLOR.GND, { sig: 'GND', paso: 1, tipo: 'fuente', ord: 1 });

    // Orden de cableado. Por módulo del plan; en cada módulo, primero la alimentación (de izquierda a derecha, protoboard
    // por protoboard) y luego las señales, con todos los cables de una misma señal seguidos.
    const idxTablero = k => { const x = geo.leerClave(k); return x && x.agujero ? ordenTablero.get(x.tablero) : -1; };
    const colDe = k => { const x = geo.leerClave(k); return x && x.agujero ? x.col : 0; };
    const grupo = { fuente: 0, riel: 0, alim: 1, senal: 2 };
    doc.ordenCables = [...doc.wires].sort((x, y) => (x.paso - y.paso) || (grupo[x.tipo] - grupo[y.tipo]) || (
      x.tipo === 'alim' ? (idxTablero(x.a) - idxTablero(y.a) || colDe(x.a) - colDe(y.a) || (x.sig < y.sig ? -1 : x.sig > y.sig ? 1 : 0)) :
      x.tipo === 'senal' ? x.sig.localeCompare(y.sig, 'en', { numeric: true }) : (x.ord - y.ord))).map(w => w.id);

    // Secciones: qué columnas de cada protoboard son de cada módulo.
    const rango = new Map();
    for (const p of doc.parts) {
      const paso = pasoDe.get(p.id);
      if (!paso) continue;
      for (const h of S.huella(p)) {
        const k = geo.leerClave(h.clave);
        if (!k || !k.agujero) continue;
        const id = `${k.tablero}|${paso}`;
        const r = rango.get(id) || { board: k.tablero, paso, col0: 99, col1: 0 };
        r.col0 = Math.min(r.col0, k.col); r.col1 = Math.max(r.col1, k.col);
        rango.set(id, r);
      }
    }
    const vistos = new Set();
    for (const t of tableros) {
      const aqui = [...rango.values()].filter(r => r.board === t.id).sort((a, b) => a.col0 - b.col0);
      for (const r of aqui) {
        const titulo = dis.pasos[r.paso - 1].titulo;
        doc.secciones.push({ board: t.id, col0: r.col0, col1: r.col1, lado: 'modulo', paso: r.paso, texto: `Paso ${r.paso} · ${titulo}${vistos.has(r.paso) ? ' (continúa)' : ''}` });
        vistos.add(r.paso);
      }
      const titulos = [...new Set(aqui.map(r => dis.pasos[r.paso - 1].titulo))];
      const n = tableros.indexOf(t) + 1;
      t.nombre = `Protoboard ${n}` + (titulos.length ? ` · ${titulos.join(' + ')}` : n === 1 ? ' · Alimentación' : '');
    }
    return doc;
  };
})(globalThis);
